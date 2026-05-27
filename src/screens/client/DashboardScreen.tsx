import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

interface DashboardData {
  name: string;
  creditLimit: number;
  availableCredit: number;
  nextPaymentDue: {
    amount: number;
    dueDate: string;
    daysLeft: number;
  } | null;
  activeOrdersCount: number;
  paidOffRate: number;
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData>({
    name: 'Client Rider',
    creditLimit: 50000.0,
    availableCredit: 38250.0,
    nextPaymentDue: {
      amount: 3450.0,
      dueDate: '2026-05-28',
      daysLeft: 5,
    },
    activeOrdersCount: 3,
    paidOffRate: 78,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      // 2. Get account limit
      const { data: limitData } = await supabase
        .from('account_limits')
        .select('credit_limit')
        .eq('user_id', user.id)
        .single();

      // 3. Get active orders and payments to calculate available credits
      const { data: orders } = await supabase
        .from('orders')
        .select('id, amount, is_paid')
        .eq('user_id', user.id);

      const { data: payments } = await supabase
        .from('payments')
        .select('amount_due, is_paid, due_date')
        .order('due_date', { ascending: true });

      const name = profile?.name || user.email?.split('@')[0] || 'User';
      const creditLimit = limitData ? parseFloat(limitData.credit_limit) : 50000.0;

      // Calculate total outstanding balance
      let outstanding = 0;
      if (payments) {
        outstanding = payments
          .filter((p: any) => !p.is_paid)
          .reduce((sum: number, p: any) => sum + parseFloat(p.amount_due), 0);
      }
      const availableCredit = Math.max(0, creditLimit - outstanding);

      // Find next payment due
      const nextDue = payments?.find((p: any) => !p.is_paid);
      let nextPaymentDue = null;
      if (nextDue) {
        const due = new Date(nextDue.due_date);
        const today = new Date();
        const diffTime = due.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        nextPaymentDue = {
          amount: parseFloat(nextDue.amount_due),
          dueDate: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          daysLeft,
        };
      }

      // Active orders count
      const activeOrdersCount = orders ? orders.filter((o: any) => !o.is_paid).length : 0;

      // Paid off rate calculation
      const totalPayments = payments ? payments.length : 0;
      const paidPayments = payments ? payments.filter((p: any) => p.is_paid).length : 0;
      const paidOffRate = totalPayments > 0 ? Math.round((paidPayments / totalPayments) * 100) : 100;

      setData({
        name,
        creditLimit,
        availableCredit,
        nextPaymentDue,
        activeOrdersCount,
        paidOffRate,
      });
    } catch (error) {
      console.warn('Error fetching DB dashboard data, using local placeholders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const percentageUsed = Math.round(((data.creditLimit - data.availableCredit) / data.creditLimit) * 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Profile Card Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{data.name}</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{data.name.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        {/* Credit Limit Gauge Card */}
        <View style={styles.creditCard}>
          <View style={styles.creditHeader}>
            <Text style={styles.creditTitle}>AVAILABLE SPENDING LIMIT</Text>
            <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          </View>

          <Text style={styles.creditValue}>₱{data.availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <Text style={styles.creditSubText}>out of ₱{data.creditLimit.toLocaleString('en-US')} limit</Text>

          {/* Custom Sleek Progress Bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${100 - percentageUsed}%` }]} />
          </View>

          <View style={styles.creditFooter}>
            <Text style={styles.footerLabel}>Used Limit: {percentageUsed}%</Text>
            <Text style={styles.footerLabel}>₱{(data.creditLimit - data.availableCredit).toLocaleString('en-US')} active</Text>
          </View>
        </View>

        {/* Next Payment Due Prompt */}
        {data.nextPaymentDue ? (
          <View style={styles.dueCard}>
            <View style={styles.dueIconContainer}>
              <Ionicons name="alarm-outline" size={24} color="#f59e0b" />
            </View>
            <View style={styles.dueInfo}>
              <Text style={styles.dueLabel}>Next Payment Due</Text>
              <Text style={styles.dueAmount}>₱{data.nextPaymentDue.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              <Text style={styles.dueDateText}>Due: {data.nextPaymentDue.dueDate} ({data.nextPaymentDue.daysLeft} days left)</Text>
            </View>
            <TouchableOpacity style={styles.payButton}>
              <Text style={styles.payButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.dueCard, styles.dueCardPaid]}>
            <View style={[styles.dueIconContainer, styles.dueIconPaid]}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#10b981" />
            </View>
            <View style={styles.dueInfo}>
              <Text style={styles.dueLabel}>No Outstanding Payments</Text>
              <Text style={styles.dueDateText}>You are all caught up!</Text>
            </View>
          </View>
        )}

        {/* Quick Analytics Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="briefcase-outline" size={22} color="#3b82f6" />
            <Text style={styles.statValue}>{data.activeOrdersCount}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="analytics-outline" size={22} color="#10b981" />
            <Text style={styles.statValue}>{data.paidOffRate}%</Text>
            <Text style={styles.statLabel}>Installment Pay-off</Text>
          </View>
        </View>

        {/* Short Action Prompts */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
            </View>
            <Text style={styles.actionText}>Add Order</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Ionicons name="document-text-outline" size={24} color="#10b981" />
            </View>
            <Text style={styles.actionText}>Upload Proof</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
              <Ionicons name="calendar-outline" size={24} color="#8b5cf6" />
            </View>
            <Text style={styles.actionText}>Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
              <Ionicons name="headset-outline" size={24} color="#ec4899" />
            </View>
            <Text style={styles.actionText}>NootAI Chat</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate-900
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  welcomeText: {
    color: '#64748b',
    fontSize: 14,
  },
  userName: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
  },
  creditCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  creditTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  creditValue: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '900',
  },
  creditSubText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  creditFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  footerLabel: {
    color: '#475569',
    fontSize: 11,
  },
  dueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  dueCardPaid: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  dueIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dueIconPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  dueInfo: {
    flex: 1,
  },
  dueLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  dueAmount: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 2,
  },
  dueDateText: {
    color: '#64748b',
    fontSize: 11,
  },
  payButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  payButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  statValue: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: {
    alignItems: 'center',
    width: '22%',
  },
  actionIconBg: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
});
