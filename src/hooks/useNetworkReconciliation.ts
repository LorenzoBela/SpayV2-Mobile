import { useEffect } from 'react';
import { queryClient } from '../utils/queryClient';
import { initNetworkMonitor, subscribeReconnect } from '../utils/networkResilience';
import { syncWidgetData } from '../utils/widgetSync';

const RECONNECT_QUERY_KEYS = new Set([
  'admin-dashboard',
  'admin-clients',
  'admin-orders',
  'admin-payments',
  'admin-reminders',
  'admin-reports',
  'shared-credit-limits',
  'dashboard',
  'orders',
  'notifications',
  'unreadCount',
  'budget',
]);

/**
 * Connects the shared NetInfo monitor to TanStack Query and triggers
 * background query invalidation when transitioning from offline to online.
 */
export function useNetworkReconciliation() {
  useEffect(() => {
    const stopMonitor = initNetworkMonitor();
    const unsubscribeReconnect = subscribeReconnect(() => {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            Array.isArray(queryKey) &&
            queryKey.some((part) => typeof part === 'string' && RECONNECT_QUERY_KEYS.has(part))
          );
        },
      });
      void syncWidgetData(true);
    });

    return () => {
      unsubscribeReconnect();
      stopMonitor();
    };
  }, []);
}
