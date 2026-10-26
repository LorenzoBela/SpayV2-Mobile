import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, PanResponder, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LockKeyhole, LockKeyholeOpen, Users } from 'lucide-react-native';
import { adjustPercentage, distributePercentageRemainder, decimalUnits, previewInstallmentSplit, SPLIT_MODES, unitsText, type SplitConfiguration, type SplitMode } from '../utils/split-allocation';

type Person = { id: string; name: string; avatarUrl?: string | null };
type Props = { total: string | number; months: number; participants: Person[]; value?: SplitConfiguration | null; onChange: (value: SplitConfiguration) => void; isDarkMode: boolean; disabled?: boolean; onValidityChange?: (valid: boolean) => void };
const money = (cents: number) => `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SplitEditor({ total, months, participants, value, onChange, isDarkMode, disabled: externallyDisabled, onValidityChange }: Props) {
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);
  const ids = participants.map(p => p.id);
  const matches = value?.participants.length === ids.length && value.participants.every(p => ids.includes(p.userId));
  const lockedRemoval = value?.participants.some(p => locks[p.userId] && !ids.includes(p.userId)) ?? false;
  const disabled = externallyDisabled || lockedRemoval;
  const config = matches ? value! : reconcileDraft(participants, value);
  const c = { text: isDarkMode ? '#f8fafc' : '#0f172a', secondary: isDarkMode ? '#94a3b8' : '#64748b', border: isDarkMode ? '#334155' : '#e2e8f0', card: isDarkMode ? '#161c2a' : '#ffffff', input: isDarkMode ? '#0f172a' : '#f8fafc', accent: '#ee4d2d' };
  useEffect(() => {
    if (value && !matches && !lockedRemoval) {
      onChange(config);
    }
  }, [ids.join(','), matches, lockedRemoval]);
  const configKey = JSON.stringify(config);
  const idsKey = JSON.stringify(ids);
  const result = useMemo(() => {
    try {
      if (lockedRemoval) throw new Error('Restore the removed participant and unlock their share before removing them.');
      if (String(total).trim() === '') throw new Error('Enter the order amount to preview the split.');
      return { data: previewInstallmentSplit(total, months, JSON.parse(configKey), JSON.parse(idsKey)), error: '' }; }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : 'Check the allocation.' }; }
  }, [total, months, configKey, idsKey, lockedRemoval]);
  const validityCallback = useRef(onValidityChange);
  useEffect(() => { validityCallback.current = onValidityChange; }, [onValidityChange]);
  const valid = Boolean(externallyDisabled) || !result.error;
  useEffect(() => {
    validityCallback.current?.(valid);
    return () => validityCallback.current?.(true);
  }, [valid]);
  let basisPoints: number[] = [];
  try { basisPoints = config.participants.map(p => decimalUnits(p.value)); } catch { /* incomplete numeric draft */ }
  const ready = basisPoints.length === ids.length && basisPoints.reduce((a, b) => a + b, 0) === 10000;
  const changeMode = (mode: SplitMode) => {
    if (mode === config.mode) return;
    setLocks({});
    const next = draft(participants, mode);
    if (mode === 'EXACT' && result.data) next.participants = config.participants.map((p, i) => ({ userId: p.userId, value: unitsText(result.data!.targets[i]) }));
    onChange(next);
  };
  const awaitingAmount = String(total).trim() === '' && !lockedRemoval;
  const modeCaptions = { EQUAL: 'Same share', PERCENTAGE: 'e.g. 30 / 70', EXACT: 'Set each amount', RATIO: 'e.g. 1 : 2' };
  return <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border, opacity: disabled ? 0.6 : 1 }]}>
    <View style={styles.heading}><Users size={14} color={c.accent} /><Text style={[styles.label, { color: c.accent }]}>SPLIT THIS INSTALLMENT</Text></View>
    <View style={styles.modes}>{SPLIT_MODES.map(m => <Pressable key={m.value} disabled={disabled} accessibilityRole="button" accessibilityLabel={m.label} accessibilityState={{ selected: config.mode === m.value, disabled }} onPress={() => changeMode(m.value)} style={[styles.mode, { borderColor: config.mode === m.value ? c.accent : c.border, backgroundColor: config.mode === m.value ? 'rgba(238,77,45,0.08)' : c.input }]}><Text style={[styles.modeText, { color: config.mode === m.value ? c.accent : c.secondary }]}>{m.label}</Text><Text style={{ color: c.secondary, fontSize: 10, lineHeight: 16, marginTop: 3 }}>{modeCaptions[m.value]}</Text></Pressable>)}</View>
    {config.mode === 'PERCENTAGE' && ids.length === 2 && <View style={styles.modes}>{[30, 50, 70].map(n => <Pressable key={n} disabled={disabled || Object.values(locks).some(Boolean)} accessibilityRole="button" accessibilityLabel={`${participants[0]?.name} ${n} percent, ${participants[1]?.name} ${100 - n} percent`} onPress={() => onChange({ ...config, participants: config.participants.map((p, i) => ({ ...p, value: String(i === 0 ? n : 100 - n) })) })} style={[styles.shortcut, { borderColor: c.border }]}><Text style={{ color: c.accent, fontWeight: '700' }}>{n}/{100 - n}</Text></Pressable>)}</View>}
    {config.participants.map((p, i) => {
      const name = participants.find(person => person.id === p.userId)?.name || 'Client';
      const sliderDisabled = disabled || !ready || locks[p.userId] || config.participants.every((peer, j) => j === i || locks[peer.userId]);
      return <View key={p.userId} style={[styles.person, { backgroundColor: c.input, borderColor: c.border }]}>
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 110, flexDirection: 'row', alignItems: 'center', gap: 10 }}>{participants.find(person => person.id === p.userId)?.avatarUrl ? <Image source={{ uri: participants.find(person => person.id === p.userId)!.avatarUrl! }} style={{ height: 36, width: 36, borderRadius: 18 }} contentFit="cover" /> : <View style={{ height: 36, width: 36, borderRadius: 18, backgroundColor: 'rgba(238,77,45,0.1)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</Text></View>}<Text style={[styles.name, { color: c.text }]}>{name}</Text></View>
          {config.mode !== 'EQUAL' && <View style={styles.number}><Text style={{ color: c.secondary }}>{config.mode === 'EXACT' ? '₱' : ''}</Text><TextInput accessibilityLabel={`${name} ${config.mode === 'PERCENTAGE' ? 'percentage' : config.mode === 'RATIO' ? 'ratio weight' : 'amount'}`} editable={!disabled && !locks[p.userId]} keyboardType={config.mode === 'RATIO' ? 'number-pad' : 'decimal-pad'} value={p.value} onChangeText={text => onChange({ ...config, participants: config.participants.map((person, j) => i === j ? { ...person, value: text } : person) })} style={[styles.input, { color: c.text, borderColor: c.border }]} /><Text style={{ color: c.secondary }}>{config.mode === 'PERCENTAGE' ? '%' : ''}</Text></View>}
          {config.mode === 'PERCENTAGE' && <Pressable accessibilityRole="button" accessibilityLabel={`${locks[p.userId] ? 'Unlock' : 'Lock'} ${name}'s share`} accessibilityState={{ selected: Boolean(locks[p.userId]) }} disabled={disabled} onPress={() => setLocks(old => ({ ...Object.fromEntries(Object.entries(old).filter(([id]) => ids.includes(id))), [p.userId]: !old[p.userId] }))} style={styles.lock}>{locks[p.userId] ? <LockKeyhole size={15} color={c.accent} /> : <LockKeyholeOpen size={15} color={c.secondary} />}</Pressable>}
        </View>
        <Text style={[styles.amount, { color: result.data ? c.text : c.secondary }]}>{result.data ? money(result.data.targets[i]) : config.mode === 'EQUAL' ? `${Number((100 / Math.max(1, ids.length)).toFixed(2))}%` : ''}</Text>
        {config.mode === 'PERCENTAGE' && (ids.length > 2 || i === 0) && <PercentageSlider label={`${name} share`} value={Number(p.value) || 0} disabled={Boolean(sliderDisabled)} muted={c.border} onChange={percent => {
          const next = adjustPercentage(basisPoints, i, Math.round(percent) * 100, config.participants.map(person => Boolean(locks[person.userId])));
          onChange({ ...config, participants: config.participants.map((person, j) => ({ ...person, value: unitsText(next[j]) })) });
        }} />}
      </View>;
    })}
    {config.mode === 'PERCENTAGE' && basisPoints.length === ids.length && !ready && <Pressable accessibilityRole="button" disabled={disabled || config.participants.every(p => locks[p.userId]) || basisPoints.reduce((sum, v, i) => sum + (locks[config.participants[i].userId] ? v : 0), 0) > 10000} onPress={() => {
      const next = distributePercentageRemainder(basisPoints, config.participants.map(p => Boolean(locks[p.userId])));
      onChange({ ...config, participants: config.participants.map((p, i) => ({ ...p, value: unitsText(next[i]) })) });
    }} style={[styles.shortcut, { borderColor: c.border }]}><Text style={{ fontSize: 12, color: c.accent, fontWeight: '700' }}>Distribute remaining</Text></Pressable>}
    {config.mode === 'EXACT' && <View><Text style={[styles.help, { color: c.secondary }]}>Assign unallocated remainder to:</Text><View style={styles.modes}>{[{ id: '', name: 'None' }, ...participants].map(p => <Pressable key={p.id} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: (config.remainderUserId ?? '') === p.id }} onPress={() => onChange({ ...config, remainderUserId: p.id || undefined })} style={[styles.shortcut, { borderColor: config.remainderUserId === p.id ? c.accent : c.border }]}><Text style={{ color: c.text, fontSize: 12 }}>{p.name}</Text></Pressable>)}</View></View>}
    {awaitingAmount ? <Text style={[styles.help, { color: c.secondary, backgroundColor: c.input, padding: 10, borderRadius: 10 }]}>Enter the order amount to see each person’s total and installments.</Text> : result.error ? <Text accessibilityRole="alert" style={[styles.help, { color: isDarkMode ? '#fca5a5' : '#b91c1c' }]}>{result.error}</Text> : <>
      <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.disclosure}><Text style={[styles.help, { color: c.accent, fontWeight: '700' }]}>{expanded ? 'Hide' : 'Preview'} installments · {money(result.data!.total)}</Text></Pressable>
      {expanded && result.data!.matrix.map((row, i) => <View key={i} style={[styles.scheduleRow, { borderColor: c.border }]}><Text style={[styles.help, { color: c.text, fontWeight: '700' }]}>Installment {i + 1}</Text>{row.map((amount, j) => <View key={j} style={styles.row}><Text style={[styles.help, { color: c.secondary, flex: 1 }]}>{participants.find(p => p.id === config.participants[j].userId)?.name}</Text><Text style={[styles.help, { color: c.text }]}>{amount === 0 ? 'No payment required' : money(amount)}</Text></View>)}</View>)}
    </>}
  </View>;
}

function draft(people: Person[], mode: SplitMode): SplitConfiguration {
  return { version: 1, mode, participants: people.map((p, i) => ({ userId: p.id, value: mode === 'PERCENTAGE' ? unitsText(Math.floor(10000 / people.length) + (i === people.length - 1 ? 10000 % people.length : 0)) : mode === 'EXACT' ? '0' : '1' })) };
}

function PercentageSlider({ value, onChange, disabled, label, muted }: { value: number; onChange: (n: number) => void; disabled: boolean; label: string; muted: string }) {
  const width = useRef(1), start = useRef(value), current = useRef({ value, onChange, disabled });
  useLayoutEffect(() => { current.current = { value, onChange, disabled }; }, [value, onChange, disabled]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !current.current.disabled && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
    onPanResponderGrant: () => { start.current = current.current.value; },
    onPanResponderMove: (_, g) => { if (!current.current.disabled) current.current.onChange(Math.max(0, Math.min(100, start.current + g.dx / width.current * 100))); },
    onPanResponderTerminationRequest: () => true,
  }), []);
  return <View {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityState={{ disabled }} accessibilityValue={{ min: 0, max: 100, now: value, text: `${value}%` }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => { if (!disabled) onChange(Math.max(0, Math.min(100, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1)))); }} onLayout={e => { width.current = e.nativeEvent.layout.width; }} style={{ height: 44, justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
    <View pointerEvents="none" style={{ height: 5, borderRadius: 3, backgroundColor: muted }}><View style={{ height: 5, width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: '#ee4d2d', borderRadius: 3 }} /></View>
    <View pointerEvents="none" style={{ position: 'absolute', left: `${Math.min(100, Math.max(0, value))}%`, marginLeft: -9, height: 18, width: 18, borderRadius: 9, backgroundColor: '#ee4d2d', borderColor: '#fff', borderWidth: 2 }} />
  </View>;
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 7 }, label: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, mode: { flexBasis: '47%', flexGrow: 1, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderRadius: 10, minHeight: 64 }, modeText: { fontSize: 12, fontWeight: '700' }, shortcut: { paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderRadius: 8, minHeight: 44 },
  person: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 }, row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }, name: { flex: 1, minWidth: 50, fontSize: 14, lineHeight: 20, fontWeight: '700' }, number: { flexDirection: 'row', alignItems: 'center', gap: 3 }, input: { minWidth: 64, minHeight: 44, paddingHorizontal: 8, borderWidth: 1, borderRadius: 8, fontSize: 14, fontWeight: '800', textAlign: 'right' }, lock: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, amount: { fontSize: 15, fontWeight: '800', textAlign: 'right', fontVariant: ['tabular-nums'] }, help: { fontSize: 12, lineHeight: 18 }, disclosure: { minHeight: 44, justifyContent: 'center' }, scheduleRow: { gap: 4, borderTopWidth: 1, paddingTop: 9 },
});

function reconcileDraft(people: Person[], previous?: SplitConfiguration | null): SplitConfiguration {
  if (!previous) return draft(people, 'EQUAL');
  const ids = people.map(p => p.id);
  return { ...previous, remainderUserId: ids.includes(previous.remainderUserId ?? '') ? previous.remainderUserId : undefined, participants: people.map(p => previous.participants.find(existing => existing.userId === p.id) ?? { userId: p.id, value: previous.mode === 'EQUAL' || previous.mode === 'RATIO' ? '1' : '0' }) };
}
