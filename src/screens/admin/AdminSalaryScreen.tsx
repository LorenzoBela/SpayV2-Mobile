import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  ChevronLeft,
  Banknote,
  Calendar,
  Clock,
  Briefcase,
  Award,
  FileText,
  CheckCircle2,
  PlusCircle,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  X,
  Building2,
  Sparkles,
  Calculator,
  Receipt,
  Check,
  DollarSign,
  HelpCircle,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { PremiumAlert } from '../../services/PremiumAlertService';
import {
  getSalaryData,
  updateSalarySettings,
  confirmPaycheck,
  addJobHistory,
  SalaryDataPayload,
  SalaryPaycheckRecord,
  JobHistoryRecord,
} from '../../services/salaryService';

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function AdminSalaryScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salaryData, setSalaryData] = useState<SalaryDataPayload | null>(null);

  // Modals state
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedPendingCheck, setSelectedPendingCheck] = useState<SalaryPaycheckRecord | null>(null);
  const [deductionsInput, setDeductionsInput] = useState('');
  const [deductionsReasonInput, setDeductionsReasonInput] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [jobTitleInput, setJobTitleInput] = useState('');
  const [employerInput, setEmployerInput] = useState('');
  const [baseSalaryInput, setBaseSalaryInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [promotionNoteInput, setPromotionNoteInput] = useState('');
  const [submittingJob, setSubmittingJob] = useState(false);

  const [payslipModalVisible, setPayslipModalVisible] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<SalaryPaycheckRecord | null>(null);

  // Countdown State
  const [countdown, setCountdown] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Reanimated flip values
  const flipScale = useSharedValue(1);

  const loadData = useCallback(async () => {
    try {
      const data = await getSalaryData();
      setSalaryData(data);
    } catch (err: any) {
      console.error('[AdminSalaryScreen] Failed to load salary data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Payday Countdown Timer Effect
  useEffect(() => {
    if (!salaryData?.nextPaydayIso) return;

    const targetTime = new Date(salaryData.nextPaydayIso).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, targetTime - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(prev => {
        if (prev.seconds !== seconds) {
          // Trigger flip animation pulse
          flipScale.value = withSequence(
            withTiming(1.04, { duration: 150, easing: Easing.out(Easing.quad) }),
            withTiming(1.0, { duration: 150, easing: Easing.in(Easing.quad) })
          );
        }
        return { days, hours, minutes, seconds };
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [salaryData?.nextPaydayIso]);

  const animatedHeroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flipScale.value }],
  }));

  // Confirm Paycheck handler
  const handleOpenConfirmModal = (check: SalaryPaycheckRecord) => {
    setSelectedPendingCheck(check);
    setDeductionsInput('');
    setDeductionsReasonInput('');
    setConfirmModalVisible(true);
  };

  const handleConfirmPaycheckSubmit = async () => {
    if (!selectedPendingCheck) return;
    setSubmittingConfirm(true);
    try {
      const deductionsNum = parseFloat(deductionsInput) || 0;
      const actualReceived = Math.max(0, selectedPendingCheck.expectedNet - deductionsNum);

      const updated = await confirmPaycheck(
        selectedPendingCheck.id,
        actualReceived,
        deductionsNum,
        deductionsReasonInput
      );
      setSalaryData(updated);
      setConfirmModalVisible(false);
      PremiumAlert.alert('Paycheck Confirmed', 'The paycheck has been recorded in your confirmed earnings ledger.');
    } catch (err: any) {
      PremiumAlert.alert('Error', err.message || 'Failed to confirm paycheck');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  // Log Job Position handler
  const handleOpenJobModal = () => {
    if (salaryData) {
      setJobTitleInput(salaryData.jobTitle || '');
      setEmployerInput(salaryData.employer || '');
      setBaseSalaryInput(salaryData.baseSalary ? salaryData.baseSalary.toString() : '');
      setStartDateInput(salaryData.employmentStartDate || '');
      setPromotionNoteInput('');
    }
    setJobModalVisible(true);
  };

  const handleSaveJobSubmit = async () => {
    if (!jobTitleInput.trim() || !baseSalaryInput.trim() || !startDateInput.trim()) {
      PremiumAlert.alert('Validation Error', 'Please enter Job Title, Base Monthly Salary, and Employment Start Date.');
      return;
    }
    setSubmittingJob(true);
    try {
      const baseSalaryNum = parseFloat(baseSalaryInput) || 0;
      const updated = await addJobHistory({
        jobTitle: jobTitleInput.trim(),
        employer: employerInput.trim() || 'S-Pay Operations',
        baseSalary: baseSalaryNum,
        startDate: startDateInput.trim(),
        promotionNote: promotionNoteInput.trim() || undefined
      });
      setSalaryData(updated);
      setJobModalVisible(false);
      PremiumAlert.alert('Role Logged', 'Position and salary raise record logged successfully.');
    } catch (err: any) {
      PremiumAlert.alert('Error', err.message || 'Failed to save job position');
    } finally {
      setSubmittingJob(false);
    }
  };

  const handleOpenPayslip = (check: SalaryPaycheckRecord) => {
    setSelectedPayslip(check);
    setPayslipModalVisible(true);
  };

  const formatCurrency = (val: number) => {
    return `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const theme = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    accent: '#ee4d2d',
    accentLight: 'rgba(238, 77, 45, 0.08)',
    emerald: '#10b981',
    emeraldLight: 'rgba(16, 185, 129, 0.1)',
    blue: '#3b82f6',
    blueLight: 'rgba(59, 130, 246, 0.1)',
    amber: '#f59e0b',
    amberLight: 'rgba(245, 158, 11, 0.1)',
    purple: '#8b5cf6',
    purpleLight: 'rgba(139, 92, 246, 0.1)',
    modalOverlay: 'rgba(0, 0, 0, 0.65)',
  };

  if (loading) {
    return <PremiumLoader title="Calculating Salary & Cashflow..." subtitle="Preparing payday countdown and tax analytics..." />;
  }

  const tax = salaryData?.taxBreakdown;
  const bonus = salaryData?.bonus13thBreakdown;
  const cutoff = salaryData?.cutoffSchedule;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.headerBg} />

      {/* Navigation Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtitle}>COMPENSATION & CASHFLOW</Text>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Salary Payday Hub</Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshIconBtn, { backgroundColor: theme.accentLight }]}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 3D FLIP PAYDAY COUNTDOWN HERO */}
        <Animated.View
          style={[
            styles.heroCard,
            { backgroundColor: isDarkMode ? '#1a2234' : '#1e293b', borderColor: isDarkMode ? '#2e3d5a' : '#334155' },
            animatedHeroStyle,
          ]}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroBadge}>
              <Sparkles size={12} color="#fbbf24" />
              <Text style={styles.heroBadgeText}>SEMI-MONTHLY TARGET (10TH & 25TH)</Text>
            </View>
            <Text style={styles.heroTargetLabel}>
              {salaryData?.nextPaydayIso
                ? new Date(salaryData.nextPaydayIso).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Next Payday'}
            </Text>
          </View>

          <Text style={styles.heroMainTitle}>Next Payday Countdown</Text>
          <Text style={styles.heroRoleSub}>
            {salaryData?.jobTitle || 'Position Unspecified'} • {salaryData?.employer || 'S-Pay Operations'}
          </Text>

          {/* Flip Digit Containers */}
          <View style={styles.flipGrid}>
            <View style={styles.flipBox}>
              <View style={styles.flipCardInner}>
                <Text style={styles.flipDigit}>{String(countdown.days).padStart(2, '0')}</Text>
              </View>
              <Text style={styles.flipLabel}>DAYS</Text>
            </View>

            <Text style={styles.flipColon}>:</Text>

            <View style={styles.flipBox}>
              <View style={styles.flipCardInner}>
                <Text style={styles.flipDigit}>{String(countdown.hours).padStart(2, '0')}</Text>
              </View>
              <Text style={styles.flipLabel}>HOURS</Text>
            </View>

            <Text style={styles.flipColon}>:</Text>

            <View style={styles.flipBox}>
              <View style={styles.flipCardInner}>
                <Text style={styles.flipDigit}>{String(countdown.minutes).padStart(2, '0')}</Text>
              </View>
              <Text style={styles.flipLabel}>MINS</Text>
            </View>

            <Text style={styles.flipColon}>:</Text>

            <View style={styles.flipBox}>
              <View style={[styles.flipCardInner, styles.flipCardInnerActive]}>
                <Text style={[styles.flipDigit, { color: '#ff6b4a' }]}>
                  {String(countdown.seconds).padStart(2, '0')}
                </Text>
              </View>
              <Text style={[styles.flipLabel, { color: '#ff6b4a' }]}>SECS</Text>
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroFooterItem}>
              <Clock size={14} color="#94a3b8" />
              <Text style={styles.heroFooterText}>
                Cycle: {salaryData?.frequency === 'SEMI_MONTHLY_10_25' ? '10th & 25th of Month' : '15th & 30th of Month'}
              </Text>
            </View>
            <View style={styles.heroFooterItem}>
              <Calendar size={14} color="#94a3b8" />
              <Text style={styles.heroFooterText}>
                Started: {salaryData?.employmentStartDate || 'N/A'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* 2. TOP SUMMARY PILL CARDS */}
        <View style={styles.summaryPillRow}>
          {/* Card 1: Total Net Received */}
          <View style={[styles.pillCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.pillIconBox, { backgroundColor: theme.emeraldLight }]}>
              <Banknote size={18} color={theme.emerald} />
            </View>
            <Text style={[styles.pillLabel, { color: theme.textSecondary }]}>Total Net Received</Text>
            <Text style={[styles.pillValue, { color: theme.emerald }]}>
              {formatCurrency(salaryData?.totalEarnedLifetime || 0)}
            </Text>
            <Text style={[styles.pillSubtext, { color: theme.textMuted }]}>
              {salaryData?.confirmedPaychecks?.length || 0} Confirmed Paychecks
            </Text>
          </View>

          {/* Card 2: BIR Tax Paid */}
          <View style={[styles.pillCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.pillIconBox, { backgroundColor: theme.amberLight }]}>
              <FileText size={18} color={theme.amber} />
            </View>
            <Text style={[styles.pillLabel, { color: theme.textSecondary }]}>BIR Tax Paid</Text>
            <Text style={[styles.pillValue, { color: theme.amber }]}>
              {formatCurrency(salaryData?.totalTaxPaidLifetime || 0)}
            </Text>
            <Text style={[styles.pillSubtext, { color: theme.textMuted }]}>
              TRAIN Law Withholding
            </Text>
          </View>

          {/* Card 3: Statutory Paid */}
          <View style={[styles.pillCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.pillIconBox, { backgroundColor: theme.purpleLight }]}>
              <ShieldCheck size={18} color={theme.purple} />
            </View>
            <Text style={[styles.pillLabel, { color: theme.textSecondary }]}>Statutory Paid</Text>
            <Text style={[styles.pillValue, { color: theme.purple }]}>
              {formatCurrency(salaryData?.totalStatutoryPaidLifetime || 0)}
            </Text>
            <Text style={[styles.pillSubtext, { color: theme.textMuted }]}>
              SSS, PhilHealth, Pag-IBIG
            </Text>
          </View>
        </View>

        {/* 3. PENDING PAYCHECK CONFIRMATION CARD / MODAL */}
        {salaryData?.pendingPaychecks && salaryData.pendingPaychecks.length > 0 && (
          <View style={[styles.sectionCard, styles.pendingAlertCard, { backgroundColor: theme.cardBg, borderColor: '#f59e0b' }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.titleWithIcon}>
                <View style={[styles.sectionIconBox, { backgroundColor: theme.amberLight }]}>
                  <AlertCircle size={20} color={theme.amber} />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                    Pending Paycheck Confirmation ({salaryData.pendingPaychecks.length})
                  </Text>
                  <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                    Confirm received salary and enter any absence/late deductions
                  </Text>
                </View>
              </View>
            </View>

            {salaryData.pendingPaychecks.map((check: SalaryPaycheckRecord) => (
              <View key={check.id} style={[styles.pendingCheckItem, { backgroundColor: isDarkMode ? '#1e293b' : '#fffbe6', borderColor: '#fde68a' }]}>
                <View style={styles.pendingCheckLeft}>
                  <Text style={[styles.pendingPeriodLabel, { color: theme.textPrimary }]}>
                    {check.periodLabel}
                  </Text>
                  <Text style={[styles.pendingDateText, { color: theme.textSecondary }]}>
                    Payday: {check.paydayDate}
                  </Text>
                  <View style={styles.pendingBreakdownRow}>
                    <Text style={[styles.pendingEstText, { color: theme.emerald }]}>
                      Expected Net: {formatCurrency(check.expectedNet)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.confirmActionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => handleOpenConfirmModal(check)}
                  activeOpacity={0.8}
                >
                  <CheckCircle2 size={16} color="#ffffff" />
                  <Text style={styles.confirmActionBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 4. JOB POSITION & PROMOTION HISTORY TIMELINE */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.sectionIconBox, { backgroundColor: theme.blueLight }]}>
                <Briefcase size={20} color={theme.blue} />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Position & Promotion History</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Career growth & compensation timeline</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.smallAddBtn, { backgroundColor: theme.accentLight }]}
              onPress={handleOpenJobModal}
              activeOpacity={0.7}
            >
              <PlusCircle size={14} color={theme.accent} />
              <Text style={[styles.smallAddBtnText, { color: theme.accent }]}>Log Role</Text>
            </TouchableOpacity>
          </View>

          {/* Timeline List */}
          {salaryData?.jobHistory && salaryData.jobHistory.length > 0 ? (
            <View style={styles.timelineList}>
              {salaryData.jobHistory.map((item: JobHistoryRecord, idx: number) => {
                const isPresent = !item.endDate;
                return (
                  <View key={item.id || idx} style={styles.timelineItem}>
                    <View style={styles.timelineLeftColumn}>
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: isPresent ? theme.accent : theme.textMuted },
                        ]}
                      />
                      {idx < salaryData.jobHistory.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: theme.cardBorder }]} />
                      )}
                    </View>
                    <View style={[styles.timelineContentCard, { backgroundColor: isDarkMode ? '#1a2234' : '#f8fafc', borderColor: theme.cardBorder }]}>
                      <View style={styles.timelineHeaderRow}>
                        <Text style={[styles.timelineJobTitle, { color: theme.textPrimary }]}>
                          {item.jobTitle}
                        </Text>
                        <View style={[styles.timelineBadge, { backgroundColor: isPresent ? theme.accentLight : 'rgba(148, 163, 184, 0.15)' }]}>
                          <Text style={[styles.timelineBadgeText, { color: isPresent ? theme.accent : theme.textMuted }]}>
                            {isPresent ? 'PRESENT ROLE' : 'PAST POSITION'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.timelineEmployer, { color: theme.textSecondary }]}>
                        {item.employer}
                      </Text>
                      <View style={styles.timelineSalaryRow}>
                        <Text style={[styles.timelineSalaryLabel, { color: theme.textMuted }]}>Base Salary:</Text>
                        <Text style={[styles.timelineSalaryVal, { color: theme.emerald }]}>
                          {formatCurrency(item.baseSalary)} / mo
                        </Text>
                      </View>
                      <View style={styles.timelineDateRow}>
                        <Calendar size={12} color={theme.textMuted} />
                        <Text style={[styles.timelineDateText, { color: theme.textMuted }]}>
                          {item.startDate} {item.endDate ? `to ${item.endDate}` : 'to Present'}
                        </Text>
                      </View>
                      {item.promotionNote ? (
                        <View style={[styles.promotionNoteBox, { backgroundColor: theme.blueLight }]}>
                          <Award size={12} color={theme.blue} />
                          <Text style={[styles.promotionNoteText, { color: theme.blue }]}>
                            {item.promotionNote}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No employment history logged yet.</Text>
          )}
        </View>

        {/* 5. BIR TRAIN LAW TAX & STATUTORY BREAKDOWN CARD */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.sectionIconBox, { backgroundColor: theme.purpleLight }]}>
                <Calculator size={20} color={theme.purple} />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>BIR TRAIN Law & Statutory</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Itemized official monthly deductions</Text>
              </View>
            </View>
          </View>

          <View style={[styles.grossHeaderBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
            <Text style={[styles.grossHeaderLabel, { color: theme.textSecondary }]}>Base Monthly Gross Salary</Text>
            <Text style={[styles.grossHeaderVal, { color: theme.textPrimary }]}>
              {formatCurrency(tax?.grossMonthly || 0)}
            </Text>
          </View>

          {/* Breakdown Table */}
          <View style={styles.breakdownTable}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: theme.textSecondary }]}>SSS Contribution (4.5%)</Text>
              <Text style={[styles.tableVal, { color: theme.textPrimary }]}>-{formatCurrency(tax?.sss || 0)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: theme.textSecondary }]}>PhilHealth Contribution (2.5%)</Text>
              <Text style={[styles.tableVal, { color: theme.textPrimary }]}>-{formatCurrency(tax?.philhealth || 0)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: theme.textSecondary }]}>Pag-IBIG HDMF (2%)</Text>
              <Text style={[styles.tableVal, { color: theme.textPrimary }]}>-{formatCurrency(tax?.pagibig || 0)}</Text>
            </View>
            <View style={[styles.tableRow, styles.subtotalRow, { borderTopColor: theme.cardBorder }]}>
              <Text style={[styles.subtotalLabel, { color: theme.purple }]}>Total Statutory Deductions</Text>
              <Text style={[styles.subtotalVal, { color: theme.purple }]}>-{formatCurrency(tax?.totalStatutory || 0)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: theme.textSecondary }]}>Taxable Monthly Income</Text>
              <Text style={[styles.tableVal, { color: theme.textPrimary }]}>{formatCurrency(tax?.taxableIncome || 0)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: theme.textSecondary }]}>BIR TRAIN Law Withholding Tax</Text>
              <Text style={[styles.tableVal, { color: theme.amber }]}>-{formatCurrency(tax?.withholdingTax || 0)}</Text>
            </View>

            <View style={[styles.tableRow, styles.totalRow, { borderTopColor: theme.cardBorder }]}>
              <View>
                <Text style={[styles.totalLabel, { color: theme.textPrimary }]}>Monthly Net Take-Home</Text>
                <Text style={[styles.totalSub, { color: theme.textMuted }]}>
                  Effective Tax Rate: {tax?.effectiveTaxRate || 0}%
                </Text>
              </View>
              <Text style={[styles.totalVal, { color: theme.emerald }]}>
                {formatCurrency(tax?.netTakeHome || 0)}
              </Text>
            </View>

            <View style={styles.paycheckPairRow}>
              <View style={[styles.paycheckPairBox, { backgroundColor: theme.emeraldLight }]}>
                <Text style={[styles.paycheckPairLabel, { color: theme.emerald }]}>10th Paycheck</Text>
                <Text style={[styles.paycheckPairVal, { color: theme.emerald }]}>
                  {formatCurrency(tax?.paycheck10th || 0)}
                </Text>
              </View>
              <View style={[styles.paycheckPairBox, { backgroundColor: theme.emeraldLight }]}>
                <Text style={[styles.paycheckPairLabel, { color: theme.emerald }]}>25th Paycheck</Text>
                <Text style={[styles.paycheckPairVal, { color: theme.emerald }]}>
                  {formatCurrency(tax?.paycheck25th || 0)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 6. DOLE P.D. 851 PRO-RATED 13TH MONTH BONUS CARD */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.sectionIconBox, { backgroundColor: theme.amberLight }]}>
                <Award size={20} color={theme.amber} />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>DOLE P.D. 851 13th Month Bonus</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Mandatory pro-rated year-end bonus</Text>
              </View>
            </View>
            {bonus?.isFullyTaxExempt && (
              <View style={[styles.taxExemptBadge, { backgroundColor: theme.emeraldLight }]}>
                <ShieldCheck size={12} color={theme.emerald} />
                <Text style={[styles.taxExemptBadgeText, { color: theme.emerald }]}>100% Tax Exempt</Text>
              </View>
            )}
          </View>

          <View style={styles.bonusGrid}>
            <View style={[styles.bonusGridBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}>
              <Text style={[styles.bonusGridLabel, { color: theme.textMuted }]}>Months Worked</Text>
              <Text style={[styles.bonusGridVal, { color: theme.textPrimary }]}>{bonus?.monthsWorked || 0} mos</Text>
              <Text style={[styles.bonusGridSub, { color: theme.textSecondary }]}>{bonus?.proratedPercentage || 0}% of Year</Text>
            </View>
            <View style={[styles.bonusGridBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}>
              <Text style={[styles.bonusGridLabel, { color: theme.textMuted }]}>Gross 13th Month</Text>
              <Text style={[styles.bonusGridVal, { color: theme.emerald }]}>{formatCurrency(bonus?.gross13thMonthPay || 0)}</Text>
              <Text style={[styles.bonusGridSub, { color: theme.textSecondary }]}>Cap Limit: ₱90,000</Text>
            </View>
          </View>

          <View style={[styles.bonusNoteBox, { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb', borderColor: '#fcd34d' }]}>
            <HelpCircle size={16} color={theme.amber} />
            <Text style={[styles.bonusNoteText, { color: isDarkMode ? '#fef08a' : '#92400e' }]}>
              Under BIR rules, 13th month pay up to ₱90,000 is tax-exempt. Taxable excess over limit: {formatCurrency(bonus?.taxable13thMonthAmount || 0)}.
            </Text>
          </View>
        </View>

        {/* 7. PAYROLL CUT-OFF & FIRST PAYDAY SCHEDULE CARD */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.sectionIconBox, { backgroundColor: theme.blueLight }]}>
                <Clock size={20} color={theme.blue} />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Payroll Cut-Off Schedule</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>First payday & cut-off alignment</Text>
              </View>
            </View>
          </View>

          <View style={styles.cutoffInfoContainer}>
            <View style={styles.cutoffRow}>
              <Text style={[styles.cutoffLabel, { color: theme.textSecondary }]}>Employment Start Date</Text>
              <Text style={[styles.cutoffVal, { color: theme.textPrimary }]}>{cutoff?.employmentStartDate || 'N/A'}</Text>
            </View>
            <View style={styles.cutoffRow}>
              <Text style={[styles.cutoffLabel, { color: theme.textSecondary }]}>First Payday Date</Text>
              <Text style={[styles.cutoffVal, { color: theme.blue }]}>{cutoff?.firstPaydayLabel || 'N/A'}</Text>
            </View>
            <View style={styles.cutoffRow}>
              <Text style={[styles.cutoffLabel, { color: theme.textSecondary }]}>Cut-Off Period Worked</Text>
              <Text style={[styles.cutoffVal, { color: theme.textPrimary }]}>{cutoff?.cutoffPeriodWorked || 'Standard'}</Text>
            </View>
            <View style={styles.cutoffRow}>
              <Text style={[styles.cutoffLabel, { color: theme.textSecondary }]}>First Paycheck Status</Text>
              <Text style={[styles.cutoffVal, { color: cutoff?.isFirstPaydayProrated ? theme.amber : theme.emerald }]}>
                {cutoff?.isFirstPaydayProrated ? 'Prorated' : 'Full Semi-Monthly'}
              </Text>
            </View>
          </View>
        </View>

        {/* 8. CONFIRMED PAYDAY EARNINGS LEDGER & DIGITAL PAYSLIP */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, styles.marginBottom]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.sectionIconBox, { backgroundColor: theme.emeraldLight }]}>
                <Receipt size={20} color={theme.emerald} />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Confirmed Payday Ledger</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Historical payslips & digital receipts</Text>
              </View>
            </View>
          </View>

          {salaryData?.confirmedPaychecks && salaryData.confirmedPaychecks.length > 0 ? (
            <View style={styles.ledgerList}>
              {salaryData.confirmedPaychecks.map((check: SalaryPaycheckRecord) => (
                <TouchableOpacity
                  key={check.id}
                  style={[styles.ledgerRow, { borderBottomColor: theme.cardBorder }]}
                  onPress={() => handleOpenPayslip(check)}
                  activeOpacity={0.7}
                >
                  <View style={styles.ledgerLeft}>
                    <Text style={[styles.ledgerPeriod, { color: theme.textPrimary }]}>{check.periodLabel}</Text>
                    <Text style={[styles.ledgerDate, { color: theme.textMuted }]}>Payday: {check.paydayDate}</Text>
                  </View>
                  <View style={styles.ledgerRight}>
                    <Text style={[styles.ledgerAmount, { color: theme.emerald }]}>
                      {formatCurrency(check.actualReceived)}
                    </Text>
                    <View style={styles.payslipBtnBadge}>
                      <Text style={styles.payslipBtnBadgeText}>View Payslip</Text>
                      <ChevronRight size={12} color={theme.accent} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyLedgerBox}>
              <FileText size={28} color={theme.textMuted} />
              <Text style={[styles.emptyLedgerText, { color: theme.textMuted }]}>
                No confirmed paychecks in ledger yet. Confirm pending paychecks above when received.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL 1: CONFIRM PAYCHECK MODAL */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Confirm Paycheck Received</Text>
              <TouchableOpacity onPress={() => setConfirmModalVisible(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedPendingCheck && (
              <ScrollView style={styles.modalBody}>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  {selectedPendingCheck.periodLabel} ({selectedPendingCheck.paydayDate})
                </Text>

                <View style={[styles.modalSummaryBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <View style={styles.modalSummaryRow}>
                    <Text style={[styles.modalSummaryLabel, { color: theme.textSecondary }]}>Expected Net Paycheck:</Text>
                    <Text style={[styles.modalSummaryVal, { color: theme.emerald }]}>
                      {formatCurrency(selectedPendingCheck.expectedNet)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Absence / Late Deductions (₱)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  value={deductionsInput}
                  onChangeText={setDeductionsInput}
                />

                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Deduction Reason / Notes</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                  ]}
                  placeholder="e.g. 2 hours tardiness on July 14"
                  placeholderTextColor={theme.textMuted}
                  value={deductionsReasonInput}
                  onChangeText={setDeductionsReasonInput}
                />

                <View style={[styles.netConfirmBox, { backgroundColor: theme.emeraldLight }]}>
                  <Text style={[styles.netConfirmLabel, { color: theme.emerald }]}>Actual Net to Receive:</Text>
                  <Text style={[styles.netConfirmVal, { color: theme.emerald }]}>
                    {formatCurrency(
                      Math.max(0, selectedPendingCheck.expectedNet - (parseFloat(deductionsInput) || 0))
                    )}
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.cardBorder }]}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.accent }]}
                onPress={handleConfirmPaycheckSubmit}
                disabled={submittingConfirm}
              >
                {submittingConfirm ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Confirm Paycheck</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: LOG JOB POSITION / ROLE MODAL */}
      <Modal
        visible={jobModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJobModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Log Job Position / Salary Raise</Text>
              <TouchableOpacity onPress={() => setJobModalVisible(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Job Title *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="e.g. Senior Software Engineer"
                placeholderTextColor={theme.textMuted}
                value={jobTitleInput}
                onChangeText={setJobTitleInput}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Employer / Company</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="e.g. S-Pay Operations"
                placeholderTextColor={theme.textMuted}
                value={employerInput}
                onChangeText={setEmployerInput}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Base Monthly Salary (₱) *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="e.g. 60000"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={baseSalaryInput}
                onChangeText={setBaseSalaryInput}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Employment Start Date * (YYYY-MM-DD)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="2026-01-01"
                placeholderTextColor={theme.textMuted}
                value={startDateInput}
                onChangeText={setStartDateInput}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Promotion Note / Reason</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="e.g. Annual Merit Promotion"
                placeholderTextColor={theme.textMuted}
                value={promotionNoteInput}
                onChangeText={setPromotionNoteInput}
              />
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.cardBorder }]}
                onPress={() => setJobModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.accent }]}
                onPress={handleSaveJobSubmit}
                disabled={submittingJob}
              >
                {submittingJob ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Save Position</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: DIGITAL PAYSLIP MODAL */}
      <Modal
        visible={payslipModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayslipModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalCard, styles.payslipModalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.payslipHeaderTitleRow}>
                <Receipt size={22} color={theme.accent} />
                <Text style={[styles.modalTitle, { color: theme.textPrimary, marginLeft: 8 }]}>
                  Official Digital Payslip
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPayslipModalVisible(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedPayslip && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={[styles.payslipStampBox, { backgroundColor: theme.accentLight }]}>
                  <Text style={styles.payslipStampCompany}>S-PAY OPERATIONS</Text>
                  <Text style={[styles.payslipStampPeriod, { color: theme.textPrimary }]}>
                    {selectedPayslip.periodLabel}
                  </Text>
                  <Text style={[styles.payslipStampDate, { color: theme.textSecondary }]}>
                    Payday Date: {selectedPayslip.paydayDate}
                  </Text>
                </View>

                <Text style={[styles.payslipSectionHeading, { color: theme.textPrimary }]}>
                  Itemized Earnings & Deductions
                </Text>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>Expected Semi-Monthly Gross</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.textPrimary }]}>
                    {formatCurrency(selectedPayslip.expectedGross)}
                  </Text>
                </View>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>SSS Employee Share</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.textPrimary }]}>
                    -{formatCurrency(selectedPayslip.sssDeducted)}
                  </Text>
                </View>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>PhilHealth Share</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.textPrimary }]}>
                    -{formatCurrency(selectedPayslip.philhealthDeducted)}
                  </Text>
                </View>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>Pag-IBIG HDMF Share</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.textPrimary }]}>
                    -{formatCurrency(selectedPayslip.pagibigDeducted)}
                  </Text>
                </View>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>BIR Withholding Tax</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.amber }]}>
                    -{formatCurrency(selectedPayslip.taxDeducted)}
                  </Text>
                </View>

                {selectedPayslip.deductionsAmount > 0 && (
                  <View style={styles.payslipLineRow}>
                    <Text style={[styles.payslipLineLabel, { color: theme.accent }]}>
                      Late / Absence Deduction ({selectedPayslip.deductionsReason || 'N/A'})
                    </Text>
                    <Text style={[styles.payslipLineVal, { color: theme.accent }]}>
                      -{formatCurrency(selectedPayslip.deductionsAmount)}
                    </Text>
                  </View>
                )}

                <View style={[styles.payslipNetTotalBox, { backgroundColor: theme.emeraldLight }]}>
                  <Text style={[styles.payslipNetTotalLabel, { color: theme.emerald }]}>NET TAKE-HOME RECEIVED</Text>
                  <Text style={[styles.payslipNetTotalVal, { color: theme.emerald }]}>
                    {formatCurrency(selectedPayslip.actualReceived)}
                  </Text>
                </View>

                <View style={styles.payslipFooterStamp}>
                  <ShieldCheck size={14} color={theme.emerald} />
                  <Text style={[styles.payslipFooterStampText, { color: theme.textMuted }]}>
                    System Verified • Confirmed on {selectedPayslip.confirmedAt ? new Date(selectedPayslip.confirmedAt).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: theme.accent, marginTop: 12 }]}
              onPress={() => setPayslipModalVisible(false)}
            >
              <Text style={styles.modalSubmitBtnText}>Close Payslip</Text>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 1,
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
  },

  /* Hero Card & Flip Digits */
  heroCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 20,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  heroBadgeText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  heroTargetLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  heroMainTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  heroRoleSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  flipGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  flipBox: {
    alignItems: 'center',
  },
  flipCardInner: {
    width: 60,
    height: 64,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipCardInnerActive: {
    borderColor: '#ff6b4a',
    backgroundColor: '#1e1b18',
  },
  flipDigit: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  flipLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 1,
  },
  flipColon: {
    color: '#64748b',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -16,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  heroFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroFooterText: {
    color: '#94a3b8',
    fontSize: 11,
  },

  /* Top Summary Pill Cards */
  summaryPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  pillCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
  },
  pillIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  pillValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  pillSubtext: {
    fontSize: 9,
    marginTop: 2,
  },

  /* Sections */
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  pendingAlertCard: {
    borderWidth: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 1,
  },

  /* Pending Paycheck Item */
  pendingCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  pendingCheckLeft: {
    flex: 1,
  },
  pendingPeriodLabel: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  pendingDateText: {
    fontSize: 11,
    marginTop: 1,
  },
  pendingBreakdownRow: {
    marginTop: 4,
  },
  pendingEstText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  confirmActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  confirmActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  /* Timeline */
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallAddBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  timelineList: {
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineLeftColumn: {
    width: 20,
    alignItems: 'center',
    marginRight: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  timelineContentCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineJobTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  timelineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timelineBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  timelineEmployer: {
    fontSize: 11,
    marginTop: 2,
  },
  timelineSalaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  timelineSalaryLabel: {
    fontSize: 11,
  },
  timelineSalaryVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timelineDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  timelineDateText: {
    fontSize: 10,
  },
  promotionNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 6,
    borderRadius: 6,
  },
  promotionNoteText: {
    fontSize: 10,
    fontWeight: '600',
  },

  /* Tax Breakdown Table */
  grossHeaderBox: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  grossHeaderLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  grossHeaderVal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  breakdownTable: {
    gap: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableLabel: {
    fontSize: 12,
  },
  tableVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  subtotalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
  subtotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  subtotalVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalRow: {
    paddingTop: 10,
    borderTopWidth: 1.5,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalSub: {
    fontSize: 10,
  },
  totalVal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  paycheckPairRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  paycheckPairBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  paycheckPairLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  paycheckPairVal: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
  },

  /* Bonus Grid */
  taxExemptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  taxExemptBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bonusGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  bonusGridBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  bonusGridLabel: {
    fontSize: 10,
  },
  bonusGridVal: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  bonusGridSub: {
    fontSize: 10,
    marginTop: 2,
  },
  bonusNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  bonusNoteText: {
    fontSize: 11,
    flex: 1,
  },

  /* Cutoff info */
  cutoffInfoContainer: {
    gap: 8,
  },
  cutoffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cutoffLabel: {
    fontSize: 12,
  },
  cutoffVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  /* Confirmed Ledger */
  ledgerList: {
    gap: 4,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  ledgerLeft: {
    flex: 1,
  },
  ledgerPeriod: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  ledgerDate: {
    fontSize: 11,
    marginTop: 1,
  },
  ledgerRight: {
    alignItems: 'flex-end',
  },
  ledgerAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  payslipBtnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  payslipBtnBadgeText: {
    color: '#ee4d2d',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyLedgerBox: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyLedgerText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  marginBottom: {
    marginBottom: 32,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
  },
  payslipModalCard: {
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSub: {
    fontSize: 12,
    marginBottom: 10,
  },
  modalBody: {
    flexGrow: 0,
  },
  modalSummaryBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSummaryLabel: {
    fontSize: 12,
  },
  modalSummaryVal: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  netConfirmBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 6,
  },
  netConfirmLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  netConfirmVal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  /* Payslip Specific */
  payslipHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payslipStampBox: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  payslipStampCompany: {
    color: '#ee4d2d',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  payslipStampPeriod: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 4,
  },
  payslipStampDate: {
    fontSize: 11,
    marginTop: 2,
  },
  payslipSectionHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  payslipLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  payslipLineLabel: {
    fontSize: 12,
  },
  payslipLineVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  payslipNetTotalBox: {
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  payslipNetTotalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  payslipNetTotalVal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  payslipFooterStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 10,
  },
  payslipFooterStampText: {
    fontSize: 10,
  },
});
