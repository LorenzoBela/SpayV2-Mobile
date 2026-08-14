import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility, AndroidGroupAlertBehavior } from '@notifee/react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Device from 'expo-device';
import { supabase } from '../utils/supabase';
import { storage } from '../utils/queryPersister';
import { ANDROID_CHANNELS } from './notificationServiceConfig';
import { buildDisplayNotificationInput } from './fcmNotificationServiceConfig';
import { ensureTrayNotificationPermissions, setupAndroidNotificationChannels } from './notificationService';

export async function setupNotifeeChannels() {
  if (Platform.OS !== 'android') return;

  const channelConfigs: Record<string, { name: string; importance: AndroidImportance; vibrationPattern?: number[]; lightColor?: string; showBadge: boolean }> = {
    [ANDROID_CHANNELS.PAYMENT_UPDATES]: {
      name: 'S-Pay Payments & Reminders',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 100, 150], // Crisp fintech double-tap
      lightColor: '#22c55e',
      showBadge: true,
    },
    [ANDROID_CHANNELS.ALERTS]: {
      name: 'S-Pay Security & Alerts',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 100, 300], // High urgency buzz
      lightColor: '#ef4444',
      showBadge: true,
    },
    [ANDROID_CHANNELS.ADS]: {
      name: 'S-Pay Announcements',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100],
      lightColor: '#3b82f6',
      showBadge: false,
    },
    [ANDROID_CHANNELS.SYSTEM]: {
      name: 'S-Pay System Updates',
      importance: AndroidImportance.HIGH,
      lightColor: '#e11d48',
      showBadge: true,
    },
  };

  for (const [channelId, config] of Object.entries(channelConfigs)) {
    await notifee.createChannel({
      id: channelId,
      name: config.name,
      importance: config.importance,
      sound: 'default',
      vibration: true,
      vibrationPattern: config.vibrationPattern,
      lights: Boolean(config.lightColor),
      lightColor: config.lightColor,
      visibility: AndroidVisibility.PUBLIC,
      badge: config.showBadge,
    });
  }
}

export function getNotificationAndroidOptions(category: string, type?: string) {
  let groupId = 'spay_system';
  let groupAlertBehavior = AndroidGroupAlertBehavior.ALL;
  let actions: Array<{ title: string; pressAction: { id: string; launchActivity?: string } }> = [];

  if (category === 'PAYMENT_UPDATES') {
    groupId = 'spay_payments';
    actions = [
      {
        title: '💳 View & Pay',
        pressAction: {
          id: 'view_pay',
          launchActivity: 'default',
        },
      },
      {
        title: '✓ Mark Read',
        pressAction: {
          id: 'mark_read',
        },
      },
    ];
  } else if (category === 'ADS') {
    groupId = 'spay_announcements';
    groupAlertBehavior = AndroidGroupAlertBehavior.SUMMARY;
    actions = [
      {
        title: '📢 Open Update',
        pressAction: {
          id: 'view_ad',
          launchActivity: 'default',
        },
      },
    ];
  }

  return {
    groupId,
    groupAlertBehavior,
    actions,
  };
}

export async function setAppBadgeCount(count: number) {
  try {
    await notifee.setBadgeCount(Math.max(0, count));
  } catch (e) {
    console.warn('[Badge] Failed to set badge:', e);
  }
}

export async function clearAppBadge() {
  try {
    await notifee.setBadgeCount(0);
  } catch (e) {
    console.warn('[Badge] Failed to clear badge:', e);
  }
}

export async function incrementAppBadge() {
  try {
    await notifee.incrementBadgeCount();
  } catch (e) {
    console.warn('[Badge] Failed to increment badge:', e);
  }
}

export async function displayFcmRemoteMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
  // Data-only FCM: title/body are in remoteMessage.data, not remoteMessage.notification
  const input = buildDisplayNotificationInput(remoteMessage);
  if (!input) return;

  await setupNotifeeChannels();
  const category = String(input.data?.category || 'SYSTEM');
  const type = String(input.data?.type || '');
  const androidOpts = getNotificationAndroidOptions(category, type);

  await notifee.displayNotification({
    title: input.title,
    body: input.body,
    data: input.data as Record<string, string>,
    android: {
      channelId: input.channelId,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      pressAction: { id: 'default' },
      groupId: androidOpts.groupId,
      groupAlertBehavior: androidOpts.groupAlertBehavior,
      actions: androidOpts.actions,
    },
  });

  if (category !== 'ADS') {
    void incrementAppBadge();
  }
}

function getPersistentDeviceId(): string {
  try {
    let devId = storage.getString('spay_persistent_device_id');
    if (!devId) {
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const model = Device.modelName ? Device.modelName.replace(/\s+/g, '_') : 'device';
      devId = `${Platform.OS}-${model}-${randomSuffix}`;
      storage.set('spay_persistent_device_id', devId);
    }
    return devId;
  } catch {
    return `${Platform.OS}-${Device.modelName || 'device'}`;
  }
}

async function upsertFcmToken(userId: string, fcmToken: string, customDeviceId?: string) {
  const deviceId = customDeviceId || getPersistentDeviceId();
  
  // 1. Write to Supabase table
  const supabasePromise = supabase
    .from('notification_devices')
    .upsert(
      {
        user_id: userId,
        expo_push_token: `fcm:${fcmToken}`,
        fcm_token: fcmToken,
        platform: Platform.OS,
        device_id: deviceId,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: 'expo_push_token' },
    );

  // 2. Dual-write to Next.js API endpoint (Prisma DB)
  const apiPromise = (async () => {
    try {
      const serverUrl = process.env.EXPO_PUBLIC_API_URL || 'https://nootspaytracker.vercel.app';
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      await fetch(`${serverUrl}/api/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          fcmToken,
          platform: Platform.OS,
          deviceId,
        }),
      });
    } catch (err) {
      console.warn('[FCM] register-device fetch error:', err);
    }
  })();

  const [result] = await Promise.all([supabasePromise, apiPromise]);
  return result;
}

export async function registerForFcmNotifications(userId: string) {
  return ensureDeviceRegistration(userId);
}

export async function ensureDeviceRegistration(userId: string) {
  if (!userId) return null;

  await setupAndroidNotificationChannels();
  await setupNotifeeChannels();

  await ensureTrayNotificationPermissions();
  try {
    await messaging().requestPermission();
  } catch {
    // Ignore
  }

  try {
    await messaging().registerDeviceForRemoteMessages();
  } catch {
    // Ignore
  }

  let fcmToken: string | null = null;
  try {
    fcmToken = await messaging().getToken();
  } catch (err) {
    console.warn('[FCM] getToken error:', err);
  }

  if (!fcmToken) {
    console.warn('[FCM] No token retrieved from Firebase');
    return null;
  }

  const deviceId = getPersistentDeviceId();
  console.log('[FCM] Ensuring registration for device:', deviceId, 'token:', fcmToken.slice(0, 20) + '...');
  const { error } = await upsertFcmToken(userId, fcmToken, deviceId);
  if (error) {
    console.warn('[FCM] Supabase registration warning:', error.message);
  }

  return fcmToken;
}

export function subscribeToFcmTokenRefresh(userId: string) {
  return messaging().onTokenRefresh((fcmToken) => {
    void upsertFcmToken(userId, fcmToken);
  });
}

export function subscribeToForegroundFcmMessages() {
  return messaging().onMessage(async (remoteMessage) => {
    const input = buildDisplayNotificationInput(remoteMessage);
    if (!input) return;

    await setupNotifeeChannels();
    const category = String(input.data?.category || 'SYSTEM');
    const type = String(input.data?.type || '');
    const androidOpts = getNotificationAndroidOptions(category, type);

    await notifee.displayNotification({
      title: input.title,
      body: input.body,
      data: input.data as Record<string, string>,
      android: {
        channelId: input.channelId,
        importance: AndroidImportance.HIGH,
        sound: 'default',
        pressAction: { id: 'default' },
        groupId: androidOpts.groupId,
        groupAlertBehavior: androidOpts.groupAlertBehavior,
        actions: androidOpts.actions,
      },
    });

    if (category !== 'ADS') {
      void incrementAppBadge();
    }
  });
}
