import React, { useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { getLinkedProfileForUser } from '../utils/authProfile';
import { supabase } from '../utils/supabase';
import { parseNotificationDigestDetails } from '../utils/notificationDigestDetails';
import { notificationDetailMoney } from '../utils/financialNotificationDetails';

type Props = { notificationId: string; data: unknown; onOpenCurrent: (params: { notificationId: string; notificationOrderId: string; notificationPaymentId: string }) => void };
export default function NotificationDigestDetails({ notificationId, data, onOpenCurrent }: Props) {
  const { isDarkMode } = useContext(ThemeContext);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const hasDigest = !!data && typeof data === 'object' && 'digestItems' in data;
  useEffect(() => {
    let active = true, generation = 0;
    const resolveOwner = async () => {
      const request = ++generation; setViewerId(null);
      try {
        const { data: auth } = await supabase.auth.getSession(); const session = auth.session;
        if (!session) return;
        const profile = await getLinkedProfileForUser(session.user);
        const current = await supabase.auth.getSession();
        if (active && request === generation && current.data.session?.user.id === session.user.id) setViewerId(profile?.id || null);
      } catch { /* Unavailable identity must not expose another recipient's details. */ }
    };
    if (hasDigest) void resolveOwner(); else setViewerId(null);
    const { data: auth } = supabase.auth.onAuthStateChange(() => { if (hasDigest) void resolveOwner(); });
    return () => { active = false; generation++; auth.subscription.unsubscribe(); };
  }, [notificationId, hasDigest]);
  const digest = parseNotificationDigestDetails(data, viewerId);
  if (!digest) return null;
  const foreground = isDarkMode ? '#f8fafc' : '#0f172a', muted = isDarkMode ? '#94a3b8' : '#64748b', border = isDarkMode ? '#223049' : '#e2e8f0';
  return <View style={[styles.panel, { borderColor: border }]}>
    <Text accessibilityRole="header" style={styles.heading}>PAYMENT SUMMARY</Text>
    <Text style={[styles.name, { color: foreground }]}>Your total in this summary · {notificationDetailMoney(digest.ownAmountMinor)}</Text>
    <Text style={[styles.note, { color: muted }]}>These amounts were unpaid when this summary was saved. Open each order to see its current payment status.</Text>
    {digest.digestItems.slice(0, visibleCount).map(item => <View key={item.paymentId} style={[styles.item, { borderTopColor: border }]}>
      <Text style={[styles.name, { color: foreground }]}>{item.itemName}</Text>
      <Text style={[styles.note, { color: muted }]}>Month {item.monthNumber} · Your payment {notificationDetailMoney(item.amountMinor)}</Text>
      <Text style={[styles.note, { color: muted }]}>{item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}` : 'Due date unavailable'}</Text>
      <Pressable accessibilityRole="button" onPress={() => onOpenCurrent({ notificationId, notificationOrderId: item.orderId, notificationPaymentId: item.paymentId })} style={styles.button}><Text style={styles.buttonText}>View current order</Text></Pressable>
    </View>)}
    {visibleCount < digest.itemCount && <Pressable accessibilityRole="button" onPress={() => setVisibleCount(count => count + 20)} style={styles.button}><Text style={styles.buttonText}>Show next 20 installments</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { minWidth: 0, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 20, gap: 10 },
  heading: { color: '#ee4d2d', fontFamily: 'Outfit-Bold', fontSize: 10, letterSpacing: 1, lineHeight: 17 },
  name: { fontFamily: 'Jakarta-Bold', fontSize: 13, lineHeight: 21, flexShrink: 1 },
  note: { fontFamily: 'Jakarta-Medium', fontSize: 11, lineHeight: 18, flexShrink: 1 },
  item: { minWidth: 0, gap: 8, borderTopWidth: 1, paddingTop: 12 },
  button: { minHeight: 44, backgroundColor: '#ee4d2d', borderRadius: 12, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontFamily: 'Jakarta-Bold', fontSize: 12, lineHeight: 20 },
});
