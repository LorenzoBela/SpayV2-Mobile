import { describe, it, expect } from 'vitest';
import { buildDisplayNotificationInput } from './fcmNotificationServiceConfig';

describe('fcmNotificationServiceConfig', () => {
  it('builds display notification input with transformed channel ID and payload', () => {
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

    expect(input).not.toBeNull();
    expect(input?.title).toBe('Reminder');
    expect(input?.body).toBe('Pay today.');
    expect(input?.channelId).toBe('spay-payments-v2');
    expect(input?.data?.notificationId).toBe('notif-1');
  });
});
