import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { syncWidgetData } from '../utils/widgetSync';

/**
 * Custom hook that subscribes to realtime changes in specified Supabase tables.
 * When changes occur (INSERT, UPDATE, DELETE), the callback is triggered or specific query keys are invalidated.
 * Changes are debounced by 300ms to group rapid succession events (e.g. bulk inserts).
 * Automatically invalidates all active queries when transitioning from offline to online.
 */
export function useRealtimeSync(
  tables: string[], 
  onSync?: () => void,
  queryKeysToInvalidate?: any[][]
) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const queryClient = useQueryClient();

  // Handle offline -> online transition
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Invalidate all active queries when transitioning from offline back to online
      // We check if it's connected and internet is reachable (if known)
      if (state.isConnected && state.isInternetReachable !== false) {
        console.log('[useRealtimeSync] Network status is ONLINE. Invalidating all active queries to ensure data consistency.');
        queryClient.invalidateQueries();
        void syncWidgetData();
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    if (tables.length === 0) return;

    // Generate a unique channel identifier to avoid collision
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const channelName = `realtime-sync-${tables.join('-')}-${uniqueId}`;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Targeted invalidation if query keys are provided
        if (queryKeysToInvalidate && queryKeysToInvalidate.length > 0) {
          queryKeysToInvalidate.forEach((key) => {
            console.log(`[useRealtimeSync] Targeted invalidation for query key: ${JSON.stringify(key)}`);
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
        
        // Execute legacy/custom callback if provided
        if (onSyncRef.current) {
          onSyncRef.current();
        }

        // Sync home screen widgets with updated data
        void syncWidgetData();
      }, 300);
    };

    console.log(`[useRealtimeSync] Subscribing to changes on [${tables.join(', ')}] under channel: ${channelName}`);
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log(`[useRealtimeSync] Database change detected on table: ${table}. Event type: ${payload.eventType}`);
          triggerSync();
        }
      );
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[useRealtimeSync] Channel ${channelName} successfully subscribed.`);
      } else if (status === 'CLOSED') {
        console.log(`[useRealtimeSync] Channel ${channelName} subscription closed.`);
      } else if (status === 'CHANNEL_ERROR') {
        console.warn(`[useRealtimeSync] Channel ${channelName} subscription error. Check if Realtime is enabled in Supabase!`);
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      console.log(`[useRealtimeSync] Cleaning up subscription for channel: ${channelName}`);
      void supabase.removeChannel(channel);
    };
  }, [tables.join(','), JSON.stringify(queryKeysToInvalidate), queryClient]); // Re-subscribe if the table list or keys change
}
