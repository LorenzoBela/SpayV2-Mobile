import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
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
        // tRPC keys are path tuples, not legacy ['client-orders'] aliases.
        queryClient.invalidateQueries({ predicate: query => {
          const path = query.queryKey[0];
          return Array.isArray(path) && ['orders', 'payments', 'dashboard', 'admin', 'expenses'].includes(String(path[0]));
        } });
        
        if (onSyncRef.current) {
          onSyncRef.current();
        }

        void syncWidgetData();
      }, 300);
    };

    const subscribedTables = [...new Set(tables.some(table => table === 'orders' || table === 'payments')
      ? [...tables, 'order_participants', 'order_participant_payments'] : tables)];

    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let isDisposed = false;

    const subscribeChannel = () => {
      if (isDisposed || activeChannel) return;
      const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const name = `realtime-sync-${tablesKey}-${suffix}`;
      const ch = supabase.channel(name);
      subscribedTables.forEach((table) => {
        ch.on(
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
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[useRealtimeSync] Channel ${name} successfully subscribed.`);
        } else if (status === 'CLOSED') {
          console.log(`[useRealtimeSync] Channel ${name} subscription closed.`);
        } else if (status === 'CHANNEL_ERROR') {
          console.warn(`[useRealtimeSync] Channel ${name} subscription error. Check if Realtime is enabled in Supabase!`);
        }
      });
      activeChannel = ch;
    };

    const unsubscribeChannel = () => {
      if (!activeChannel) return;
      const ch = activeChannel;
      activeChannel = null;
      void supabase.removeChannel(ch);
    };

    if (AppState.currentState === 'active') {
      subscribeChannel();
    }

    let wasBackgrounded = AppState.currentState === 'background';
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        if (wasBackgrounded) {
          wasBackgrounded = false;
          subscribeChannel();
          triggerSync();
        }
      } else if (nextState === 'background') {
        wasBackgrounded = true;
        unsubscribeChannel();
      }
    });

    const fallbackRefresh = tables.some(table => table === 'orders' || table === 'payments') ? setInterval(() => {
      if (AppState.currentState === 'active') triggerSync();
    }, 60000) : null;

    return () => {
      isDisposed = true;
      appStateSub.remove();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (fallbackRefresh !== null) clearInterval(fallbackRefresh);
      unsubscribeChannel();
    };
  }, [tablesKey, queryClient]);
}
