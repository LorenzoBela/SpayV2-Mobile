import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Receipt, Users } from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { getLinkedProfileForUser } from '../utils/authProfile';
import { supabase } from '../utils/supabase';
import { notificationDetailMoney, parseFinancialNotificationDetails } from '../utils/financialNotificationDetails';
import InstallmentShares from './InstallmentShares';

type CurrentOrderParams = { notificationId: string; notificationOrderId: string; notificationPaymentId?: string };
type Props = { notificationId: string; data: unknown; snapshotAt: string; onOpenCurrent: (params: CurrentOrderParams) => void };

/** Own-recipient historical detail, styled like the existing split/order cards. Current membership is rechecked by the order screen. */
export default function FinancialNotificationDetails({ notificationId, data, snapshotAt, onOpenCurrent }: Props) {
  const { isDarkMode } = useContext(ThemeContext);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const raw = data && typeof data === 'object' ? data as Record<string, unknown> : null;
  const hasContext = !!raw?.sharedContext;
  useEffect(() => {
    let active = true; let generation = 0;
    const resolveOwner = async () => {
      const request = ++generation; setViewerId(null); setChecking(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData.session;
        if (!session) return;
        // Resolve the signed-in owner explicitly; the general helper can intentionally return an impersonated profile.
        const profile = await getLinkedProfileForUser(session.user);
        const current = await supabase.auth.getSession();
        if (active && request === generation && current.data.session?.user.id === session.user.id) setViewerId(profile?.id || null);
      } catch { /* Missing auth/context is unavailable, never another recipient's financial detail. */ }
      finally { if (active && request === generation) setChecking(false); }
    };
    if (hasContext) void resolveOwner(); else setChecking(false);
    const { data: auth } = supabase.auth.onAuthStateChange(() => { if (hasContext) void resolveOwner(); });
    return () => { active = false; generation++; auth.subscription.unsubscribe(); };
  }, [notificationId, hasContext]);
  useEffect(() => { setSelectedMonth(typeof raw?.paymentId === 'string' ? raw.paymentId : null); }, [notificationId, raw?.paymentId]);
  const context = useMemo(() => parseFinancialNotificationDetails(data, viewerId), [data, viewerId]);
  if (!hasContext) return null;
  const text = isDarkMode ? '#e2e8f0' : '#334155', secondary = isDarkMode ? '#94a3b8' : '#64748b', border = isDarkMode ? '#334155' : '#e2e8f0';
  if (!context) return <View style={[styles.panel, { borderColor: border, backgroundColor: isDarkMode ? '#172130' : '#f8fafc' }]}><Text style={[styles.note, { color: secondary }]}>{checking ? 'Checking order details…' : 'Order details are not available for this account.'}</Text></View>;
  const isShared = context.participants.length > 1;
  const initial = context.installments.find(month => month.paymentId === selectedMonth)
    || context.installments.find(month => month.participants.some(person => person.own && person.status === 'unpaid'))
    || context.installments[0];
  const monthIndex = initial ? context.installments.findIndex(month => month.paymentId === initial.paymentId) : -1;
  const date = new Date(snapshotAt);
  const snapshotLabel = Number.isFinite(date.getTime()) ? date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Time not available';
  return <View style={styles.root}>
    <View style={[styles.panel, { borderColor: border, backgroundColor: isDarkMode ? '#172130' : '#f8fafc' }]}>
      <Text style={[styles.historyLabel, { color: secondary }]}>DETAILS AT THE TIME</Text>
      <Text style={[styles.note, { color: secondary }]}>{snapshotLabel} · Asia/Manila</Text>
      <Text style={[styles.note, { color: secondary, marginTop: 4 }]}>These details were saved when this notification was created. Amounts and payment statuses may have changed since then.</Text>
      <View style={styles.headingRow}>{isShared ? <Users size={14} color="#ee4d2d" /> : <Receipt size={14} color="#ee4d2d" />}<Text style={styles.heading}>{isShared ? `Shared order · ${context.method}` : context.method}</Text></View>
      <Text style={[styles.itemName, { color: text }]}>{context.itemName}</Text>
      <Text style={[styles.total, { color: text }]}>{isShared ? 'Your total share' : 'Order total'} · {notificationDetailMoney(context.ownTotalMinor)}</Text>
      {isShared && <Text style={[styles.note, { color: secondary }]}>Total order amount · {notificationDetailMoney(context.groupTotalMinor)}</Text>}
      {isShared && context.participants.map(person => <View key={person.userId} style={[styles.person, { borderTopColor: border }]}>
        <Text style={[styles.name, { color: text }]}>{person.name}{person.own ? ' (You)' : ''}</Text>
        <Text style={[styles.note, { color: secondary }]}>{person.percentage} · Total share {notificationDetailMoney(person.allocationMinor)}</Text>
      </View>)}
    </View>
    {initial ? <View>
      <View style={styles.monthControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous installment" disabled={monthIndex <= 0} onPress={() => setSelectedMonth(context.installments[monthIndex - 1].paymentId)} style={[styles.monthButton, { borderColor: border, opacity: monthIndex <= 0 ? 0.35 : 1 }]}><ChevronLeft size={16} color={text} /></Pressable>
        <Text style={[styles.monthLabel, { color: secondary }]}>Installment {monthIndex + 1} of {context.installments.length}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next installment" disabled={monthIndex >= context.installments.length - 1} onPress={() => setSelectedMonth(context.installments[monthIndex + 1].paymentId)} style={[styles.monthButton, { borderColor: border, opacity: monthIndex >= context.installments.length - 1 ? 0.35 : 1 }]}><ChevronRight size={16} color={text} /></Pressable>
      </View>
      <Text style={[styles.total, { color: text }]}>{isShared ? `Your share for Month ${initial.monthNumber}` : `Month ${initial.monthNumber} payment`} · {notificationDetailMoney(initial.ownAmountMinor)}</Text>
      <InstallmentShares title={`Month ${initial.monthNumber} · ${initial.dueDate ? new Date(initial.dueDate).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : 'Due date not available'}`} viewerId={viewerId || undefined} groupAmountDue={!isShared || initial.groupAmountMinor === null ? null : initial.groupAmountMinor / 100} isDarkMode={isDarkMode}
        shares={initial.participants.map(person => ({ participantId: person.userId, userId: person.userId, name: person.name, amountDue: person.amountMinor === null ? null : person.amountMinor / 100, isPaid: person.status === 'paid' ? true : person.status === 'unpaid' ? false : null, paidAt: null, status: person.status || 'unavailable' }))} />
    </View> : <Text style={[styles.note, { color: secondary }]}>Monthly payment details are not available.</Text>}
    <Pressable accessibilityRole="button" onPress={() => onOpenCurrent({ notificationId, notificationOrderId: context.orderId, notificationPaymentId: initial?.paymentId })} style={styles.openButton}>
      <LinearGradient colors={['#ee4d2d', '#ff6647']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.openGradient}><Text style={styles.openText}>View current order</Text><ChevronRight size={16} color="#fff" /></LinearGradient>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', minWidth: 0, marginBottom: 20, gap: 10 },
  panel: { minWidth: 0, borderWidth: 1, borderRadius: 12, padding: 12 },
  historyLabel: { fontFamily: 'Outfit-Bold', fontSize: 10, letterSpacing: 1, lineHeight: 17, marginBottom: 4 },
  note: { fontFamily: 'Jakarta-Medium', fontSize: 11, lineHeight: 18, flexShrink: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 14, marginBottom: 8 },
  heading: { flex: 1, minWidth: 0, color: '#ee4d2d', fontFamily: 'Jakarta-Bold', fontSize: 11, lineHeight: 18 },
  itemName: { fontFamily: 'Outfit-Bold', fontSize: 15, lineHeight: 22, marginBottom: 8, flexShrink: 1 },
  total: { fontFamily: 'Jakarta-Bold', fontSize: 12, lineHeight: 20, marginBottom: 4, flexShrink: 1 },
  person: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, marginTop: 9, gap: 4, minWidth: 0 },
  name: { fontFamily: 'Jakarta-SemiBold', fontSize: 13, lineHeight: 20, flexShrink: 1 },
  monthControls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  monthButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontFamily: 'Jakarta-Medium', fontSize: 11, lineHeight: 18, flexShrink: 1 },
  openButton: { minHeight: 48, borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  openGradient: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14 },
  openText: { color: '#fff', fontFamily: 'Jakarta-Bold', fontSize: 13, lineHeight: 20, flexShrink: 1 },
});
