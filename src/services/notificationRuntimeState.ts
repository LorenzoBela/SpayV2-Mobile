/** OTA-safe bounded state; no native imports so account/race semantics can be tested directly. */
export interface NotificationStateStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}
export type NotificationOwner = { authUserId: string; profileId: string };
export type PendingNotificationAction = {
  notificationId: string;
  action: 'open' | 'mark_read';
  data: Record<string, string>;
  createdAt: number;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validNotificationUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
function validActionId(value: unknown): value is string {
  if (validNotificationUuid(value)) return true;
  if (typeof value !== 'string') return false;
  const parts = value.split(':push:');
  return parts.length === 2 && parts.every(validNotificationUuid);
}
export function notificationPresentation(data: Record<string, unknown>, owner: NotificationOwner | null, title: string, body: string) {
  if (!owner) return null;
  const recipient = typeof data.recipientUserId === 'string' ? data.recipientUserId : typeof data.targetUserId === 'string' ? data.targetUserId : null;
  if (recipient && recipient !== owner.profileId) return null;
  return recipient ? { title, body } : { title: 'S-Pay update', body: 'Open S-Pay to review your notification.' };
}
type PendingReceipt = { notificationId: string; action: 'received' | 'opened'; createdAt: number };
const keys = { owner: 'spay_notification_owner_v2', registration: 'spay_notification_registration_v2', displayed: 'spay_notification_displayed_v2', pending: 'spay_notification_pending_v2', handled: 'spay_notification_handled_v2', receipts: 'spay_notification_receipts_v2' };
const MAX_AGE = 24 * 60 * 60 * 1000;

export function createNotificationRuntimeState(storage: NotificationStateStorage, now = () => Date.now()) {
  const read = <T>(key: string): T | null => { try { const raw = storage.getString(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; } };
  const write = (key: string, value: unknown) => { storage.set(key, JSON.stringify(value)); };
  const owner = () => { const row = read<NotificationOwner>(keys.owner); return row && typeof row.authUserId === 'string' && typeof row.profileId === 'string' ? row : null; };
  const same = (a: NotificationOwner | null, b: NotificationOwner | null) => a?.authUserId === b?.authUserId && a?.profileId === b?.profileId;
  const bounded = (key: string) => { const rows = read<{ id: string; at: number }[]>(key); return (Array.isArray(rows) ? rows : []).filter(row => row && typeof row.id === 'string' && Number.isFinite(row.at) && row.at > now() - MAX_AGE).slice(-200); };
  const seen = (key: string, id: string) => bounded(key).some(row => row.id === id && (key !== keys.handled || !id.endsWith(':open') || row.at > now() - 5000));
  const record = (key: string, id: string) => write(key, [...bounded(key).filter(row => row.id !== id), { id, at: now() }].slice(-200));
  const receipts = () => { const rows = read<PendingReceipt[]>(keys.receipts); return (Array.isArray(rows) ? rows : []).filter(row => row && validNotificationUuid(row.notificationId) && ['received', 'opened'].includes(row.action) && Number.isFinite(row.createdAt) && row.createdAt > now() - MAX_AGE).slice(-100); };
  return {
    owner,
    bind(next: NotificationOwner | null) {
      const previous = owner();
      if (!same(previous, next)) {
        storage.remove(keys.registration); storage.remove(keys.displayed); storage.remove(keys.handled); storage.remove(keys.receipts);
        // Retain a cold-start tap only when its intended recipient matches the newly verified owner.
        const pending = read<PendingNotificationAction>(keys.pending);
        const recipient = pending?.data?.recipientUserId || pending?.data?.targetUserId;
        if (previous || !next || (recipient && recipient !== next.profileId)) storage.remove(keys.pending);
      }
      if (next) write(keys.owner, next); else storage.remove(keys.owner);
    },
    rememberRegistration(expected: NotificationOwner, registrationId: unknown) {
      if (!validNotificationUuid(registrationId) || !same(owner(), expected)) return false;
      write(keys.registration, { ...expected, registrationId }); return true;
    },
    registration(expected: NotificationOwner) {
      const row = read<NotificationOwner & { registrationId: string }>(keys.registration);
      return row && same(row, expected) && same(owner(), expected) && validNotificationUuid(row.registrationId) ? row.registrationId : null;
    },
    queueReceipt(expected: NotificationOwner, notificationId: string, action: PendingReceipt['action']) {
      if (!same(owner(), expected) || !validNotificationUuid(notificationId)) return false;
      write(keys.receipts, [...receipts().filter(row => row.notificationId !== notificationId || row.action !== action), { notificationId, action, createdAt: now() }].slice(-100));
      return true;
    },
    receipts(expected: NotificationOwner) { return same(owner(), expected) ? receipts() : []; },
    clearReceipt(expected: NotificationOwner, notificationId: string, action: PendingReceipt['action']) {
      if (same(owner(), expected)) write(keys.receipts, receipts().filter(row => row.notificationId !== notificationId || row.action !== action));
    },
    displayed(id: string) { return seen(keys.displayed, id); },
    recordDisplayed(id: string) { record(keys.displayed, id); },
    handled(id: string) { return seen(keys.handled, id); },
    recordHandled(id: string) { record(keys.handled, id); },
    queue(action: PendingNotificationAction) {
      if (!validActionId(action.notificationId)) return false;
      const recipient = action.data.recipientUserId || action.data.targetUserId;
      const current = owner();
      if (current && recipient && recipient !== current.profileId) return false;
      if (seen(keys.handled, `${action.notificationId}:${action.action}`)) return false;
      write(keys.pending, { ...action, createdAt: now() }); return true;
    },
    pending() {
      const row = read<PendingNotificationAction>(keys.pending);
      if (!row || !validActionId(row.notificationId) || !['open', 'mark_read'].includes(row.action) || !row.data || typeof row.data !== 'object' || !Number.isFinite(row.createdAt) || row.createdAt <= now() - MAX_AGE || row.createdAt > now() + 60_000) {
        storage.remove(keys.pending); return null;
      }
      return row;
    },
    clearPending(notificationId: string, action: PendingNotificationAction['action']) {
      const row = read<PendingNotificationAction>(keys.pending);
      if (row?.notificationId === notificationId && row.action === action) storage.remove(keys.pending);
    },
  };
}

/** Payload-controlled route names are allowlisted; ownership is verified separately before use. */
export function notificationDestination(data: Record<string, unknown>, role: 'admin' | 'client') {
  const type = typeof data.type === 'string' ? data.type : '';
  const screen = typeof data.screen === 'string' ? data.screen : '';
  if (role === 'admin') {
    if (screen === 'AdminRequests' || type === 'PURCHASE_REQUEST_SUBMITTED') return { root: 'AdminRequests', screen: null };
    if (screen === 'Orders' || screen === 'AdminOrders') return { root: 'Admin', screen: 'AdminOrders' };
    if (screen === 'Payments' || screen === 'AdminPayments') return { root: 'Admin', screen: 'AdminPayments' };
    if (screen === 'Settings' || screen === 'AdminSettings') return { root: 'Admin', screen: 'AdminSettings' };
    return { root: 'Admin', screen: 'AdminNotifications' };
  }
  if (screen === 'RequestBuy' || screen === 'MyRequests' || type === 'PURCHASE_REQUEST_APPROVED') return { root: 'Main', screen: 'RequestBuy' };
  const target = ['Orders', 'Payments', 'Budget', 'Settings'].includes(screen) ? screen : 'Notifications';
  return { root: 'Main', screen: target };
}
