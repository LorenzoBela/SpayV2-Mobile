import React, { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { ThemeContext } from '../navigation/navigationTypes';
import { supabase } from '../utils/supabase';
import { storage } from '../utils/queryPersister';
import { financialNotificationContextSchema, notificationDetailMoney } from '../utils/financialNotificationDetails';

export const deliveryStatusLabels = {
  PENDING: 'Queued', DEFERRED: 'Scheduled for later', PROCESSING: 'Preparing', HANDOFF: 'Sending to provider',
  ACCEPTED: 'Provider accepted', REPORTED: 'App reported receipt', OPENED: 'App reported opened', SKIPPED: 'Not sent',
  SUPERSEDED: 'Replaced by a newer update', UNKNOWN: 'Delivery not confirmed', RETRY: 'Waiting to retry', FAILED: 'Send failed', DEAD_LETTER: 'Retries stopped',
} as const;
const statusSchema = z.enum(Object.keys(deliveryStatusLabels) as [keyof typeof deliveryStatusLabels, ...(keyof typeof deliveryStatusLabels)[]]);
const channelSchema = z.enum(['EMAIL', 'PUSH', 'IN_APP']);
const rowSchema = z.object({ id: z.string().uuid(), recipientName: z.string(), channel: channelSchema, status: statusSchema, attempts: z.number().int().nonnegative(), createdAt: z.string(), providerMessageId: z.string().nullish() });
const operationRowSchema = z.object({ id: z.string().uuid(), label: z.string().max(80), recipientName: z.string(), status: z.string().max(80), attempts: z.number().int().nonnegative(), updatedAt: z.string() });
const historySchema = z.object({ available: z.boolean(), actorId: z.string().min(1).optional(), deliveries: z.array(rowSchema).max(30), operations: z.array(operationRowSchema).max(30).optional(), nextCursor: z.string().uuid().nullish() });
const previewSchema = z.object({ context: financialNotificationContextSchema.nullable(), originalStatus: statusSchema, canResend: z.boolean(), notice: z.string() });
const operationSchema = z.object({ key: z.string().uuid(), reason: z.string().trim().min(5).max(300), state: z.enum(['unknown', 'queued']) });
type Delivery = z.infer<typeof rowSchema>;
type Preview = z.infer<typeof previewSchema>;
type Operation = z.infer<typeof operationSchema>;
const channelLabels = { EMAIL: 'Email', PUSH: 'Phone notification', IN_APP: 'S-Pay inbox' };
export function deliveryStateLabel(channel: Delivery['channel'], status: Delivery['status']) {
  return channel === 'IN_APP' && status === 'ACCEPTED' ? 'Saved in inbox' : channel === 'IN_APP' && status === 'HANDOFF' ? 'Saving to inbox' : deliveryStatusLabels[status];
}
const statuses = { paid: 'Paid', unpaid: 'Unpaid', no_payment_required: 'No payment required', unavailable: 'Unavailable' };
const apiUrl = () => `${(process.env.EXPO_PUBLIC_API_URL || 'https://nootspaytracker.vercel.app').replace(/\/$/, '')}/api/notifications/deliveries`;
function dateLabel(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Time unavailable'; }
function operationKey() {
  // An operation identifier is not a credential. Keep this within existing JavaScript capabilities.
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function NotificationDeliveryHistory() {
  const { isDarkMode } = useContext(ThemeContext);
  const [available, setAvailable] = useState(false), [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<Delivery[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [otherEmails, setOtherEmails] = useState<z.infer<typeof operationRowSchema>[]>([]);
  const [channel, setChannel] = useState(''), [status, setStatus] = useState('');
  const [showStatuses, setShowStatuses] = useState(false), [busy, setBusy] = useState(false), [previewBusy, setPreviewBusy] = useState(false), [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Delivery | null>(null), [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState(''), [operation, setOperation] = useState<Operation | null>(null), [monthIndex, setMonthIndex] = useState(0), [message, setMessage] = useState('');
  const serverActor = useRef<string | null>(null);
  const active = useRef(true), owner = useRef<string | null>(null), epoch = useRef(0), listSequence = useRef(0), previewSequence = useRef(0), selectedId = useRef<string | null>(null);
  const listAbort = useRef<AbortController | null>(null), previewAbort = useRef<AbortController | null>(null);
  const sendingRef = useRef(false), operations = useRef(new Map<string, Operation>()), filters = useRef({ channel: '', status: '' });
  const textColor = isDarkMode ? '#f8fafc' : '#0f172a', muted = isDarkMode ? '#94a3b8' : '#64748b', border = isDarkMode ? '#223049' : '#e2e8f0';
  const card = { backgroundColor: isDarkMode ? '#161c2a' : '#ffffff', borderColor: border };
  const textStyle = { color: textColor }, noteStyle = { color: muted };
  const savedKey = (id: string) => `spay.notification.resend:${owner.current}:${id}`;

  function clearPreview() {
    previewSequence.current++; previewAbort.current?.abort(); selectedId.current = null;
    setSelected(null); setPreview(null); setPreviewBusy(false); setReason(''); setOperation(null); setMonthIndex(0);
  }
  function clearOwner() {
    epoch.current++; listSequence.current++; listAbort.current?.abort(); clearPreview(); owner.current = null;
    operations.current.clear(); serverActor.current = null; setAvailable(false); setRows([]); setOtherEmails([]); setCursor(null); setMessage(''); setBusy(false); setSending(false); sendingRef.current = false;
  }
  async function authorizedFetch(url: string, init: RequestInit, expectedOwner: string) {
    const { data } = await supabase.auth.getSession(); const session = data.session;
    if (!session || session.user.id !== expectedOwner || owner.current !== expectedOwner) throw new Error('Open delivery history again for the signed-in account.');
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${session.access_token}` } });
    const current = await supabase.auth.getSession();
    if (current.data.session?.user.id !== expectedOwner || owner.current !== expectedOwner) throw new Error('The signed-in account changed.');
    return response;
  }
  async function load(next?: string) {
    const expectedOwner = owner.current; if (!expectedOwner) return;
    listAbort.current?.abort(); const controller = new AbortController(); listAbort.current = controller;
    const sequence = ++listSequence.current, generation = epoch.current; setBusy(true); setMessage('');
    try {
      const params = new URLSearchParams(); if (next) params.set('cursor', next); if (filters.current.channel) params.set('channel', filters.current.channel); if (filters.current.status) params.set('status', filters.current.status);
      const response = await authorizedFetch(`${apiUrl()}${params.size ? `?${params}` : ''}`, { signal: controller.signal }, expectedOwner);
      if (!active.current || generation !== epoch.current || sequence !== listSequence.current) return;
      if (!response.ok) { if (response.status === 401 || response.status === 403) clearOwner(); throw new Error('Unable to load delivery history. Please try again.'); }
      const parsed = historySchema.safeParse(await response.json());
      if (!parsed.success) throw new Error('Delivery history could not be read. Please try again.');
      if (!active.current || generation !== epoch.current || sequence !== listSequence.current || owner.current !== expectedOwner) return;
      serverActor.current = parsed.data.actorId ?? null; setOtherEmails(parsed.data.operations ?? []); setAvailable(parsed.data.available);
      if (!parsed.data.available) { setRows([]); setOtherEmails([]); setCursor(null); clearPreview(); return; }
      setRows(previous => next ? [...new Map([...previous, ...parsed.data.deliveries].map(row => [row.id, row])).values()] : parsed.data.deliveries); setCursor(parsed.data.nextCursor ?? null);
    } catch (error) {
      if (active.current && generation === epoch.current && sequence === listSequence.current && !controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Unable to load delivery history.');
    } finally { if (active.current && generation === epoch.current && sequence === listSequence.current) setBusy(false); }
  }
  useEffect(() => {
    active.current = true;
    const initialize = async () => {
      const generation = epoch.current; const { data } = await supabase.auth.getSession();
      if (!active.current || generation !== epoch.current || !data.session) return;
      owner.current = data.session.user.id; void load();
    };
    void initialize().catch(() => {});
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session?.user.id && session.user.id !== owner.current)) {
        clearOwner(); if (session) setTimeout(() => { if (active.current) void initialize().catch(() => {}); }, 0);
      }
    });
    return () => { active.current = false; epoch.current++; listSequence.current++; previewSequence.current++; listAbort.current?.abort(); previewAbort.current?.abort(); auth.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function filter(nextChannel: string, nextStatus: string) {
    if (sendingRef.current) return;
    filters.current = { channel: nextChannel, status: nextStatus }; setChannel(nextChannel); setStatus(nextStatus); setRows([]); setOtherEmails([]); setCursor(null); clearPreview(); void load();
  }
  function saveOperation(id: string, value: Operation) {
    operations.current.set(id, value); setOperation(value);
    try { storage.set(savedKey(id), JSON.stringify(value)); } catch { /* Keep the in-memory retry identity if local persistence is unavailable. */ }
  }
  function restoreOperation(id: string) {
    let saved = operations.current.get(id) ?? null;
    if (!saved) { try { const parsed = operationSchema.safeParse(JSON.parse(storage.getString(savedKey(id)) || 'null')); if (parsed.success) saved = parsed.data; } catch {} }
    if (saved) operations.current.set(id, saved); setOperation(saved); setReason(saved?.reason || '');
  }
  async function openPreview(row: Delivery) {
    if (sendingRef.current || !owner.current) return;
    previewAbort.current?.abort(); const controller = new AbortController(); previewAbort.current = controller;
    const sequence = ++previewSequence.current, generation = epoch.current, expectedOwner = owner.current;
    selectedId.current = row.id; setSelected(row); setPreview(null); setMonthIndex(0); restoreOperation(row.id); setPreviewBusy(true); setMessage('');
    try {
      const response = await authorizedFetch(apiUrl(), { method: 'POST', signal: controller.signal, body: JSON.stringify({ id: row.id, action: 'preview' }) }, expectedOwner);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(response.status === 409 && typeof result?.error === 'string' && (result.error.startsWith('Payment summaries ') || result.error === 'Delivery format is not supported by this tool') ? 'Payment summaries cover several orders. Review the saved summary in the S-Pay inbox and open each order for its current status.' : 'Unable to load current order details. Refresh the history and try again.');
      }
      const parsed = previewSchema.safeParse(await response.json()); if (!parsed.success) throw new Error('Current order details could not be read.');
      if (active.current && generation === epoch.current && sequence === previewSequence.current && selectedId.current === row.id) setPreview(parsed.data);
    } catch (error) {
      if (active.current && generation === epoch.current && sequence === previewSequence.current && !controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Unable to load the preview.');
    } finally { if (active.current && generation === epoch.current && sequence === previewSequence.current) setPreviewBusy(false); }
  }
  async function sendUpdate() {
    if (!owner.current || !serverActor.current || !selected || !preview?.context || !preview.canResend || sendingRef.current || operation?.state === 'queued') return;
    const normalized = reason.trim(); if (normalized.length < 5 || normalized.length > 300) { setMessage('Enter a reason of 5–300 characters.'); return; }
    const row = selected, expectedOwner = owner.current, generation = epoch.current;
    let request = operations.current.get(row.id);
    if (!request) { request = { key: operationKey(), reason: normalized, state: 'unknown' }; saveOperation(row.id, request); }
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
    sendingRef.current = true; setSending(true); setMessage('');
    try {
      const response = await authorizedFetch(apiUrl(), { method: 'POST', signal: controller.signal, body: JSON.stringify({ id: row.id, action: 'resend', ownerUserId: serverActor.current, operationKey: request.key, reason: request.reason }) }, expectedOwner);
      const result = await response.json().catch(() => null);
      if (!active.current || generation !== epoch.current || selectedId.current !== row.id) return;
      if (!response.ok || result?.queued !== true) throw new Error(response.status === 409 ? 'This delivery changed or the request could not be confirmed. Refresh the preview before trying again.' : 'The update was not confirmed. Check or retry this request using the same reason.');
      saveOperation(row.id, { ...request, state: 'queued' }); setMessage('Current order update queued. Refresh the history to follow its progress.');
    } catch (error) {
      if (active.current && generation === epoch.current && selectedId.current === row.id) setMessage(controller.signal.aborted ? 'The request was not confirmed. Check or retry this request using the same reason.' : error instanceof Error ? error.message : 'The request was not confirmed.');
    } finally { clearTimeout(timeout); if (generation === epoch.current) { sendingRef.current = false; if (active.current) setSending(false); } }
  }
  const button = (title: string, onPress: () => void, disabled = false, primary = false) => <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={[styles.button, { borderColor: primary ? '#ee4d2d' : border, backgroundColor: primary ? '#ee4d2d' : 'transparent', opacity: disabled ? 0.45 : 1 }]}><Text style={[styles.buttonText, { color: primary ? '#fff' : textColor }]}>{title}</Text></Pressable>;
  if (!available) return null;
  const context = preview?.context, month = context?.installments[monthIndex], shared = (context?.participants.length ?? 0) > 1;
  const statusText = (person: { amountMinor: number | null; status?: string }) => person.amountMinor === null ? statuses.unavailable : person.amountMinor === 0 ? statuses.no_payment_required : person.status === 'paid' ? statuses.paid : person.status === 'unpaid' ? statuses.unpaid : statuses.unavailable;
  return <View style={[styles.card, card]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.header}><Text style={[styles.heading, textStyle]}>Delivery history</Text><Text style={[styles.link, { color: '#ee4d2d' }]}>{expanded ? 'Hide' : 'Manage'}</Text></Pressable>
    {expanded && <View style={styles.content}>
      <Text style={[styles.note, noteStyle]}>Provider acceptance does not confirm delivery. Received and opened statuses appear when reported by the app.</Text>
      <Text style={[styles.label, textStyle]}>Channel</Text><View style={styles.wrap}>{button('All channels', () => filter('', status), sending, channel === '')}{Object.entries(channelLabels).map(([key, title]) => <React.Fragment key={key}>{button(title, () => filter(key, status), sending, channel === key)}</React.Fragment>)}</View>
      <View style={styles.wrap}>{button(status ? deliveryStatusLabels[status as keyof typeof deliveryStatusLabels] : 'All statuses', () => setShowStatuses(value => !value), sending)}{button(busy ? 'Loading…' : 'Refresh history', () => void load(), busy || sending)}</View>
      {showStatuses && <View style={styles.wrap}>{button('All statuses', () => { setShowStatuses(false); filter(channel, ''); }, sending, !status)}{Object.entries(deliveryStatusLabels).map(([key, title]) => <React.Fragment key={key}>{button(title, () => { setShowStatuses(false); filter(channel, key); }, sending, status === key)}</React.Fragment>)}</View>}
      {rows.map(row => <View key={row.id} style={[styles.row, { borderColor: border }]}><Text style={[styles.name, textStyle]}>{row.recipientName}</Text><Text style={[styles.note, noteStyle]}>{channelLabels[row.channel]} · {dateLabel(row.createdAt)}</Text><Text style={[styles.label, { color: '#ee4d2d' }]}>{deliveryStateLabel(row.channel, row.status)}</Text><Text style={[styles.note, noteStyle]}>{row.attempts} attempt{row.attempts === 1 ? '' : 's'}</Text>{button('Preview current order', () => void openPreview(row), sending)}</View>)}
      {!rows.length && <Text style={[styles.note, noteStyle]}>{busy ? 'Loading delivery history…' : 'No delivery records match these filters.'}</Text>}
      {cursor && button('Load more', () => void load(cursor), busy || sending)}
      {otherEmails.length > 0 && <View style={[styles.row, { borderColor: border }]}>
        <Text accessibilityRole="header" style={[styles.heading, textStyle]}>Other email deliveries</Text>
        <Text style={[styles.note, noteStyle]}>Latest 30 records, filtered by your choices. Processing completed does not confirm that an email was sent.</Text>
        {otherEmails.map(row => <View key={row.id} style={[styles.row, { borderColor: border }]}><Text style={[styles.name, textStyle]}>{row.label}</Text><Text style={[styles.note, noteStyle]}>{row.recipientName}</Text><Text style={[styles.label, { color: '#ee4d2d' }]}>{row.status}</Text><Text style={[styles.note, noteStyle]}>{row.attempts} attempt{row.attempts === 1 ? '' : 's'} · {dateLabel(row.updatedAt)}</Text></View>)}
      </View>}
      {selected && <View style={[styles.preview, { borderColor: border }]}>
        <View style={styles.wrap}><Text accessibilityRole="header" style={[styles.heading, textStyle]}>Current order details</Text>{button('Close preview', clearPreview, sending)}</View>
        <Text style={[styles.name, textStyle]}>{selected.recipientName} · {channelLabels[selected.channel]}</Text>
        {previewBusy ? <Text accessibilityLiveRegion="polite" style={[styles.note, noteStyle]}>Loading current order details…</Text> : !preview ? button('Try preview again', () => void openPreview(selected)) : <>
          <Text style={[styles.note, noteStyle]}>This preview shows current saved amounts, not the original message. Payment status may change before the update is sent.</Text>
          <Text style={[styles.note, noteStyle]}>Original delivery: {deliveryStateLabel(selected.channel, preview.originalStatus)}</Text>
          {context ? <><Text style={[styles.name, textStyle]}>{context.itemName}</Text><Text style={[styles.note, noteStyle]}>{context.method} · {shared ? 'Group total' : 'Order total'} {notificationDetailMoney(context.groupTotalMinor)}</Text>
            {context.participants.map(person => <View key={person.userId} style={styles.person}><Text style={[styles.name, textStyle]}>{person.name}{person.own ? ' (Recipient)' : ''}</Text><Text style={[styles.note, noteStyle]}>{person.percentage} · {notificationDetailMoney(person.allocationMinor)} total</Text></View>)}
            {month && <View style={[styles.preview, { borderColor: border }]}><View style={styles.wrap}>{button('Previous month', () => setMonthIndex(index => index - 1), monthIndex === 0)}<Text style={[styles.label, textStyle]}>Month {month.monthNumber}</Text>{button('Next month', () => setMonthIndex(index => index + 1), monthIndex >= context.installments.length - 1)}</View>{month.participants.map(person => <View key={person.userId} style={styles.person}><Text style={[styles.name, textStyle]}>{person.name}{person.own ? ' (Recipient)' : ''}</Text><Text style={[styles.note, noteStyle]}>{notificationDetailMoney(person.amountMinor)} · {statusText(person)}</Text></View>)}</View>}
          </> : <Text style={[styles.note, noteStyle]}>Current order details are unavailable for this recipient. An update cannot be sent.</Text>}
          {context && preview.canResend ? <View style={styles.content}><Text style={[styles.note, noteStyle]}>Send the latest order details using the original channel. This does not replay the old message. Your reason will be saved.</Text><Text style={[styles.label, textStyle]}>Reason for sending an update</Text><TextInput accessibilityLabel="Reason for sending an update" editable={!sending && !operation} multiline maxLength={300} value={reason} onChangeText={setReason} style={[styles.input, { color: textColor, borderColor: border }]} /><Text style={[styles.note, noteStyle]}>{operation ? 'This reason and request ID are retained so retrying does not create another request.' : 'Use 5–300 characters. Do not include passwords or payment proof details.'}</Text>{button(sending ? 'Checking request…' : operation?.state === 'queued' ? 'Update queued' : operation ? 'Check or retry request' : 'Send current order update', () => void sendUpdate(), sending || operation?.state === 'queued' || reason.trim().length < 5, true)}</View> : <Text style={[styles.note, noteStyle]}>Check any active or unconfirmed delivery before sending another update.</Text>}
        </>}
      </View>}
      {!!message && <Text accessibilityLiveRegion="polite" style={[styles.note, noteStyle]}>{message}</Text>}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16, minWidth: 0 },
  header: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { fontFamily: 'Jakarta-Bold', fontSize: 13, lineHeight: 21, flexShrink: 1 },
  link: { fontFamily: 'Jakarta-Bold', fontSize: 12, lineHeight: 20 },
  content: { gap: 12, marginTop: 8, minWidth: 0 },
  note: { fontFamily: 'Jakarta-Medium', fontSize: 11, lineHeight: 18, flexShrink: 1 },
  label: { fontFamily: 'Jakarta-Bold', fontSize: 12, lineHeight: 20, flexShrink: 1 },
  name: { fontFamily: 'Jakarta-Bold', fontSize: 13, lineHeight: 21, flexShrink: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 },
  button: { minHeight: 44, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'Jakarta-Bold', fontSize: 11, lineHeight: 18, flexShrink: 1 },
  row: { minWidth: 0, borderTopWidth: 1, paddingTop: 12, gap: 6 },
  person: { minWidth: 0, gap: 4, paddingVertical: 6 },
  preview: { minWidth: 0, borderWidth: 1, borderRadius: 12, padding: 12, gap: 12 },
  input: { minHeight: 96, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', fontFamily: 'Jakarta-Medium', fontSize: 12, lineHeight: 20 },
});
