import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';
import { displayFcmRemoteMessage, setupNotifeeChannels } from './src/services/fcmNotificationService';
import { setupAndroidNotificationChannels } from './src/services/notificationService';

void setupAndroidNotificationChannels();
void setupNotifeeChannels();

notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    if (type === EventType.DISMISSED) {
      return;
    }

    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'mark_read') {
      try {
        await notifee.decrementBadgeCount();
        if (detail.notification?.id) {
          await notifee.cancelNotification(detail.notification.id);
        }
      } catch {
        // Non-blocking
      }
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
