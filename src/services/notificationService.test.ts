import { describe, it, expect } from 'vitest';
import { normalizeAndroidChannelId, shouldAttemptRemotePushRegistration } from './notificationServiceConfig';

describe('notificationServiceConfig', () => {
  it('evaluates shouldAttemptRemotePushRegistration correctly', () => {
    expect(shouldAttemptRemotePushRegistration(undefined)).toBe(true);
    expect(shouldAttemptRemotePushRegistration('')).toBe(true);
    expect(shouldAttemptRemotePushRegistration('true')).toBe(true);
    expect(shouldAttemptRemotePushRegistration('false')).toBe(false);
    expect(shouldAttemptRemotePushRegistration('FALSE')).toBe(false);
  });

  it('normalizes Android channel IDs properly', () => {
    expect(normalizeAndroidChannelId('spay-system-v1', 'SYSTEM')).toBe('spay-system-v3');
    expect(normalizeAndroidChannelId('spay-ads-v1', 'ADS')).toBe('spay-ads-v3');
    expect(normalizeAndroidChannelId('spay-payments-v2', 'SYSTEM')).toBe('spay-payments-v3');
    expect(normalizeAndroidChannelId('', 'ALERTS')).toBe('spay-alerts-v3');
  });
});
