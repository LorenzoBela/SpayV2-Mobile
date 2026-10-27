import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { InstallmentShare } from '../utils/installment-shares';

type Props = {
  shares?: InstallmentShare[];
  viewerId?: string;
  title?: string;
  groupAmountDue?: number | null;
  isDarkMode?: boolean;
};

const currency = (amount: number) => `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const labels: Record<InstallmentShare['status'], string> = {
  paid: 'Paid', unpaid: 'Unpaid', no_payment_required: 'No payment required', unavailable: 'Unavailable',
};

/** Display stored monthly liabilities. Never infer a share or status from order totals. */
export default function InstallmentShares({ shares, viewerId, title = 'Monthly shares', groupAmountDue, isDarkMode = false }: Props) {
  const text = isDarkMode ? '#e2e8f0' : '#334155';
  const secondary = isDarkMode ? '#94a3b8' : '#64748b';
  const line = isDarkMode ? '#334155' : '#e2e8f0';
  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#172130' : '#f8fafc', borderColor: line }]}>
      <Text style={styles.heading}>{title}</Text>
      {typeof groupAmountDue === 'number' && Number.isFinite(groupAmountDue) && (
        <Text style={[styles.groupTotal, { color: secondary }]}>Group installment · {currency(groupAmountDue)}</Text>
      )}
      {!shares?.length ? (
        <Text style={[styles.empty, { color: secondary }]}>Monthly shares unavailable.</Text>
      ) : shares.map((share, index) => {
        const name = `${share.name || 'Participant'}${viewerId && share.userId === viewerId ? ' (You)' : ''}`;
        const amount = share.amountDue !== null && Number.isFinite(share.amountDue) && share.amountDue >= 0 ? currency(share.amountDue) : 'Unavailable';
        const status = labels[share.status] ?? labels.unavailable;
        const statusColor = share.status === 'paid' ? (isDarkMode ? '#6ee7b7' : '#047857')
          : share.status === 'unpaid' ? (isDarkMode ? '#fbbf24' : '#92400e') : secondary;
        return (
          <View key={share.participantId || share.userId || index} accessible accessibilityLabel={`${name}, ${amount}, ${status}`}
            style={[styles.person, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line }]}>
            <Text style={[styles.name, { color: text }]}>{name}</Text>
            <View style={styles.liability}>
              <Text style={[styles.amount, { color: text }]}>{amount}</Text>
              <Text style={[styles.status, { color: statusColor }]}>{status}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', minWidth: 0, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 3, marginTop: 10 },
  heading: { color: '#ee4d2d', fontSize: 11, fontWeight: '800', lineHeight: 17 },
  groupTotal: { fontFamily: 'Jakarta-Medium', fontSize: 11, lineHeight: 17, marginTop: 2, marginBottom: 2 },
  empty: { fontFamily: 'Jakarta-Medium', fontSize: 12, lineHeight: 18, paddingVertical: 10 },
  person: { paddingVertical: 9, minWidth: 0, gap: 4 },
  name: { fontFamily: 'Jakarta-SemiBold', fontSize: 13, fontWeight: '700', lineHeight: 20, flexShrink: 1 },
  liability: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 10, rowGap: 4 },
  amount: { fontFamily: 'Outfit-Bold', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 20, flexShrink: 1 },
  status: { fontFamily: 'Jakarta-Bold', fontSize: 11, fontWeight: '700', lineHeight: 18, flexShrink: 1 },
});
