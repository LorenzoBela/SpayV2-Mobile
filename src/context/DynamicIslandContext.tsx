import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import {
  getLiveWeatherSnapshot,
  fetchFreshWeather,
  subscribeToWeatherUpdates,
  WeatherSnapshot,
} from '../services/weatherService';

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
  | 'promo_ad'
  | 'pro_subscription';

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

const VALID_ISLAND_TYPES: DynamicIslandNotificationType[] = [
  'payment',
  'overdue_alert',
  'payment_success',
  'order_assigned',
  'sync',
  'shared_payment',
  'payment_streak',
  'debt_free',
  'noot_savings',
  'limit_increase',
  'low_balance',
  'zero_interest',
  'biometric_auth',
  'offline_queue',
  'ota_update',
  'admin_impersonation',
  'admin_client_payment',
  'admin_risk_alert',
  'admin_reminder_sent',
  'promo_ad',
  'pro_subscription',
];

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
  const [userName, setUserName] = useState<string>('Lorenzo');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>('');
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
  const [missedCount, setMissedCount] = useState<number>(0);

  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownGreetingRef = useRef<boolean>(false);
  const userNameRef = useRef<string>('Lorenzo');
  const userAvatarRef = useRef<string>('');
  const currentUserIdRef = useRef<string | undefined>(propUserId);

  useEffect(() => {
    currentUserIdRef.current = propUserId;
  }, [propUserId]);

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
        setTimeout(() => setSecondaryNotification(prev), 0);
      }
      return payload;
    });
    setIsExpanded(false);

    const autoDismissMs = payload.durationMs || 5000;
    if (autoDismissMs > 0) {
      dismissTimerRef.current = setTimeout(() => {
        setActiveNotification((current) => {
          if (current?.id === payload.id) {
            return null;
          }
          return current;
        });
      }, autoDismissMs);
    }
  }, []);

  const handleIncomingNotification = useCallback(
    (newNotif: any) => {
      if (!newNotif) return;

      const rawType = (newNotif.type || '').toLowerCase();
      let notifType: DynamicIslandNotificationType = 'sync';

      if (VALID_ISLAND_TYPES.includes(rawType as DynamicIslandNotificationType)) {
        notifType = rawType as DynamicIslandNotificationType;
      } else if (rawType.includes('overdue')) {
        notifType = 'overdue_alert';
      } else if (rawType.includes('success') || rawType.includes('paid')) {
        notifType = 'payment_success';
      } else if (rawType.includes('streak')) {
        notifType = 'payment_streak';
      } else if (rawType.includes('promo')) {
        notifType = 'promo_ad';
      } else if (rawType.includes('risk')) {
        notifType = 'admin_risk_alert';
      } else if (rawType.includes('pay')) {
        notifType = 'payment';
      }

      const rawAmount = newNotif.data?.amount ?? newNotif.amount;
      const formattedAmount =
        rawAmount !== undefined && rawAmount !== null && rawAmount !== ''
          ? `₱${Number(rawAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
          : undefined;

      triggerIsland({
        id: newNotif.id || `notif_${Date.now()}`,
        type: notifType,
        title: newNotif.title || 'New Notification',
        subtitle: newNotif.body || newNotif.subtitle || undefined,
        amount: formattedAmount,
        compactText: newNotif.title || 'Notification',
        compactBadge: formattedAmount || 'New Alert',
        detailLeft: newNotif.body || newNotif.subtitle || 'Tap to view details',
        detailRight: 'Review',
        actionText: (newNotif.data?.actionText as string) || 'View Details',
        durationMs: 7000,
        onAction: () => {
          if (newNotif.id) {
            void supabase
              .from('notifications')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newNotif.id)
              .then(() => {});
          }
        },
      });
    },
    [triggerIsland]
  );

  const handleIncomingPayment = useCallback(
    (newPayment: any) => {
      if (!newPayment) return;

      const rawAmount = Number(
        newPayment.amount_due || newPayment.amount_paid || newPayment.amountDue || 0
      );
      const formattedAmount = `₱${rawAmount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
      })}`;

      if (newPayment.is_paid) {
        const isAdmin = userRole === 'ADMIN' || activeRole === 'admin';
        triggerIsland({
          id: `payment_${newPayment.id}_${Date.now()}`,
          type: isAdmin ? 'admin_client_payment' : 'payment_success',
          title: isAdmin ? 'Client Payment Received' : 'Payment Successful',
          subtitle: isAdmin
            ? 'Client account balance updated'
            : 'Payment has been processed and cleared',
          amount: formattedAmount,
          compactText: isAdmin ? 'Payment Received' : 'Payment Cleared',
          compactBadge: formattedAmount,
          detailLeft: 'Status: Paid Clear',
          detailRight: 'Receipt ✓',
          durationMs: 7000,
        });
      } else if (newPayment.due_date && new Date(newPayment.due_date).getTime() < Date.now()) {
        const dueFormatted = new Date(newPayment.due_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        triggerIsland({
          id: `overdue_${newPayment.id}_${Date.now()}`,
          type: 'overdue_alert',
          title: 'Payment Overdue Alert',
          subtitle: `Installment overdue since ${dueFormatted}`,
          amount: formattedAmount,
          compactText: 'Overdue Due',
          compactBadge: 'Overdue',
          detailLeft: `Due: ${dueFormatted}`,
          detailRight: 'Pay Now',
          actionText: 'Review Overdue Due',
          durationMs: 9000,
        });
      } else {
        const dueFormatted = newPayment.due_date
          ? new Date(newPayment.due_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : 'Upcoming';
        triggerIsland({
          id: `payment_sched_${newPayment.id}_${Date.now()}`,
          type: 'payment',
          title: 'Payment Due Scheduled',
          subtitle: `Due date on ${dueFormatted}`,
          amount: formattedAmount,
          compactText: 'Scheduled Payment',
          compactBadge: formattedAmount,
          detailLeft: `Due: ${dueFormatted}`,
          detailRight: 'View',
          durationMs: 6000,
        });
      }
    },
    [userRole, activeRole, triggerIsland]
  );

  const checkMissedNotifications = useCallback(async () => {
    if (!sessionExists || !activeRole) return;

    try {
      const storedLastOnline = await AsyncStorage.getItem('spay_last_online_at');
      const fallbackTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const checkSince = storedLastOnline || fallbackTime;
      setLastOnlineAt(checkSince);

      const isAdmin = userRole === 'ADMIN' || userRole === 'admin' || activeRole === 'admin';

      let userFirstName = userNameRef.current;
      let avatar = userAvatarRef.current;

      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        currentUserIdRef.current = authData.user.id;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profile?.name) {
            userFirstName = extractFirstName(profile.name, authData.user.email);
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

        if (userFirstName) {
          userNameRef.current = userFirstName;
          setUserName(userFirstName);
        }
        if (avatar) {
          userAvatarRef.current = avatar;
          setUserAvatarUrl(avatar);
        }
      }

      const [recentPaymentsRes, recentOverdueRes, unreadCountRes] = await Promise.allSettled([
        supabase
          .from('payments')
          .select('id, amount_due, is_paid, payment_date, due_date')
          .eq('is_paid', true)
          .gte('payment_date', checkSince)
          .limit(10),
        supabase
          .from('payments')
          .select('id, amount_due, due_date, is_paid')
          .eq('is_paid', false)
          .lt('due_date', new Date().toISOString())
          .limit(10),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .is('read_at', null),
      ]);

      const paymentsList = recentPaymentsRes.status === 'fulfilled' ? (recentPaymentsRes.value.data as any[]) || [] : [];
      const overdueList = recentOverdueRes.status === 'fulfilled' ? (recentOverdueRes.value.data as any[]) || [] : [];
      const unreadTotal = unreadCountRes.status === 'fulfilled' ? (unreadCountRes.value.count || 0) : 0;
      const totalMissed = paymentsList.length + overdueList.length;

      setMissedCount(totalMissed + unreadTotal);

      const nameToDisplay = userFirstName || 'Lorenzo';

      const totalOverdueNum = overdueList.reduce(
        (acc: number, s: any) =>
          acc + (Number(s.amount_due || s.amountDue || s.total_amount_due) || 0),
        0
      );
      const totalOverdue = `₱${totalOverdueNum.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
      })}`;

      let greetingDetailLeft = 'All Billing Accounts Clear';
      if (overdueList.length > 0) {
        greetingDetailLeft = `${overdueList.length} Overdue Dues (${totalOverdue})`;
      } else if (paymentsList.length > 0) {
        greetingDetailLeft = `${paymentsList.length} Recent Payments Clear`;
      }

      // 1. Prioritize Welcome Greeting on session & activeRole start
      if (!hasShownGreetingRef.current) {
        hasShownGreetingRef.current = true;
        AsyncStorage.setItem('spay_last_online_at', new Date().toISOString());

        const hour = new Date().getHours();
        const greetingTime = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
        const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const weatherSnap = getLiveWeatherSnapshot();
        const weatherBadge =
          weatherSnap.rainChance !== undefined && weatherSnap.rainChance > 0
            ? `${weatherSnap.temp}°C • 🌧️ ${weatherSnap.rainChance}%`
            : `${weatherSnap.temp}°C`;

        triggerIsland({
          id: `greeting_${Date.now()}`,
          type: 'sync',
          title: `${greetingTime}, ${nameToDisplay}!`,
          subtitle: isAdmin ? 'SPay Admin Mobile • Operational' : 'SPay Client Mobile • Operational',
          compactText: `${greetingTime}, ${nameToDisplay}`,
          compactBadge: `${formattedTime} • ${weatherBadge}`,
          detailLeft: greetingDetailLeft,
          detailRight: 'Live Sync Active ✓',
          avatarUrl: avatar || undefined,
          durationMs: 5000,
        });

        // Queue Catch-Up as secondary if missed items exist
        if (totalMissed > 0 || unreadTotal > 0) {
          const totalAmount =
            paymentsList.reduce((acc: number, p: any) => acc + (Number(p.amount_due || p.amountDue || p.amount_paid) || 0), 0) +
            overdueList.reduce((acc: number, s: any) => acc + (Number(s.amount_due || s.amountDue || s.total_amount_due) || 0), 0);

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
          paymentsList.reduce((acc: number, p: any) => acc + (Number(p.amount_due || p.amountDue || p.amount_paid) || 0), 0) +
          overdueList.reduce((acc: number, s: any) => acc + (Number(s.amount_due || s.amountDue || s.total_amount_due) || 0), 0);

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
  }, [sessionExists, activeRole, userRole, triggerIsland]);

  // Trigger check ONLY when sessionExists and activeRole transition to valid
  useEffect(() => {
    if (!sessionExists || !activeRole) {
      hasShownGreetingRef.current = false;
      return;
    }
    checkMissedNotifications();
  }, [sessionExists, activeRole, checkMissedNotifications]);

  // Weather update listener to keep greeting badge fresh
  useEffect(() => {
    void fetchFreshWeather().catch(() => {});

    const unsubscribe = subscribeToWeatherUpdates((snapshot: WeatherSnapshot) => {
      setActiveNotification((curr) => {
        if (curr && curr.id.startsWith('greeting')) {
          const formattedTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const weatherBadge =
            snapshot.rainChance !== undefined && snapshot.rainChance > 0
              ? `${snapshot.temp}°C • 🌧️ ${snapshot.rainChance}%`
              : `${snapshot.temp}°C`;

          return {
            ...curr,
            compactBadge: `${formattedTime} • ${weatherBadge}`,
          };
        }
        return curr;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Supabase Realtime channel subscription for notifications and payments
  useEffect(() => {
    if (!sessionExists) return;

    const uniqueChannelId = `dynamic_island_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(uniqueChannelId);

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            handleIncomingNotification(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
            handleIncomingPayment(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionExists, handleIncomingNotification, handleIncomingPayment]);

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

export default DynamicIslandProvider;
