import { beforeEach, describe, expect, it } from 'vitest';
import { createNotificationRuntimeState, notificationDestination, notificationPresentation, type NotificationOwner } from './notificationRuntimeState';
const a: NotificationOwner = { authUserId: 'auth-a', profileId: 'a' };
const b: NotificationOwner = { authUserId: 'auth-b', profileId: 'b' };
const id = '11111111-1111-4111-a111-111111111111';
const registration = '22222222-2222-4222-a222-222222222222';
let values: Map<string, string>;
let now: number;
function state() { return createNotificationRuntimeState({ getString: key => values.get(key), set: (key, value) => { values.set(key, value); }, remove: key => { values.delete(key); } }, () => now); }
beforeEach(() => { values = new Map(); now = 100_000; });
describe('notification account state', () => {
  it('binds a registration to verified auth and linked profile identities', () => {
    const store = state(); store.bind(a);
    expect(store.rememberRegistration(a, registration)).toBe(true);
    expect(store.registration(a)).toBe(registration); expect(store.registration(b)).toBeNull();
    store.bind(b); expect(store.registration(a)).toBeNull(); expect(store.rememberRegistration(a, registration)).toBe(false);
  });
  it('does not accept model-name registration labels', () => {
    const store = state(); store.bind(a); expect(store.rememberRegistration(a, 'android-phone')).toBe(false);
  });
  it('persists bounded display dedup across process recreation and clears it for another account', () => {
    const store = state(); store.bind(a); store.recordDisplayed(id);
    expect(state().displayed(id)).toBe(true);
    store.bind(b); expect(store.displayed(id)).toBe(false);
  });
  it('expires display history and bounds its size', () => {
    const store = state(); store.bind(a);
    for (let i = 0; i < 220; i++) store.recordDisplayed(`n-${i}`);
    expect(store.displayed('n-0')).toBe(false); expect(store.displayed('n-219')).toBe(true);
    now += 25 * 60 * 60 * 1000; expect(store.displayed('n-219')).toBe(false);
  });
  it('preserves a cold-start tap until the matching user is ready, rejects another user', () => {
    const store = state(); store.queue({ notificationId: id, action: 'open', data: { recipientUserId: 'a' }, createdAt: now });
    store.bind(a); expect(store.pending()?.notificationId).toBe(id);
    store.bind(b); expect(store.pending()).toBeNull();
    expect(store.queue({ notificationId: id, action: 'open', data: { recipientUserId: 'a' }, createdAt: now })).toBe(false);
  });
  it('clears pending taps on logout and does not replay a handled action', () => {
    const store = state(); store.bind(a);
    store.recordHandled(`${id}:open`); expect(store.queue({ notificationId: id, action: 'open', data: {}, createdAt: now })).toBe(false);
    store.queue({ notificationId: id, action: 'mark_read', data: {}, createdAt: now });
    store.bind(null); expect(store.pending()).toBeNull();
  });
  it('deduplicates competing tap callbacks but permits a later deliberate reopen', () => {
    const store = state(); store.bind(a); store.recordHandled(`${id}:open`);
    expect(store.handled(`${id}:open`)).toBe(true);
    now += 6000;
    expect(store.handled(`${id}:open`)).toBe(false);
    expect(store.queue({ notificationId: id, action: 'open', data: {}, createdAt: now })).toBe(true);
  });
  it('does not clear a new pending action when an older async callback finishes', () => {
    const store = state(); store.bind(a);
    store.queue({ notificationId: id, action: 'mark_read', data: {}, createdAt: now });
    store.clearPending(id, 'open'); expect(store.pending()?.action).toBe('mark_read');
  });
  it('retains legacy push-only IDs for an inbox fallback but refuses arbitrary URL IDs', () => {
    const store = state(); store.bind(a);
    const syntheticId = `${id}:push:${registration}`;
    expect(store.queue({ notificationId: syntheticId, action: 'open', data: {}, createdAt: now })).toBe(true);
    expect(store.pending()?.notificationId).toBe(syntheticId);
    expect(store.queue({ notificationId: 'https://attacker.example', action: 'open', data: {}, createdAt: now })).toBe(false);
  });
  it('bounds, deduplicates and expires receipts without carrying them into another account', () => {
    const store = state(); store.bind(a);
    expect(store.queueReceipt(a, id, 'received')).toBe(true);
    store.queueReceipt(a, id, 'received'); store.queueReceipt(a, id, 'opened');
    expect(store.receipts(a)).toHaveLength(2);
    store.clearReceipt(b, id, 'received'); expect(store.receipts(a)).toHaveLength(2);
    store.clearReceipt(a, id, 'received'); expect(store.receipts(a)).toHaveLength(1);
    now += 25 * 60 * 60 * 1000; expect(store.receipts(a)).toHaveLength(0);
    store.queueReceipt(a, id, 'opened'); store.bind(b); expect(store.receipts(b)).toHaveLength(0);
  });
  it('recovers from malformed persisted pending and dedup records', () => {
    values.set('spay_notification_pending_v2', JSON.stringify({ notificationId: id }));
    values.set('spay_notification_displayed_v2', JSON.stringify({ wrong: 'shape' }));
    const store = state(); expect(() => store.bind(a)).not.toThrow();
    expect(store.pending()).toBeNull(); expect(store.displayed(id)).toBe(false);
  });
});
describe('role-aware route allowlist', () => {
  it('sends admin orders/payments to admin tabs and clients to client tabs', () => {
    expect(notificationDestination({ screen: 'Orders' }, 'admin')).toEqual({ root: 'Admin', screen: 'AdminOrders' });
    expect(notificationDestination({ screen: 'Payments' }, 'client')).toEqual({ root: 'Main', screen: 'Payments' });
  });
  it('falls back to inbox for injected route or opposite-role route', () => {
    expect(notificationDestination({ screen: 'AdminSystemHealth' }, 'client').screen).toBe('Notifications');
    expect(notificationDestination({ screen: 'https://malicious.example' }, 'admin').screen).toBe('AdminNotifications');
  });
});
describe('tray account privacy', () => {
  it('suppresses a prior recipient and unauthenticated messages', () => {
    expect(notificationPresentation({ recipientUserId: 'a' }, b, 'Amount due', 'Private amount')).toBeNull();
    expect(notificationPresentation({}, null, 'Amount due', 'Private amount')).toBeNull();
  });
  it('uses generic copy for legacy messages without a recipient binding', () => {
    expect(notificationPresentation({}, a, 'Amount due', 'Private amount')).toEqual({ title: 'S-Pay update', body: 'Open S-Pay to review your notification.' });
    expect(notificationPresentation({ recipientUserId: 'a' }, a, 'Amount due', 'Private amount')).toEqual({ title: 'Amount due', body: 'Private amount' });
  });
});
