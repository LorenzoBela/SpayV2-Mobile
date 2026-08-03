import { describe, expect, it, beforeEach, vi } from 'vitest';
import { offlineQueue, OfflineQueueManager, QueuedMutation } from '../offlineQueue';

describe('Offline Mutation Queue Module', () => {
  let queueInstance: OfflineQueueManager;

  beforeEach(async () => {
    queueInstance = new OfflineQueueManager();
    await queueInstance.clearQueue();
  });

  describe('Enqueue & Storage Persistence', () => {
    it('enqueues a new mutation with generated idempotency key and default retry count', async () => {
      const item = await queueInstance.enqueue({
        url: 'https://api.spay.com/v1/orders',
        method: 'POST',
        body: { amount: 500, currency: 'PHP' },
      });

      expect(item).toBeDefined();
      expect(item.id).toMatch(/^queue_/);
      expect(item.url).toBe('https://api.spay.com/v1/orders');
      expect(item.method).toBe('POST');
      expect(item.idempotencyKey).toBeDefined();
      expect(item.retryCount).toBe(0);
      expect(item.maxRetries).toBe(5);

      const queue = await queueInstance.getQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe(item.id);
    });

    it('preserves an existing idempotency key when provided', async () => {
      const customKey = 'pre-existing-idempotency-key-777';
      const item = await queueInstance.enqueue({
        url: 'https://api.spay.com/v1/transfers',
        method: 'PUT',
        idempotencyKey: customKey,
      });

      expect(item.idempotencyKey).toBe(customKey);
    });

    it('returns synchronous queue items via getQueueSync', async () => {
      await queueInstance.enqueue({
        url: 'https://api.spay.com/v1/user/settings',
        method: 'PATCH',
        body: { theme: 'dark' },
      });

      const syncQueue = queueInstance.getQueueSync();
      expect(syncQueue.length).toBe(1);
      expect(syncQueue[0].method).toBe('PATCH');
    });
  });

  describe('Dequeue & Clear Queue', () => {
    it('dequeues an item by ID', async () => {
      const item1 = await queueInstance.enqueue({ url: '/url1', method: 'POST' });
      const item2 = await queueInstance.enqueue({ url: '/url2', method: 'POST' });

      expect((await queueInstance.getQueue()).length).toBe(2);

      const removed = await queueInstance.dequeue(item1.id);
      expect(removed).toBe(true);

      const remaining = await queueInstance.getQueue();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(item2.id);
    });

    it('clears all items in the queue', async () => {
      await queueInstance.enqueue({ url: '/url1', method: 'POST' });
      await queueInstance.enqueue({ url: '/url2', method: 'POST' });

      await queueInstance.clearQueue();
      expect((await queueInstance.getQueue()).length).toBe(0);
    });
  });

  describe('flushQueue Execution Flow', () => {
    it('processes queued mutations sequentially in FIFO order using custom executor', async () => {
      const item1 = await queueInstance.enqueue({ url: '/action1', method: 'POST' });
      const item2 = await queueInstance.enqueue({ url: '/action2', method: 'PUT' });

      const executedIds: string[] = [];
      const mockExecutor = vi.fn(async (item: QueuedMutation) => {
        executedIds.push(item.id);
        return { success: true };
      });

      const result = await queueInstance.flushQueue(mockExecutor);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
      expect(executedIds).toEqual([item1.id, item2.id]);
      expect((await queueInstance.getQueue()).length).toBe(0);
    });

    it('increments retryCount on failure and retains item if below maxRetries', async () => {
      const item = await queueInstance.enqueue({
        url: '/flaky-endpoint',
        method: 'POST',
        maxRetries: 3,
      });

      const failingExecutor = vi.fn(async () => {
        throw new Error('Network timeout');
      });

      const result = await queueInstance.flushQueue(failingExecutor);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);

      const queue = await queueInstance.getQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe(item.id);
      expect(queue[0].retryCount).toBe(1);
    });

    it('dequeues item when retryCount reaches maxRetries', async () => {
      const item = await queueInstance.enqueue({
        url: '/dead-endpoint',
        method: 'POST',
        maxRetries: 1,
      });

      const failingExecutor = vi.fn(async () => {
        throw new Error('Permanent 500 server error');
      });

      const result = await queueInstance.flushQueue(failingExecutor);

      expect(result.failed).toBe(1);
      expect(result.remaining).toBe(0);
      expect((await queueInstance.getQueue()).length).toBe(0);
    });
  });

  describe('Status Subscription & Offline State', () => {
    it('notifies status subscribers on queue changes', async () => {
      const statusHistory: number[] = [];
      const unsubscribe = queueInstance.subscribeStatus((status) => {
        statusHistory.push(status.pendingCount);
      });

      await queueInstance.enqueue({ url: '/test1', method: 'POST' });
      await queueInstance.enqueue({ url: '/test2', method: 'POST' });
      await queueInstance.clearQueue();

      unsubscribe();

      expect(statusHistory.length).toBeGreaterThanOrEqual(3);
      expect(statusHistory[statusHistory.length - 1]).toBe(0);
    });
  });
});
