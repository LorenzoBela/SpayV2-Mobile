import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { queryClient } from '../utils/queryClient';

/**
 * Connects NetInfo to TanStack Query onlineManager and triggers
 * intelligent background query invalidation when moving from dead zones to 4G/5G/WiFi.
 */
export function useNetworkReconciliation() {
  const wasOffline = useRef(false);

  useEffect(() => {
    // 1. Sync React Native NetInfo with TanStack Query's onlineManager
    onlineManager.setEventListener((setOnline) => {
      return NetInfo.addEventListener((state) => {
        const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
        setOnline(isOnline);
      });
    });

    // 2. Listen to network state transitions for automatic re-sync
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);

      if (!isOnline) {
        wasOffline.current = true;
      } else if (wasOffline.current && isOnline) {
        wasOffline.current = false;
        
        // Re-focus and invalidate queries on connection recovery
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            // Refetch essential fintech queries on reconnect
            return (
              Array.isArray(queryKey) &&
              (queryKey.includes('dashboard') ||
                queryKey.includes('notifications') ||
                queryKey.includes('unreadCount') ||
                queryKey.includes('orders') ||
                queryKey.includes('budget'))
            );
          },
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
