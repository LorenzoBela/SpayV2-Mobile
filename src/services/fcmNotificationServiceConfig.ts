import { normalizeAndroidChannelId, type NotificationCategory } from './notificationServiceConfig';

export type RemoteMessageLike = {
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, unknown>;
};

export function buildDisplayNotificationInput(message: RemoteMessageLike) {
  const data = message.data ?? {};
  const category = typeof data.category === 'string'
    ? data.category as NotificationCategory
    : 'SYSTEM';
  const requestedChannelId = typeof data.channelId === 'string' ? data.channelId : undefined;

  return {
    title: message.notification?.title || (typeof data.title === 'string' ? data.title : 'S-Pay'),
    body: message.notification?.body || (typeof data.body === 'string' ? data.body : 'You have a new notification.'),
    channelId: normalizeAndroidChannelId(requestedChannelId, category),
    data,
  };
}
