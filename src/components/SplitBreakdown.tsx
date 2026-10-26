import React, { useContext } from 'react';
import { View, Text } from 'react-native';
import { Users } from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { participantPercentage, splitModeLabel, type SplitConfiguration } from '../utils/split-allocation';

type Person = { id?: string; userId?: string; user_id?: string; name?: string; profile?: { name?: string }; splitAmount?: unknown; split_amount?: unknown; amountDue?: unknown; isPaid?: boolean; is_paid?: boolean; splitPercentageLabel?: string; splitMode?: string };
export default function SplitBreakdown({ total, config, participants, currentUserId, compact = false }: { total: unknown; config?: unknown; participants: Person[]; currentUserId?: string; compact?: boolean }) {
  const { isDarkMode } = useContext(ThemeContext);
  if (!participants.length) return null;
  const split = config as SplitConfiguration | null;
  const text = isDarkMode ? '#e2e8f0' : '#334155', secondary = isDarkMode ? '#94a3b8' : '#64748b';
  const mode = split ? splitModeLabel(split) : participants[0]?.splitMode ?? splitModeLabel(null);
  return <View style={{ borderWidth: 1, borderColor: isDarkMode ? 'rgba(238,77,45,0.25)' : '#fed7aa', backgroundColor: 'rgba(238,77,45,0.04)', borderRadius: 14, padding: 12, gap: 9 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><Users size={13} color="#ee4d2d" /><Text style={{ color: '#ee4d2d', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>SPLIT BREAKDOWN · {mode.toUpperCase()}</Text></View>
    {participants.map((p, i) => {
      const id = p.userId ?? p.user_id;
      const amount = Number(p.amountDue ?? p.splitAmount ?? p.split_amount ?? 0);
      const label = p.splitPercentageLabel ?? participantPercentage(split, id ?? '', Number(p.splitAmount ?? p.split_amount ?? 0), Number(total));
      return <View key={id ?? p.id ?? i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 }}>
        <Text style={{ color: text, fontSize: 12, fontWeight: '700', flexShrink: 1 }}>{p.name ?? p.profile?.name ?? 'Participant'} {id && id === currentUserId ? '(You)' : ''}<Text style={{ color: secondary, fontWeight: '400' }}> · {label}</Text></Text>
        <View style={{ alignItems: 'flex-end', gap: 2 }}><Text style={{ color: text, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>{!compact && <Text style={{ fontSize: 10, color: amount === 0 ? secondary : (p.isPaid ?? p.is_paid) ? '#10b981' : isDarkMode ? '#fbbf24' : '#92400e' }}>{amount === 0 ? 'No payment required' : (p.isPaid ?? p.is_paid) ? 'Paid' : 'Unpaid'}</Text>}</View>
      </View>;
    })}
  </View>;
}
