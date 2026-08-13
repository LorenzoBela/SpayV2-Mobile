import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

export type DynamicIslandNotificationType =
  | 'payment'
  | 'overdue_alert'
  | 'payment_success'
  | 'order_assigned'
  | 'sync'
  | 'shared_payment'
  | 'payment_streak'
  | 'debt_free'
  | 'noot_savings'
  | 'limit_increase'
  | 'low_balance'
  | 'zero_interest'
  | 'biometric_auth'
  | 'offline_queue'
  | 'ota_update'
  | 'admin_impersonation'
  | 'admin_client_payment'
  | 'admin_risk_alert'
  | 'admin_reminder_sent'
  | 'promo_ad';

export interface DynamicIslandNotificationPayload {
  id: string;
  type: DynamicIslandNotificationType;
  title: string;
  subtitle?: string;
  amount?: string;
  compactText?: string;
  compactBadge?: string;
  detailLeft?: string;
  detailRight?: string;
  actionText?: string;
  avatarUrl?: string;
  onAction?: () => void;
  hasProgress?: boolean;
  progressPct?: number;
  durationMs?: number;
  isDualEvent?: boolean;
}

interface DynamicIslandContextType {
  activeNotification: DynamicIslandNotificationPayload | null;
  secondaryNotification: DynamicIslandNotificationPayload | null;
  isExpanded: boolean;
  lastOnlineAt: string | null;
  missedCount: number;
  userName: string;
  userAvatarUrl: string;
  triggerIsland: (payload: DynamicIslandNotificationPayload) => void;
  dismissIsland: () => void;
  toggleExpand: () => void;
  setSecondaryEvent: (payload: DynamicIslandNotificationPayload | null) => void;
  checkMissedNotifications: () => Promise<void>;
}

const DynamicIslandContext = createContext<DynamicIslandContextType>({
  activeNotification: null,
  secondaryNotification: null,
  isExpanded: false,
  lastOnlineAt: null,
  missedCount: 0,
  userName: '',
  userAvatarUrl: '',
  triggerIsland: () => {},
  dismissIsland: () => {},
  toggleExpand: () => {},
  setSecondaryEvent: () => {},
  checkMissedNotifications: async () => {},
});

export const useDynamicIsland = () => useContext(DynamicIslandContext);

export function extractFirstName(rawName?: string, email?: string): string {
  if (rawName && typeof rawName === 'string') {
    const cleaned = rawName.replace(/^(admin|client|user)\s+/i, '').trim();
    const firstWord = cleaned.split(' ')[0];
    if (firstWord && firstWord.length > 1) {
      return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
    }
  }
  if (email && typeof email === 'string') {
    const prefix = email.split('@')[0].replace(/^(admin|client|user)[._-]?/i, '');
    const firstWord = prefix.split(/[._-]/)[0];
    if (firstWord && firstWord.length > 1) {
      return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
    }
  }
  return 'Lorenzo';
}

export const DynamicIslandProvider: React.FC<{
  children: React.ReactNode;
  userId?: string;
  userRole?: string;
  activeRole?: string | null;
  sessionExists?: boolean;
}> = ({
  children,
  userId: propUserId,
  userRole = 'CLIENT',
  activeRole,
  sessionExists = false,
}) => {
  const [activeNotification, setActiveNotification] = useState<DynamicIslandNotificationPayload | null>(null);
  const [secondaryNotification, setSecondaryNotification] = useState<DynamicIslandNotificationPayload | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(propUserId);
  const [userName, setUserName] = useState<string>('');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>('');
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
  const [missedCount, setMissedCount] = useState<number>(0);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownGreetingRef = useRef<boolean>(false);

  const clearTimer = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const dismissIsland = useCallback(() => {
    clearTimer();
    setActiveNotification(null);
    setSecondaryNotification(null);
    setIsExpanded(false);
  }, []);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const setSecondaryEvent = useCallback((payload: DynamicIslandNotificationPayload | null) => {
    setSecondaryNotification(payload);
  }, []);

  const triggerIsland = useCallback((payload: DynamicIslandNotificationPayload) => {
    clearTimer();
    setActiveNotification((prev) => {
      if (prev && prev.id !== payload.id) {
        setSecondaryNotification(prev);
      }
      return payload;
    });
    setIsExpanded(false);

    const autoDismissMs = payload.durationMs || 5000;
    if (autoDismissMs > 0) {
      dismissTimerRef.current = setTimeout(() => {
        setActiveNotification((current) => {
          if (current?.id === payload.id) {
            setSecondaryNotification(null);
            return null;
          }
          return current;
        });
      }, autoDismissMs);
    }
  }, []);

  const checkMissedNotifications = useCallback(async () => {
    if (!sessionExists || !activeRole) return;

    try {
      const storedLastOnline = await AsyncStorage.getItem('spay_last_online_at');
      const fallbackTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const checkSince = storedLastOnline || fallbackTime;
      setLastOnlineAt(checkSince);

      const isAdmin = userRole === 'ADMIN' || userRole === 'admin' || activeRole === 'admin';

      let userFirstName = userName;
      let avatar = userAvatarUrl;

      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, full_name, avatar_url')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profile) {
            if (profile.first_name || profile.full_name) {
              userFirstName = extractFirstName(profile.first_name || profile.full_name, authData.user.email);
            }
            if (profile.avatar_url) {
              avatar = profile.avatar_url;
            }
          }
        } catch {
          // Fallback
        }

        if (!userFirstName || userFirstName === 'Lorenzo') {
          const rawName =
            authData.user.user_metadata?.first_name ||
            authData.user.user_metadata?.full_name ||
            authData.user.user_metadata?.name;
          userFirstName = extractFirstName(rawName, authData.user.email);
        }

        if (!avatar) {
          avatar =
            authData.user.user_metadata?.avatar_url ||
            authData.user.user_metadata?.picture ||
            authData.user.user_metadata?.profile_photo ||
            authData.user.user_metadata?.avatar ||
            '';
        }

        if (userFirstName) setUserName(userFirstName);
        if (avatar) setUserAvatarUrl(avatar);
      }

      const [recentPaymentsRes, recentOverdueRes, unreadCountRes] = await Promise.allSettled([
        supabase
          .from('payments')
          .select('id, amount_paid, payment_reference, created_at')
          .gte('created_at', checkSince)
          .limit(10),
        supabase
          .from('spay_billing_statements')
          .select('id, total_amount_due, status, updated_at')
          .eq('status', 'OVERDUE')
          .gte('updated_at', checkSince)
          .limit(10),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('read', false),
      ]);

      const paymentsList = recentPaymentsRes.status === 'fulfilled' ? (recentPaymentsRes.value.data as any[]) || [] : [];
      const overdueList = recentOverdueRes.status === 'fulfilled' ? (recentOverdueRes.value.data as any[]) || [] : [];
      const unreadTotal = unreadCountRes.status === 'fulfilled' ? (unreadCountRes.value.count || 0) : 0;
      const totalMissed = paymentsList.length + overdueList.length;

      setMissedCount(totalMissed + unreadTotal);

      const nameToDisplay = userFirstName || 'Lorenzo';

      // 1. Prioritize Welcome Greeting on session & activeRole start
      if (!hasShownGreetingRef.current) {
        hasShownGreetingRef.current = true;
        AsyncStorage.setItem('spay_last_online_at', new Date().toISOString());

        const hour = new Date().getHours();
        const greetingTime = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
        const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        triggerIsland({
          id: `greeting_${Date.now()}`,
          type: 'sync',
          title: `${greetingTime}, ${nameToDisplay}!`,
          subtitle: isAdmin ? 'SPay Admin Mobile • Operational' : 'SPay Client Mobile • Operational',
          compactText: `${greetingTime}, ${nameToDisplay}`,
          compactBadge: `${formattedTime} • 30°C`,
          detailLeft: 'All Billing Accounts Clear',
          detailRight: 'Live Sync Active ✓',
          avatarUrl: avatar || undefined,
          durationMs: 5000,
        });

        // Queue Catch-Up as secondary if missed items exist
        if (totalMissed > 0 || unreadTotal > 0) {
          const totalAmount =
            paymentsList.reduce((acc: number, p: any) => acc + (Number(p.amount_paid) || 0), 0) +
            overdueList.reduce((acc: number, s: any) => acc + (Number(s.total_amount_due) || 0), 0);

          const lastActiveFormatted = new Date(checkSince).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            month: 'short',
            day: 'numeric',
          });

          setSecondaryNotification({
            id: `catchup_${Date.now()}`,
            type: 'sync',
            title: `${totalMissed + unreadTotal} Updates & Notifs Missed!`,
            subtitle: `Since last active on ${lastActiveFormatted}`,
            amount: totalAmount > 0 ? `₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : undefined,
            compactText: 'Missed Catch-Up',
            compactBadge: `${totalMissed + unreadTotal} Missed`,
            detailLeft: `${paymentsList.length} Pays • ${overdueList.length} Overdues • ${unreadTotal} Unread`,
            detailRight: 'Review All',
            actionText: 'Acknowledge & Mark Read ✓',
            durationMs: 12000,
            onAction: () => {
              AsyncStorage.setItem('spay_last_online_at', new Date().toISOString());
              setMissedCount(0);
            },
          });
        }
      } else if (totalMissed > 0 || unreadTotal > 0) {
        const totalAmount =
          paymentsList.reduce((acc: number, p: any) => acc + (Number(p.amount_paid) || 0), 0) +
          overdueList.reduce((acc: number, s: any) => acc + (Number(s.total_amount_due) || 0), 0);

        const lastActiveFormatted = new Date(checkSince).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          month: 'short',
          day: 'numeric',
        });

        triggerIsland({
          id: `catchup_${Date.now()}`,
          type: 'sync',
          title: `${totalMissed + unreadTotal} Updates & Notifs Missed!`,
          subtitle: `Since last active on ${lastActiveFormatted}`,
          amount: totalAmount > 0 ? `₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : undefined,
          compactText: 'Missed Catch-Up',
          compactBadge: `${totalMissed + unreadTotal} Missed`,
          detailLeft: `${paymentsList.length} Pays • ${overdueList.length} Overdues • ${unreadTotal} Unread`,
          detailRight: 'Review All',
          actionText: 'Acknowledge & Mark Read ✓',
          durationMs: 12000,
          onAction: () => {
            AsyncStorage.setItem('spay_last_online_at', new Date().toISOString());
            setMissedCount(0);
          },
        });
      }
    } catch (err) {
      console.warn('[Mobile DynamicIsland] Catch-up error:', err);
    }
  }, [sessionExists, activeRole, userRole, userName, userAvatarUrl, triggerIsland]);

  // Reset greeting ref on logout or session end
  useEffect(() => {
    if (!sessionExists || !activeRole) {
      hasShownGreetingRef.current = false;
      return;
    }
    checkMissedNotifications();
  }, [sessionExists, activeRole, checkMissedNotifications]);

  // Timer cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, []);

  return (
    <DynamicIslandContext.Provider
      value={{
        activeNotification,
        secondaryNotification,
        isExpanded,
        lastOnlineAt,
        missedCount,
        userName,
        userAvatarUrl,
        triggerIsland,
        dismissIsland,
        toggleExpand,
        setSecondaryEvent,
        checkMissedNotifications,
      }}
    >
      {children}
    </DynamicIslandContext.Provider>
  );
};
