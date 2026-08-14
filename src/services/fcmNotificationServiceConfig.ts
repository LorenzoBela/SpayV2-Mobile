import { normalizeAndroidChannelId } from './notificationServiceConfig';
import type { NotificationCategory } from './notificationServiceConfig';

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

  const title = message.notification?.title || (typeof data.title === 'string' ? data.title : '');
  const body = message.notification?.body || (typeof data.body === 'string' ? data.body : '');

  if (!title && !body) {
    return null;
  }

  return {
    title: title || 'S-Pay',
    body: body,
    channelId: normalizeAndroidChannelId(requestedChannelId, category),
    data,
  };
}
