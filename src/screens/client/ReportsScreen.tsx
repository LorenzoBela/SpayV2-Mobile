import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Award, AlertCircle, ShoppingBag, ShieldAlert } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../../utils/supabase';
import { ThemeContext } from '../../navigation/navigationTypes';

const { width } = Dimensions.get('window');

export default function ReportsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = React.useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalSpent: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    completionRate: 0,
    totalPaidAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    onTimeRate: 100,
    healthScore: 100,
    creditScore: 500,
    debtRatio: 0,
    streak: 0,
  });

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Orders
      const { data: dbOrders } = await supabase
        .from('orders')
        .select('id, amount, is_paid, order_date')
        .eq('user_id', user.id);

      // 2. Fetch Payments
      const orderIds = dbOrders ? dbOrders.map(o => o.id) : [];
      let dbPayments: any[] = [];
      if (orderIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('id, due_date, amount_due, is_paid, payment_date')
          .in('order_id', orderIds);
        if (paymentsData) dbPayments = paymentsData;
      }

      const orders = dbOrders || [];
      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.amount), 0);
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      const completedOrders = orders.filter(o => o.is_paid).length;
      const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

      // Payments calculations
      const totalPayments = dbPayments.length;
      const completedPayments = dbPayments.filter(p => p.is_paid).length;
      const totalPaidAmount = dbPayments.filter(p => p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount_due), 0);
      const pendingAmount = dbPayments.filter(p => !p.is_paid).reduce((sum, p) => sum + parseFloat(p.amount_due), 0);
      
      const now = new Date();
      const overdueAmount = dbPayments
        .filter(p => !p.is_paid && new Date(p.due_date) < now)
        .reduce((sum, p) => sum + parseFloat(p.amount_due), 0);

      // Compliance
      const duePayments = dbPayments.filter(p => new Date(p.due_date) <= now);
      const totalDuePayments = duePayments.length;
      const onTimePayments = duePayments.filter(p => p.is_paid && p.payment_date && new Date(p.payment_date) <= new Date(p.due_date)).length;
      const onTimeRate = totalDuePayments > 0 ? Math.round((onTimePayments / totalDuePayments) * 100) : 100;

      // Health Score
      const onTimeCompleted = dbPayments.filter(p => p.is_paid && p.payment_date && new Date(p.payment_date) <= new Date(p.due_date)).length;
      const onTimeRateCompleted = completedPayments > 0 ? (onTimeCompleted / completedPayments) * 100 : 100;

      let totalDaysLate = 0;
      dbPayments.forEach(p => {
        if (p.is_paid && p.payment_date && p.due_date) {
          const pTime = new Date(p.payment_date).getTime();
          const dTime = new Date(p.due_date).getTime();
          if (pTime > dTime) {
            totalDaysLate += Math.ceil((pTime - dTime) / (1000 * 60 * 60 * 24));
          }
        }
      });
      const avgDaysLate = completedPayments > 0 ? totalDaysLate / completedPayments : 0;
      const healthScore = Math.min(100, Math.max(0, Math.round(onTimeRateCompleted - (avgDaysLate * 2))));

      // Credit Score & Debt Ratio
      const paymentCompletionRate = totalPayments > 0 ? Math.round((completedPayments / totalPayments) * 100) : 0;
      const creditScore = Math.min(850, Math.max(500, Math.round(500 + (onTimeRate * 3) + (paymentCompletionRate * 0.5))));
      const debtRatio = totalPaidAmount > 0 ? Math.min(99, Math.round((pendingAmount / Math.max(totalPaidAmount, 1000)) * 100)) : 0;

      // Streak
      const completedSorted = [...dbPayments]
        .filter(p => p.is_paid)
        .sort((a, b) => new Date(b.payment_date || b.due_date).getTime() - new Date(a.payment_date || a.due_date).getTime());
      let streak = 0;
      for (const p of completedSorted) {
        if (p.payment_date && new Date(p.payment_date) <= new Date(p.due_date)) {
          streak++;
        } else {
          break;
        }
      }

      setMetrics({
        totalSpent,
        totalOrders,
        avgOrderValue,
        completionRate,
        totalPaidAmount,
        pendingAmount,
        overdueAmount,
        onTimeRate,
        healthScore,
        creditScore,
        debtRatio,
        streak,
      });
    } catch (e) {
      console.warn('Failed to fetch reports details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color="#ee4d2d" />
      </View>
    );
  }

  // Circular gauge config for Credit Score
  const csMin = 500;
  const csMax = 850;
  const csPercentage = Math.max(0, Math.min(100, ((metrics.creditScore - csMin) / (csMax - csMin)) * 100));
  const radius = 55;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - csPercentage / 100);

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Financial Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Credit Score & Health Hub */}
        <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: t.textSecondary }]}>CREDIT RATING SUMMARY</Text>
          <View style={styles.scoreRow}>
            <View style={styles.gaugeBox}>
              <Svg width={130} height={130} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle
                  cx={65}
                  cy={65}
                  r={radius}
                  stroke={isDarkMode ? '#1e293b' : '#e2e8f0'}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <Circle
                  cx={65}
                  cy={65}
                  r={radius}
                  stroke="#ee4d2d"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </Svg>
              <View style={styles.gaugeTextOverlay}>
                <Text style={[styles.scoreValue, { color: t.textPrimary }]}>{metrics.creditScore}</Text>
                <Text style={styles.scoreRange}>500-850</Text>
              </View>
            </View>

            <View style={styles.scoreMeta}>
              <View style={styles.metaRow}>
                <Award size={16} color="#fbbf24" />
                <View style={styles.metaTextCol}>
                  <Text style={[styles.metaLabel, { color: t.textSecondary }]}>Wellness Score</Text>
                  <Text style={[styles.metaVal, { color: t.textPrimary }]}>{metrics.healthScore}%</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Calendar size={16} color="#3b82f6" />
                <View style={styles.metaTextCol}>
                  <Text style={[styles.metaLabel, { color: t.textSecondary }]}>On-Time Rate</Text>
                  <Text style={[styles.metaVal, { color: t.textPrimary }]}>{metrics.onTimeRate}%</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <TrendingUp size={16} color="#10b981" />
                <View style={styles.metaTextCol}>
                  <Text style={[styles.metaLabel, { color: t.textSecondary }]}>Payment Streak</Text>
                  <Text style={[styles.metaVal, { color: t.textPrimary }]}>{metrics.streak} months</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Expenses Overview */}
        <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: t.textSecondary }]}>EXPENSES & PURCHASES</Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.gridCell, { borderRightWidth: 1, borderRightColor: t.divider }]}>
              <ShoppingBag size={20} color="#3b82f6" style={styles.cellIcon} />
              <Text style={[styles.cellLabel, { color: t.textSecondary }]}>Total Spent</Text>
              <Text style={[styles.cellValue, { color: t.textPrimary }]}>{formatCurrency(metrics.totalSpent)}</Text>
            </View>

            <View style={styles.gridCell}>
              <TrendingUp size={20} color="#10b981" style={styles.cellIcon} />
              <Text style={[styles.cellLabel, { color: t.textSecondary }]}>Total Orders</Text>
              <Text style={[styles.cellValue, { color: t.textPrimary }]}>{metrics.totalOrders}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: t.divider }]} />

          <View style={styles.statsGrid}>
            <View style={[styles.gridCell, { borderRightWidth: 1, borderRightColor: t.divider }]}>
              <TrendingDown size={20} color="#f59e0b" style={styles.cellIcon} />
              <Text style={[styles.cellLabel, { color: t.textSecondary }]}>Avg Order Val</Text>
              <Text style={[styles.cellValue, { color: t.textPrimary }]}>{formatCurrency(metrics.avgOrderValue)}</Text>
            </View>

            <View style={styles.gridCell}>
              <Award size={20} color="#a855f7" style={styles.cellIcon} />
              <Text style={[styles.cellLabel, { color: t.textSecondary }]}>Completion Rate</Text>
              <Text style={[styles.cellValue, { color: t.textPrimary }]}>{metrics.completionRate}%</Text>
            </View>
          </View>
        </View>

        {/* Payment Health Ledger */}
        <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: t.textSecondary }]}>LEDGER EXPOSURE</Text>
          
          <View style={styles.ledgerRow}>
            <Text style={[styles.ledgerLabel, { color: t.textSecondary }]}>Paid Principal</Text>
            <Text style={[styles.ledgerVal, { color: '#10b981' }]}>{formatCurrency(metrics.totalPaidAmount)}</Text>
          </View>

          <View style={styles.ledgerRow}>
            <Text style={[styles.ledgerLabel, { color: t.textSecondary }]}>Outstanding Principal</Text>
            <Text style={[styles.ledgerVal, { color: t.textPrimary }]}>{formatCurrency(metrics.pendingAmount)}</Text>
          </View>

          <View style={styles.ledgerRow}>
            <Text style={[styles.ledgerLabel, { color: t.textSecondary }]}>Overdue Penalties</Text>
            <Text style={[styles.ledgerVal, { color: metrics.overdueAmount > 0 ? '#ef4444' : t.textSecondary }]}>
              {formatCurrency(metrics.overdueAmount)}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: t.divider }]} />

          <View style={styles.ledgerRow}>
            <Text style={[styles.ledgerLabel, { color: t.textPrimary, fontWeight: 'bold' }]}>Debt-to-Asset Ratio</Text>
            <Text style={[styles.ledgerVal, { color: '#ee4d2d', fontWeight: 'bold' }]}>{metrics.debtRatio}%</Text>
          </View>
        </View>

        {/* Dynamic Warning Card */}
        {metrics.overdueAmount > 0 && (
          <View style={styles.warningCard}>
            <AlertCircle size={20} color="#ffffff" style={styles.warningIcon} />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Overdue Dues Notice</Text>
              <Text style={styles.warningDesc}>
                You have {formatCurrency(metrics.overdueAmount)} in past-due installments. Clear these soon to protect your credibility rating.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gaugeBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeTextOverlay: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Jakarta-ExtraBold',
  },
  scoreRange: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },
  scoreMeta: {
    flex: 1,
    marginLeft: 20,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaTextCol: {
    marginLeft: 10,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cellIcon: {
    marginBottom: 6,
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  cellValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  ledgerLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  ledgerVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#ef4444',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  warningIcon: {
    marginRight: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  warningDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    lineHeight: 16,
  },
});
