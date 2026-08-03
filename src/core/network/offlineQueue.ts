import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { storage } from '../../utils/queryPersister';
import { attachIdempotencyKey, generateIdempotencyKey } from './idempotencyInterceptor';

export type HttpMutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface QueuedMutation {
  id: string;
  url: string;
  method: HttpMutationMethod;
  body?: any;
  headers?: Record<string, string>;
  idempotencyKey: string;
  createdAt: number;
  retryCount: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export interface QueueStatus {
  pendingCount: number;
  isSyncing: boolean;
  isOffline: boolean;
  lastSyncedAt?: number;
}

export type MutationExecutor = (item: QueuedMutation) => Promise<any>;

const QUEUE_STORAGE_KEY = 'SPAY_OFFLINE_MUTATION_QUEUE';
const DEFAULT_MAX_RETRIES = 5;

export class OfflineQueueManager {
  private queue: QueuedMutation[] = [];
  private isSyncing = false;
  private isOffline = false;
  private lastSyncedAt?: number;
  private listeners: Set<(status: QueueStatus) => void> = new Set();
  private netInfoUnsubscribe?: () => void;
  private inMemoryFallback: QueuedMutation[] = [];
  private isInitialized = false;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Loads saved queue from MMKV / Storage into memory cache.
   */
  public loadFromStorage(): QueuedMutation[] {
    try {
      const raw = storage.getString ? storage.getString(QUEUE_STORAGE_KEY) : null;
      if (raw) {
        this.queue = JSON.parse(raw);
      } else {
        this.queue = [...this.inMemoryFallback];
      }
    } catch {
      this.queue = [...this.inMemoryFallback];
    }
    this.isInitialized = true;
    return this.queue;
  }

  /**
   * Persists current memory queue to MMKV / Storage.
   */
  private saveToStorage(): void {
    try {
      this.inMemoryFallback = [...this.queue];
      if (storage.set) {
        storage.set(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      }
    } catch (e) {
      console.warn('[OfflineQueue] Failed to persist queue to storage:', e);
      this.inMemoryFallback = [...this.queue];
    }
    this.notifyListeners();
  }

  /**
   * Adds a mutation request to the offline queue.
   * Generates or preserves idempotency key.
   */
  public async enqueue(
    mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retryCount' | 'idempotencyKey'> & {
      idempotencyKey?: string;
    }
  ): Promise<QueuedMutation> {
    if (!this.isInitialized) {
      this.loadFromStorage();
    }

    const { headers, idempotencyKey } = attachIdempotencyKey(
      mutation.headers,
      mutation.idempotencyKey
    );

    const queuedItem: QueuedMutation = {
      id: `queue_${Date.now()}_${generateIdempotencyKey().slice(0, 8)}`,
      url: mutation.url,
      method: mutation.method,
      body: mutation.body,
      headers,
      idempotencyKey,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: mutation.maxRetries ?? DEFAULT_MAX_RETRIES,
      metadata: mutation.metadata,
    };

    this.queue.push(queuedItem);
    this.saveToStorage();
    return queuedItem;
  }

  /**
   * Removes a specific item from the queue by ID.
   */
  public async dequeue(id: string): Promise<boolean> {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((item) => item.id !== id);
    if (this.queue.length !== initialLength) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Returns a copy of all pending queued mutations.
   */
  public async getQueue(): Promise<QueuedMutation[]> {
    if (!this.isInitialized) {
      this.loadFromStorage();
    }
    return [...this.queue];
  }

  /**
   * Synchronous getter for pending queue items.
   */
  public getQueueSync(): QueuedMutation[] {
    if (!this.isInitialized) {
      this.loadFromStorage();
    }
    return [...this.queue];
  }

  /**
   * Clears all items in the queue.
   */
  public async clearQueue(): Promise<void> {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Returns current status snapshot.
   */
  public getStatus(): QueueStatus {
    return {
      pendingCount: this.queue.length,
      isSyncing: this.isSyncing,
      isOffline: this.isOffline,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  /**
   * Subscribes a listener to queue status updates.
   */
  public subscribeStatus(listener: (status: QueueStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  /**
   * Updates offline state flag.
   */
  public setOfflineState(offline: boolean): void {
    this.isOffline = offline;
    this.notifyListeners();
  }

  /**
   * Default mutation executor using standard fetch.
   */
  private async defaultExecutor(item: QueuedMutation): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...item.headers,
      'X-Idempotency-Key': item.idempotencyKey,
    };

    const res = await fetch(item.url, {
      method: item.method,
      headers,
      body: item.body ? JSON.stringify(item.body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }

    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Flushes all queued mutations sequentially in FIFO order.
   */
  public async flushQueue(
    executor?: MutationExecutor
  ): Promise<{ success: number; failed: number; remaining: number }> {
    if (this.isSyncing || this.queue.length === 0) {
      return { success: 0, failed: 0, remaining: this.queue.length };
    }

    this.isSyncing = true;
    this.notifyListeners();

    let success = 0;
    let failed = 0;
    const exec = executor || this.defaultExecutor.bind(this);

    // Process FIFO copy of current items
    const itemsToProcess = [...this.queue];

    for (const item of itemsToProcess) {
      try {
        await exec(item);
        // Successful execution - remove from queue
        await this.dequeue(item.id);
        success++;
      } catch (err: any) {
        failed++;
        item.retryCount += 1;

        const maxRetries = item.maxRetries ?? DEFAULT_MAX_RETRIES;
        if (item.retryCount >= maxRetries) {
          console.warn(`[OfflineQueue] Item ${item.id} reached max retries (${maxRetries}). Dequeuing.`);
          await this.dequeue(item.id);
        } else {
          // Update item in queue with incremented retry count
          const idx = this.queue.findIndex((q) => q.id === item.id);
          if (idx !== -1) {
            this.queue[idx] = { ...item };
            this.saveToStorage();
          }
          // Stop sequential flush on connection failure to avoid rapid retries when offline
          break;
        }
      }
    }

    this.isSyncing = false;
    this.lastSyncedAt = Date.now();
    this.notifyListeners();

    return { success, failed, remaining: this.queue.length };
  }

  /**
   * Starts listening to NetInfo status.
   * Auto-flushes when connection is restored (offline -> online transition).
   */
  public initAutoFlush(executor?: MutationExecutor): () => void {
    if (this.netInfoUnsubscribe) {
      return this.netInfoUnsubscribe;
    }

    let wasOffline = false;

    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      this.setOfflineState(!isConnected);

      if (!isConnected) {
        wasOffline = true;
      } else if (wasOffline || this.queue.length > 0) {
        wasOffline = false;
        console.log('[OfflineQueue] NetInfo reconnected. Triggering auto-flush of queued mutations...');
        void this.flushQueue(executor);
      }
    });

    return () => {
      if (this.netInfoUnsubscribe) {
        this.netInfoUnsubscribe();
        this.netInfoUnsubscribe = undefined;
      }
    };
  }
}

export const offlineQueue = new OfflineQueueManager();
