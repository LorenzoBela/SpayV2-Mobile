import { normalizeAndroidChannelId, shouldAttemptRemotePushRegistration } from './notificationServiceConfig';

function assertEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

assertEqual(shouldAttemptRemotePushRegistration(undefined), true);
assertEqual(shouldAttemptRemotePushRegistration(''), true);
assertEqual(shouldAttemptRemotePushRegistration('true'), true);
assertEqual(shouldAttemptRemotePushRegistration('false'), false);
assertEqual(shouldAttemptRemotePushRegistration('FALSE'), false);

assertEqual(normalizeAndroidChannelId('spay-system-v1', 'SYSTEM'), 'spay-system-v2');
assertEqual(normalizeAndroidChannelId('spay-ads-v1', 'ADS'), 'spay-ads-v2');
assertEqual(normalizeAndroidChannelId('spay-payments-v2', 'SYSTEM'), 'spay-payments-v2');
assertEqual(normalizeAndroidChannelId('', 'ALERTS'), 'spay-alerts-v2');
