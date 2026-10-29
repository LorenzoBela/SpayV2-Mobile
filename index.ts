import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';
import { displayFcmRemoteMessage, setupNotifeeChannels } from './src/services/fcmNotificationService';
import { markOwnedTrayNotificationRead, setupAndroidNotificationChannels } from './src/services/notificationService';
import { notificationRuntime, queueNotificationAction } from './src/services/notificationRuntime';

void setupAndroidNotificationChannels();
void setupNotifeeChannels();

notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    if (type === EventType.DISMISSED) {
      return;
    }

    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'mark_read') {
      try {
        const data = detail.notification?.data || {};
        const id = typeof data.notificationId === 'string' ? data.notificationId : '';
        if (id && await markOwnedTrayNotificationRead(id, detail.notification?.id)) notificationRuntime.recordHandled(`${id}:mark_read`);
        else queueNotificationAction(data, 'mark_read');
      } catch {
        queueNotificationAction(detail.notification?.data || {}, 'mark_read');
      }
    } else if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      queueNotificationAction(detail.notification?.data || {}, 'open');
    }
  } catch (err) {
    console.warn('[Notifee] Background event handler handled error:', err);
  }
});

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    if (!remoteMessage) return;
    await displayFcmRemoteMessage(remoteMessage);
  } catch (err) {
    console.warn('[FCM] Background message handler handled error:', err);
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
