import { storage } from '../utils/queryPersister';
import { createNotificationRuntimeState, type PendingNotificationAction } from './notificationRuntimeState';

// The existing encrypted app storage is reused; no native dependency/config change.
const fallback = new Map<string, string>();
const removed = new Set<string>();
export const notificationRuntime = createNotificationRuntimeState({
  getString(key) { if (removed.has(key)) return undefined; if (fallback.has(key)) return fallback.get(key); try { return storage.getString(key); } catch { return undefined; } },
  set(key, value) { removed.delete(key); fallback.set(key, value); try { storage.set(key, value); } catch { /* memory-only until storage recovers */ } },
  remove(key) { removed.add(key); fallback.delete(key); try { storage.remove(key); } catch { /* tombstone blocks stale account data in this process */ } },
});

const pendingListeners = new Set<() => void>();
export function queueNotificationAction(data: Record<string, unknown>, action: PendingNotificationAction['action'] = 'open') {
  const safe: Record<string, string> = {};
  for (const key of ['notificationId', 'schemaVersion', 'recipientUserId', 'targetUserId', 'screen', 'type', 'orderId', 'paymentId']) {
    if (typeof data[key] === 'string' || typeof data[key] === 'number') safe[key] = String(data[key]);
  }
  if (!notificationRuntime.queue({ notificationId: safe.notificationId, action, data: safe, createdAt: Date.now() })) return;
  for (const listener of pendingListeners) listener();
}
export function subscribeToPendingNotificationAction(listener: () => void) {
  pendingListeners.add(listener);
  return () => { pendingListeners.delete(listener); };
}

const presenting = new Set<string>();
export async function presentNotificationOnce(id: string, display: () => Promise<void>) {
  if (!id || notificationRuntime.displayed(id) || presenting.has(id)) return false;
  presenting.add(id);
  // Checkpoint before native handoff. A process death leaves an unknown outcome, not an automatic duplicate replay.
  notificationRuntime.recordDisplayed(id);
  try { await display(); return true; }
  finally { presenting.delete(id); }
}
