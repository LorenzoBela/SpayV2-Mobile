import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
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

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};
