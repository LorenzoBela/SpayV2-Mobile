export type NotificationCategory = 'PAYMENT_UPDATES' | 'ALERTS' | 'ADS' | 'SYSTEM';

export const ANDROID_CHANNELS: Record<NotificationCategory, string> = {
  PAYMENT_UPDATES: 'spay-payments-v3',
  ALERTS: 'spay-alerts-v3',
  ADS: 'spay-ads-v3',
  SYSTEM: 'spay-system-v3',
};

const LEGACY_ANDROID_CHANNELS: Record<string, NotificationCategory> = {
  'spay-payments-v1': 'PAYMENT_UPDATES',
  'spay-alerts-v1': 'ALERTS',
  'spay-ads-v1': 'ADS',
  'spay-system-v1': 'SYSTEM',
  'spay-payments-v2': 'PAYMENT_UPDATES',
  'spay-alerts-v2': 'ALERTS',
  'spay-ads-v2': 'ADS',
  'spay-system-v2': 'SYSTEM',
};

export function shouldAttemptRemotePushRegistration(value: string | undefined) {
  return value?.trim().toLowerCase() !== 'false';
}

export function normalizeAndroidChannelId(
  requestedChannelId: string | undefined,
  fallbackCategory: NotificationCategory,
) {
  const channelId = requestedChannelId?.trim() || '';
  const legacyCategory = LEGACY_ANDROID_CHANNELS[channelId];
  if (legacyCategory) return ANDROID_CHANNELS[legacyCategory];
  return channelId || ANDROID_CHANNELS[fallbackCategory] || ANDROID_CHANNELS.SYSTEM;
}
