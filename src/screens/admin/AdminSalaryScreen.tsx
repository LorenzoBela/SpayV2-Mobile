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
  Animated as RNAnimated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
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
  ChevronRight,
  RefreshCw,
  AlertCircle,
  X,
  Building2,
  Sparkles,
  Calculator,
  Receipt,
  HelpCircle,
  Zap,
  Percent,
  SlidersHorizontal,
  PiggyBank,
  CalendarClock,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import CountdownTimer from '../../components/CountdownTimer';
import { parseUtcDate } from '../../utils/date';
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
  isToday?: boolean;
  isOverdue?: boolean;
}

const FLIP_PHASE_MS = 300;
const FLIP_TOTAL_MS = FLIP_PHASE_MS * 2;
const flipEaseIn = Easing.bezier(0.42, 0, 1, 1);
const flipEaseOut = Easing.bezier(0, 0, 0.58, 1);

interface SalaryFlipCardProps {
  value: number;
  label: string;
  isSecs?: boolean;
}

const SalaryFlipCard = React.memo(function SalaryFlipCard({ value, label, isSecs }: SalaryFlipCardProps) {
  const format = (val: number) => String(val).padStart(2, '0');
  const newValue = format(value);

  const { isDarkMode } = useContext(ThemeContext);

  const [current, setCurrent] = useState(newValue);
  const [previous, setPrevious] = useState(newValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [topRevealed, setTopRevealed] = useState(false);

  const topFlipProgress = React.useRef(new RNAnimated.Value(1)).current;
  const bottomFlipProgress = React.useRef(new RNAnimated.Value(1)).current;
  const lastValueRef = React.useRef(newValue);
  const animTimerRef = React.useRef<any>(null);
  const revealTimerRef = React.useRef<any>(null);

  useEffect(() => {
    if (newValue !== lastValueRef.current) {
      setPrevious(lastValueRef.current);
      setCurrent(newValue);
      setIsAnimating(true);
      setTopRevealed(false);
      topFlipProgress.stopAnimation();
      bottomFlipProgress.stopAnimation();
      topFlipProgress.setValue(0);
      bottomFlipProgress.setValue(0);

      RNAnimated.parallel([
        RNAnimated.timing(topFlipProgress, {
          toValue: 1,
          duration: FLIP_PHASE_MS,
          easing: flipEaseIn,
          useNativeDriver: true,
        }),
        RNAnimated.sequence([
          RNAnimated.delay(FLIP_PHASE_MS),
          RNAnimated.timing(bottomFlipProgress, {
            toValue: 1,
            duration: FLIP_PHASE_MS,
            easing: flipEaseOut,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(() => {
        setTopRevealed(true);
      }, FLIP_PHASE_MS);

      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => {
        setIsAnimating(false);
        setTopRevealed(false);
      }, FLIP_TOTAL_MS);

      lastValueRef.current = newValue;
    }
  }, [newValue]);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      topFlipProgress.stopAnimation();
      bottomFlipProgress.stopAnimation();
    };
  }, []);

  const showFlip = previous !== current;
  const activeFlip = showFlip && isAnimating;
  const topStaticValue = isAnimating && !topRevealed ? previous : current;
  const bottomStaticValue = isAnimating ? previous : current;

  // Theme-derived card layout variables
  const cardBgTop = isSecs
    ? (isDarkMode ? '#281a17' : '#fee2e2')
    : (isDarkMode ? '#1e293b' : '#e2e8f0');
  const cardBgBottom = isSecs
    ? (isDarkMode ? '#1e1614' : '#fecaca')
    : (isDarkMode ? '#161c2a' : '#cbd5e1');
  const textColorTop = isSecs
    ? '#ff6b4a'
    : (isDarkMode ? '#f8fafc' : '#0f172a');
  const textColorBottom = isSecs
    ? '#ee4d2d'
    : (isDarkMode ? '#cbd5e1' : '#334155');
  const cardBorderColor = isSecs
    ? (isDarkMode ? 'rgba(255, 107, 74, 0.4)' : 'rgba(238, 77, 45, 0.4)')
    : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
  const labelColor = isSecs
    ? '#ff6b4a'
    : (isDarkMode ? '#64748b' : '#475569');

  const rotateTop = topFlipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  const rotateBottom = bottomFlipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });

  const opacityTop = topFlipProgress.interpolate({
    inputRange: [0, 0.98, 1],
    outputRange: [1, 1, 0],
  });

  const opacityBottom = bottomFlipProgress.interpolate({
    inputRange: [0, 0.02, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <View style={styles.salaryFlipCol}>
      <View style={styles.salaryFlipOuterWrap}>
        <View style={[styles.salaryFlipCardOuter, { backgroundColor: cardBgTop, borderColor: cardBorderColor }]}>
          {/* 1. Top Static */}
          <View style={[styles.salaryTopHalfContainer, { backgroundColor: cardBgTop }]}>
            <Text style={[styles.salaryTopText, { color: textColorTop }]}>{topStaticValue}</Text>
          </View>

          {/* 2. Bottom Static */}
          <View style={[styles.salaryBottomHalfContainer, { backgroundColor: cardBgBottom }]}>
            <Text style={[styles.salaryBottomText, { color: textColorBottom }]}>{bottomStaticValue}</Text>
          </View>

          {/* 3. Animated Top Flap (old value flipping away) */}
          {activeFlip && (
            <RNAnimated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 30,
                  opacity: opacityTop,
                  transform: [
                    { perspective: 400 },
                    { translateY: 15 },
                    { rotateX: rotateTop },
                    { translateY: -15 },
                  ],
                  zIndex: 3,
                  backfaceVisibility: 'hidden',
                } as any
              ]}
            >
              <View style={[styles.salaryTopHalfContainer, { backgroundColor: cardBgTop }]}>
                <Text style={[styles.salaryTopText, { color: textColorTop }]}>{previous}</Text>
              </View>
            </RNAnimated.View>
          )}

          {/* 4. Animated Bottom Flap (new value flipping into place) */}
          {activeFlip && (
            <RNAnimated.View
              style={[
                {
                  position: 'absolute',
                  top: 30,
                  left: 0,
                  right: 0,
                  height: 30,
                  opacity: opacityBottom,
                  transform: [
                    { perspective: 400 },
                    { translateY: -15 },
                    { rotateX: rotateBottom },
                    { translateY: 15 },
                  ],
                  zIndex: 2,
                  backfaceVisibility: 'hidden',
                } as any
              ]}
            >
              <View style={[styles.salaryBottomHalfContainer, { backgroundColor: cardBgBottom }]}>
                <Text style={[styles.salaryBottomText, { color: textColorBottom }]}>{current}</Text>
              </View>
            </RNAnimated.View>
          )}

          {/* Horizontal Split Line */}
          <View style={styles.salaryFlipCardDivider} />
        </View>
      </View>
      <Text style={[styles.flipLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
});

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
  const [endDateInput, setEndDateInput] = useState('');
  const [promotionNoteInput, setPromotionNoteInput] = useState('');
  const [submittingJob, setSubmittingJob] = useState(false);

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settingsJobTitle, setSettingsJobTitle] = useState('');
  const [settingsEmployer, setSettingsEmployer] = useState('');
  const [settingsBaseSalary, setSettingsBaseSalary] = useState('');
  const [settingsStartDate, setSettingsStartDate] = useState('');
  const [settingsFrequency, setSettingsFrequency] = useState('SEMI_MONTHLY_10_25');
  const [settingsCustomPayday, setSettingsCustomPayday] = useState('');
  const [submittingSettings, setSubmittingSettings] = useState(false);

  const [payslipModalVisible, setPayslipModalVisible] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<SalaryPaycheckRecord | null>(null);



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
      setEndDateInput('');
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
        endDate: endDateInput.trim() || null,
        promotionNote: promotionNoteInput.trim() || undefined,
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

  // Settings Modal handler
  const handleOpenSettingsModal = () => {
    if (salaryData) {
      setSettingsJobTitle(salaryData.jobTitle || '');
      setSettingsEmployer(salaryData.employer || '');
      setSettingsBaseSalary(salaryData.baseSalary ? salaryData.baseSalary.toString() : '');
      setSettingsStartDate(salaryData.employmentStartDate || '');
      setSettingsFrequency(salaryData.frequency || 'SEMI_MONTHLY_10_25');
      setSettingsCustomPayday(salaryData.customPayday || '');
    }
    setSettingsModalVisible(true);
  };

  const handleSaveSettingsSubmit = async () => {
    if (!settingsJobTitle.trim() || !settingsBaseSalary.trim() || !settingsStartDate.trim()) {
      PremiumAlert.alert('Validation Error', 'Please fill in Job Title, Base Monthly Salary, and Employment Start Date.');
      return;
    }
    setSubmittingSettings(true);
    try {
      const baseSalaryNum = parseFloat(settingsBaseSalary) || 0;
      const updated = await updateSalarySettings({
        jobTitle: settingsJobTitle.trim(),
        employer: settingsEmployer.trim() || 'S-Pay Operations',
        baseSalary: baseSalaryNum,
        employmentStartDate: settingsStartDate.trim(),
        frequency: settingsFrequency,
        customPayday: settingsFrequency === 'CUSTOM' ? settingsCustomPayday.trim() : null,
      });
      setSalaryData(updated);
      setSettingsModalVisible(false);
      PremiumAlert.alert('Settings Saved', 'Salary profile and pay cycle frequency updated successfully.');
    } catch (err: any) {
      PremiumAlert.alert('Error', err.message || 'Failed to update salary settings');
    } finally {
      setSubmittingSettings(false);
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
    bg: isDarkMode ? '#000000' : '#f8fafc',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    headerBg: isDarkMode ? '#000000' : '#ffffff',
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

  const baseGross = salaryData?.baseSalary || 0;
  const annualTarget = baseGross * 12;
  const totalEarned = salaryData?.totalEarnedLifetime || 0;
  const progressPercent = annualTarget > 0 ? Math.min(100, Math.round((totalEarned / annualTarget) * 100)) : 0;

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
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.refreshIconBtn, { backgroundColor: theme.accentLight, marginRight: 6 }]}
            onPress={handleOpenSettingsModal}
            activeOpacity={0.7}
          >
            <SlidersHorizontal size={18} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.refreshIconBtn, { backgroundColor: theme.accentLight }]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <RefreshCw size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>
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
          ]}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroBadge}>
              <Sparkles size={12} color="#fbbf24" />
              <Text style={styles.heroBadgeText}>
                {salaryData?.frequency === 'SEMI_MONTHLY_15_30' ? 'SEMI-MONTHLY TARGET (15TH & 30TH)' : 'SEMI-MONTHLY TARGET (10TH & 25TH)'}
              </Text>
            </View>
            <Text style={styles.heroTargetLabel}>
              {salaryData?.nextPaydayIso
                ? new Date(`${salaryData.nextPaydayIso.split('T')[0]}T00:00:00`).toLocaleDateString('en-US', {
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
          <CountdownTimer targetDate={salaryData?.nextPaydayIso} parseDateFn={parseUtcDate}>
            {(cDown) => (
              <>
                <View style={styles.flipGrid}>
                  <SalaryFlipCard value={cDown.days} label="DAYS" />
                  <Text style={styles.flipColon}>:</Text>
                  <SalaryFlipCard value={cDown.hours} label="HOURS" />
                  <Text style={styles.flipColon}>:</Text>
                  <SalaryFlipCard value={cDown.minutes} label="MINS" />
                  <Text style={styles.flipColon}>:</Text>
                  <SalaryFlipCard value={cDown.seconds} label="SECS" isSecs />
                </View>

                {/* Status Message */}
                <View style={styles.heroStatusContainer}>
                  <Clock size={13} color="#ee4d2d" />
                  <Text style={styles.heroStatusText}>
                    {cDown.isToday
                      ? 'Payday Today — Cash is in'
                      : cDown.isOverdue
                      ? 'Payday Date Arrived'
                      : `Target: ${
                          salaryData?.nextPaydayIso
                            ? new Date(`${salaryData.nextPaydayIso.split('T')[0]}T00:00:00`).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Next Payday'
                        }`}
                  </Text>
                </View>
              </>
            )}
          </CountdownTimer>

          {/* Progress Bar towards Annual Gross Target */}
          <View style={styles.heroTargetProgressBox}>
            <View style={styles.heroTargetHeaderRow}>
              <Text style={styles.heroTargetTitle}>
                Annual Target ({formatCurrency(annualTarget)})
              </Text>
              <Text style={styles.heroTargetPercent}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroFooterItem}>
              <Clock size={14} color="#94a3b8" />
              <Text style={styles.heroFooterText}>
                Cycle: {salaryData?.frequency === 'SEMI_MONTHLY_15_30' ? '15th & 30th of Month' : '10th & 25th of Month'}
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
              <PiggyBank size={18} color={theme.emerald} />
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
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  Position & Promotion History
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  Career growth & compensation timeline
                </Text>
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
                const isPresent = !item.endDate || item.endDate === 'Present' || String(item.endDate).toLowerCase() === 'present';
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
                            {isPresent ? 'ACTIVE POSITION' : 'PAST POSITION'}
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
                            "{item.promotionNote}"
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
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  BIR TRAIN Law & Statutory
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  Sweldo.ph BIR TRAIN Formula
                </Text>
              </View>
            </View>
            <View style={[styles.taxRateBadge, { backgroundColor: theme.purpleLight }]}>
              <Text style={[styles.taxRateBadgeText, { color: theme.purple }]}>
                Eff. {tax?.effectiveTaxRate || 0}%
              </Text>
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
                <Text style={[styles.totalLabel, { color: theme.textPrimary }]}>Net Take-Home (Monthly)</Text>
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
                <Text style={[styles.paycheckPairLabel, { color: theme.emerald }]}>
                  {salaryData?.frequency === 'SEMI_MONTHLY_15_30' ? '15th Paycheck' : '10th Paycheck'}
                </Text>
                <Text style={[styles.paycheckPairVal, { color: theme.emerald }]}>
                  {formatCurrency(tax?.paycheck10th || 0)}
                </Text>
              </View>
              <View style={[styles.paycheckPairBox, { backgroundColor: theme.emeraldLight }]}>
                <Text style={[styles.paycheckPairLabel, { color: theme.emerald }]}>
                  {salaryData?.frequency === 'SEMI_MONTHLY_15_30' ? '30th Paycheck' : '25th Paycheck'}
                </Text>
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
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  DOLE P.D. 851 13th Month Bonus
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  Mandatory pro-rated year-end bonus
                </Text>
              </View>
            </View>
            <View style={[styles.taxExemptBadge, { backgroundColor: theme.amberLight }]}>
              <Percent size={12} color={theme.amber} />
              <Text style={[styles.taxExemptBadgeText, { color: theme.amber }]}>
                {bonus?.proratedPercentage || 0}% Rate
              </Text>
            </View>
          </View>

          <View style={styles.bonusGrid}>
            <View style={[styles.bonusGridBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}>
              <Text style={[styles.bonusGridLabel, { color: theme.textMuted }]}>Tenure Window</Text>
              <Text style={[styles.bonusGridVal, { color: theme.textPrimary }]}>
                {bonus?.monthsWorked || 0} Mos ({bonus?.daysWorked || 0} Days)
              </Text>
              <Text style={[styles.bonusGridSub, { color: theme.textSecondary }]}>
                Earned: {formatCurrency(bonus?.totalEarnedInYear || 0)}
              </Text>
            </View>
            <View style={[styles.bonusGridBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}>
              <Text style={[styles.bonusGridLabel, { color: theme.textMuted }]}>Gross 13th Month</Text>
              <Text style={[styles.bonusGridVal, { color: theme.emerald }]}>
                {formatCurrency(bonus?.gross13thMonthPay || 0)}
              </Text>
              <Text style={[styles.bonusGridSub, { color: theme.textSecondary }]}>Tax Cap: ₱90,000</Text>
            </View>
          </View>

          {/* Tax Exemption Banner */}
          <View style={[styles.bonusNoteBox, { backgroundColor: bonus?.isFullyTaxExempt ? theme.emeraldLight : theme.amberLight, borderColor: bonus?.isFullyTaxExempt ? theme.emerald : theme.amber }]}>
            {bonus?.isFullyTaxExempt ? (
              <ShieldCheck size={16} color={theme.emerald} />
            ) : (
              <AlertCircle size={16} color={theme.amber} />
            )}
            <Text style={[styles.bonusNoteText, { color: bonus?.isFullyTaxExempt ? theme.emerald : theme.amber }]}>
              {bonus?.isFullyTaxExempt
                ? '100% Tax Exempt (Below ₱90,000 Cap)'
                : `₱${(bonus?.taxable13thMonthAmount || 0).toLocaleString()} Taxable over ₱90k (Est. Tax: -${formatCurrency(bonus?.estimated13thMonthTax || 0)})`}
            </Text>
          </View>

          {/* Final Net 13th Month Bonus */}
          <View style={[styles.net13thMonthBox, { backgroundColor: theme.accentLight }]}>
            <View>
              <Text style={[styles.net13thMonthLabel, { color: theme.accent }]}>Net 13th Month Bonus Payout</Text>
              <Text style={[styles.net13thMonthVal, { color: theme.accent }]}>
                {formatCurrency(bonus?.net13thMonthPay || 0)}
              </Text>
            </View>
            <Award size={22} color={theme.accent} />
          </View>

          <View style={styles.doleDeadlineBanner}>
            <Text style={[styles.doleDeadlineText, { color: theme.textMuted }]}>
              DOLE Mandatory Payout Deadline: On or before Dec 24.
            </Text>
          </View>
        </View>

        {/* 7. PAYROLL CUT-OFF & FIRST PAYDAY SCHEDULE CARD */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.sectionIconBox, { backgroundColor: theme.blueLight }]}>
                <CalendarClock size={20} color={theme.blue} />
              </View>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  Payroll Cut-Off Schedule
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  First payday & cut-off alignment
                </Text>
              </View>
            </View>
            <View style={[styles.scheduleBadge, { backgroundColor: theme.accentLight }]}>
              <Text style={[styles.scheduleBadgeText, { color: theme.accent }]}>
                {salaryData?.frequency === 'SEMI_MONTHLY_15_30' ? '15th & 30th Payroll' : '10th & 25th Payroll'}
              </Text>
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
                {cutoff?.isFirstPaydayProrated ? 'Pro-Rated (Started Mid-Cutoff)' : 'Full Semi-Monthly Cut-Off'}
              </Text>
            </View>
            <View style={[styles.cutoffRow, styles.cutoffHighlightRow, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
              <Text style={[styles.cutoffLabel, { color: theme.textPrimary, fontWeight: 'bold' }]}>Est. First Net Paycheck</Text>
              <Text style={[styles.cutoffVal, { color: theme.emerald, fontSize: 14 }]}>
                {formatCurrency(cutoff?.proratedFirstPaycheck || 0)}
              </Text>
            </View>
            {cutoff?.isFirstPaydayProrated && (
              <Text style={[styles.cutoffSubDetail, { color: theme.textMuted }]}>
                Standard Semi-Monthly: {formatCurrency(cutoff?.standardSemiMonthlyPaycheck || 0)}
              </Text>
            )}
          </View>
        </View>

        {/* 8. CONFIRMED PAYDAY EARNINGS LEDGER & DIGITAL PAYSLIP */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, styles.marginBottom]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithIcon}>
              <View style={[styles.sectionIconBox, { backgroundColor: theme.emeraldLight }]}>
                <Receipt size={20} color={theme.emerald} />
              </View>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  Confirmed Payday Ledger
                </Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  Historical payslips & digital receipts
                </Text>
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
                    <View style={styles.ledgerDetailsSubRow}>
                      <Text style={[styles.ledgerSubText, { color: theme.textMuted }]}>
                        Base: {formatCurrency(check.expectedNet)} • Tax: {formatCurrency(check.taxDeducted || (tax?.withholdingTax ? tax.withholdingTax / 2 : 0))}
                      </Text>
                    </View>
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
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Log Job Position / Role</Text>
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

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Start Date * (YYYY-MM-DD)</Text>
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

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>End Date (YYYY-MM-DD or leave blank for Present)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="Leave empty for Present"
                placeholderTextColor={theme.textMuted}
                value={endDateInput}
                onChangeText={setEndDateInput}
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

      {/* MODAL 3: SALARY PROFILE & PAY CYCLE SETTINGS MODAL */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Salary Profile & Cycle Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Job Title / Position *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="e.g. Software Engineer"
                placeholderTextColor={theme.textMuted}
                value={settingsJobTitle}
                onChangeText={setSettingsJobTitle}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Employer / Company</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="e.g. S-Pay Operations"
                placeholderTextColor={theme.textMuted}
                value={settingsEmployer}
                onChangeText={setSettingsEmployer}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Base Monthly Salary (₱) *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="e.g. 50000"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={settingsBaseSalary}
                onChangeText={setSettingsBaseSalary}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Employment Start Date * (YYYY-MM-DD)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                ]}
                placeholder="2026-01-01"
                placeholderTextColor={theme.textMuted}
                value={settingsStartDate}
                onChangeText={setSettingsStartDate}
              />

              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Pay Cycle Frequency</Text>
              <View style={styles.frequencyPickerCol}>
                {[
                  { label: 'Semi-Monthly (10th & 25th)', value: 'SEMI_MONTHLY_10_25' },
                  { label: 'Semi-Monthly (15th & 30th)', value: 'SEMI_MONTHLY_15_30' },
                  { label: 'Monthly (End of Month)', value: 'MONTHLY_END' },
                  { label: 'Bi-Weekly (Every 2 Weeks)', value: 'BI_WEEKLY' },
                  { label: 'Custom Payday Override', value: 'CUSTOM' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.frequencyOptionBtn,
                      {
                        backgroundColor: settingsFrequency === opt.value ? theme.accentLight : isDarkMode ? '#1e293b' : '#f8fafc',
                        borderColor: settingsFrequency === opt.value ? theme.accent : theme.cardBorder,
                      },
                    ]}
                    onPress={() => setSettingsFrequency(opt.value)}
                  >
                    <Text
                      style={[
                        styles.frequencyOptionText,
                        { color: settingsFrequency === opt.value ? theme.accent : theme.textPrimary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {settingsFrequency === 'CUSTOM' && (
                <>
                  <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Custom Target Payday (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: theme.textPrimary, borderColor: theme.cardBorder },
                    ]}
                    placeholder="2026-08-01"
                    placeholderTextColor={theme.textMuted}
                    value={settingsCustomPayday}
                    onChangeText={setSettingsCustomPayday}
                  />
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.cardBorder }]}
                onPress={() => setSettingsModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: theme.accent }]}
                onPress={handleSaveSettingsSubmit}
                disabled={submittingSettings}
              >
                {submittingSettings ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Save Settings</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: DIGITAL PAYSLIP MODAL */}
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
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                    Official Digital Payslip
                  </Text>
                  <Text style={[styles.payslipRefId, { color: theme.textMuted }]}>
                    Ref ID: {selectedPayslip?.id || 'N/A'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setPayslipModalVisible(false)}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedPayslip && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={[styles.payslipStampBox, { backgroundColor: theme.accentLight }]}>
                  <Text style={styles.payslipStampCompany}>{salaryData?.employer?.toUpperCase() || 'S-PAY OPERATIONS'}</Text>
                  <Text style={[styles.payslipStampPosition, { color: theme.accent }]}>
                    {salaryData?.jobTitle || 'Position Unspecified'}
                  </Text>
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
                    {formatCurrency(selectedPayslip.expectedGross || (tax?.grossMonthly ? tax.grossMonthly / 2 : 0))}
                  </Text>
                </View>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>SSS Employee Share</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.textPrimary }]}>
                    -{formatCurrency(selectedPayslip.sssDeducted || (tax?.sss ? tax.sss / 2 : 0))}
                  </Text>
                </View>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>PhilHealth Share</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.textPrimary }]}>
                    -{formatCurrency(selectedPayslip.philhealthDeducted || (tax?.philhealth ? tax.philhealth / 2 : 0))}
                  </Text>
                </View>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>Pag-IBIG HDMF Share</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.textPrimary }]}>
                    -{formatCurrency(selectedPayslip.pagibigDeducted || (tax?.pagibig ? tax.pagibig / 2 : 0))}
                  </Text>
                </View>

                <View style={styles.payslipLineRow}>
                  <Text style={[styles.payslipLineLabel, { color: theme.textSecondary }]}>BIR Withholding Tax</Text>
                  <Text style={[styles.payslipLineVal, { color: theme.amber }]}>
                    -{formatCurrency(selectedPayslip.taxDeducted || (tax?.withholdingTax ? tax.withholdingTax / 2 : 0))}
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingBottom: 120,
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
    marginBottom: 12,
  },
  salaryFlipCol: {
    alignItems: 'center',
    gap: 4,
  },
  salaryFlipOuterWrap: {},
  salaryFlipCardOuter: {
    width: 52,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  salaryTopHalfContainer: {
    height: 30,
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    justifyContent: 'flex-start',
  },
  salaryTopText: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    height: 60,
    lineHeight: 60,
  },
  salaryBottomHalfContainer: {
    height: 30,
    overflow: 'hidden',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    justifyContent: 'flex-end',
  },
  salaryBottomText: {
    color: '#cbd5e1',
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    height: 60,
    lineHeight: 60,
    marginTop: -30,
  },
  salaryFlipCardDivider: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
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
  heroStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  heroStatusText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTargetProgressBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  heroTargetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroTargetTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  heroTargetPercent: {
    color: '#ff6b4a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ee4d2d',
    borderRadius: 3,
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
    flex: 1,
    marginRight: 6,
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
  taxRateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  taxRateBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
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
    fontSize: 14,
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
    marginBottom: 10,
  },
  bonusNoteText: {
    fontSize: 11,
    flex: 1,
    fontWeight: '600',
  },
  net13thMonthBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  net13thMonthLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  net13thMonthVal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  doleDeadlineBanner: {
    alignItems: 'center',
    marginTop: 4,
  },
  doleDeadlineText: {
    fontSize: 10,
    fontStyle: 'italic',
  },

  /* Cutoff info */
  scheduleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scheduleBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cutoffInfoContainer: {
    gap: 8,
  },
  cutoffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cutoffHighlightRow: {
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  cutoffLabel: {
    fontSize: 12,
  },
  cutoffVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  cutoffSubDetail: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: -2,
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
  ledgerDetailsSubRow: {
    marginTop: 2,
  },
  ledgerSubText: {
    fontSize: 10,
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
  frequencyPickerCol: {
    gap: 6,
    marginTop: 4,
  },
  frequencyOptionBtn: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  frequencyOptionText: {
    fontSize: 12,
    fontWeight: 'bold',
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
  payslipRefId: {
    fontSize: 10,
    marginTop: 1,
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
  payslipStampPosition: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
