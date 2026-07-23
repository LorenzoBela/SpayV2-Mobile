import { InteractionManager } from 'react-native';

const prefetchedKeys = new Set<string>();

/**
 * Lightweight, non-blocking background pre-fetcher for Mobile.
 * Executes ONLY when the JS thread is 100% idle (after all touch/gesture animations finish).
 */
export function runIdlePrefetch(key: string, prefetchFn: () => Promise<any> | void, ttlMs: number = 1000 * 60 * 15) {
  if (prefetchedKeys.has(key)) return;

  // Mark key as prefetched to prevent repeated background hits
  prefetchedKeys.add(key);

  // Clear key after TTL to allow periodic background updates
  setTimeout(() => {
    prefetchedKeys.delete(key);
  }, ttlMs);

  // Defer execution until all active screen transitions and touch gestures complete
  InteractionManager.runAfterInteractions(() => {
    try {
      prefetchFn();
    } catch (err) {
      console.warn(`[IdlePrefetch] Deferred task (${key}) failed gracefully:`, err);
    }
  });
}
