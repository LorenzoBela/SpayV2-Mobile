import React, { useContext, useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { supabase } from '../utils/supabase';

type Category = 'PAYMENT_UPDATES' | 'ALERTS' | 'ADS' | 'SYSTEM';
type Policy = { version: 2; channels: Record<Category, { email: boolean; push: boolean }>; quietHours: { enabled: boolean; startMinute: number; endMinute: number; timezone: string }; cadence: 'standard' | 'weekly_digest'; marketing: 'off' | 'weekly_digest'; peerPayments: boolean; lockScreenPrivacy: boolean };
const categories: [Category, string][] = [['PAYMENT_UPDATES', 'Payment updates'], ['ALERTS', 'Alerts'], ['ADS', 'Promotions and wishlist'], ['SYSTEM', 'System updates']];
const timeText = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const readMinute = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
const apiUrl = () => `${(process.env.EXPO_PUBLIC_API_URL || 'https://nootspaytracker.vercel.app').replace(/\/$/, '')}/api/notifications/preferences`;

export default function NotificationDeliveryPreferences() {
  const { isDarkMode } = useContext(ThemeContext);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [revision, setRevision] = useState(0);
  const [owner, setOwner] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [start, setStart] = useState('21:00');
  const [end, setEnd] = useState('08:00');
  const color = isDarkMode ? '#f8fafc' : '#0f172a';
  const muted = isDarkMode ? '#94a3b8' : '#64748b';
  const border = isDarkMode ? '#223049' : '#e2e8f0';
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession(); const session = data.session;
      if (!session) return;
      const response = await fetch(apiUrl(), { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal });
      if (!response.ok) return;
      const result = await response.json(); const current = await supabase.auth.getSession();
      if (!active || current.data.session?.user.id !== session.user.id || !result.available || result.policy?.version !== 2) return;
      setOwner(session.user.id); setOwnerUserId(result.ownerUserId); setPolicy(result.policy); setRevision(result.revision);
      setStart(timeText(result.policy.quietHours.startMinute)); setEnd(timeText(result.policy.quietHours.endMinute));
    })().catch(() => {});
    const { data: auth } = supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') { setPolicy(null); setOwner(null); } });
    return () => { active = false; controller.abort(); auth.subscription.unsubscribe(); };
  }, []);
  if (!policy) return null;
  const change = (patch: Partial<Policy>) => setPolicy(prev => prev ? { ...prev, ...patch } : prev);
  async function save() {
    if (!policy) return;
    const startMinute = readMinute(start), endMinute = readMinute(end);
    if (startMinute === null || endMinute === null) { setMessage('Enter quiet hours as HH:MM, for example 21:00.'); return; }
    setSaving(true); setMessage('');
    try {
      const { data } = await supabase.auth.getSession(); const session = data.session;
      if (!session || session.user.id !== owner) throw new Error('Reopen preferences for the signed-in account.');
      const response = await fetch(apiUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ revision, ownerUserId, policy: { ...policy, quietHours: { ...policy.quietHours, startMinute, endMinute } } }) });
      const result = await response.json(); const current = await supabase.auth.getSession();
      if (current.data.session?.user.id !== session.user.id) return;
      if (!response.ok) throw new Error(response.status === 409 ? 'Preferences changed elsewhere. Reopen this page before saving.' : 'Unable to save preferences. Please try again.');
      setPolicy(result.policy); setRevision(result.revision); setMessage('Preferences saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save preferences.'); }
    finally { setSaving(false); }
  }
  const toggle = (label: string, value: boolean, onValueChange: (value: boolean) => void) => <View key={label} style={{ flexDirection: 'row', minHeight: 48, alignItems: 'center', gap: 12 }}><Text style={{ flex: 1, flexShrink: 1, fontFamily: 'Jakarta-Medium', fontSize: 12, lineHeight: 20, color }}>{label}</Text><Switch accessibilityLabel={label} disabled={saving} value={value} onValueChange={onValueChange} trackColor={{ false: border, true: '#ee4d2d' }} /></View>;
  const inputStyle = { color, borderColor: border, borderWidth: 1, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, fontFamily: 'Jakarta-Medium', fontSize: 12 };
  return <View style={{ backgroundColor: isDarkMode ? '#161c2a' : '#ffffff', borderColor: border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Text style={{ color, fontFamily: 'Jakarta-Bold', fontSize: 13 }}>Delivery preferences</Text><Text style={{ color: '#ee4d2d' }}>{expanded ? 'Hide' : 'Manage'}</Text></Pressable>
    {expanded && <View>
      <Text style={{ color: muted, fontSize: 11, lineHeight: 18, marginVertical: 8 }}>Choose how you receive notifications. Your notification history stays in the inbox. Existing category switches and your phone’s notification settings still apply.</Text>
      {categories.map(([key, label]) => <View key={key} style={{ borderBottomWidth: 1, borderColor: border, paddingVertical: 12 }}><Text style={{ color, fontFamily: 'Jakarta-Bold', fontSize: 13 }}>{label}</Text>
        {toggle(`${label} · Email`, policy.channels[key].email, value => change({ channels: { ...policy.channels, [key]: { ...policy.channels[key], email: value } } }))}
        {toggle(`${label} · Phone notifications`, policy.channels[key].push, value => change({ channels: { ...policy.channels, [key]: { ...policy.channels[key], push: value } } }))}
      </View>)}
      {toggle('Quiet hours', policy.quietHours.enabled, enabled => change({ quietHours: { ...policy.quietHours, enabled } }))}
      {policy.quietHours.enabled && <View>
        <Text style={{ color: muted, fontSize: 11, marginVertical: 8 }}>From / Until · 24-hour time</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}><TextInput accessibilityLabel="Quiet hours from" editable={!saving} style={[inputStyle, { flex: 1 }]} value={start} onChangeText={setStart} maxLength={5} /><TextInput accessibilityLabel="Quiet hours until" editable={!saving} style={[inputStyle, { flex: 1 }]} value={end} onChangeText={setEnd} maxLength={5} /></View>
        <Text style={{ color: muted, fontSize: 11, marginVertical: 8 }}>Time zone</Text><TextInput accessibilityLabel="Quiet hours timezone" editable={!saving} autoCapitalize="none" style={inputStyle} value={policy.quietHours.timezone} onChangeText={timezone => change({ quietHours: { ...policy.quietHours, timezone } })} />
      </View>}
      {toggle('Weekly payment summary', policy.cadence === 'weekly_digest', value => change({ cadence: value ? 'weekly_digest' : 'standard' }))}
      {toggle('Weekly promotions and wishlist', policy.marketing !== 'off', value => change({ marketing: value ? 'weekly_digest' : 'off' }))}
      {toggle('Updates when someone sharing my order pays', policy.peerPayments, value => change({ peerPayments: value }))}
      {toggle('Hide names and amounts in phone notifications', policy.lockScreenPrivacy, value => change({ lockScreenPrivacy: value }))}
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={{ borderRadius: 12, backgroundColor: '#ee4d2d', minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12, opacity: saving ? 0.5 : 1 }}><Text style={{ color: '#fff', fontFamily: 'Jakarta-Bold', fontSize: 12 }}>{saving ? 'Saving…' : 'Save preferences'}</Text></Pressable>
      {!!message && <Text accessibilityLiveRegion="polite" style={{ color: muted, fontSize: 11, lineHeight: 18, marginTop: 8 }}>{message}</Text>}
    </View>}
  </View>;
}
