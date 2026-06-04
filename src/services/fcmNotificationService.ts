import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Device from 'expo-device';
import { supabase } from '../utils/supabase';
import { ANDROID_CHANNELS } from './notificationServiceConfig';
import { buildDisplayNotificationInput } from './fcmNotificationServiceConfig';
import { ensureTrayNotificationPermissions, setupAndroidNotificationChannels } from './notificationService';

async function setupNotifeeChannels() {
  if (Platform.OS !== 'android') return;

  for (const [category, channelId] of Object.entries(ANDROID_CHANNELS)) {
    await notifee.createChannel({
      id: channelId,
      name: category === 'ADS' ? 'S-Pay Announcements' : `S-Pay ${category.replace('_', ' ')}`,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [0, 250, 150, 250],
      visibility: AndroidVisibility.PUBLIC,
    });
  }
}

export async function displayFcmRemoteMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
  if (remoteMessage.notification) {
    return;
  }

  const input = buildDisplayNotificationInput(remoteMessage);
  await setupNotifeeChannels();
  await notifee.displayNotification({
    title: input.title,
    body: input.body,
    data: input.data as Record<string, string>,
    android: {
      channelId: input.channelId,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250],
      pressAction: { id: 'default' },
    },
  });
}

async function upsertFcmToken(userId: string, fcmToken: string) {
  return supabase
    .from('notification_devices')
    .upsert(
      {
        user_id: userId,
        expo_push_token: `fcm:${fcmToken}`,
        fcm_token: fcmToken,
        platform: Platform.OS,
        device_id: `${Platform.OS}-${Device.modelName || 'device'}`,
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: 'fcm_token' },
    );
}

export async function registerForFcmNotifications(userId: string) {
  await setupAndroidNotificationChannels();
  await setupNotifeeChannels();

  const hasPermission = await ensureTrayNotificationPermissions();
  if (!hasPermission || !Device.isDevice) {
    return null;
  }

  await messaging().registerDeviceForRemoteMessages();
  const fcmToken = await messaging().getToken();
  if (!fcmToken) return null;

  const { error } = await upsertFcmToken(userId, fcmToken);
  if (error) {
    console.warn('[FCM] Failed to register device token:', error.message);
    return null;
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
    await setupNotifeeChannels();
    await notifee.displayNotification({
      title: input.title,
      body: input.body,
      data: input.data as Record<string, string>,
      android: {
        channelId: input.channelId,
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 150, 250],
        pressAction: { id: 'default' },
      },
    });
  });
}
