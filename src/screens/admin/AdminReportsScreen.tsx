import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  CreditCard,
  PieChart,
  Activity,
  Layers,
  ChevronRight,
  Sparkles,
  Award,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAllAdminData, getExportLedgerCsv } from '../../services/adminService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function AdminReportsScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Stats & categories
  const [reportStats, setReportStats] = useState({
    totalPrincipal: 0,
    collectedAmount: 0,
    outstandingAmount: 0,
    collectionEfficiency: 0,
    retentionRate: 0,
    avgOrderValue: 0,
  });

  const [categoryData, setCategoryData] = useState<Array<{ category: string; count: number; totalValue: number; percentage: number }>>([]);
  const [installmentsBreakdown, setInstallmentsBreakdown] = useState<Array<{ months: number; count: number; total: number; collected: number; outstanding: number }>>([]);

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const result = await fetchAllAdminData();
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync analytical reports database.');
      }

      const { profiles = [], orders = [], payments = [] } = result;

      // 1. Calculate general collection efficiency metrics
      const clientOrders = orders.filter(o => profiles.some(p => p.id === o.user_id));
      const totalSpent = clientOrders.reduce((sum, o) => sum + Number(o.amount), 0);

      const clientPayments = payments.filter(p => clientOrders.some(o => o.id === p.order_id));
      const totalDueAmount = clientPayments.reduce((sum, p) => sum + Number(p.amount_due), 0);
      const collectedAmount = clientPayments.filter(p => p.is_paid).reduce((sum, p) => sum + Number(p.amount_due), 0);
      const outstandingAmount = clientPayments.filter(p => !p.is_paid).reduce((sum, p) => sum + Number(p.amount_due), 0);

      const collectionEfficiency = totalDueAmount > 0
        ? Math.round((collectedAmount / totalDueAmount) * 100)
        : 0;

      // 2. Retention rate estimation
      // Count client profiles and how many have > 1 order
      const clientOrderCounts = new Map<string, number>();
      clientOrders.forEach(o => {
        clientOrderCounts.set(o.user_id, (clientOrderCounts.get(o.user_id) || 0) + 1);
      });
      const clientsWithOrdersCount = clientOrderCounts.size;
      const repeatClientsCount = Array.from(clientOrderCounts.values()).filter(c => c > 1).length;
      const retentionRate = clientsWithOrdersCount > 0
        ? Math.round((repeatClientsCount / clientsWithOrdersCount) * 100)
        : 0;

      // Avg order size
      const avgOrderValue = clientOrders.length > 0
        ? totalSpent / clientOrders.length
        : 0;

      setReportStats({
        totalPrincipal: totalSpent,
        collectedAmount,
        outstandingAmount,
        collectionEfficiency,
        retentionRate,
        avgOrderValue,
      });

      // 3. Product Categories distribution
      const categoriesMap = new Map<string, { count: number; total: number }>();
      const getCategoryName = (name: string) => {
        const lower = name.toLowerCase();
        if (/phone|laptop|computer|tv|headphone|earphone|electronic|gadget|camera|tablet|speaker|monitor/i.test(lower)) return 'Electronics';
        if (/chair|table|sofa|bed|desk|furniture|cabinet|shelf/i.test(lower)) return 'Furniture';
        if (/fridge|washing|microwave|oven|appliance|freezer/i.test(lower)) return 'Appliances';
        if (/dress|shirt|pants|clothes|fashion|wear|shoe|bag/i.test(lower)) return 'Fashion';
        if (/beauty|cosmetic|skincare|makeup|serum/i.test(lower)) return 'Beauty';
        if (/food|snack|eat|drink|coffee|tea|meal/i.test(lower)) return 'Food';
        return 'Other';
      };

      clientOrders.forEach(order => {
        const cat = getCategoryName(order.item_name);
        const data = categoriesMap.get(cat) || { count: 0, total: 0 };
        data.count += 1;
        data.total += Number(order.amount);
        categoriesMap.set(cat, data);
      });

      const processedCategories = Array.from(categoriesMap.entries()).map(([category, details]) => {
        return {
          category,
          count: details.count,
          totalValue: details.total,
          percentage: totalSpent > 0 ? Math.round((details.total / totalSpent) * 100) : 0,
        };
      }).sort((a, b) => b.totalValue - a.totalValue);

      setCategoryData(processedCategories);

      // 4. Installments duration breakdown
      const termsMap = new Map<number, { count: number; total: number; collected: number; outstanding: number }>();
      clientOrders.forEach(order => {
        const months = order.installment_months;
        const details = termsMap.get(months) || { count: 0, total: 0, collected: 0, outstanding: 0 };

        const orderPayments = payments.filter(p => p.order_id === order.id);
        const coll = orderPayments.filter(p => p.is_paid).reduce((sum, p) => sum + Number(p.amount_due), 0);
        const outst = orderPayments.filter(p => !p.is_paid).reduce((sum, p) => sum + Number(p.amount_due), 0);

        details.count += 1;
        details.total += Number(order.amount);
        details.collected += coll;
        details.outstanding += outst;

        termsMap.set(months, details);
      });

      const processedTerms = Array.from(termsMap.entries()).map(([months, details]) => {
        return {
          months,
          ...details,
        };
      }).sort((a, b) => a.months - b.months);

      setInstallmentsBreakdown(processedTerms);

    } catch (err: any) {
      console.warn('[AdminReportsScreen] Loading error:', err);
      setError(err?.message || 'Sync failed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleExportCSV = async () => {
    setActionLoading(true);
    try {
      const response = await getExportLedgerCsv({ allTime: true });
      if (response.success && response.csv) {
        const fileUri = `${FileSystem.documentDirectory}spay_collections_ledger_${new Date().toISOString().split('T')[0]}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, response.csv, {
          encoding: FileSystem.EncodingType.UTF8
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Collections Ledger CSV' });
        } else {
          Alert.alert('Export Complete', 'Ledger exported successfully to local documents folder.');
        }
      } else {
        Alert.alert('Export Failed', response.error || 'Failed to download report data.');
      }
    } catch (e: any) {
      Alert.alert('Export Error', e?.message || 'Error occurred while saving CSV file.');
    } finally {
      setActionLoading(false);
    }
  };

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#1e293b' : '#f1f5f9',
    accent: '#ee4d2d',
    accentLight: 'rgba(238, 77, 45, 0.08)',
  };

  // SVG Gauge calculations
  const radius = 50;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (reportStats.collectionEfficiency / 100) * circumference;

  if (loading) {
    return (
      <PremiumLoader
        title="Admin Control Center"
        subtitle="Loading report ledgers and running aggregations..."
        error={error}
        onRetry={() => loadData()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSubtitle}>Operations Center</Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Reports & Analytics</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: t.accentLight, borderColor: t.accent }]}
          onPress={handleExportCSV}
          disabled={actionLoading}
        >
          <FileSpreadsheet size={16} color={t.accent} />
          <Text style={[styles.exportBtnText, { color: t.accent }]}>{actionLoading ? 'Exporting...' : 'Export Ledger'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* Collection Efficiency Gauge Card */}
        <View style={[styles.gaugeCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.gaugeContainer}>
            <Svg width={120} height={120}>
              <Circle
                cx={60}
                cy={60}
                r={radius}
                stroke={isDarkMode ? '#1e293b' : '#f1f5f9'}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <Circle
                cx={60}
                cy={60}
                r={radius}
                stroke={t.accent}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <SvgText
                x={60}
                y={66}
                fill={t.textPrimary}
                fontSize={20}
                fontWeight="bold"
                textAnchor="middle"
              >
                {reportStats.collectionEfficiency}%
              </SvgText>
            </Svg>

            <View style={styles.gaugeInfoCol}>
              <Text style={[styles.gaugeTitle, { color: t.textPrimary }]}>Collection Efficiency</Text>
              <Text style={styles.gaugeDesc}>Ratio of successfully collected installments to total dues outstanding.</Text>
              <View style={styles.metricsBadgeRow}>
                <View style={styles.miniBadge}>
                  <Award size={10} color="#10b981" />
                  <Text style={styles.miniBadgeText}>Healthy</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: t.border }]} />

          <View style={styles.statsOverviewRow}>
            <View>
              <Text style={styles.overviewLabel}>Total Collected</Text>
              <Text style={[styles.overviewValue, { color: '#10b981' }]}>{formatCurrency(reportStats.collectedAmount)}</Text>
            </View>
            <View>
              <Text style={styles.overviewLabel}>Ledger Outstanding</Text>
              <Text style={[styles.overviewValue, { color: t.accent }]}>{formatCurrency(reportStats.outstandingAmount)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.overviewLabel}>Total Dues Volume</Text>
              <Text style={[styles.overviewValue, { color: t.textPrimary }]}>{formatCurrency(reportStats.collectedAmount + reportStats.outstandingAmount)}</Text>
            </View>
          </View>
        </View>

        {/* General Business metrics */}
        <View style={styles.miniStatsRow}>
          <View style={[styles.miniStatCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={styles.miniStatLabel}>Avg Client Order Size</Text>
            <Text style={[styles.miniStatVal, { color: t.textPrimary }]}>{formatCurrency(reportStats.avgOrderValue)}</Text>
          </View>
          <View style={[styles.miniStatCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={styles.miniStatLabel}>Rider Retention Rate</Text>
            <Text style={[styles.miniStatVal, { color: t.textPrimary }]}>{reportStats.retentionRate}%</Text>
          </View>
        </View>

        {/* Category distribution */}
        <Text style={styles.sectionTitleText}>Purchase Categories Volume</Text>
        <View style={[styles.cardCollection, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          {categoryData.length > 0 ? (
            categoryData.map((item, idx) => (
              <View key={item.category} style={styles.categoryRow}>
                <View style={styles.categoryInfo}>
                  <Text style={[styles.categoryName, { color: t.textPrimary }]}>{item.category}</Text>
                  <Text style={styles.categoryCount}>{item.count} items ordered</Text>
                </View>

                <View style={styles.categoryProgressWrapper}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${item.percentage}%` }]} />
                  </View>
                  <Text style={[styles.categoryPercentage, { color: t.textPrimary }]}>{item.percentage}%</Text>
                </View>

                <Text style={[styles.categoryValueText, { color: t.textPrimary }]}>{formatCurrency(item.totalValue)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No orders recorded to classify.</Text>
          )}
        </View>

        {/* Installments period breakdown */}
        <Text style={styles.sectionTitleText}>Amortization Terms Breakdown</Text>
        <View style={[styles.cardCollection, { backgroundColor: t.cardBg, borderColor: t.cardBorder, marginBottom: 20 }]}>
          {installmentsBreakdown.length > 0 ? (
            installmentsBreakdown.map((item) => {
              const rate = item.total > 0 ? Math.round((item.collected / item.total) * 100) : 0;
              return (
                <View key={item.months} style={styles.termRow}>
                  <View style={styles.termHeader}>
                    <Text style={[styles.termTitleText, { color: t.textPrimary }]}>{item.months} Months Duration</Text>
                    <Text style={styles.termCountText}>{item.count} Active Ledgers</Text>
                  </View>

                  <View style={styles.termDataColumns}>
                    <View>
                      <Text style={styles.termColLabel}>Principal Total</Text>
                      <Text style={[styles.termColVal, { color: t.textPrimary }]}>{formatCurrency(item.total)}</Text>
                    </View>
                    <View>
                      <Text style={styles.termColLabel}>Collected</Text>
                      <Text style={[styles.termColVal, { color: '#10b981' }]}>{formatCurrency(item.collected)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.termColLabel}>Settle Rate</Text>
                      <Text style={[styles.termColVal, { color: t.accent }]}>{rate}%</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No installment order logs to break down.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    gap: 2,
  },
  headerSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  gaugeCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
  },
  gaugeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  gaugeInfoCol: {
    flex: 1,
    gap: 6,
  },
  gaugeTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  gaugeDesc: {
    fontSize: 10,
    color: '#64748b',
    lineHeight: 14,
  },
  metricsBadgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  miniBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#10b981',
  },
  cardDivider: {
    height: 1,
  },
  statsOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  overviewValue: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  miniStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniStatCard: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  miniStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  miniStatVal: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 8,
  },
  cardCollection: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 16,
  },
  categoryRow: {
    gap: 8,
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  categoryCount: {
    fontSize: 10,
    color: '#64748b',
  },
  categoryProgressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ee4d2d',
  },
  categoryPercentage: {
    fontSize: 11,
    fontWeight: 'bold',
    width: 30,
    textAlign: 'right',
  },
  categoryValueText: {
    fontSize: 12,
    fontWeight: 'bold',
    alignSelf: 'flex-end',
  },
  termRow: {
    gap: 10,
  },
  termHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  termTitleText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  termCountText: {
    fontSize: 10,
    color: '#64748b',
  },
  termDataColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 10,
    borderRadius: 12,
  },
  termColLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  termColVal: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    paddingVertical: 20,
  },
});
