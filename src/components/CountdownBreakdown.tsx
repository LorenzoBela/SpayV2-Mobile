import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type CountdownPerson = {
  id?: string; userId?: string; name?: string; email?: string;
  amountDue?: unknown; isPaid?: boolean;
  splitPercentageLabel?: string; splitMode?: string;
};
const amountValue = (value: unknown) => {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const currency = (amount: number | null) => amount == null ? 'Unavailable' : `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const colors = (dark: boolean) => ({ text: dark ? '#e2e8f0' : '#1e293b', muted: dark ? '#94a3b8' : '#64748b', line: dark ? '#334155' : '#e2e8f0', accent: dark ? '#fb923c' : '#c2410c' });

export function CountdownParticipantRow({ person, isDarkMode = false, showStatus = true, roleLabel }: {
  person: CountdownPerson; isDarkMode?: boolean; showStatus?: boolean; roleLabel?: string;
}) {
  const c = colors(isDarkMode);
  const amount = amountValue(person.amountDue);
  const metadata = [person.splitPercentageLabel, person.splitMode].filter(Boolean).join(' · ');
  const status = amount == null ? 'Unavailable' : amount === 0 ? 'No payment required'
    : person.isPaid === true ? 'Paid' : person.isPaid === false ? 'Unpaid' : 'Unavailable';
  const statusColor = status === 'Paid' ? (isDarkMode ? '#6ee7b7' : '#047857') : status === 'Unpaid' ? (isDarkMode ? '#fbbf24' : '#92400e') : c.muted;
  return <View style={styles.person}>
    <Text testID="countdown-person-name" style={[styles.personName, { color: c.text }]}>{person.name || 'Participant'}</Text>
    {!!metadata && <Text testID="countdown-person-metadata" style={[styles.metadata, { color: c.muted }]}>{metadata}</Text>}
    {!!roleLabel && <Text style={[styles.role, { color: c.accent }]}>{roleLabel}</Text>}
    <View style={styles.amountRow}>
      <Text testID="countdown-person-amount" style={[styles.amount, { color: c.text }]}>{currency(amount)}</Text>
      {showStatus && <View style={[styles.statusBadge, { backgroundColor: status === 'Paid' ? 'rgba(16,185,129,0.12)' : status === 'Unpaid' ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.1)' }]}>
        <Text testID="countdown-person-status" style={[styles.status, { color: statusColor }]}>{status}</Text>
      </View>}
    </View>
  </View>;
}

export function CountdownParticipantList({ people, isDarkMode = false, showHeading = true, withDivider = true }: {
  people: CountdownPerson[]; isDarkMode?: boolean; showHeading?: boolean; withDivider?: boolean;
}) {
  const c = colors(isDarkMode);
  const settled = people.filter(person => {
    const amount = amountValue(person.amountDue);
    return amount !== null && (amount === 0 || person.isPaid === true);
  }).length;
  return <View style={[styles.people, withDivider && { borderTopWidth: 1, borderTopColor: c.line }]}>
    {showHeading && <View style={styles.sectionHeading}>
      <Text style={[styles.label, { color: c.muted }]}>PARTICIPANT SPLITS</Text>
      <Text style={[styles.settled, { color: c.accent }]}>{settled}/{people.length} settled</Text>
    </View>}
    {people.map((person, index) => <View key={person.id ?? person.userId ?? index} style={index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line } : undefined}>
      <CountdownParticipantRow person={person} isDarkMode={isDarkMode} />
    </View>)}
  </View>;
}

export function CountdownBill({ itemName, amountDue, amountLabel = 'Installment due', dueLabel, metadata, isShared = false, people, isDarkMode = false }: {
  itemName: string; amountDue: unknown; amountLabel?: string; dueLabel?: string;
  metadata?: string; isShared?: boolean; people?: CountdownPerson[]; isDarkMode?: boolean;
}) {
  const c = colors(isDarkMode);
  return <View style={[styles.bill, { backgroundColor: isDarkMode ? '#172130' : '#f8fafc', borderColor: c.line }, isShared && { borderLeftWidth: 3, borderLeftColor: '#ee4d2d' }]}>
    <Text testID="countdown-item-name" style={[styles.itemName, { color: c.text }]}>{itemName || 'Installment'}</Text>
    {isShared && <Text style={[styles.shared, { color: c.accent }]}>SHARED INSTALLMENT</Text>}
    {!!metadata && <Text style={[styles.metadata, { color: c.muted }]}>{metadata}</Text>}
    {!!dueLabel && <Text style={[styles.metadata, { color: c.muted }]}>{dueLabel}</Text>}
    <View style={[styles.amountRow, { marginTop: 8 }]}>
      <Text style={[styles.metadata, { color: c.muted }]}>{amountLabel}</Text>
      <Text style={[styles.billAmount, { color: c.text }]}>{currency(amountValue(amountDue))}</Text>
    </View>
    {!!people?.length && <CountdownParticipantList people={people} isDarkMode={isDarkMode} />}
  </View>;
}

export function CountdownClientSummary({ name, email, amountDue, isShared = false, detail, trailing, isDarkMode = false }: {
  name: string; email?: string; amountDue: unknown; isShared?: boolean;
  detail?: string; trailing?: React.ReactNode; isDarkMode?: boolean;
}) {
  const c = colors(isDarkMode);
  return <View style={styles.client}>
    <Text style={[styles.clientName, { color: c.text }]}>{name}</Text>
    {isShared && <Text style={[styles.shared, { color: c.accent }]}>INCLUDES SHARED INSTALLMENTS</Text>}
    {!!email && <Text style={[styles.metadata, { color: c.muted }]}>{email}</Text>}
    {!!detail && <Text style={[styles.metadata, { color: c.muted }]}>{detail}</Text>}
    <View style={styles.amountRow}>
      <Text style={[styles.metadata, { color: c.muted }]}>Client total due</Text>
      <View style={styles.totalWithIcon}><Text style={[styles.billAmount, { color: c.text }]}>{currency(amountValue(amountDue))}</Text>{trailing}</View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  bill: { minWidth: 0, width: '100%', alignSelf: 'stretch', padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  itemName: { fontFamily: 'Jakarta-SemiBold', fontSize: 14, fontWeight: '700', lineHeight: 21, flexShrink: 1, minWidth: 0 },
  shared: { color: '#ee4d2d', fontSize: 10, fontWeight: '800', lineHeight: 16, marginTop: 5, flexShrink: 1 },
  metadata: { fontFamily: 'Jakarta-Medium', fontSize: 11, lineHeight: 17, flexShrink: 1, minWidth: 0, marginTop: 3 },
  people: { width: '100%', minWidth: 0, marginTop: 10, paddingTop: 8 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 10, rowGap: 4, marginBottom: 2 },
  label: { fontFamily: 'Jakarta-Bold', fontSize: 10, fontWeight: '700', lineHeight: 17, letterSpacing: 0.5, flexShrink: 1 },
  settled: { color: '#ee4d2d', fontSize: 11, lineHeight: 17, fontWeight: '700' },
  person: { minWidth: 0, width: '100%', paddingVertical: 9 },
  personName: { fontFamily: 'Jakarta-SemiBold', fontSize: 13, fontWeight: '700', lineHeight: 20, flexShrink: 1, minWidth: 0 },
  role: { color: '#ee4d2d', fontSize: 10, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 6, marginTop: 5, minWidth: 0 },
  amount: { fontFamily: 'Outfit-Bold', fontSize: 13, fontWeight: '800', lineHeight: 20, fontVariant: ['tabular-nums'], flexShrink: 1 },
  billAmount: { fontFamily: 'Outfit-Bold', fontSize: 15, fontWeight: '800', lineHeight: 23, fontVariant: ['tabular-nums'], flexShrink: 1 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, maxWidth: '100%' },
  status: { fontFamily: 'Jakarta-Bold', fontSize: 10, lineHeight: 16, fontWeight: '700', flexShrink: 1 },
  client: { flex: 1, width: '100%', minWidth: 0, gap: 3 },
  clientName: { fontFamily: 'Jakarta-SemiBold', fontSize: 14, lineHeight: 21, fontWeight: '700', flexShrink: 1, minWidth: 0 },
  totalWithIcon: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 5, minWidth: 0 },
});
