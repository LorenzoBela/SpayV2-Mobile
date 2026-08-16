import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility, AndroidGroupAlertBehavior } from '@notifee/react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
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
      vibrationPattern: [150, 100, 150], // Crisp fintech double-tap
      lightColor: '#22c55e',
      showBadge: true,
    },
    [ANDROID_CHANNELS.ALERTS]: {
      name: 'S-Pay Security & Alerts',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [300, 100, 300], // High urgency buzz
      lightColor: '#ef4444',
      showBadge: true,
    },
    [ANDROID_CHANNELS.ADS]: {
      name: 'S-Pay Announcements',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: [100, 100],
      lightColor: '#3b82f6',
      showBadge: false,
    },
    [ANDROID_CHANNELS.SYSTEM]: {
      name: 'S-Pay System Updates',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [250, 150, 250],
      lightColor: '#e11d48',
      showBadge: true,
    },
  };

  for (const [channelId, config] of Object.entries(channelConfigs)) {
    try {
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
    } catch (err: any) {
      console.warn(`[Notifee] Channel creation fallback for ${channelId}:`, err?.message || err);
      // Fallback without vibration pattern if device vendor rejects custom pattern
      try {
        await notifee.createChannel({
          id: channelId,
          name: config.name,
          importance: config.importance,
          sound: 'default',
          vibration: true,
          badge: config.showBadge,
        });
      } catch (fallbackErr: any) {
        console.warn(`[Notifee] Base channel creation error for ${channelId}:`, fallbackErr?.message || fallbackErr);
      }
    }
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
  
  // Revoke any previous active tokens for this device to prevent duplicate records
  try {
    await supabase
      .from('notification_devices')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .neq('expo_push_token', `fcm:${fcmToken}`)
      .is('revoked_at', null);
  } catch (err) {
    console.warn('[FCM] Error revoking stale device token:', err);
  }

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

export async function ensureDeviceRegistration(userId: string, maxRetries = 3): Promise<string | null> {
  if (!userId) return null;

  await setupAndroidNotificationChannels();
  await setupNotifeeChannels();

  await ensureTrayNotificationPermissions();
  if (Platform.OS === 'ios') {
    try {
      await messaging().requestPermission();
      await messaging().registerDeviceForRemoteMessages();
    } catch {
      // Ignore
    }
  }

  let attempt = 0;
  const retryDelays = [1000, 2500, 5000, 10000];

  while (attempt <= maxRetries) {
    try {
      let fcmToken: string | null = null;
      try {
        fcmToken = await messaging().getToken();
      } catch (err) {
        console.warn(`[FCM] messaging().getToken error (attempt ${attempt + 1}/${maxRetries + 1}):`, err);
      }

      // Robust fallback: if messaging().getToken() returned null, retrieve native device push token directly
      if (!fcmToken) {
        try {
          const deviceToken = await Notifications.getDevicePushTokenAsync();
          if (deviceToken?.data && typeof deviceToken.data === 'string') {
            fcmToken = deviceToken.data;
          }
        } catch (err) {
          console.warn(`[FCM] Notifications.getDevicePushTokenAsync error (attempt ${attempt + 1}/${maxRetries + 1}):`, err);
        }
      }

      if (fcmToken) {
        const deviceId = getPersistentDeviceId();
        const { error } = await upsertFcmToken(userId, fcmToken, deviceId);
        if (error) {
          console.warn(`[FCM] Supabase registration warning (attempt ${attempt + 1}):`, error.message);
        } else {
          storage.set('spay_cached_fcm_token', fcmToken);
          storage.set('spay_last_fcm_sync', new Date().toISOString());
          return fcmToken;
        }
      }
    } catch (err) {
      console.warn(`[FCM] ensureDeviceRegistration unexpected error (attempt ${attempt + 1}):`, err);
    }

    attempt++;
    if (attempt <= maxRetries) {
      await new Promise((res) => setTimeout(res, retryDelays[attempt - 1] || 3000));
    }
  }

  return null;
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
