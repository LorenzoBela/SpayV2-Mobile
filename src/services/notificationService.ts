import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../utils/authProfile';

export type NotificationCategory = 'PAYMENT_UPDATES' | 'ALERTS' | 'ADS' | 'SYSTEM';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  category: NotificationCategory;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  data?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at: string;
}

export const ANDROID_CHANNELS: Record<NotificationCategory, string> = {
  PAYMENT_UPDATES: 'spay-payments-v1',
  ALERTS: 'spay-alerts-v1',
  ADS: 'spay-ads-v1',
  SYSTEM: 'spay-system-v1',
};

const ENABLE_REMOTE_PUSH_NOTIFICATIONS =
  process.env.EXPO_PUBLIC_ENABLE_REMOTE_PUSH_NOTIFICATIONS === 'true';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined
  );
}

export async function setupAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.PAYMENT_UPDATES, {
    name: 'S-Pay Payments',
    description: 'Payment reminders, due dates, confirmations, and order updates.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#ee4d2d',
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.ALERTS, {
    name: 'S-Pay Alerts',
    description: 'Important account, budget, and system alerts.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 350, 150, 350],
    lightColor: '#ef4444',
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.ADS, {
    name: 'S-Pay Ads',
    description: 'S-Pay promotions and announcements.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 150],
    lightColor: '#3b82f6',
  });

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNELS.SYSTEM, {
    name: 'S-Pay System',
    description: 'Account notices and general system messages.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: '#10b981',
  });
}

export async function registerForTrayNotifications(userId: string) {
  await setupAndroidNotificationChannels();

  if (!ENABLE_REMOTE_PUSH_NOTIFICATIONS) {
    console.log('[Notifications] Remote push token registration disabled.');
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Notifications] Physical device required for Expo push tokens.');
    return null;
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (existingPermissions.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted.');
    return null;
  }

  const projectId = getProjectId();
  let expoPushToken: string;
  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    expoPushToken = tokenResult.data;
  } catch (error: any) {
    console.warn(
      '[Notifications] Remote push token unavailable. Configure FCM or keep EXPO_PUBLIC_ENABLE_REMOTE_PUSH_NOTIFICATIONS unset.',
      error?.message || error
    );
    return null;
  }

  const { error } = await supabase
    .from('notification_devices')
    .upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        device_id: `${Platform.OS}-${Device.modelName || 'device'}`,
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: 'expo_push_token' }
    );

  if (error) {
    console.warn('[Notifications] Failed to register device token:', error.message);
  }

  return expoPushToken;
}

export async function fetchNotifications(limit = 100) {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as AppNotification[];
}

export async function markNotificationRead(notificationId: string) {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', profileId);

  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', profileId)
    .is('read_at', null);

  if (error) throw error;
}

export async function clearNotification(notificationId: string) {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', profileId);

  if (error) throw error;
}

export async function mirrorToLocalTray(notification: AppNotification) {
  const channelId =
    typeof notification.data?.channelId === 'string'
      ? notification.data.channelId
      : ANDROID_CHANNELS[notification.category] || ANDROID_CHANNELS.SYSTEM;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: {
        notificationId: notification.id,
        type: notification.type,
        category: notification.category,
        screen: notification.data?.screen || 'Notifications',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: Platform.OS === 'android' ? channelId : undefined,
    },
  });
}

export function subscribeToRealtimeNotifications(
  userId: string,
  onNotification: (notification: AppNotification) => void
) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(`mobile-notifications-${userId}-${uniqueId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as AppNotification);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToRealtimeNotificationChanges(
  userId: string,
  onChange: () => void
) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(`mobile-notification-count-${userId}-${uniqueId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
