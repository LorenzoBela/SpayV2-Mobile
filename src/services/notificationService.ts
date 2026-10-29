import { pushRegistrationGate } from './pushRegistrationGate';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import notifee, { AndroidImportance } from '@notifee/react-native';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../utils/authProfile';
import {
  ANDROID_CHANNELS,
  normalizeAndroidChannelId,
  shouldAttemptRemotePushRegistration,
} from './notificationServiceConfig';
import { trpcVanillaClient } from '../utils/trpc';
import { notificationRuntime, presentNotificationOnce } from './notificationRuntime';
import { notificationPresentation, validNotificationUuid } from './notificationRuntimeState';

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

const ENABLE_REMOTE_PUSH_NOTIFICATIONS =
  shouldAttemptRemotePushRegistration(process.env.EXPO_PUBLIC_ENABLE_REMOTE_PUSH_NOTIFICATIONS);

// Enable notification alert & banner display for local system tray
Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const data = notification.request.content.data || {};
    const id = typeof data.notificationId === 'string' ? data.notificationId : notification.request.identifier;
    const owner = await currentNotificationOwner();
    const recipient = data.recipientUserId || data.targetUserId;
    // Do not expose a former account's remote message after an account switch.
    const displayKey = data.spayLocalTray === 'true' ? `${id}:expo-local` : id;
    const allowed = !!owner && (!recipient || recipient === owner.profileId) && !notificationRuntime.displayed(displayKey);
    if (allowed) notificationRuntime.recordDisplayed(displayKey);
    return { shouldShowAlert: allowed, shouldPlaySound: allowed, shouldSetBadge: false, shouldShowBanner: allowed, shouldShowList: allowed };
  },
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

  const channels = [
    {
      id: ANDROID_CHANNELS.PAYMENT_UPDATES,
      name: 'S-Pay Payments',
      description: 'Payment reminders, due dates, confirmations, and order updates.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [250, 150, 250],
      lightColor: '#ee4d2d',
    },
    {
      id: ANDROID_CHANNELS.ALERTS,
      name: 'S-Pay Alerts',
      description: 'Important account, budget, and system alerts.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [350, 150, 350],
      lightColor: '#ef4444',
    },
    {
      id: ANDROID_CHANNELS.ADS,
      name: 'S-Pay Announcements',
      description: 'S-Pay promotions and announcements.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [250, 150, 250],
      lightColor: '#3b82f6',
    },
    {
      id: ANDROID_CHANNELS.SYSTEM,
      name: 'S-Pay System',
      description: 'Account notices and general system messages.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [250, 150, 250],
      lightColor: '#10b981',
    },
  ];

  for (const ch of channels) {
    try {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        description: ch.description,
        importance: ch.importance,
        vibrationPattern: ch.vibrationPattern,
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        lightColor: ch.lightColor,
      });
    } catch (err: any) {
      console.warn(`[Expo Notifications] Channel setup warning for ${ch.id}:`, err?.message || err);
    }
  }
}

export async function ensureTrayNotificationPermissions() {
  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (existingPermissions.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted.');
    return false;
  }

  return true;
}

export async function registerForTrayNotifications(userId: string) {
  const registrationVersion = pushRegistrationGate.version;
  await setupAndroidNotificationChannels();

  const hasPermission = await ensureTrayNotificationPermissions();
  if (!hasPermission) {
    return null;
  }

  if (!ENABLE_REMOTE_PUSH_NOTIFICATIONS) {
    console.log('[Notifications] Remote push token registration disabled.');
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Notifications] Physical device required for Expo push tokens.');
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
      '[Notifications] Remote push token unavailable. Configure FCM or set EXPO_PUBLIC_ENABLE_REMOTE_PUSH_NOTIFICATIONS=false to disable remote pushes.',
      error?.message || error
    );
    return null;
  }

  return pushRegistrationGate.run(async signal => {
    const deviceId = `${Platform.OS}-${Device.modelName || 'device'}`;
    const { error } = await supabase
      .from('notification_devices')
      .upsert(
        {
          user_id: userId,
          expo_push_token: expoPushToken,
          platform: Platform.OS,
          device_id: deviceId,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: 'expo_push_token' }
      ).abortSignal(signal);

    // Dual-write to production backend
    try {
      const serverUrl = process.env.EXPO_PUBLIC_API_URL || 'https://nootspaytracker.vercel.app';
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return expoPushToken;
      await fetch(`${serverUrl}/api/notifications/register-device`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          userId,
          expoPushToken,
          platform: Platform.OS,
          deviceId,
        }),
      }).then(async response => {
        if (!response.ok) console.warn('[Notifications] Device registration rejected:', response.status);
        else {
          const result = await response.json();
          const current = await supabase.auth.getSession();
          if (!signal.aborted && registrationVersion === pushRegistrationGate.version && current.data.session?.user.id === sessionData.session?.user.id) {
            notificationRuntime.rememberRegistration({ authUserId: sessionData.session!.user.id, profileId: userId }, result.registrationId);
            void flushNotificationReceipts();
          }
        }
      }).catch(() => console.warn('[Notifications] Device registration unavailable'));
    } catch {
      // Non-blocking
    }

    if (error) {
      console.warn('[Notifications] Failed to register device token:', error.message);
    }

    return expoPushToken;
  }, registrationVersion);
}

export async function fetchNotifications(limit = 100) {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user) return [];

  try {
    const data = await (trpcVanillaClient.notifications as any).list.query({ limit });
    return (data?.notifications || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      category: n.category,
      priority: n.priority,
      data: n.data,
      read_at: n.readAt,
      created_at: n.createdAt,
    })) as AppNotification[];
  } catch (trpcError) {
    console.warn('[notificationService] tRPC fetchNotifications failed, falling back to Supabase:', trpcError);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AppNotification[];
  }
}

export async function markNotificationRead(notificationId: string) {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user) return;

  try {
    await (trpcVanillaClient.notifications as any).markRead.mutate({ notificationId });
  } catch (trpcError) {
    console.warn('[notificationService] tRPC markNotificationRead failed, falling back to Supabase:', trpcError);
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', profileId);

    if (error) throw error;
  }
}

export async function markAllNotificationsRead() {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user) return;

  try {
    await (trpcVanillaClient.notifications as any).markAllRead.mutate();
  } catch (trpcError) {
    console.warn('[notificationService] tRPC markAllNotificationsRead failed, falling back to Supabase:', trpcError);
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', profileId)
      .is('read_at', null);

    if (error) throw error;
  }
}

export async function clearNotification(notificationId: string) {
  const { user, profileId } = await getLinkedProfileForCurrentUser();
  if (!user) return;

  try {
    await (trpcVanillaClient.notifications as any).clear.mutate({ notificationId });
  } catch (trpcError) {
    console.warn('[notificationService] tRPC clearNotification failed, falling back to Supabase:', trpcError);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', profileId);

    if (error) throw error;
  }
}

export async function mirrorToLocalTray(notification: AppNotification) {
  const owner = await currentNotificationOwner();
  const copy = notificationPresentation(notification.data || {}, owner, notification.title, notification.body);
  if (!copy) return;
  // Delivery must not prompt unexpectedly; the explicit registration/settings flow owns permission prompts.
  if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
  const stillCurrent = await currentNotificationOwner();
  if (!owner || stillCurrent?.authUserId !== owner.authUserId || stillCurrent.profileId !== owner.profileId) return;

  const rawChannel = notification.data?.channelId;
  const requestedChannelId = typeof rawChannel === 'string' ? rawChannel : '';
  const channelId = normalizeAndroidChannelId(requestedChannelId, notification.category);

  const data = { ...(notification.data || {}), notificationId: notification.id, type: notification.type, category: notification.category };
  await presentNotificationOnce(notification.id, async () => {
  if (Platform.OS === 'android') {
    try {
      await setupAndroidNotificationChannels();
      const current = notificationRuntime.owner();
      if (current?.authUserId !== owner.authUserId || current.profileId !== owner.profileId) return;
      await notifee.displayNotification({
        id: notification.id,
        title: copy.title,
        body: copy.body,
        data: data as Record<string, string>,
        android: {
          channelId: channelId || ANDROID_CHANNELS.SYSTEM,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          pressAction: { id: 'default' },
        },
      });
      return;
    } catch { throw new Error('Native tray display outcome unavailable'); }
  }

  await Notifications.scheduleNotificationAsync({
    identifier: notification.id,
    content: {
      title: copy.title,
      body: copy.body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [250, 150, 250],
      data: { ...data, spayLocalTray: 'true' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  });
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
        if (payload.eventType !== 'INSERT' || !payload.new) return;
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

export async function reportNotificationReceipt(
  notificationId?: string,
  action: 'received' | 'opened' = 'received'
) {
  if (!validNotificationUuid(notificationId)) return;
  try {
    const owner = await currentNotificationOwner();
    if (!owner) return;
    notificationRuntime.queueReceipt(owner, notificationId, action);
    await flushNotificationReceipts();
  } catch { /* Telemetry never blocks opening the app. */ }
}

let receiptFlush: Promise<void> | null = null;
export async function flushNotificationReceipts() {
  if (receiptFlush) return receiptFlush;
  receiptFlush = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const owner = notificationRuntime.owner();
    if (!session || !owner || owner.authUserId !== session.user.id) return;
    const registrationId = notificationRuntime.registration(owner);
    if (!registrationId) return;
    const serverUrl = process.env.EXPO_PUBLIC_API_URL || 'https://nootspaytracker.vercel.app';
    const deadline = Date.now() + 8000;
    for (const receipt of notificationRuntime.receipts(owner).slice(0, 10)) {
      const current = notificationRuntime.owner();
      if (Date.now() >= deadline || current?.authUserId !== owner.authUserId || current.profileId !== owner.profileId) break;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(3000, Math.max(1, deadline - Date.now())));
      try {
        const response = await fetch(`${serverUrl}/api/notifications/receipt`, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ notificationId: receipt.notificationId, registrationId, action: receipt.action }),
        });
        if (response.ok || response.status === 400 || response.status === 404) notificationRuntime.clearReceipt(owner, receipt.notificationId, receipt.action);
        else break;
      } catch { break; }
      finally { clearTimeout(timer); }
    }
  })().catch(() => undefined).finally(() => { receiptFlush = null; });
  return receiptFlush;
}

export async function currentNotificationOwner() {
  const { data, error } = await supabase.auth.getSession();
  const owner = notificationRuntime.owner();
  return !error && data.session && owner?.authUserId === data.session.user.id ? owner : null;
}

/** Resolve notification content from an authenticated, owner-scoped row before following payload IDs. */
export async function readOwnedNotification(notificationId: string) {
  if (!validNotificationUuid(notificationId)) return null;
  const owner = await currentNotificationOwner();
  if (!owner) return null;
  const result = await supabase.from('notifications').select('id,user_id,type,data')
    .eq('id', notificationId).eq('user_id', owner.profileId).maybeSingle();
  if (result.error) throw result.error;
  const current = notificationRuntime.owner();
  if (current?.authUserId !== owner.authUserId || current.profileId !== owner.profileId) return null;
  return result.data;
}

export async function markOwnedTrayNotificationRead(notificationId: string, trayId?: string) {
  const before = await currentNotificationOwner();
  if (!before) return false;
  const row = await readOwnedNotification(notificationId);
  if (!row) return false;
  await markNotificationRead(notificationId);
  const after = await currentNotificationOwner();
  if (after?.authUserId !== before.authUserId || after.profileId !== before.profileId) return false;
  if (trayId) await notifee.cancelNotification(trayId);
  await syncNotificationBadge();
  await reportNotificationReceipt(notificationId, 'opened');
  return true;
}

export async function syncNotificationBadge() {
  const owner = await currentNotificationOwner();
  if (owner) {
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', owner.profileId).is('read_at', null);
    const current = notificationRuntime.owner();
    if (!error && count !== null && current?.authUserId === owner.authUserId && current.profileId === owner.profileId) await notifee.setBadgeCount(count);
  }
}

