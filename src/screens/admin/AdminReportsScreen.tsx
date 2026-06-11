import { PremiumAlert } from '../../services/PremiumAlertService';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import React, { useState, useEffect, useContext, useMemo } from 'react';
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
  Modal,
  TextInput,
  Dimensions,
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
  Users,
  Clock,
  HeartPulse,
  AlertCircle,
  AlertTriangle,
  Mail,
  Download,
  Filter,
  Info,
  X,
  ChevronDown,
  Check,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  UserCheck,
  ShieldCheck,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAdminReports, fetchAdminClients, getExportLedgerCsv, callAdminApi } from '../../services/adminService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Svg, { Circle, Text as SvgText, Path, Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const shortMonthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function AdminReportsScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Timeframe Filter States
  const [allTime, setAllTime] = useState(true);
  const [startMonth, setStartMonth] = useState(1);
  const [startYear, setStartYear] = useState(new Date().getFullYear() - 1);
  const [endMonth, setEndMonth] = useState(12);
  const [endYear, setEndYear] = useState(new Date().getFullYear());

  // Picker modal states
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempAllTime, setTempAllTime] = useState(true);
  const [tempStartMonth, setTempStartMonth] = useState(1);
  const [tempStartYear, setTempStartYear] = useState(new Date().getFullYear() - 1);
  const [tempEndMonth, setTempEndMonth] = useState(12);
  const [tempEndYear, setTempEndYear] = useState(new Date().getFullYear());

  // Sub Tab Navigation
  const [activeTab, setActiveTab] = useState<'revenue' | 'forecast' | 'behavior'>('revenue');

  // Bulk Reminders Modal States
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState<'all' | 'month' | 'selected' | 'overdue'>('overdue');
  const [modalStep, setModalStep] = useState<'select' | 'preview'>('select');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedBulkMonth, setSelectedBulkMonth] = useState<string>('');
  const [selectedBulkYear, setSelectedBulkYear] = useState<string>(new Date().getFullYear().toString());
  const [previewData, setPreviewData] = useState<any>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<number>(0);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Single reminder loading map
  const [remindingMap, setRemindingMap] = useState<Record<string, boolean>>({});

  // Theme object
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

  const queryClient = useQueryClient();

  const { data: reportsData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['admin-reports', { allTime, startMonth, startYear, endMonth, endYear }],
    queryFn: () => fetchAdminReports({ allTime, startMonth, startYear, endMonth, endYear }),
    staleTime: 30000,
  });

  const { data: clientsSelectionData } = useQuery({
    queryKey: ['admin-clients-selection'],
    queryFn: () => fetchAdminClients({ page: 1, pageSize: 1000 }),
    staleTime: 30000,
  });

  const allProfiles = clientsSelectionData?.clients || [];
  const error = queryError ? (queryError as Error).message : null;

  const loadData = async (showLoader?: boolean) => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['admin-clients-selection'] })
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useRealtimeSync(
    ['orders', 'payments', 'profiles'],
    undefined,
    [['admin-reports']]
  );

  // Determine available years statically to avoid loading massive history
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  }, []);

  // Apply filters
  const handleApplyFilters = () => {
    setStartMonth(tempStartMonth);
    setStartYear(tempStartYear);
    setEndMonth(tempEndMonth);
    setEndYear(tempEndYear);
    setAllTime(tempAllTime);
    setIsFilterModalOpen(false);
  };

  // Open date filter modal
  const openFilterModal = () => {
    setTempStartMonth(startMonth);
    setTempStartYear(startYear);
    setTempEndMonth(endMonth);
    setTempEndYear(endYear);
    setTempAllTime(allTime);
    setIsFilterModalOpen(true);
  };

  // Handle Export CSV
  const handleExportCSV = async () => {
    setActionLoading(true);
    try {
      const response = await getExportLedgerCsv({
        allTime,
        startYear: allTime ? undefined : startYear,
        startMonth: allTime ? undefined : startMonth,
        endYear: allTime ? undefined : endYear,
        endMonth: allTime ? undefined : endMonth,
      });

      if (response.success && response.csv) {
        const fileUri = `${FileSystem.documentDirectory}spay_collections_ledger_${new Date().toISOString().split('T')[0]}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, response.csv, {
          encoding: FileSystem.EncodingType.UTF8
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Collections Ledger CSV' });
        } else {
          PremiumAlert.alert('Export Complete', 'Ledger exported successfully to local documents folder.');
        }
      } else {
        PremiumAlert.alert('Export Failed', response.error || 'Failed to download report data.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Export Error', e?.message || 'Error occurred while saving CSV file.');
    } finally {
      setActionLoading(false);
    }
  };

  // Extract report variables from backend payload with defaults to avoid UI breakage
  const reportsPayload = reportsData?.success ? reportsData : null;

  const metrics = reportsPayload?.metrics || {
    totalRevenue: 0,
    outstanding: 0,
    overdueAmount: 0,
    collectionRate: 0,
    growthRate: 0,
    avgPaymentValue: 0,
    avgMonthlyRevenue: 0,
    avgDaysOverdue: 0,
    activeClients: 0,
    totalOrders: 0,
    retentionRate: 0,
    avgPaymentVelocity: 0,
  };

  const monthlyData = reportsPayload?.monthlyData || [];
  const clientLeaderboard = reportsPayload?.clientLeaderboard || [];
  const itemLeaderboard = reportsPayload?.itemLeaderboard || [];
  const delinquentClients = reportsPayload?.delinquentClients || [];
  const dayPatterns = reportsPayload?.dayPatterns || [];
  const yearComparison = reportsPayload?.yearComparison || [];
  const forecastData = reportsPayload?.forecastData || [];
  const termAnalysis = reportsPayload?.termAnalysis || [];

  // Financial Health Score (Weighted index)
  const healthScore = useMemo(() => {
    let score = 0;
    score += Math.min(metrics.collectionRate, 100) * 0.4; // 40% Weight
    score += (metrics.growthRate > 0 ? Math.min(metrics.growthRate, 50) : 0) * 0.3; // 30% Weight
    score += (metrics.retentionRate > 0 ? Math.min(metrics.retentionRate, 100) : 0) * 0.2; // 20% Weight
    score += (delinquentClients.length === 0 ? 10 : Math.max(0, 10 - delinquentClients.length)) * 1.0; // 10% Weight
    return Math.min(100, Math.max(0, Math.round(score)));
  }, [metrics, delinquentClients]);

  const healthStatus = useMemo(() => {
    if (healthScore >= 80) return { label: 'Excellent', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)', textColor: '#10b981', progress: '#10b981' };
    if (healthScore >= 60) return { label: 'Good', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)', textColor: '#22c55e', progress: '#22c55e' };
    if (healthScore >= 40) return { label: 'Fair', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', textColor: '#f59e0b', progress: '#f59e0b' };
    return { label: 'Attention Required', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', textColor: '#ef4444', progress: '#ef4444' };
  }, [healthScore]);

  // Concentric Rings calculation (Paid vs Pending vs Overdue)
  const totalDuesVolume = metrics.totalRevenue + metrics.outstanding;
  const paidPct = totalDuesVolume > 0 ? (metrics.totalRevenue / totalDuesVolume) * 100 : 0;
  const pendingPct = totalDuesVolume > 0 ? ((metrics.outstanding - metrics.overdueAmount) / totalDuesVolume) * 100 : 0;
  const overduePct = totalDuesVolume > 0 ? (metrics.overdueAmount / totalDuesVolume) * 100 : 0;

  // Single reminder trigger alert
  const handleSendSingleReminder = async (clientId: string) => {
    setRemindingMap(prev => ({ ...prev, [clientId]: true }));
    try {
      const response = await callAdminApi('send-bulk-reminders', {
        type: 'selected',
        clientIds: [clientId]
      });

      if (response.success) {
        PremiumAlert.alert('Reminder Queued', 'Payment alert email reminder has been sent.');
      } else {
        PremiumAlert.alert('Alert Failed', response.error || 'Failed to dispatch email.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Sync Error', e?.message || 'Error occurred during reminder dispatch.');
    } finally {
      setRemindingMap(prev => ({ ...prev, [clientId]: false }));
    }
  };

  // Preview Bulk queue handler
  const handlePreviewBulkReminders = async () => {
    if (bulkType === 'month' && (!selectedBulkMonth || !selectedBulkYear)) {
      PremiumAlert.alert('Fields Required', 'Please select both target month and year.');
      return;
    }
    if (bulkType === 'selected' && selectedClientIds.length === 0) {
      PremiumAlert.alert('Recipients Required', 'Please select at least one client recipient.');
      return;
    }

    setIsPreviewLoading(true);
    setModalStep('preview');
    setPreviewData(null);
    setActivePreviewTab(0);

    try {
      const response = await callAdminApi('preview-bulk-reminders', {
        type: bulkType,
        month: selectedBulkMonth || undefined,
        year: selectedBulkYear || undefined,
        clientIds: bulkType === 'selected' ? selectedClientIds : (bulkType === 'overdue' ? delinquentClients.map((c: any) => c.id) : undefined)
      });

      if (response.status === 'success' || response.status === 'info') {
        setPreviewData(response);
      } else {
        PremiumAlert.alert('Error', response.message || 'Failed to compile email layout previews.');
        setModalStep('select');
      }
    } catch (e) {
      PremiumAlert.alert('Error', 'Network error occurred while fetching layout previews.');
      setModalStep('select');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Dispatch Bulk execution
  const handleSendBulkReminders = async () => {
    if (bulkType === 'month' && (!selectedBulkMonth || !selectedBulkYear)) {
      PremiumAlert.alert('Fields Required', 'Month and year must be specified.');
      return;
    }
    if (bulkType === 'selected' && selectedClientIds.length === 0) {
      PremiumAlert.alert('Clients Required', 'Select at least one client.');
      return;
    }

    setIsSendingBulk(true);
    try {
      const response = await callAdminApi('send-bulk-reminders', {
        type: bulkType,
        month: selectedBulkMonth || undefined,
        year: selectedBulkYear || undefined,
        clientIds: bulkType === 'selected' ? selectedClientIds : (bulkType === 'overdue' ? delinquentClients.map((c: any) => c.id) : undefined)
      });

      if (response.success) {
        PremiumAlert.alert('Dispatched Successfully', response.message || 'Bulk reminder emails queued.');
        setIsBulkModalOpen(false);
        setModalStep('select');
        loadData(false);
      } else {
        PremiumAlert.alert('Dispatch Failure', response.error || 'Failed to process bulk reminders.');
      }
    } catch (e) {
      PremiumAlert.alert('Dispatch Error', 'Network error executing bulk dispatch.');
    } finally {
      setIsSendingBulk(false);
    }
  };

  const filteredClientsForSelection = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    return allProfiles.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [allProfiles, clientSearch]);

  const handleToggleSelectClient = (id: string) => {
    setSelectedClientIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSelectAllClients = () => {
    const allFilteredIds = filteredClientsForSelection.map((c: any) => c.id);
    const allSelected = allFilteredIds.every((id: any) => selectedClientIds.includes(id));
    if (allSelected) {
      setSelectedClientIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedClientIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

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

      {/* Filter Panel Trigger & Bulk Button */}
      <View style={styles.topActionsRow}>
        <TouchableOpacity
          style={[styles.filterTrigger, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
          onPress={openFilterModal}
        >
          <View style={styles.filterTriggerLeft}>
            <Filter size={14} color={t.accent} />
            <Text 
              style={[styles.filterTriggerText, { color: t.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {allTime
                ? 'All-Time Range'
                : `${shortMonthNames[startMonth - 1]} '${String(startYear).substring(2)} - ${shortMonthNames[endMonth - 1]} '${String(endYear).substring(2)}`}
            </Text>
          </View>
          <ChevronDown size={14} color={t.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bulkBtn, { backgroundColor: isDarkMode ? '#e0533c' : '#ee4d2d' }]}
          onPress={() => {
            setSelectedClientIds([]);
            setSelectedBulkMonth('');
            setBulkType('overdue');
            setIsBulkModalOpen(true);
          }}
        >
          <Mail size={14} color="#ffffff" />
          <Text style={styles.bulkBtnText}>Bulk Reminders</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* KPI Container (Symmetrical Premium Layout) */}
        <View style={styles.kpiContainer}>
          {/* Card 1: Financial Health Score Hero Card */}
          <View
            style={[
              styles.heroKpiCard,
              {
                backgroundColor: healthScore >= 80 
                  ? (isDarkMode ? '#064e3b' : '#ecfdf5')
                  : healthScore >= 60 
                  ? (isDarkMode ? '#065f46' : '#f0fdf4')
                  : healthScore >= 40
                  ? (isDarkMode ? '#78350f' : '#fffbeb')
                  : (isDarkMode ? '#7f1d1d' : '#fef2f2'),
                borderColor: t.cardBorder,
              }
            ]}
          >
            <View style={styles.heroHealthLeft}>
              <View style={styles.heroHealthHeader}>
                <View style={[styles.iconWrapper, { backgroundColor: healthStatus.bgColor }]}>
                  <HeartPulse size={15} color={healthStatus.textColor} />
                </View>
                <Text style={[styles.heroKpiLabel, { color: t.textSecondary }]}>Financial Health</Text>
              </View>
              <Text style={[styles.heroHealthDesc, { color: t.textSecondary }]}>
                Business state is classified as <Text style={{ color: healthStatus.textColor, fontWeight: 'bold', fontFamily: 'Outfit-Bold' }}>{healthStatus.label}</Text>. Rate matches overall metrics.
              </Text>
            </View>

            <View style={styles.radialContainer}>
              <Svg width={74} height={74} viewBox="0 0 74 74">
                <Circle
                  cx={37}
                  cy={37}
                  r={30}
                  stroke={isDarkMode ? '#1e293b' : '#f1f5f9'}
                  strokeWidth={6}
                  fill="transparent"
                />
                <Circle
                  cx={37}
                  cy={37}
                  r={30}
                  stroke={healthStatus.textColor}
                  strokeWidth={6}
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 30}
                  strokeDashoffset={2 * Math.PI * 30 * (1 - healthScore / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 37 37)"
                />
                <SvgText
                  x={37}
                  y={42}
                  fill={t.textPrimary}
                  fontSize={15}
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="Outfit-Bold"
                >
                  {healthScore}
                </SvgText>
              </Svg>
            </View>
          </View>

          {/* Row 1: Collected Revenue & Outstanding Dues */}
          <View style={styles.kpiRow}>
            {/* Collected Revenue */}
            <View style={[styles.kpiColCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.kpiCardTop}>
                <View style={[styles.iconWrapper, { backgroundColor: 'rgba(238, 77, 45, 0.12)' }]}>
                  <CreditCard size={14} color={t.accent} />
                </View>
                <Text style={styles.kpiLabel}>Collected</Text>
              </View>
              <Text style={[styles.kpiVal, { color: t.textPrimary }]} numberOfLines={1}>
                {formatCurrency(metrics.totalRevenue)}
              </Text>
              <View style={styles.growthBadgeRow}>
                <View style={[
                  styles.growthBadge,
                  { backgroundColor: metrics.growthRate >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                ]}>
                  {metrics.growthRate >= 0 ? <ArrowUpRight size={9} color="#10b981" /> : <ArrowDownRight size={9} color="#ef4444" />}
                  <Text style={[styles.growthText, { color: metrics.growthRate >= 0 ? '#10b981' : '#ef4444' }]}>
                    {metrics.growthRate >= 0 ? '+' : ''}{metrics.growthRate}%
                  </Text>
                </View>
                <Text style={styles.growthLabel}>MoM</Text>
              </View>
            </View>

            {/* Outstanding Dues */}
            <View style={[styles.kpiColCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.kpiCardTop}>
                <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.12)' }]}>
                  <FileSpreadsheet size={14} color={t.textSecondary} />
                </View>
                <Text style={styles.kpiLabel}>Outstanding</Text>
              </View>
              <Text style={[styles.kpiVal, { color: t.textPrimary }]} numberOfLines={1}>
                {formatCurrency(metrics.outstanding)}
              </Text>
              <View style={styles.efficiencyRow}>
                <View style={styles.efficiencyLabels}>
                  <Text style={styles.efficiencyText}>Efficiency</Text>
                  <Text style={[styles.efficiencyPct, { color: t.textPrimary }]}>{metrics.collectionRate}%</Text>
                </View>
                <View style={[styles.progressBg, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <View style={[styles.progressFill, { width: `${metrics.collectionRate}%`, backgroundColor: '#10b981' }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Row 2: Overdue Balance & Default Duration */}
          <View style={styles.kpiRow}>
            {/* Overdue Balance */}
            <View style={[styles.kpiColCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.kpiCardTop}>
                <View style={[styles.iconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <AlertTriangle size={14} color="#ef4444" />
                </View>
                <Text style={styles.kpiLabel}>Overdue</Text>
              </View>
              <Text style={[styles.kpiVal, { color: '#ef4444' }]} numberOfLines={1}>
                {formatCurrency(metrics.overdueAmount)}
              </Text>
              <Text style={styles.kpiSubtext} numberOfLines={1}>
                Defaults: <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>{delinquentClients.length} clients</Text>
              </Text>
            </View>

            {/* Default Duration */}
            <View style={[styles.kpiColCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.kpiCardTop}>
                <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.12)' }]}>
                  <Clock size={14} color={t.textSecondary} />
                </View>
                <Text style={styles.kpiLabel}>Default Time</Text>
              </View>
              <Text style={[styles.kpiVal, { color: t.textPrimary }]} numberOfLines={1}>
                {metrics.avgDaysOverdue} <Text style={{ fontSize: 11, fontWeight: 'normal' }}>Days</Text>
              </Text>
              <Text style={styles.kpiSubtext} numberOfLines={1}>Avg duration unpaid</Text>
            </View>
          </View>

          {/* Card 6: Client Retention Hero Card */}
          <View
            style={[
              styles.heroKpiCard,
              {
                backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                borderColor: t.cardBorder,
              }
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.heroHealthHeader}>
                <View style={[styles.iconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Users size={15} color="#3b82f6" />
                </View>
                <Text style={[styles.heroKpiLabel, { color: t.textSecondary }]}>Retention & Velocity</Text>
              </View>
              <Text style={[styles.heroHealthDesc, { color: t.textSecondary }]}>
                Loyalty is running at <Text style={{ color: t.textPrimary, fontWeight: 'bold', fontFamily: 'Outfit-Bold' }}>{metrics.retentionRate}%</Text> with first-installment velocity taking <Text style={{ color: t.accent, fontWeight: 'bold', fontFamily: 'Outfit-Bold' }}>{metrics.avgPaymentVelocity} days</Text>.
              </Text>
            </View>

            {/* Visual speed scale gauge right side */}
            <View style={styles.velocityScale}>
              <Text style={styles.velocityScaleLabel}>Installment speed</Text>
              <View style={[styles.velocityTrack, { backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }]}>
                <View style={[
                  styles.velocityMarker,
                  {
                    left: `${Math.min(Math.max((metrics.avgPaymentVelocity / 30) * 100, 0), 100)}%`,
                    backgroundColor: metrics.avgPaymentVelocity <= 5 ? '#10b981' : metrics.avgPaymentVelocity <= 15 ? '#f59e0b' : '#ef4444'
                  }
                ]} />
              </View>
              <View style={styles.velocityScaleLabels}>
                <Text style={styles.scaleLabelText}>Fast</Text>
                <Text style={styles.scaleLabelText}>30d</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Navigator */}
        <View style={[styles.tabBar, { borderBottomColor: t.cardBorder }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'revenue' && { borderBottomColor: t.accent }]}
            onPress={() => setActiveTab('revenue')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'revenue' ? t.accent : t.textSecondary }]}>Collections</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'forecast' && { borderBottomColor: t.accent }]}
            onPress={() => setActiveTab('forecast')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'forecast' ? t.accent : t.textSecondary }]}>YoY & Forecast</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'behavior' && { borderBottomColor: t.accent }]}
            onPress={() => setActiveTab('behavior')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'behavior' ? t.accent : t.textSecondary }]}>Behavior</Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: Collections & Dues */}
        {activeTab === 'revenue' && (
          <View style={styles.tabContentContainer}>
            {/* Area Chart Card */}
            <View style={[styles.chartCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: t.textPrimary }]}>Monthly Collections Ledger</Text>
                <Text style={styles.chartDesc}>Comparing collected payments against projected dues.</Text>
              </View>

              {monthlyData.length > 0 ? (
                (() => {
                  const chartWidth = Dimensions.get('window').width - 64;
                  const chartHeight = 180;
                  const paddingLeft = 40;
                  const paddingRight = 10;
                  const paddingTop = 15;
                  const paddingBottom = 25;
                  const innerWidth = chartWidth - paddingLeft - paddingRight;
                  const innerHeight = chartHeight - paddingTop - paddingBottom;

                  const maxVal = Math.max(...monthlyData.map((d: any) => Math.max(d.collected, d.projected)), 1000) * 1.1;

                  const points = monthlyData.map((d: any, index: number) => {
                    const x = paddingLeft + (monthlyData.length > 1 ? (index / (monthlyData.length - 1)) * innerWidth : innerWidth / 2);
                    const yCollected = paddingTop + innerHeight - (d.collected / maxVal) * innerHeight;
                    const yProjected = paddingTop + innerHeight - (d.projected / maxVal) * innerHeight;
                    return { x, yCollected, yProjected, month: d.month };
                  });

                  const collectedPath = points.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yCollected}`).join(' ');
                  const collectedAreaPath = `${collectedPath} L ${points[points.length - 1].x} ${paddingTop + innerHeight} L ${points[0].x} ${paddingTop + innerHeight} Z`;
                  const projectedPath = points.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yProjected}`).join(' ');

                  return (
                    <View style={styles.svgWrapper}>
                      <Svg width={chartWidth} height={chartHeight}>
                        <Defs>
                          <LinearGradient id="gradientCollected" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor={t.accent} stopOpacity={0.25} />
                            <Stop offset="100%" stopColor={t.accent} stopOpacity={0.0} />
                          </LinearGradient>
                        </Defs>
                        {/* Horizontal gridlines */}
                        {[0, 1, 2, 3, 4].map(idx => {
                          const y = paddingTop + (idx * innerHeight) / 4;
                          const gridVal = maxVal - (idx * maxVal) / 4;
                          return (
                            <G key={idx}>
                              <Path d={`M ${paddingLeft} ${y} H ${chartWidth - paddingRight}`} stroke={t.border} strokeWidth={1} strokeDasharray="3 3" />
                              <SvgText x={paddingLeft - 8} y={y + 4} fill={t.textSecondary} fontSize={9} textAnchor="end">
                                {formatCurrency(gridVal)}
                              </SvgText>
                            </G>
                          );
                        })}

                        {/* Area Fill */}
                        <Path d={collectedAreaPath} fill="url(#gradientCollected)" />

                        {/* Collected Line */}
                        <Path d={collectedPath} stroke={t.accent} strokeWidth={2.5} fill="transparent" />

                        {/* Projected Line (Dashed) */}
                        <Path d={projectedPath} stroke={isDarkMode ? '#64748b' : '#94a3b8'} strokeWidth={1.8} strokeDasharray="4 4" fill="transparent" />

                        {/* Dots and Labels */}
                        {points.map((p: any, idx: number) => (
                          <G key={idx}>
                            <Circle cx={p.x} cy={p.yCollected} r={4} fill={t.accent} />
                            <SvgText x={p.x} y={paddingTop + innerHeight + 15} fill={t.textSecondary} fontSize={9} textAnchor="middle">
                              {p.month}
                            </SvgText>
                          </G>
                        ))}
                      </Svg>
                    </View>
                  );
                })()
              ) : (
                <View style={styles.emptyChart}>
                  <Text style={[styles.emptyChartText, { color: t.textSecondary }]}>No chart data available for timeframe.</Text>
                </View>
              )}
            </View>

            {/* Concentric Doughnut Card */}
            <View style={[styles.chartCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: t.textPrimary }]}>Payment Status Distribution</Text>
                <Text style={styles.chartDesc}>Total ledger valuation grouped by current paid/pending/default status.</Text>
              </View>

              <View style={styles.donutBody}>
                <View style={styles.donutGraphic}>
                  <Svg width={120} height={120} viewBox="0 0 120 120">
                    {/* Ring 1: Paid (Outer) */}
                    <Circle cx={60} cy={60} r={45} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} strokeWidth={7} fill="transparent" />
                    <Circle
                      cx={60} cy={60} r={45}
                      stroke={t.accent} strokeWidth={7} fill="transparent"
                      strokeDasharray={2 * Math.PI * 45}
                      strokeDashoffset={2 * Math.PI * 45 * (1 - paidPct / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                    />

                    {/* Ring 2: Pending (Middle) */}
                    <Circle cx={60} cy={60} r={33} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} strokeWidth={7} fill="transparent" />
                    <Circle
                      cx={60} cy={60} r={33}
                      stroke={isDarkMode ? '#475569' : '#94a3b8'} strokeWidth={7} fill="transparent"
                      strokeDasharray={2 * Math.PI * 33}
                      strokeDashoffset={2 * Math.PI * 33 * (1 - pendingPct / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                    />

                    {/* Ring 3: Overdue (Inner) */}
                    <Circle cx={60} cy={60} r={21} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} strokeWidth={7} fill="transparent" />
                    <Circle
                      cx={60} cy={60} r={21}
                      stroke="#ef4444" strokeWidth={7} fill="transparent"
                      strokeDasharray={2 * Math.PI * 21}
                      strokeDashoffset={2 * Math.PI * 21 * (1 - overduePct / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                    />
                  </Svg>
                </View>

                {/* Donut Legend */}
                <View style={styles.donutLegend}>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: t.accent }]} />
                    <View style={styles.legendTextWrapper}>
                      <Text style={[styles.legendName, { color: t.textPrimary }]}>Paid ({Math.round(paidPct)}%)</Text>
                      <Text style={[styles.legendVal, { color: t.textSecondary }]}>{formatCurrency(metrics.totalRevenue)}</Text>
                    </View>
                  </View>

                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#475569' : '#94a3b8' }]} />
                    <View style={styles.legendTextWrapper}>
                      <Text style={[styles.legendName, { color: t.textPrimary }]}>Pending ({Math.round(pendingPct)}%)</Text>
                      <Text style={[styles.legendVal, { color: t.textSecondary }]}>{formatCurrency(metrics.outstanding - metrics.overdueAmount)}</Text>
                    </View>
                  </View>

                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                    <View style={styles.legendTextWrapper}>
                      <Text style={[styles.legendName, { color: t.textPrimary }]}>Overdue ({Math.round(overduePct)}%)</Text>
                      <Text style={[styles.legendVal, { color: '#ef4444' }]}>{formatCurrency(metrics.overdueAmount)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: YoY & Forecast */}
        {activeTab === 'forecast' && (
          <View style={styles.tabContentContainer}>
            {/* YoY Chart */}
            <View style={[styles.chartCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: t.textPrimary }]}>Year-over-Year Comparative Analysis</Text>
                <Text style={styles.chartDesc}>Revenue compared against corresponding months of previous year.</Text>
              </View>

              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barChartScroll}>
                {(() => {
                  const maxYoy = Math.max(...yearComparison.map((d: any) => Math.max(d.currentYear, d.previousYear)), 1000) * 1.1;
                  return (
                    <View style={styles.yoyContainer}>
                      {yearComparison.map((m: any, idx: number) => {
                        const prevHeight = maxYoy > 0 ? (m.previousYear / maxYoy) * 100 : 0;
                        const currHeight = maxYoy > 0 ? (m.currentYear / maxYoy) * 100 : 0;

                        return (
                          <View key={idx} style={styles.yoyCol}>
                            <View style={styles.yoyBarsContainer}>
                              <View style={[
                                styles.yoyBar,
                                {
                                  height: `${Math.max(prevHeight, 2)}%`,
                                  backgroundColor: isDarkMode ? '#334155' : '#cbd5e1'
                                }
                              ]} />
                              <View style={[
                                styles.yoyBar,
                                {
                                  height: `${Math.max(currHeight, 2)}%`,
                                  backgroundColor: t.accent
                                }
                              ]} />
                            </View>
                            <Text style={[styles.yoyMonthText, { color: t.textSecondary }]}>{m.month}</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </ScrollView>
            </View>

            {/* Forecast List */}
            <View style={[styles.chartCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: t.textPrimary }]}>Upcoming Revenue Projections</Text>
                <Text style={styles.chartDesc}> receivables scheduled for the next 3 months.</Text>
              </View>

              <View style={styles.forecastBody}>
                <View style={[styles.forecastSummary, { backgroundColor: t.border }]}>
                  <Text style={styles.forecastSummaryLabel}>Total Projected Forecast</Text>
                  <Text style={[styles.forecastSummaryVal, { color: t.textPrimary }]}>
                    {formatCurrency(forecastData.reduce((sum: number, d: any) => sum + d.projected, 0))}
                  </Text>
                  <Text style={[styles.forecastSummaryCount, { color: t.textSecondary }]}>
                    From {forecastData.reduce((sum: number, d: any) => sum + d.count, 0)} pending installments.
                  </Text>
                </View>

                <View style={styles.forecastRows}>
                  {forecastData.map((d: any, index: number) => (
                    <View key={index} style={[styles.forecastRow, { borderBottomColor: t.border }]}>
                      <Text style={[styles.forecastRowMonth, { color: t.textPrimary }]}>{d.month}</Text>
                      <Text style={[styles.forecastRowAmt, { color: t.accent }]}>{formatCurrency(d.projected)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* TAB 3: Behavior */}
        {activeTab === 'behavior' && (
          <View style={styles.tabContentContainer}>
            {/* Weekday Transaction Patterns */}
            <View style={[styles.chartCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: t.textPrimary }]}>Transaction Patterns by Day</Text>
                <Text style={styles.chartDesc}>Total collected volumes grouped by weekday of payment.</Text>
              </View>

              <View style={styles.behaviorChartWrapper}>
                {(() => {
                  const maxDay = Math.max(...dayPatterns.map((d: any) => d.collected), 1000) * 1.1;
                  return (
                    <View style={styles.barChartRow}>
                      {dayPatterns.map((d: any, idx: number) => {
                        const h = maxDay > 0 ? (d.collected / maxDay) * 100 : 0;
                        return (
                          <View key={idx} style={styles.behaviorCol}>
                            <View style={styles.yoyBarsContainer}>
                              <View style={[
                                styles.behaviorBar,
                                {
                                  height: `${Math.max(h, 2)}%`,
                                  backgroundColor: '#f59e0b'
                                }
                              ]} />
                            </View>
                            <Text style={[styles.yoyMonthText, { color: t.textSecondary }]}>{d.day}</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            </View>

            {/* Installment Term sales */}
            <View style={[styles.chartCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: t.textPrimary }]}>Installment Term Distribution</Text>
                <Text style={styles.chartDesc}>Consumer sales volume broken down by installment duration.</Text>
              </View>

              <View style={styles.behaviorChartWrapper}>
                {(() => {
                  const maxTerm = Math.max(...termAnalysis.map((d: any) => d.value), 1000) * 1.1;
                  return (
                    <View style={styles.barChartRow}>
                      {termAnalysis.map((d: any, idx: number) => {
                        const h = maxTerm > 0 ? (d.value / maxTerm) * 100 : 0;
                        return (
                          <View key={idx} style={styles.behaviorCol}>
                            <View style={styles.yoyBarsContainer}>
                              <View style={[
                                styles.behaviorBar,
                                {
                                  height: `${Math.max(h, 2)}%`,
                                  backgroundColor: '#10b981'
                                }
                              ]} />
                            </View>
                            <Text style={[styles.yoyMonthText, { color: t.textSecondary }]}>{d.term}</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            </View>
          </View>
        )}

        {/* Top Revenue Contributors */}
        <Text style={styles.sectionHeader}>Top Revenue Contributors</Text>
        <View style={[styles.leaderboardCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          {clientLeaderboard.length > 0 ? (
            clientLeaderboard.map((client: any, index: number) => (
              <View
                key={client.id}
                style={[
                  styles.leaderboardRow,
                  { borderBottomColor: t.border }
                ]}
              >
                <View style={styles.leaderboardRank}>
                  <Text style={styles.leaderboardRankText}>0{index + 1}</Text>
                </View>
                <View style={styles.leaderboardInfo}>
                  <Text style={[styles.leaderboardName, { color: t.textPrimary }]}>{client.name}</Text>
                  <Text style={styles.leaderboardSub}>{client.orders} orders • {client.email}</Text>
                </View>
                <Text style={[styles.leaderboardVal, { color: t.textPrimary }]}>
                  {formatCurrency(client.paidAmount + client.outstandingAmount)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyListText, { color: t.textSecondary }]}>No spenders recorded.</Text>
          )}
        </View>

        {/* Delinquency Risk Assessment */}
        <Text style={styles.sectionHeader}>Delinquency Risk Assessment</Text>
        <View style={[styles.leaderboardCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          {delinquentClients.length > 0 ? (
            delinquentClients.map((client: any) => {
              const isReminding = !!remindingMap[client.id];
              return (
                <View
                  key={client.id}
                  style={[
                    styles.riskCard,
                    { borderColor: t.border }
                  ]}
                >
                  <View style={styles.riskHeader}>
                    <View style={styles.riskClientCol}>
                      <Text style={[styles.riskName, { color: t.textPrimary }]}>{client.name}</Text>
                      <Text style={styles.riskEmail}>{client.email}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.riskAlertBtn, { backgroundColor: t.accentLight, borderColor: t.accent }]}
                      onPress={() => handleSendSingleReminder(client.id)}
                      disabled={isReminding}
                    >
                      <Mail size={12} color={t.accent} />
                      <Text style={[styles.riskAlertText, { color: t.accent }]}>
                        {isReminding ? 'Queueing...' : 'Alert'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: t.border }]} />

                  <View style={styles.riskMetricsRow}>
                    <View>
                      <Text style={styles.riskLabel}>Overdue Bills</Text>
                      <Text style={styles.riskVal}>{client.overdueCount}</Text>
                    </View>
                    <View>
                      <Text style={styles.riskLabel}>Overdue Amount</Text>
                      <Text style={styles.riskVal}>{formatCurrency(client.overdueAmount)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.riskLabel}>Longest Default</Text>
                      <Text style={[styles.riskVal, { color: t.textPrimary }]}>{client.longestOverdue} days</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.riskEmpty}>
              <ShieldCheck size={28} color="#10b981" />
              <Text style={[styles.riskEmptyTitle, { color: t.textPrimary }]}>Zero High Risk Accounts</Text>
              <Text style={styles.riskEmptyDesc}>All client accounts have less than 2 overdue installments.</Text>
            </View>
          )}
        </View>

        {/* Top Selling Items */}
        <Text style={styles.sectionHeader}>Top Selling Items</Text>
        <View style={[styles.leaderboardCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, marginBottom: 30 }]}>
          {itemLeaderboard.length > 0 ? (
            itemLeaderboard.map((item: any, index: number) => (
              <View
                key={item.itemName}
                style={[
                  styles.leaderboardRow,
                  { borderBottomColor: t.border }
                ]}
              >
                <View style={styles.leaderboardRank}>
                  <Text style={styles.leaderboardRankText}>#{index + 1}</Text>
                </View>
                <View style={styles.leaderboardInfo}>
                  <Text style={[styles.leaderboardName, { color: t.textPrimary }]}>{item.itemName}</Text>
                  <Text style={styles.leaderboardSub}>{item.orderCount} orders scheduled</Text>
                </View>
                <Text style={[styles.leaderboardVal, { color: t.textPrimary }]}>
                  {formatCurrency(item.totalValue)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyListText, { color: t.textSecondary }]}>No items sold.</Text>
          )}
        </View>
      </ScrollView>

      {/* --- TIME TIME-FRAME PICKER MODAL --- */}
      <Modal
        visible={isFilterModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: t.textPrimary }]}>Timeframe Analysis Filters</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* All historical Toggle */}
            <TouchableOpacity
              style={styles.allTimeToggleRow}
              activeOpacity={0.8}
              onPress={() => setTempAllTime(!tempAllTime)}
            >
              <Text style={[styles.allTimeToggleText, { color: t.textPrimary }]}>All Historical Data</Text>
              <View style={[
                styles.checkbox,
                { borderColor: t.accent, backgroundColor: tempAllTime ? t.accent : 'transparent' }
              ]}>
                {tempAllTime && <Check size={12} color="#ffffff" />}
              </View>
            </TouchableOpacity>

            {!tempAllTime && (
              <ScrollView style={styles.filtersScroll} showsVerticalScrollIndicator={false}>
                {/* START PERIOD */}
                <Text style={styles.filterGroupHeader}>START BILLING MONTH</Text>
                <View style={styles.periodSelectors}>
                  <View style={styles.pickerDropdown}>
                    <Text style={styles.pickerDropdownLabel}>Year</Text>
                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                      {availableYears.map(y => (
                        <TouchableOpacity
                          key={y}
                          style={[styles.badgeBtn, tempStartYear === y && { backgroundColor: t.accent, borderColor: t.accent }]}
                          onPress={() => setTempStartYear(y)}
                        >
                          <Text style={[styles.badgeBtnText, { color: tempStartYear === y ? '#ffffff' : t.textSecondary }]}>
                            {y}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.pickerDropdown}>
                    <Text style={styles.pickerDropdownLabel}>Month</Text>
                    <View style={styles.monthsGrid}>
                      {monthNames.map((m, idx) => (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.monthGridBadge,
                            { borderColor: t.border },
                            tempStartMonth === (idx + 1) && { backgroundColor: t.accent, borderColor: t.accent }
                          ]}
                          onPress={() => setTempStartMonth(idx + 1)}
                        >
                          <Text style={[styles.monthGridText, { color: tempStartMonth === (idx + 1) ? '#ffffff' : t.textSecondary }]}>
                            {m.substring(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* END PERIOD */}
                <Text style={[styles.filterGroupHeader, { marginTop: 15 }]}>END BILLING MONTH</Text>
                <View style={styles.periodSelectors}>
                  <View style={styles.pickerDropdown}>
                    <Text style={styles.pickerDropdownLabel}>Year</Text>
                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                      {availableYears.map(y => (
                        <TouchableOpacity
                          key={y}
                          style={[styles.badgeBtn, tempEndYear === y && { backgroundColor: t.accent, borderColor: t.accent }]}
                          onPress={() => setTempEndYear(y)}
                        >
                          <Text style={[styles.badgeBtnText, { color: tempEndYear === y ? '#ffffff' : t.textSecondary }]}>
                            {y}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.pickerDropdown}>
                    <Text style={styles.pickerDropdownLabel}>Month</Text>
                    <View style={styles.monthsGrid}>
                      {monthNames.map((m, idx) => (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.monthGridBadge,
                            { borderColor: t.border },
                            tempEndMonth === (idx + 1) && { backgroundColor: t.accent, borderColor: t.accent }
                          ]}
                          onPress={() => setTempEndMonth(idx + 1)}
                        >
                          <Text style={[styles.monthGridText, { color: tempEndMonth === (idx + 1) ? '#ffffff' : t.textSecondary }]}>
                            {m.substring(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity style={[styles.applyFilterBtn, { backgroundColor: t.accent }]} onPress={handleApplyFilters}>
              <Text style={styles.applyFilterBtnText}>Apply Analytical timeframe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- DIALOG: BULK REMINDERS --- */}
      <Modal
        visible={isBulkModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!isSendingBulk) {
            setIsBulkModalOpen(false);
            setModalStep('select');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayDismiss}
            activeOpacity={1}
            onPress={() => {
              if (!isSendingBulk) {
                setIsBulkModalOpen(false);
                setModalStep('select');
              }
            }}
          />

          <SwipeDismissModal
            onDismiss={() => {
              if (!isSendingBulk) {
                setIsBulkModalOpen(false);
                setModalStep('select');
              }
            }}
            disabled={isSendingBulk}
          >
            <View style={[
              styles.modalContent,
              { backgroundColor: t.cardBg, borderColor: t.cardBorder, height: modalStep === 'preview' ? '92%' : 'auto' }
            ]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: modalStep === 'preview' ? '#0f172a' : t.accent }]}>
              <View style={styles.modalHeaderLeft}>
                <Mail size={18} color="#ffffff" />
                <View>
                  <Text style={styles.modalHeaderTitle}>
                    {modalStep === 'preview' ? 'Reminders Preview Queue' : 'Bulk Reminders'}
                  </Text>
                  <Text style={styles.modalHeaderDesc}>
                    {modalStep === 'preview' ? 'Review compiled email queue' : 'Select dispatch targets'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  if (!isSendingBulk) {
                    setIsBulkModalOpen(false);
                    setModalStep('select');
                  }
                }}
                disabled={isSendingBulk}
              >
                <X size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {modalStep === 'select' && (
              <ScrollView style={styles.bulkModalForm} contentContainerStyle={{ padding: 20, gap: 16 }}>
                <Text style={styles.bulkOptionHeader}>Select Scope</Text>

                <View style={styles.bulkOptionsGrid}>
                  {/* Option 1: All Clients */}
                  <TouchableOpacity
                    style={[
                      styles.bulkOptionCard,
                      { backgroundColor: t.border, borderColor: t.cardBorder },
                      bulkType === 'all' && { borderColor: t.accent, borderWidth: 1.5 }
                    ]}
                    onPress={() => setBulkType('all')}
                  >
                    <Users size={16} color={bulkType === 'all' ? t.accent : t.textSecondary} />
                    <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>All Clients</Text>
                    <Text style={styles.bulkOptionDescText}>Targets all active pending ledger accounts.</Text>
                  </TouchableOpacity>

                  {/* Option 2: Specific Month */}
                  <TouchableOpacity
                    style={[
                      styles.bulkOptionCard,
                      { backgroundColor: t.border, borderColor: t.cardBorder },
                      bulkType === 'month' && { borderColor: t.accent, borderWidth: 1.5 }
                    ]}
                    onPress={() => setBulkType('month')}
                  >
                    <Calendar size={16} color={bulkType === 'month' ? t.accent : t.textSecondary} />
                    <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Specific Month</Text>
                    <Text style={styles.bulkOptionDescText}>Targets clients due in selected billing month.</Text>
                  </TouchableOpacity>

                  {/* Option 3: Selected Clients */}
                  <TouchableOpacity
                    style={[
                      styles.bulkOptionCard,
                      { backgroundColor: t.border, borderColor: t.cardBorder },
                      bulkType === 'selected' && { borderColor: t.accent, borderWidth: 1.5 }
                    ]}
                    onPress={() => setBulkType('selected')}
                  >
                    <UserCheck size={16} color={bulkType === 'selected' ? t.accent : t.textSecondary} />
                    <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Selected Clients</Text>
                    <Text style={styles.bulkOptionDescText}>Allows manually choosing recipients list.</Text>
                  </TouchableOpacity>

                  {/* Option 4: Overdue Only */}
                  <TouchableOpacity
                    style={[
                      styles.bulkOptionCard,
                      { backgroundColor: t.border, borderColor: t.cardBorder },
                      bulkType === 'overdue' && { borderColor: t.accent, borderWidth: 1.5 }
                    ]}
                    onPress={() => setBulkType('overdue')}
                  >
                    <AlertTriangle size={16} color={bulkType === 'overdue' ? t.accent : t.textSecondary} />
                    <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Overdue Only</Text>
                    <Text style={styles.bulkOptionDescText}>Targets the {delinquentClients.length} high delinquency risk profiles.</Text>
                  </TouchableOpacity>
                </View>

                {/* Sub Options conditional parameters */}
                {bulkType === 'month' && (
                  <View style={[styles.subFieldsCard, { backgroundColor: t.border }]}>
                    <Text style={styles.subFieldsHeader}>Target Billing period</Text>
                    <View style={styles.subFieldsRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.subFieldLabel}>Month</Text>
                        <View style={styles.inlinePickerDummy}>
                          <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                            {monthNames.map((m, idx) => (
                              <TouchableOpacity
                                key={m}
                                style={[styles.badgeBtn, selectedBulkMonth === String(idx + 1) && { backgroundColor: t.accent, borderColor: t.accent }]}
                                onPress={() => setSelectedBulkMonth(String(idx + 1))}
                              >
                                <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === String(idx + 1) ? '#ffffff' : t.textSecondary }]}>
                                  {m.substring(0, 3)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </View>
                    </View>

                    <View style={{ gap: 4, marginTop: 10 }}>
                      <Text style={styles.subFieldLabel}>Year</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        {availableYears.map(y => (
                          <TouchableOpacity
                            key={y}
                            style={[styles.badgeBtn, selectedBulkYear === String(y) && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkYear(String(y))}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkYear === String(y) ? '#ffffff' : t.textSecondary }]}>
                              {y}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                {bulkType === 'selected' && (
                  <View style={[styles.subFieldsCard, { backgroundColor: t.border }]}>
                    <Text style={styles.subFieldsHeader}>Target Recipients</Text>
                    <TouchableOpacity
                      style={[styles.clientSelectTrigger, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                      onPress={() => setIsClientModalOpen(true)}
                    >
                      <Users size={14} color={t.accent} />
                      <Text style={[styles.clientSelectTriggerText, { color: t.textPrimary }]}>
                        {selectedClientIds.length > 0 ? `${selectedClientIds.length} Recipients Selected` : 'Select Client Recipients...'}
                      </Text>
                      <ChevronRight size={14} color={t.textSecondary} />
                    </TouchableOpacity>

                    {/* Optional period filters */}
                    <Text style={[styles.subFieldsHeader, { marginTop: 12 }]}>Billing month constraint (optional)</Text>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.subFieldLabel}>Month</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        <TouchableOpacity
                          style={[styles.badgeBtn, selectedBulkMonth === '' && { backgroundColor: t.accent, borderColor: t.accent }]}
                          onPress={() => setSelectedBulkMonth('')}
                        >
                          <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === '' ? '#ffffff' : t.textSecondary }]}>
                            All Months
                          </Text>
                        </TouchableOpacity>
                        {monthNames.map((m, idx) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.badgeBtn, selectedBulkMonth === String(idx + 1) && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkMonth(String(idx + 1))}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === String(idx + 1) ? '#ffffff' : t.textSecondary }]}>
                              {m.substring(0, 3)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={{ gap: 4, marginTop: 10 }}>
                      <Text style={styles.subFieldLabel}>Year</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        {availableYears.map(y => (
                          <TouchableOpacity
                            key={y}
                            style={[styles.badgeBtn, selectedBulkYear === String(y) && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkYear(String(y))}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkYear === String(y) ? '#ffffff' : t.textSecondary }]}>
                              {y}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                <View style={[styles.bulkModalNotice, { backgroundColor: t.border }]}>
                  <Info size={14} color={t.accent} />
                  <Text style={[styles.bulkModalNoticeText, { color: t.textSecondary }]}>
                    Emails will be delivered in the background via S-Pay Relay Server SMTP configurations.
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.bulkModalFooter}>
                  <TouchableOpacity
                    style={[styles.previewModeBtn, { borderColor: isDarkMode ? '#4c1d95' : '#8b5cf6' }]}
                    onPress={handlePreviewBulkReminders}
                    disabled={isSendingBulk}
                  >
                    <Text style={[styles.previewModeBtnText, { color: isDarkMode ? '#a78bfa' : '#7c3aed' }]}>Preview Queue</Text>
                  </TouchableOpacity>

                  <View style={styles.bulkActionsRight}>
                    <TouchableOpacity
                      style={[styles.bulkCancelBtn, { borderColor: t.border }]}
                      onPress={() => setIsBulkModalOpen(false)}
                      disabled={isSendingBulk}
                    >
                      <Text style={[styles.bulkCancelBtnText, { color: t.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.bulkSendBtn, { backgroundColor: t.accent }]}
                      onPress={handleSendBulkReminders}
                      disabled={isSendingBulk}
                    >
                      <Text style={styles.bulkSendBtnText}>Dispatch</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {modalStep === 'preview' && (
              <View style={styles.previewStepBody}>
                {isPreviewLoading ? (
                  <View style={styles.previewStepLoading}>
                    <Activity size={32} color={t.accent} />
                    <Text style={[styles.previewStepLoadingText, { color: t.textPrimary }]}>Compiling Queue templates...</Text>
                  </View>
                ) : !previewData?.clients || previewData.clients.length === 0 ? (
                  <View style={styles.previewStepEmpty}>
                    <Info size={32} color={t.textSecondary} />
                    <Text style={[styles.previewStepEmptyText, { color: t.textPrimary }]}>No reminders matched queue constraints.</Text>
                    <TouchableOpacity
                      style={[styles.bulkCancelBtn, { borderColor: t.border, marginTop: 10 }]}
                      onPress={() => setModalStep('select')}
                    >
                      <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>Back</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.previewMainContent}>
                    {/* Left tabs: Client Names scroll */}
                    <View style={[styles.previewLeftCol, { borderRightColor: t.border }]}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {previewData.clients.map((client: any, idx: number) => {
                          const isActive = activePreviewTab === idx;
                          return (
                            <TouchableOpacity
                              key={client.user_id}
                              style={[
                                styles.previewTabBtn,
                                { backgroundColor: t.border, borderColor: t.border },
                                isActive && { borderColor: t.accent, borderWidth: 1.5 }
                              ]}
                              onPress={() => setActivePreviewTab(idx)}
                            >
                              <Text style={[styles.previewTabBtnName, { color: t.textPrimary }]} numberOfLines={1}>
                                {client.name}
                              </Text>
                              <Text style={styles.previewTabBtnSub} numberOfLines={1}>
                                {client.email}
                              </Text>
                              <Text style={styles.previewTabBtnCount}>
                                {client.payment_count} bills
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Right column: Subject, template rendering & breakdown */}
                    <View style={styles.previewRightCol}>
                      {(() => {
                        const client = previewData.clients[activePreviewTab];
                        if (!client) return null;

                        return (
                          <ScrollView contentContainerStyle={styles.previewRightScrollContent} showsVerticalScrollIndicator={false}>
                            <View style={[styles.previewClientCard, { backgroundColor: t.border }]}>
                              <View>
                                <Text style={[styles.previewClientName, { color: t.textPrimary }]}>{client.name}</Text>
                                <Text style={styles.previewClientEmail}>{client.email}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.previewClientLabel}>Total Owed</Text>
                                <Text style={[styles.previewClientAmt, { color: t.accent }]}>{formatCurrency(client.total_due)}</Text>
                              </View>
                            </View>

                            {/* Subject card */}
                            <View style={[styles.subjectCard, { backgroundColor: t.border }]}>
                              <Text style={[styles.subjectText, { color: t.textPrimary }]} numberOfLines={2}>
                                <Text style={{ fontWeight: 'bold' }}>Subject: </Text>
                                {client.subject}
                              </Text>
                            </View>

                            {/* Native Webview wrapper for exact email template parity */}
                            <Text style={styles.subFieldsHeader}>E-Mail Body HTML Render</Text>
                            <View style={[styles.webviewContainer, { borderColor: t.border }]}>
                              <WebView
                                originWhitelist={['*']}
                                source={{ html: client.email_content }}
                                style={styles.webview}
                                scrollEnabled={true}
                              />
                            </View>

                            {/* Bills Breakdown List */}
                            <Text style={styles.subFieldsHeader}>Installments Invoiced</Text>
                            <View style={styles.invoiceBreakdownList}>
                              {client.payments?.map((p: any, pIdx: number) => (
                                <View key={pIdx} style={[styles.invoiceItemRow, { backgroundColor: t.border }]}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.invoiceItemName, { color: t.textPrimary }]} numberOfLines={1}>
                                      {p.item_name}
                                    </Text>
                                    <Text style={styles.invoiceItemSub}>
                                      Due: {new Date(p.due_date).toLocaleDateString()} • Month {p.month_number}/{p.installment_months}
                                    </Text>
                                  </View>
                                  <Text style={[styles.invoiceItemVal, { color: t.textPrimary }]}>
                                    {formatCurrency(p.amount_due)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        );
                      })()}
                    </View>
                  </View>
                )}

                {/* Footer dispatch summary controls */}
                {previewData?.clients && previewData.clients.length > 0 && (
                  <View style={[styles.previewFooterRow, { borderTopColor: t.border }]}>
                    <Text style={[styles.previewFooterSummary, { color: t.textSecondary }]}>
                      Scope: <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>{previewData.total_clients} Clients</Text> • Total: <Text style={{ color: t.accent, fontWeight: 'bold' }}>{formatCurrency(previewData.total_amount)}</Text>
                    </Text>

                    <View style={styles.bulkActionsRight}>
                      <TouchableOpacity
                        style={[styles.bulkCancelBtn, { borderColor: t.border }]}
                        onPress={() => setModalStep('select')}
                        disabled={isSendingBulk}
                      >
                        <Text style={[styles.bulkCancelBtnText, { color: t.textSecondary }]}>Options</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.bulkSendBtn, { backgroundColor: t.accent }]}
                        onPress={handleSendBulkReminders}
                        disabled={isSendingBulk}
                      >
                        <Text style={styles.bulkSendBtnText}>
                          {isSendingBulk ? 'Dispatching...' : 'Send All'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
            </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* --- CLIENTS CHECKLIST SUB-MODAL --- */}
      <Modal
        visible={isClientModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsClientModalOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.clientModalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.pickerModalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Users size={16} color={t.accent} />
                <Text style={[styles.pickerModalTitle, { color: t.textPrimary }]}>Recipients Select</Text>
              </View>
              <TouchableOpacity onPress={() => setIsClientModalOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchBox, { borderColor: t.border, backgroundColor: t.border }]}>
              <Search size={14} color={t.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: t.textPrimary }]}
                placeholder="Search clients name/email..."
                placeholderTextColor={t.textSecondary}
                value={clientSearch}
                onChangeText={setClientSearch}
                autoCorrect={false}
              />
            </View>

            <View style={styles.selectionActions}>
              <Text style={[styles.selectionCount, { color: t.textSecondary }]}>
                {filteredClientsForSelection.length} client(s) found
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.quickSelectBtn} onPress={handleSelectAllClients}>
                  <Text style={[styles.quickSelectBtnText, { color: t.accent }]}>Toggle Filtered</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickSelectBtn} onPress={() => setSelectedClientIds([])}>
                  <Text style={[styles.quickSelectBtnText, { color: t.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scroll checklist */}
            <ScrollView style={styles.clientModalScroll}>
              {filteredClientsForSelection.length > 0 ? (
                filteredClientsForSelection.map((c: any) => {
                  const isSelected = selectedClientIds.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.clientCheckRow,
                        { borderBottomColor: t.border },
                        isSelected && { backgroundColor: t.accentLight }
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleToggleSelectClient(c.id)}
                    >
                      <View style={styles.clientCheckDetails}>
                        <Text style={[styles.clientCheckName, { color: t.textPrimary }]}>{c.name}</Text>
                        <Text style={styles.clientCheckEmail}>{c.email}</Text>
                      </View>
                      <View style={[
                        styles.checkbox,
                        { borderColor: t.accent, backgroundColor: isSelected ? t.accent : 'transparent' }
                      ]}>
                        {isSelected && <Check size={12} color="#ffffff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={[styles.emptyListText, { color: t.textSecondary }]}>No matching clients found.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.applyFilterBtn, { backgroundColor: t.accent, marginTop: 15 }]}
              onPress={() => setIsClientModalOpen(false)}
            >
              <Text style={styles.applyFilterBtnText}>Confirm Selection ({selectedClientIds.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    fontFamily: 'Outfit-Bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.3,
    fontFamily: 'Outfit-Bold',
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
    fontFamily: 'Outfit-Bold',
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
  filterTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterTriggerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 6,
  },
  filterTriggerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bulkBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  kpiContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  heroKpiCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroHealthLeft: {
    flex: 1,
    gap: 6,
  },
  heroHealthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroKpiLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Outfit-Bold',
  },
  heroHealthDesc: {
    fontSize: 10.5,
    lineHeight: 14.5,
    fontFamily: 'Outfit-Regular',
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  kpiColCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  kpiCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kpiLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Outfit-Medium',
  },
  kpiVal: {
    fontSize: 17,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  kpiSubtext: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  velocityScale: {
    width: 90,
    gap: 3,
    alignItems: 'center',
  },
  velocityScaleLabel: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  velocityTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    position: 'relative',
    marginTop: 4,
  },
  velocityMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: -2,
    marginLeft: -4,
  },
  velocityScaleLabels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  scaleLabelText: {
    fontSize: 7,
    color: '#94a3b8',
    fontFamily: 'Outfit-Medium',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
  },
  growthBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  growthText: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  growthLabel: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  efficiencyRow: {
    gap: 4,
    marginTop: 4,
  },
  efficiencyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  efficiencyText: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  efficiencyPct: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  healthInfo: {
    flex: 1,
    gap: 4,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthDesc: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Outfit-Regular',
  },
  healthStatusLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  radialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    marginTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  tabContentContainer: {
    gap: 16,
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
  },
  chartHeader: {
    gap: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  chartDesc: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyChart: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 11,
    fontFamily: 'Outfit-Regular',
  },
  donutBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  donutGraphic: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutLegend: {
    flex: 1,
    paddingLeft: 16,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendTextWrapper: {
    flex: 1,
  },
  legendName: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Outfit-Bold',
  },
  legendVal: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  barChartScroll: {
    paddingVertical: 10,
  },
  yoyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    paddingLeft: 10,
  },
  yoyCol: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  yoyBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    height: 110,
    width: '100%',
  },
  yoyBar: {
    width: 6,
    borderRadius: 3,
  },
  yoyMonthText: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  forecastBody: {
    flexDirection: 'column',
    gap: 12,
  },
  forecastSummary: {
    padding: 12,
    borderRadius: 12,
    gap: 2,
  },
  forecastSummaryLabel: {
    fontSize: 9,
    color: '#ee4d2d',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
  },
  forecastSummaryVal: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  forecastSummaryCount: {
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
  },
  forecastRows: {
    gap: 8,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  forecastRowMonth: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  forecastRowAmt: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  behaviorChartWrapper: {
    height: 150,
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  barChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
  },
  behaviorCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  behaviorBar: {
    width: 10,
    borderRadius: 5,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 14,
    fontFamily: 'Outfit-Bold',
  },
  leaderboardCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  leaderboardRank: {
    width: 24,
  },
  leaderboardRankText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  leaderboardSub: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  leaderboardVal: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  emptyListText: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 12,
    fontFamily: 'Outfit-Regular',
  },
  riskCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskClientCol: {
    flex: 1,
  },
  riskName: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  riskEmail: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  riskAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  riskAlertText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  cardDivider: {
    height: 1,
  },
  riskMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  riskLabel: {
    fontSize: 8,
    color: '#64748b',
    fontFamily: 'Outfit-Medium',
    textTransform: 'uppercase',
  },
  riskVal: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    color: '#ef4444',
  },
  riskEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  riskEmptyTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  riskEmptyDesc: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    fontFamily: 'Outfit-Regular',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModalContent: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
    maxHeight: '80%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerModalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  allTimeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  allTimeToggleText: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersScroll: {
    maxHeight: 350,
  },
  filterGroupHeader: {
    fontSize: 9,
    color: '#ee4d2d',
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 8,
    fontFamily: 'Outfit-Bold',
  },
  periodSelectors: {
    gap: 10,
  },
  pickerDropdown: {
    gap: 4,
  },
  pickerDropdownLabel: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Outfit-Medium',
  },
  badgeRow: {
    gap: 6,
    paddingVertical: 4,
  },
  badgeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badgeBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthGridBadge: {
    width: '23%',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  monthGridText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  applyFilterBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFilterBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalOverlayDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
  modalHeaderDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontFamily: 'Outfit-Regular',
  },
  bulkModalForm: {
    flex: 1,
  },
  bulkOptionHeader: {
    fontSize: 9,
    color: '#ee4d2d',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 1,
  },
  bulkOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  bulkOptionCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  bulkOptionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  bulkOptionDescText: {
    fontSize: 9,
    color: '#64748b',
    lineHeight: 12,
    fontFamily: 'Outfit-Regular',
  },
  subFieldsCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  subFieldsHeader: {
    fontSize: 10,
    color: '#ee4d2d',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
  subFieldsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subFieldLabel: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Outfit-Medium',
  },
  inlinePickerDummy: {
    paddingVertical: 2,
  },
  clientSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  clientSelectTriggerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
  },
  bulkModalNotice: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  bulkModalNoticeText: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
    lineHeight: 13,
  },
  bulkModalFooter: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  previewModeBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  bulkActionsRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  bulkCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  bulkSendBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkSendBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientModalContent: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    gap: 12,
    maxHeight: '75%',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    padding: 0,
  },
  selectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 9,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
  },
  quickSelectBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  quickSelectBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientModalScroll: {
    maxHeight: 280,
  },
  clientCheckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  clientCheckDetails: {
    flex: 1,
    gap: 2,
  },
  clientCheckName: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientCheckEmail: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  previewStepBody: {
    flex: 1,
    flexDirection: 'column',
  },
  previewStepLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 50,
  },
  previewStepLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  previewStepEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 50,
  },
  previewStepEmptyText: {
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
  },
  previewMainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  previewLeftCol: {
    width: '35%',
    borderRightWidth: 1,
    padding: 10,
  },
  previewTabBtn: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 2,
  },
  previewTabBtnName: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewTabBtnSub: {
    fontSize: 8,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  previewTabBtnCount: {
    fontSize: 9,
    color: '#ee4d2d',
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
  },
  previewRightCol: {
    width: '65%',
    flex: 1,
  },
  previewRightScrollContent: {
    padding: 12,
    gap: 10,
  },
  previewClientCard: {
    padding: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewClientName: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewClientEmail: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  previewClientLabel: {
    fontSize: 8,
    color: '#64748b',
    fontFamily: 'Outfit-Medium',
    textTransform: 'uppercase',
  },
  previewClientAmt: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  subjectCard: {
    padding: 10,
    borderRadius: 10,
  },
  subjectText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Outfit-Regular',
  },
  webviewContainer: {
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  invoiceBreakdownList: {
    gap: 6,
  },
  invoiceItemRow: {
    padding: 8,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceItemName: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  invoiceItemSub: {
    fontSize: 8,
    color: '#64748b',
    fontFamily: 'Outfit-Regular',
  },
  invoiceItemVal: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  previewFooterSummary: {
    fontSize: 10,
    fontFamily: 'Outfit-Medium',
  },
});
