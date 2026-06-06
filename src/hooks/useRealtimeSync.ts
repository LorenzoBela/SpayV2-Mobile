import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';

/**
 * Custom hook that subscribes to realtime changes in specified Supabase tables.
 * When changes occur (INSERT, UPDATE, DELETE), the callback is triggered.
 * Changes are debounced by 300ms to group rapid succession events (e.g. bulk inserts).
 */
export function useRealtimeSync(tables: string[], onSync: () => void) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    if (tables.length === 0) return;

    // Generate a unique channel identifier to avoid collision
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const channelName = `realtime-sync-${tables.join('-')}-${uniqueId}`;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onSyncRef.current();
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
  }, [tables.join(',')]); // Re-subscribe if the table list changes
}
