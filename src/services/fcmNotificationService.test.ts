import { buildDisplayNotificationInput } from './fcmNotificationServiceConfig';

function assertEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const input = buildDisplayNotificationInput({
  notification: {
    title: 'Reminder',
    body: 'Pay today.',
  },
  data: {
    channelId: 'spay-payments-v1',
    notificationId: 'notif-1',
    screen: 'Payments',
  },
});

assertEqual(input.title, 'Reminder');
assertEqual(input.body, 'Pay today.');
assertEqual(input.channelId, 'spay-payments-v2');
assertEqual(input.data.notificationId, 'notif-1');
