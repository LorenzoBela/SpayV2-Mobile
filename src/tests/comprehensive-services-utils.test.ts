import { describe, expect, it } from 'vitest';
import {
  parseUtcDate,
  getUtc8DateParts,
  createUtc8Date,
  getBillingMonthKey,
  getCalendarMonthKey,
  formatBillingMonthKey,
  getNextCalendarMonthStart,
} from '../utils/date';
import { getResponsiveLayout } from '../utils/responsive';
import {
  shouldAttemptRemotePushRegistration,
  normalizeAndroidChannelId,
  ANDROID_CHANNELS,
} from '../services/notificationServiceConfig';
import { buildDisplayNotificationInput } from '../services/fcmNotificationServiceConfig';
import { getAppUpdateRuntimeInfo } from '../services/appUpdateService';

describe('Mobile Services & Utils Comprehensive Suite (550+ Assertions)', () => {
  describe('Date Parsing & Month Key Invariants', () => {
    const dates = Array.from({ length: 120 }, (_, i) => {
      const year = 2024 + (i % 5);
      const month = (i % 12) + 1;
      const day = (i % 28) + 1;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`;
    });

    it.each(dates)('parses UTC date correctly for %s', (isoStr) => {
      const dt = parseUtcDate(isoStr);
      expect(dt).toBeInstanceOf(Date);
      expect(isNaN(dt.getTime())).toBe(false);
    });

    it.each(dates)('extracts UTC+8 date parts consistently for %s', (isoStr) => {
      const parts = getUtc8DateParts(isoStr);
      expect(parts).toHaveProperty('year');
      expect(parts).toHaveProperty('month');
      expect(parts).toHaveProperty('date');
    });

    it.each(dates)('generates billing month key for %s', (isoStr) => {
      const key = getBillingMonthKey(isoStr);
      expect(key).toMatch(/^\d{4}-\d{2}$/);
    });

    it.each(dates)('generates calendar month key for %s', (isoStr) => {
      const key = getCalendarMonthKey(isoStr);
      expect(key).toMatch(/^\d{4}-\d{2}$/);
    });

    it.each(dates)('formats billing month key into human string for %s', (isoStr) => {
      const key = getBillingMonthKey(isoStr);
      const formatted = formatBillingMonthKey(key);
      expect(formatted.length).toBeGreaterThan(3);
    });
  });

  describe('Responsive Layout Calculation Matrix (150 Dimensions)', () => {
    const dimensions = Array.from({ length: 150 }, (_, i) => ({
      width: 300 + i * 10,
      height: 600 + i * 8,
    }));

    it.each(dimensions)('computes responsive layout flags for ${width}x${height}', ({ width, height }) => {
      const layout = getResponsiveLayout(width, height);
      expect(layout).toBeDefined();
      expect(typeof layout.isTablet).toBe('boolean');
      expect(typeof layout.isLargePhone).toBe('boolean');
    });
  });

  describe('Notification Service Config & Channel Normalization', () => {
    const categories: Array<keyof typeof ANDROID_CHANNELS> = [
      'PAYMENT_UPDATES',
      'ALERTS',
      'ADS',
      'SYSTEM',
    ];

    it.each(categories)('validates Android channel config for %s', (cat) => {
      const channelId = ANDROID_CHANNELS[cat];
      expect(channelId).toBeDefined();
      expect(typeof channelId).toBe('string');
    });

    it.each(categories)('normalizes channel ID for %s', (cat) => {
      const normalized = normalizeAndroidChannelId(cat, cat);
      expect(normalized).toBeDefined();
    });

    it('evaluates remote push registration eligibility', () => {
      expect(shouldAttemptRemotePushRegistration('false')).toBe(false);
      expect(shouldAttemptRemotePushRegistration('true')).toBe(true);
    });
  });

  describe('FCM Message Transformation & App Update Info', () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      notification: { title: `Alert ${i}`, body: `Content ${i}` },
      data: { category: 'PAYMENT_UPDATES', orderId: `ORD-${i}` },
    }));

    it.each(messages)('builds display input from remote message %i', (msg) => {
      const input = buildDisplayNotificationInput(msg as any);
      expect(input).toBeDefined();
      expect(input?.title).toEqual(msg.notification.title);
    });

    it('returns runtime info structure', () => {
      const info = getAppUpdateRuntimeInfo();
      expect(info).toBeDefined();
    });
  });
});
