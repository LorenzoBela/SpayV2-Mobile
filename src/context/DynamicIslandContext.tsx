import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useReducer,
} from 'react';
import { Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { parseShopeeShareText } from '../utils/shopeeParser';
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

export enum IslandPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

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
  startedAt?: number;
  expiresAt?: number;
  priority?: IslandPriority;
}

export interface IslandState {
  activeNotification: DynamicIslandNotificationPayload | null;
  secondaryNotification: DynamicIslandNotificationPayload | null;
  isExpanded: boolean;
}

export type IslandAction =
  | { type: 'TRIGGER'; payload: DynamicIslandNotificationPayload }
  | { type: 'DISMISS'; id?: string }
  | { type: 'DISMISS_ACTIVE' }
  | { type: 'DISMISS_ALL' }
  | { type: 'SET_SECONDARY'; payload: DynamicIslandNotificationPayload | null }
  | { type: 'SWAP_EVENTS' }
  | { type: 'TOGGLE_EXPAND' }
  | { type: 'SET_EXPANDED'; payload: boolean }
  | { type: 'EXPIRE'; id: string }
  | { type: 'UPDATE_WEATHER_BADGE'; badge: string };

export function getVariantPriority(type: DynamicIslandNotificationType): IslandPriority {
  switch (type) {
    case 'overdue_alert':
    case 'admin_risk_alert':
    case 'biometric_auth':
      return IslandPriority.CRITICAL;

    case 'payment':
    case 'payment_success':
    case 'admin_client_payment':
    case 'order_assigned':
    case 'shared_payment':
    case 'low_balance':
    case 'admin_impersonation':
      return IslandPriority.HIGH;

    case 'limit_increase':
    case 'debt_free':
    case 'payment_streak':
    case 'noot_savings':
    case 'zero_interest':
    case 'offline_queue':
    case 'ota_update':
    case 'admin_reminder_sent':
      return IslandPriority.NORMAL;

    case 'sync':
    case 'promo_ad':
    case 'pro_subscription':
    default:
      return IslandPriority.LOW;
  }
}

export function swapEvents(state?: IslandState): any {
  if (state && ('activeNotification' in state || 'secondaryNotification' in state || 'isExpanded' in state)) {
    return {
      ...state,
      activeNotification: state.secondaryNotification,
      secondaryNotification: state.activeNotification,
      isExpanded: false,
    };
  }
  return { type: 'SWAP_EVENTS' as const };
}

export const initialIslandState: IslandState = {
  activeNotification: null,
  secondaryNotification: null,
  isExpanded: false,
};

export function islandReducer(state: IslandState, action: IslandAction): IslandState {
  switch (action.type) {
    case 'TRIGGER': {
      const startedAt = action.payload.startedAt ?? Date.now();
      const durationMs = action.payload.durationMs ?? 5000;
      const expiresAt = action.payload.expiresAt ?? (startedAt + durationMs);
      const priority = action.payload.priority ?? getVariantPriority(action.payload.type);

      const incoming: DynamicIslandNotificationPayload = {
        ...action.payload,
        startedAt,
        expiresAt,
        priority,
        durationMs,
      };

      if (!state.activeNotification) {
        return {
          ...state,
          activeNotification: incoming,
          isExpanded: false,
        };
      }

      if (state.activeNotification.id === incoming.id) {
        return {
          ...state,
          activeNotification: incoming,
        };
      }

      if (state.secondaryNotification && state.secondaryNotification.id === incoming.id) {
        const activePri = state.activeNotification.priority ?? getVariantPriority(state.activeNotification.type);
        if (priority > activePri) {
          return {
            ...state,
            activeNotification: incoming,
            secondaryNotification: state.activeNotification,
            isExpanded: false,
          };
        }
        return {
          ...state,
          secondaryNotification: incoming,
        };
      }

      const activePri = state.activeNotification.priority ?? getVariantPriority(state.activeNotification.type);
      let incomingWins = false;

      if (priority > activePri) {
        incomingWins = true;
      } else if (priority < activePri) {
        incomingWins = false;
      } else {
        const incomingTime = incoming.startedAt ?? 0;
        const activeTime = state.activeNotification.startedAt ?? 0;
        if (incomingTime > activeTime) {
          incomingWins = true;
        } else if (incomingTime < activeTime) {
          incomingWins = false;
        } else {
          incomingWins = incoming.id >= state.activeNotification.id;
        }
      }

      if (incomingWins) {
        return {
          ...state,
          activeNotification: incoming,
          secondaryNotification: state.activeNotification,
          isExpanded: false,
        };
      } else {
        return {
          ...state,
          secondaryNotification: incoming,
        };
      }
    }

    case 'EXPIRE': {
      if (action.id && state.activeNotification?.id === action.id) {
        return {
          ...state,
          activeNotification: state.secondaryNotification,
          secondaryNotification: null,
          isExpanded: false,
        };
      }

      if (action.id && state.secondaryNotification?.id === action.id) {
        return {
          ...state,
          secondaryNotification: null,
        };
      }

      return state;
    }

    case 'DISMISS': {
      if (action.id) {
        if (state.activeNotification?.id === action.id) {
          return {
            ...state,
            activeNotification: state.secondaryNotification,
            secondaryNotification: null,
            isExpanded: false,
          };
        }
        if (state.secondaryNotification?.id === action.id) {
          return {
            ...state,
            secondaryNotification: null,
          };
        }
        return state;
      }

      return {
        ...state,
        activeNotification: state.secondaryNotification,
        secondaryNotification: null,
        isExpanded: false,
      };
    }

    case 'DISMISS_ACTIVE': {
      return {
        ...state,
        activeNotification: state.secondaryNotification,
        secondaryNotification: null,
        isExpanded: false,
      };
    }

    case 'DISMISS_ALL': {
      return {
        ...state,
        activeNotification: null,
        secondaryNotification: null,
        isExpanded: false,
      };
    }

    case 'SET_SECONDARY': {
      return {
        ...state,
        secondaryNotification: action.payload,
      };
    }

    case 'SWAP_EVENTS': {
      return swapEvents(state);
    }

    case 'TOGGLE_EXPAND': {
      return {
        ...state,
        isExpanded: !state.isExpanded,
      };
    }

    case 'SET_EXPANDED': {
      return {
        ...state,
        isExpanded: action.payload,
      };
    }

    case 'UPDATE_WEATHER_BADGE': {
      if (state.activeNotification && state.activeNotification.id.startsWith('greeting')) {
        return {
          ...state,
          activeNotification: {
            ...state.activeNotification,
            compactBadge: action.badge,
          },
        };
      }
      return state;
    }

    default:
      return state;
  }
}

export interface DynamicIslandContextType {
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
  swapEvents: () => void;
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
  swapEvents: () => {},
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
  const [state, dispatch] = useReducer(islandReducer, initialIslandState);
  const [userName, setUserName] = useState<string>('Lorenzo');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>('');
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
  const [missedCount, setMissedCount] = useState<number>(0);

  const activeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const netDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasOfflineRef = useRef<boolean>(false);
  const hasShownGreetingRef = useRef<boolean>(false);
  const userNameRef = useRef<string>('Lorenzo');
  const userAvatarRef = useRef<string>('');
  const currentUserIdRef = useRef<string | undefined>(propUserId);

  useEffect(() => {
    currentUserIdRef.current = propUserId;
  }, [propUserId]);

  // activeTimerRef lifecycle sync with activeNotification
  useEffect(() => {
    if (activeTimerRef.current) {
      clearTimeout(activeTimerRef.current);
      activeTimerRef.current = null;
    }

    const active = state.activeNotification;
    if (!active) return;

    const now = Date.now();
    let remainingMs = 5000;
    if (typeof active.expiresAt === 'number') {
      remainingMs = Math.max(0, active.expiresAt - now);
    } else if (typeof active.durationMs === 'number') {
      remainingMs = active.durationMs;
    }

    if (remainingMs > 0) {
      activeTimerRef.current = setTimeout(() => {
        dispatch({ type: 'EXPIRE', id: active.id });
      }, remainingMs);
    } else {
      dispatch({ type: 'EXPIRE', id: active.id });
    }

    return () => {
      if (activeTimerRef.current) {
        clearTimeout(activeTimerRef.current);
        activeTimerRef.current = null;
      }
    };
  }, [state.activeNotification]);

  const dismissIsland = useCallback(() => {
    dispatch({ type: 'DISMISS' });
  }, []);

  const toggleExpand = useCallback(() => {
    dispatch({ type: 'TOGGLE_EXPAND' });
  }, []);

  const setSecondaryEvent = useCallback((payload: DynamicIslandNotificationPayload | null) => {
    dispatch({ type: 'SET_SECONDARY', payload });
  }, []);

  const triggerIsland = useCallback((payload: DynamicIslandNotificationPayload) => {
    dispatch({ type: 'TRIGGER', payload });
  }, []);

  const handleSwapEvents = useCallback(() => {
    dispatch({ type: 'SWAP_EVENTS' });
  }, []);

  // 1,500ms debounced NetInfo listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      if (netDebounceTimerRef.current) {
        clearTimeout(netDebounceTimerRef.current);
      }

      netDebounceTimerRef.current = setTimeout(() => {
        const isOffline = !Boolean(netState.isConnected && netState.isInternetReachable !== false);

        if (isOffline) {
          wasOfflineRef.current = true;
          dispatch({
            type: 'TRIGGER',
            payload: {
              id: `netinfo_offline_${Date.now()}`,
              type: 'offline_queue',
              title: 'Offline Mode Active',
              subtitle: 'Network disconnected. Actions queued.',
              compactText: 'Offline Mode',
              compactBadge: 'Queued',
              detailLeft: 'Auto-syncs when online',
              detailRight: 'Offline',
              durationMs: 5000,
              priority: IslandPriority.NORMAL,
            },
          });
        } else if (wasOfflineRef.current) {
          wasOfflineRef.current = false;
          dispatch({
            type: 'TRIGGER',
            payload: {
              id: `netinfo_online_${Date.now()}`,
              type: 'sync',
              title: 'Connection Restored',
              subtitle: 'Realtime network connection restored',
              compactText: 'Back Online',
              compactBadge: 'Connected',
              detailLeft: 'Sync active',
              detailRight: 'Online ✓',
              durationMs: 4000,
              priority: IslandPriority.LOW,
            },
          });
        }
      }, 1500);
    });

    return () => {
      unsubscribe();
      if (netDebounceTimerRef.current) {
        clearTimeout(netDebounceTimerRef.current);
        netDebounceTimerRef.current = null;
      }
    };
  }, []);

  const handleIncomingNotification = useCallback(
    (newNotif: any) => {
      if (!newNotif) return;

      const textToScan = [
        newNotif.body,
        newNotif.subtitle,
        newNotif.title,
        newNotif.data?.url,
        newNotif.data?.product_url,
        newNotif.data?.link,
        newNotif.data?.text,
        newNotif.data?.shared_text,
      ]
        .filter(Boolean)
        .join(' ');

      const parsedShopee = parseShopeeShareText(textToScan);
      const isShopeeNotification =
        parsedShopee.isShopee ||
        String(newNotif.type || '').toLowerCase().includes('shopee') ||
        String(newNotif.island_type || '').toLowerCase().includes('shopee');

      const rawType = String(newNotif.type || newNotif.island_type || '').toLowerCase();
      let notifType: DynamicIslandNotificationType = 'sync';

      if (isShopeeNotification) {
        notifType = 'order_assigned';
      } else if (VALID_ISLAND_TYPES.includes(rawType as DynamicIslandNotificationType)) {
        notifType = rawType as DynamicIslandNotificationType;
      } else {
        const upper = rawType.toUpperCase();
        if (['ORDER_ASSIGNED', 'ORDER_UPDATED', 'BUY_REQUEST'].includes(upper)) notifType = 'order_assigned';
        else if (['BUDGET_ALERT', 'RISK_ALERT', 'ADMIN_RISK_ALERT'].includes(upper)) notifType = 'admin_risk_alert';
        else if (['PAYMENT_CONFIRMED', 'PAYMENT_SUCCESS', 'CASHBACK', 'REWARD_EARNED'].includes(upper)) notifType = 'payment_success';
        else if (['SHARED_ORDER_ASSIGNED', 'SHARED_PAYMENT'].includes(upper)) notifType = 'shared_payment';
        else if (['PRO_SUBSCRIPTION', 'PRO_UPGRADE'].includes(upper)) notifType = 'pro_subscription';
        else if (['ADMIN_IMPERSONATION', 'IMPERSONATION'].includes(upper)) notifType = 'admin_impersonation';
        else if (['ADMIN_CLIENT_PAYMENT', 'CLIENT_PAYMENT'].includes(upper)) notifType = 'admin_client_payment';
        else if (['OTA_UPDATE', 'APP_UPDATE'].includes(upper)) notifType = 'ota_update';
        else if (['PROMO_AD', 'PROMOTION'].includes(upper)) notifType = 'promo_ad';
        else if (['ZERO_INTEREST', 'ZERO_FEE'].includes(upper)) notifType = 'zero_interest';
        else if (['LIMIT_INCREASE', 'CREDIT_LIMIT_INCREASE'].includes(upper)) notifType = 'limit_increase';
        else if (['LOW_BALANCE', 'BALANCE_WARNING'].includes(upper)) notifType = 'low_balance';
        else if (['OFFLINE_QUEUE', 'QUEUE_SYNCED'].includes(upper)) notifType = 'offline_queue';
        else if (['BIOMETRIC_AUTH', 'BIOMETRICS'].includes(upper)) notifType = 'biometric_auth';
        else if (['DEBT_FREE', 'LOAN_CLEARED'].includes(upper)) notifType = 'debt_free';
        else if (['PAYMENT_STREAK', 'STREAK'].includes(upper)) notifType = 'payment_streak';
        else if (['NOOT_SAVINGS', 'IPON_GOAL', 'SAVINGS'].includes(upper)) notifType = 'noot_savings';
        else if (['ADMIN_REMINDER_SENT', 'REMINDER_SENT'].includes(upper)) notifType = 'admin_reminder_sent';
        else if (['OVERDUE_ALERT', 'OVERDUE'].includes(upper)) notifType = 'overdue_alert';
        else if (['PAYMENT', 'INSTALLMENT_DUE'].includes(upper)) notifType = 'payment';
      }

      const rawAmount = newNotif.data?.amount ?? newNotif.amount;
      const formattedAmount =
        rawAmount !== undefined && rawAmount !== null && rawAmount !== ''
          ? `₱${Number(rawAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
          : undefined;

      const title = isShopeeNotification
        ? newNotif.title || (parsedShopee.title ? `Shopee: ${parsedShopee.title}` : 'Shopee Link Detected')
        : newNotif.title || 'New Notification';

      const subtitle = isShopeeNotification
        ? newNotif.body || parsedShopee.title || 'Shopee product link detected'
        : newNotif.body || newNotif.subtitle || undefined;

      const compactText = isShopeeNotification
        ? newNotif.compact_text || (parsedShopee.title ? parsedShopee.title.slice(0, 22) : 'Shopee Order')
        : newNotif.title || 'Notification';

      const compactBadge = isShopeeNotification
        ? formattedAmount || 'Shopee 🛍️'
        : formattedAmount || 'New Alert';

      const actionText = isShopeeNotification
        ? (newNotif.data?.actionText as string) || (parsedShopee.url ? 'View Product' : 'View Details')
        : (newNotif.data?.actionText as string) || 'View Details';

      const onAction = () => {
        if (newNotif.id) {
          void supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', newNotif.id)
            .then(() => {});
        }
        if (isShopeeNotification && parsedShopee.url) {
          void Linking.openURL(parsedShopee.url).catch(() => {});
        }
      };

      triggerIsland({
        id: newNotif.id || `notif_${Date.now()}`,
        type: notifType,
        title,
        subtitle,
        amount: formattedAmount,
        compactText,
        compactBadge,
        detailLeft: newNotif.body || newNotif.subtitle || 'Tap to view details',
        detailRight: isShopeeNotification ? 'Shopee ✓' : 'Review',
        actionText,
        durationMs: 7000,
        hasProgress: Boolean(newNotif.has_progress || newNotif.hasProgress),
        progressPct: typeof newNotif.progress_pct === 'number' ? newNotif.progress_pct : newNotif.progressPct,
        priority: isShopeeNotification ? IslandPriority.HIGH : undefined,
        onAction,
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

        const weatherSnap = getLiveWeatherSnapshot();
        const weatherBadge =
          weatherSnap.rainChance !== undefined && weatherSnap.rainChance > 0
            ? `${weatherSnap.temp}°C • 🌧️ ${weatherSnap.rainChance}%`
            : `${weatherSnap.temp}°C`;

        triggerIsland({
          id: `greeting_${Date.now()}`,
          type: 'sync',
          title: `${greetingTime}, ${nameToDisplay}!`,
          subtitle: isAdmin ? 'Admin mode ready' : 'Ready to track payments',
          compactText: `${greetingTime}, ${nameToDisplay}`,
          compactBadge: weatherBadge,
          detailLeft: greetingDetailLeft,
          detailRight: 'Synced',
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

          setSecondaryEvent({
            id: `catchup_${Date.now()}`,
            type: 'sync',
            title: `${totalMissed + unreadTotal} Unread Updates`,
            subtitle: `Since last active on ${lastActiveFormatted}`,
            amount: totalAmount > 0 ? `₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : undefined,
            compactText: 'Updates',
            compactBadge: `${totalMissed + unreadTotal} Missed`,
            detailLeft: `${paymentsList.length} Pays • ${overdueList.length} Overdues • ${unreadTotal} Unread`,
            detailRight: 'Review All',
            actionText: 'Mark all as read',
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
          title: `${totalMissed + unreadTotal} Unread Updates`,
          subtitle: `Since last active on ${lastActiveFormatted}`,
          amount: totalAmount > 0 ? `₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : undefined,
          compactText: 'Updates',
          compactBadge: `${totalMissed + unreadTotal} Missed`,
          detailLeft: `${paymentsList.length} Pays • ${overdueList.length} Overdues • ${unreadTotal} Unread`,
          detailRight: 'Review All',
          actionText: 'Mark all as read',
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
  }, [sessionExists, activeRole, userRole, triggerIsland, setSecondaryEvent]);

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
    void fetchFreshWeather(true).catch(() => {});

    const unsubscribe = subscribeToWeatherUpdates((snapshot: WeatherSnapshot) => {
      const weatherBadge =
        snapshot.rainChance !== undefined && snapshot.rainChance > 0
          ? `${snapshot.temp}°C • 🌧️ ${snapshot.rainChance}%`
          : `${snapshot.temp}°C`;

      dispatch({ type: 'UPDATE_WEATHER_BADGE', badge: weatherBadge });
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
    return () => {
      if (activeTimerRef.current) {
        clearTimeout(activeTimerRef.current);
        activeTimerRef.current = null;
      }
      if (netDebounceTimerRef.current) {
        clearTimeout(netDebounceTimerRef.current);
        netDebounceTimerRef.current = null;
      }
    };
  }, []);

  return (
    <DynamicIslandContext.Provider
      value={{
        activeNotification: state.activeNotification,
        secondaryNotification: state.secondaryNotification,
        isExpanded: state.isExpanded,
        lastOnlineAt,
        missedCount,
        userName,
        userAvatarUrl,
        triggerIsland,
        dismissIsland,
        toggleExpand,
        setSecondaryEvent,
        checkMissedNotifications,
        swapEvents: handleSwapEvents,
      }}
    >
      {children}
    </DynamicIslandContext.Provider>
  );
};

export default DynamicIslandProvider;
