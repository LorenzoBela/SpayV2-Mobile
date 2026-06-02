import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { ThemeContext } from '../../navigation/navigationTypes';

interface PaymentItem {
  id: string;
  itemName: string;
  amountDue: number;
  dueDate: string;
  isPaid: boolean;
  paymentDate: string | null;
  monthNumber: number;
}

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = React.useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  const fetchCalendarPayments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Orders to get order names
      const { data: dbOrders } = await supabase
        .from('orders')
        .select('id, item_name')
        .eq('user_id', user.id);

      if (!dbOrders || dbOrders.length === 0) {
        setPayments([]);
        return;
      }

      const orderNamesMap = new Map<string, string>();
      dbOrders.forEach(o => orderNamesMap.set(o.id, o.item_name));

      // 2. Fetch payments sorted by due date
      const orderIds = dbOrders.map(o => o.id);
      const { data: dbPayments, error: paymentsErr } = await supabase
        .from('payments')
        .select('id, order_id, due_date, amount_due, is_paid, payment_date, month_number')
        .in('order_id', orderIds)
        .order('due_date', { ascending: true });

      if (paymentsErr) throw paymentsErr;

      if (!dbPayments) {
        setPayments([]);
        return;
      }

      const formattedPayments: PaymentItem[] = dbPayments.map(p => ({
        id: p.id,
        itemName: orderNamesMap.get(p.order_id) || 'Purchase Installment',
        amountDue: parseFloat(p.amount_due),
        dueDate: p.due_date,
        isPaid: p.is_paid,
        paymentDate: p.payment_date,
        monthNumber: p.month_number,
      }));

      setPayments(formattedPayments);
    } catch (e) {
      console.warn('Failed to fetch client payment calendar:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCalendarPayments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCalendarPayments();
  };

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d',
    divider: isDarkMode ? '#222d42' : '#e2e8f0',
  };

  const formatCurrency = (val: number) => {
    return '₱' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderPaymentItem = ({ item }: { item: PaymentItem }) => {
    const isOverdue = !item.isPaid && new Date(item.dueDate) < new Date();
    
    // Status text & colors
    let statusText = 'Upcoming';
    let statusColor = '#3b82f6';
    let StatusIcon = Clock;

    if (item.isPaid) {
      statusText = 'Settled';
      statusColor = '#10b981';
      StatusIcon = CheckCircle2;
    } else if (isOverdue) {
      statusText = 'Overdue';
      statusColor = '#ef4444';
      StatusIcon = AlertTriangle;
    }

    const dueFormatted = new Date(item.dueDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <View style={[styles.timelineCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusIconFrame, { backgroundColor: statusColor + '10' }]}>
            <StatusIcon size={16} color={statusColor} />
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          <Text style={[styles.monthLabel, { color: t.textSecondary }]}>
            Month {item.monthNumber}
          </Text>
        </View>

        <Text style={[styles.itemName, { color: t.textPrimary }]} numberOfLines={1}>
          {item.itemName}
        </Text>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.dateLabel, { color: t.textSecondary }]}>DUE DATE</Text>
            <Text style={[styles.dateValue, { color: t.textPrimary }]}>{dueFormatted}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.amountLabel, { color: t.textSecondary }]}>AMOUNT DUE</Text>
            <Text style={[styles.amountValue, { color: t.textPrimary }]}>{formatCurrency(item.amountDue)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Dues Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={[styles.loadingContainer, { backgroundColor: t.bg }]}>
          <ActivityIndicator size="large" color="#ee4d2d" />
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={item => item.id}
          renderItem={renderPaymentItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ee4d2d" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Calendar size={40} color={t.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No Dues Recorded</Text>
              <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>
                Approved installments and billing statements will display here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  listContent: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  timelineCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIconFrame: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  monthLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'right',
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
