import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { subscribeToRealtimeNotificationChanges } from '../services/notificationService';

interface NotificationContextType {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  setUnreadCount: () => {},
  refreshUnreadCount: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string | undefined;
}) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const { data: rpcCount, error: rpcError } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: userId,
      });
      if (!rpcError && typeof rpcCount === 'number') {
        setUnreadCount(rpcCount);
        return;
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    } catch (e) {
      console.warn('[NotificationProvider] Failed to fetch unread count:', e);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    refreshUnreadCount();

    const unsubscribe = subscribeToRealtimeNotificationChanges(userId, () => {
      void refreshUnreadCount();
    });

    return () => {
      unsubscribe();
    };
  }, [userId, refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, setUnreadCount, refreshUnreadCount }),
    [unreadCount, refreshUnreadCount]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

