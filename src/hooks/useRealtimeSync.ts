import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { syncWidgetData } from '../utils/widgetSync';

/**
 * Custom hook that subscribes to realtime changes in specified Supabase tables.
 * When changes occur (INSERT, UPDATE, DELETE), the callback is triggered or specific query keys are invalidated.
 * Changes are debounced by 300ms to group rapid succession events (e.g. bulk inserts).
 * Automatically invalidates all active queries ONLY when transitioning from offline to online.
 */
export function useRealtimeSync(
  tables: string[], 
  onSync?: () => void,
  queryKeysToInvalidate?: any[][]
) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const queryKeysRef = useRef(queryKeysToInvalidate);
  queryKeysRef.current = queryKeysToInvalidate;

  const queryClient = useQueryClient();
  const wasOfflineRef = useRef(false);

  // Handle actual offline -> online state transition only
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (!isOnline) {
        wasOfflineRef.current = true;
      } else if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        console.log('[useRealtimeSync] Transitioned offline -> online. Invalidating active queries.');
        queryClient.invalidateQueries({ type: 'active' });
        void syncWidgetData();
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  const tablesKey = tables.join(',');

  useEffect(() => {
    if (!tablesKey) return;

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const channelName = `realtime-sync-${tablesKey}-${uniqueId}`;

    let debounceTimer: any = null;
    const triggerSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (queryKeysRef.current && queryKeysRef.current.length > 0) {
          queryKeysRef.current.forEach((key) => {
            console.log(`[useRealtimeSync] Targeted invalidation for query key: ${JSON.stringify(key)}`);
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
        
        if (onSyncRef.current) {
          onSyncRef.current();
        }

        void syncWidgetData();
      }, 300);
    };

    console.log(`[useRealtimeSync] Subscribing to changes on [${tablesKey}] under channel: ${channelName}`);
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
  }, [tablesKey, queryClient]);
}
