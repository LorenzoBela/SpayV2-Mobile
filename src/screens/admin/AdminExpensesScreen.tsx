import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
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
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  ChevronLeft,
  Wallet,
  PiggyBank,
  Calendar,
  CreditCard,
  Plus,
  ArrowUpRight,
  TrendingDown,
  FileSpreadsheet,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  PieChart as PieIcon,
  Layers,
  Search,
  Filter,
  DollarSign,
  BarChart3,
  X,
  Zap,
  Trash2,
  ChevronUp,
  ChevronDown,
  List,
  LayoutGrid,
  RefreshCw,
  SlidersHorizontal,
  Share2,
  Download,
  Info,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import { useTabBarScroll } from '../../navigation/TabBarContext';
import { formatAmount } from '../../utils/money';
import { PremiumAlert } from '../../services/PremiumAlertService';
import {
  getExpensesDashboardData,
  postExpensesAction,
  ExpensesDashboardData,
  QuickShortcut,
  ExpenseInput,
  AtomeOrderInput,
  SPayOrderInput,
} from '../../services/expensesService';
import Svg, { Circle, Path, G, Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 3D Flip Card Configuration for Timers
const FLIP_PHASE_MS = 280;
const FLIP_TOTAL_MS = FLIP_PHASE_MS * 2;
const flipEaseIn = Easing.bezier(0.42, 0, 1, 1);
const flipEaseOut = Easing.bezier(0, 0, 0.58, 1);

interface ExpenseFlipCardProps {
  value: number | string;
  label?: string;
  isSecs?: boolean;
}

const ExpenseFlipCard = React.memo(function ExpenseFlipCard({ value, label, isSecs }: ExpenseFlipCardProps) {
  const format = (val: number | string) => String(val).padStart(2, '0');
  const newValue = format(value);
  const { isDarkMode } = useContext(ThemeContext);

  const [current, setCurrent] = useState(newValue);
  const [previous, setPrevious] = useState(newValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [topRevealed, setTopRevealed] = useState(false);

  const topFlipProgress = useRef(new RNAnimated.Value(1)).current;
  const bottomFlipProgress = useRef(new RNAnimated.Value(1)).current;
  const lastValueRef = useRef(newValue);
  const animTimerRef = useRef<any>(null);
  const revealTimerRef = useRef<any>(null);

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

  const cardBgTop = isSecs
    ? (isDarkMode ? '#2c1810' : '#ffe4e6')
    : (isDarkMode ? '#1e2538' : '#f1f5f9');
  const cardBgBottom = isSecs
    ? (isDarkMode ? '#22120a' : '#fecdd3')
    : (isDarkMode ? '#171d2c' : '#e2e8f0');
  const textColor = isSecs ? '#ff4f00' : (isDarkMode ? '#ffffff' : '#0f172a');
  const cardBorder = isSecs
    ? (isDarkMode ? 'rgba(255, 79, 0, 0.4)' : 'rgba(238, 77, 45, 0.4)')
    : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');

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
    <View style={styles.flipCardWrapper}>
      <View style={[styles.flipCardContainer, { borderColor: cardBorder }]}>
        {/* Top static background */}
        <View style={[styles.flipHalf, styles.flipHalfTop, { backgroundColor: cardBgTop }]}>
          <Text style={[styles.flipDigitText, styles.flipDigitTop, { color: textColor }]}>
            {topStaticValue}
          </Text>
        </View>

        {/* Bottom static background */}
        <View style={[styles.flipHalf, styles.flipHalfBottom, { backgroundColor: cardBgBottom }]}>
          <Text style={[styles.flipDigitText, styles.flipDigitBottom, { color: textColor }]}>
            {bottomStaticValue}
          </Text>
        </View>

        {/* Top animated flap */}
        {activeFlip && (
          <RNAnimated.View
            style={[
              styles.flipHalf,
              styles.flipHalfTop,
              styles.flipFlap,
              {
                backgroundColor: cardBgTop,
                transform: [{ perspective: 400 }, { rotateX: rotateTop }],
                opacity: opacityTop,
              },
            ]}
          >
            <Text style={[styles.flipDigitText, styles.flipDigitTop, { color: textColor }]}>
              {previous}
            </Text>
          </RNAnimated.View>
        )}

        {/* Bottom animated flap */}
        {activeFlip && (
          <RNAnimated.View
            style={[
              styles.flipHalf,
              styles.flipHalfBottom,
              styles.flipFlap,
              {
                backgroundColor: cardBgBottom,
                transform: [{ perspective: 400 }, { rotateX: rotateBottom }],
                opacity: opacityBottom,
              },
            ]}
          >
            <Text style={[styles.flipDigitText, styles.flipDigitBottom, { color: textColor }]}>
              {current}
            </Text>
          </RNAnimated.View>
        )}

        {/* Middle crease divider */}
        <View style={styles.flipDividerLine} />
      </View>

      {label ? (
        <Text style={[styles.flipLabelText, { color: isSecs ? '#ff4f00' : (isDarkMode ? '#94a3b8' : '#64748b') }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
});

export function getOrdinalSuffix(day: number): string {
  const d = Math.abs(day);
  const j = d % 10;
  const k = d % 100;
  if (j === 1 && k !== 11) return `${d}st`;
  if (j === 2 && k !== 12) return `${d}nd`;
  if (j === 3 && k !== 13) return `${d}rd`;
  return `${d}th`;
}

function formatTermType(termType: string): string {
  const map: Record<string, string> = {
    'PAY_LATER_40D': '⚡ Pay Later 40D',
    'INSTALLMENT_3M': '📅 3-Month Plan',
    'INSTALLMENT_6M': '🚀 6-Month Plan',
    'INSTALLMENT_12M': '💳 12-Month Plan',
  };
  return map[termType] || termType.replace(/_/g, ' ');
}

export default function AdminExpensesScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const scrollHandler = useTabBarScroll();

  const [data, setData] = useState<ExpensesDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'atome' | 'timeline' | 'ledger'>('overview');

  // Interactive Wallet Deck Index
  const [activeWalletCardIndex, setActiveWalletCardIndex] = useState(0);

  // Month filter mode & countdowns
  const [monthFilterMode, setMonthFilterMode] = useState<'CURRENT_FUTURE' | 'ALL' | 'UNPAID_ONLY' | 'PAID_ONLY'>('CURRENT_FUTURE');
  const [expandedMonthCards, setExpandedMonthCards] = useState<Record<string, boolean>>({});

  // Hero Countdown timer
  const [heroCountdown, setHeroCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    hasTarget: false,
    isOverdue: false,
    title: '',
    dueDateStr: '',
  });

  // Atome Tab Filter & Multi-Select
  const [atomeViewMode, setAtomeViewMode] = useState<'cards' | 'list'>('cards');
  const [atomeSearchQuery, setAtomeSearchQuery] = useState('');
  const [atomeFilterTerm, setAtomeFilterTerm] = useState('all');
  const [atomeFilterStatus, setAtomeFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [selectedAtomePaymentIds, setSelectedAtomePaymentIds] = useState<string[]>([]);
  const [atomeCurrentPage, setAtomeCurrentPage] = useState(1);
  const atomePerPage = 10;

  // Ledger Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('ALL');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [ledgerPage, setLedgerPage] = useState(1);
  const ledgerPerPage = 15;

  // Reports Tab
  const [reportPage, setReportPage] = useState(1);
  const reportPerPage = 15;

  // Shortcuts
  const [shortcutsList, setShortcutsList] = useState<QuickShortcut[]>([]);
  const [newShortcut, setNewShortcut] = useState<Omit<QuickShortcut, 'id'>>({
    emoji: '🚌',
    title: '',
    amount: 13,
    category: 'Transportation',
    paymentSource: 'CASH',
    expenseType: 'NEED',
  });

  // Modals States
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showManageCash, setShowManageCash] = useState(false);
  const [showManageShortcuts, setShowManageShortcuts] = useState(false);
  const [showTransferIpon, setShowTransferIpon] = useState(false);
  const [showAddAtome, setShowAddAtome] = useState(false);
  const [atomeModalMode, setAtomeModalMode] = useState<'single' | 'bulk'>('single');
  const [showScheduleSPay, setShowScheduleSPay] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSalaryInflowModal, setShowSalaryInflowModal] = useState(false);
  const [showExportCsvModal, setShowExportCsvModal] = useState(false);
  const [lastSalaryDeposit, setLastSalaryDeposit] = useState<{ amount: number; dest: string } | null>(null);

  // Single & Bulk Payment Modals
  const [payAtomeModal, setPayAtomeModal] = useState<{
    isOpen: boolean;
    paymentId: string;
    merchantName: string;
    monthNumber: number;
    totalMonths?: number;
    amount: number;
    dueDate: string;
    paymentSource: 'CASH' | 'BANK' | 'GCASH' | 'MARIBANK' | 'BDO';
  } | null>(null);

  const [bulkPayAtomeModal, setBulkPayAtomeModal] = useState<{
    isOpen: boolean;
    count: number;
    totalAmount: number;
    paymentSource: 'CASH' | 'BANK' | 'GCASH' | 'MARIBANK' | 'BDO';
  } | null>(null);

  // Forms
  const [expenseForm, setExpenseForm] = useState<ExpenseInput>({
    title: '',
    amount: 0,
    category: 'General',
    paymentSource: 'CASH',
    expenseType: 'WANT',
    notes: '',
  });

  const [cashForm, setCashForm] = useState({
    cashOnHand: 0,
    bdoBalance: 0,
    maribankBalance: 0,
    gcashBalance: 0,
  });

  const [iponForm, setIponForm] = useState<{
    goalId: string;
    amount: number;
    note: string;
    source: 'CASH' | 'MARIBANK' | 'BDO' | 'GCASH';
  }>({
    goalId: '',
    amount: 0,
    note: '',
    source: 'CASH',
  });

  const [atomeForm, setAtomeForm] = useState<AtomeOrderInput>({
    merchantName: '',
    totalAmount: 0,
    termType: 'INSTALLMENT_3M',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
    markAllPaid: false,
  });

  const [bulkAtomeRows, setBulkAtomeRows] = useState<AtomeOrderInput[]>([
    { merchantName: '', totalAmount: 0, termType: 'INSTALLMENT_3M', purchaseDate: new Date().toISOString().split('T')[0], markAllPaid: true, notes: '' },
    { merchantName: '', totalAmount: 0, termType: 'INSTALLMENT_3M', purchaseDate: new Date().toISOString().split('T')[0], markAllPaid: true, notes: '' },
  ]);

  const [spayForm, setSpayForm] = useState<SPayOrderInput>({
    itemName: '',
    amount: 0,
    installmentMonths: 3,
    category: 'General',
    remarks: '',
  });

  const [configForm, setConfigForm] = useState({
    spayCutoffDay: 25,
    spayDueDay: 15,
    spayCreditLimit: 50000,
    atomeCutoffDay: 25,
    atomeDueDay: 12,
    atomeCreditLimit: 30000,
  });

  // Fetch Data Function
  const loadData = useCallback(async (force = false) => {
    try {
      const res = await getExpensesDashboardData(force);
      setData(res);
      setShortcutsList(res.quickShortcuts || []);
      setCashForm({
        cashOnHand: res.balances.cashOnHand,
        bdoBalance: res.balances.bdoBalance || res.balances.bankBalance,
        maribankBalance: res.balances.maribankBalance || 0,
        gcashBalance: res.balances.gcashBalance,
      });
      setConfigForm({
        spayCutoffDay: res.billsSummary.spayCutoffDay || 25,
        spayDueDay: res.billsSummary.spayDueDay || 15,
        spayCreditLimit: res.billsSummary.spayCreditLimit || 50000,
        atomeCutoffDay: res.billsSummary.atomeCutoffDay || 25,
        atomeDueDay: res.billsSummary.atomeDueDay || 12,
        atomeCreditLimit: res.billsSummary.atomeCreditLimit || 30000,
      });
    } catch (e) {
      console.error('Error loading expenses data:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData(true);
  }, [loadData]);

  // Timer updater for hero countdown & next deadline
  useEffect(() => {
    if (!data) return;
    const upcoming = (data.upcomingPlannedPayments || []).filter((p) => !p.isPaid);
    if (upcoming.length === 0) {
      // Fallback to Next Payday countdown
      const nextPayday = new Date(data.payday.nextPaydayIso || Date.now());
      const updateFallbackTimer = () => {
        const now = new Date();
        const diffMs = nextPayday.getTime() - now.getTime();
        if (diffMs <= 0) {
          setHeroCountdown({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            hasTarget: true,
            isOverdue: false,
            title: 'Payday is Today!',
            dueDateStr: nextPayday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          });
        } else {
          setHeroCountdown({
            days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
            hasTarget: true,
            isOverdue: false,
            title: 'Next Payday Inflow',
            dueDateStr: nextPayday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          });
        }
      };
      updateFallbackTimer();
      const timer = setInterval(updateFallbackTimer, 1000);
      return () => clearInterval(timer);
    }

    const nextPayment = upcoming[0];
    const targetDate = new Date(nextPayment.dueDate);

    const updateTimer = () => {
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      if (diffMs <= 0) {
        setHeroCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          hasTarget: true,
          isOverdue: true,
          title: nextPayment.title,
          dueDateStr: targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        });
      } else {
        setHeroCountdown({
          days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
          hasTarget: true,
          isOverdue: false,
          title: nextPayment.title,
          dueDateStr: targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [data]);

  // Micro adjustments on Cash on Hand
  const handleMicroAdjustCash = async (delta: number) => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newCash = Math.max(0, data.balances.cashOnHand + delta);
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      const newTotalLiquid = newCash + prev.balances.bdoBalance + prev.balances.maribankBalance + prev.balances.gcashBalance;
      return {
        ...prev,
        balances: {
          ...prev.balances,
          cashOnHand: newCash,
          totalLiquidCash: newTotalLiquid,
          totalPhysicalCash: newCash + (prev.balances.iponSavingsBySource?.CASH || 0),
        },
      };
    });

    try {
      const res = await postExpensesAction('update-cash', {
        cashOnHand: newCash,
        bankBalance: data.balances.bankBalance,
        gcashBalance: data.balances.gcashBalance,
        bdoBalance: data.balances.bdoBalance,
        maribankBalance: data.balances.maribankBalance,
      });
      if (res.data) setData(res.data);
    } catch (e) {
      console.error('Micro adjustment failed:', e);
      loadData(true);
    }
  };

  // 1-Tap Trigger Shortcut
  const handleTriggerShortcut = async (sc: QuickShortcut) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await postExpensesAction('add-expense', {
        expense: {
          title: sc.title,
          amount: sc.amount,
          category: sc.category,
          paymentSource: sc.paymentSource,
          expenseType: sc.expenseType,
          notes: `Recorded via 1-Tap Shortcut (${sc.emoji} ${sc.title})`,
        },
      });
      if (res.success && res.data) {
        setData(res.data);
        PremiumAlert.alert('Expense Recorded', `Successfully recorded ₱${sc.amount} for ${sc.emoji} ${sc.title}!`);
      }
    } catch (e) {
      console.error('Failed to trigger shortcut:', e);
    }
  };

  // Settle single Atome payment
  const handleConfirmPayAtome = async () => {
    if (!payAtomeModal) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const src = payAtomeModal.paymentSource === 'MARIBANK' || payAtomeModal.paymentSource === 'BDO' ? 'BANK' : payAtomeModal.paymentSource;
      const res = await postExpensesAction('pay-atome-installment', {
        paymentId: payAtomeModal.paymentId,
        amount: payAtomeModal.amount,
        paymentSource: src,
      });
      if (res.success && res.data) {
        setData(res.data);
        setPayAtomeModal(null);
        PremiumAlert.alert('Payment Recorded', `₱${payAtomeModal.amount.toLocaleString()} marked as paid for ${payAtomeModal.merchantName}!`);
      }
    } catch (e: any) {
      PremiumAlert.alert('Payment Failed', e?.message || 'Could not settle payment');
    } finally {
      setIsLoading(false);
    }
  };

  // Settle bulk Atome payments
  const handleConfirmBulkPayAtome = async () => {
    if (!bulkPayAtomeModal || selectedAtomePaymentIds.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsLoading(true);
    try {
      const src = bulkPayAtomeModal.paymentSource === 'MARIBANK' || bulkPayAtomeModal.paymentSource === 'BDO' ? 'BANK' : bulkPayAtomeModal.paymentSource;
      const res = await postExpensesAction('bulk-pay-atome', {
        paymentIds: selectedAtomePaymentIds,
        paymentSource: src,
      });
      if (res.success && res.data) {
        setData(res.data);
        setSelectedAtomePaymentIds([]);
        setBulkPayAtomeModal(null);
        PremiumAlert.alert('Bulk Payments Settled', `Marked ${bulkPayAtomeModal.count} installments (₱${bulkPayAtomeModal.totalAmount.toLocaleString()}) as paid!`);
      }
    } catch (e: any) {
      PremiumAlert.alert('Bulk Pay Failed', e?.message || 'Could not settle bulk payments');
    } finally {
      setIsLoading(false);
    }
  };

  // Receive Salary Inflow
  const handleReceiveSalary = async (dest: 'CASH' | 'BANK' | 'GCASH' | 'BDO' | 'MARIBANK') => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const amt = data.payday.expectedPaydayIncome || 15000;
    setIsLoading(true);
    try {
      const res = await postExpensesAction('receive-salary', {
        amount: amt,
        destination: dest,
        notes: 'Payday Salary Deposit',
      });
      if (res.success && res.data) {
        setData(res.data);
        setLastSalaryDeposit({ amount: amt, dest });
        setShowSalaryInflowModal(false);
        PremiumAlert.alert('Salary Deposited', `₱${amt.toLocaleString()} payday salary credited to ${dest}!`);
      }
    } catch (e: any) {
      PremiumAlert.alert('Inflow Failed', e?.message || 'Could not record salary inflow');
    } finally {
      setIsLoading(false);
    }
  };

  // Reverse Salary Inflow
  const handleUndoSalary = async () => {
    if (!lastSalaryDeposit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await postExpensesAction('reverse-salary', {
        amount: lastSalaryDeposit.amount,
        destination: lastSalaryDeposit.dest,
      });
      if (res.success && res.data) {
        setData(res.data);
        setLastSalaryDeposit(null);
        PremiumAlert.alert('Salary Inflow Reversed', `Reversed ₱${lastSalaryDeposit.amount.toLocaleString()} from ${lastSalaryDeposit.dest}.`);
      }
    } catch (e: any) {
      PremiumAlert.alert('Undo Failed', e?.message || 'Could not reverse salary');
    } finally {
      setIsLoading(false);
    }
  };

  // CSV Export
  const handleExportCSV = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await postExpensesAction('export-csv');
      if (res.success && res.csv) {
        const fileUri = `${FileSystem.documentDirectory}spay_expenses_${new Date().toISOString().split('T')[0]}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, res.csv, { encoding: FileSystem.EncodingType.UTF8 });
        setShowExportCsvModal(false);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Expenses & Payment History CSV',
          });
        } else {
          PremiumAlert.alert('Export Complete', `Saved to ${fileUri}`);
        }
      }
    } catch (e) {
      PremiumAlert.alert('Export Error', 'Failed to generate CSV export');
    }
  };

  // Colors & Theme Tokens
  const t = {
    bg: isDarkMode ? '#070a12' : '#f8fafc',
    surface: isDarkMode ? '#0f1422' : '#ffffff',
    surfaceCard: isDarkMode ? '#141b2d' : '#ffffff',
    surfaceNested: isDarkMode ? '#1a2238' : '#f1f5f9',
    border: isDarkMode ? '#1e293b' : '#e2e8f0',
    borderLight: isDarkMode ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    primary: '#ee4d2d',
    primaryLight: 'rgba(238, 77, 45, 0.12)',
    success: '#10b981',
    successLight: 'rgba(16, 185, 129, 0.12)',
    warning: '#f59e0b',
    warningLight: 'rgba(245, 158, 11, 0.12)',
    danger: '#ef4444',
    dangerLight: 'rgba(239, 68, 68, 0.12)',
    accentAtome: '#FFD700',
  };

  // Wallet Deck Cards Definition
  const walletCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        id: 'bdo',
        code: 'BDO',
        name: 'BDO UNIBANK - PAYROLL',
        accountMask: '•••• 8829',
        balance: data.balances.totalBDO ?? (data.balances.bdoBalance || data.balances.bankBalance),
        liquidAmount: data.balances.bdoBalance || data.balances.bankBalance,
        savingsAmount: data.balances.iponSavingsBySource?.BDO || 0,
        bgColor: '#002855',
        textColor: '#ffffff',
        accentColor: '#FFC20E',
        roleBadge: '⚡ Payroll Receiver (Primary Salary Drop)',
        type: 'BANK_ACCOUNT',
      },
      {
        id: 'maribank',
        code: 'MARIBANK',
        name: 'MARIBANK - DIGITAL SAVINGS',
        accountMask: '•••• 4102',
        balance: data.balances.totalMariBank ?? (data.balances.maribankBalance || 0),
        liquidAmount: data.balances.maribankBalance || 0,
        savingsAmount: data.balances.iponSavingsBySource?.MARIBANK || 0,
        bgColor: '#FF4F00',
        textColor: '#ffffff',
        accentColor: '#ffffff',
        roleBadge: '🛡️ Savings Vault (Payroll Target)',
        type: 'DIGITAL_BANK',
      },
      {
        id: 'gcash',
        code: 'GCASH',
        name: 'GCASH - DAILY WALLET',
        accountMask: '0917 •••• 888',
        balance: data.balances.totalGCash ?? data.balances.gcashBalance,
        liquidAmount: data.balances.gcashBalance,
        savingsAmount: data.balances.iponSavingsBySource?.GCASH || 0,
        bgColor: '#007DFE',
        textColor: '#ffffff',
        accentColor: '#60A5FA',
        roleBadge: '☕ Everyday Micro-Spend Wallet',
        type: 'E_WALLET',
      },
      {
        id: 'spay',
        code: 'SPAY',
        name: 'SHOPEE SPAYLATER',
        accountMask: `LIMIT ₱${data.billsSummary.spayCreditLimit.toLocaleString()}`,
        balance: Math.max(0, data.billsSummary.spayCreditLimit - data.billsSummary.spayUsedCredit),
        usedCredit: data.billsSummary.spayUsedCredit,
        totalLimit: data.billsSummary.spayCreditLimit,
        bgColor: '#EE4D2D',
        textColor: '#ffffff',
        accentColor: '#FDE047',
        roleBadge: '🛍️ Buy Now Pay Later (Global Limit)',
        type: 'BNPL_CREDIT',
      },
      {
        id: 'atome',
        code: 'ATOME',
        name: 'ATOME CARD PAYLATER',
        accountMask: `LIMIT ₱${data.billsSummary.atomeCreditLimit.toLocaleString()}`,
        balance: Math.max(0, data.billsSummary.atomeCreditLimit - data.billsSummary.atomeUsedCredit),
        usedCredit: data.billsSummary.atomeUsedCredit,
        totalLimit: data.billsSummary.atomeCreditLimit,
        bgColor: '#181818',
        textColor: '#ffffff',
        accentColor: '#FDD835',
        roleBadge: '💳 40-Day Pay Later / 0% Interest',
        type: 'CREDIT_CARD',
      },
      {
        id: 'cash',
        code: 'CASH',
        name: 'PHYSICAL CASH ON HAND',
        accountMask: 'WALLETS & SAFE (PHYSICAL)',
        balance: data.balances.totalPhysicalCash ?? data.balances.cashOnHand,
        liquidAmount: data.balances.cashOnHand,
        savingsAmount: data.balances.iponSavingsBySource?.CASH || 0,
        bgColor: '#059669',
        textColor: '#ffffff',
        accentColor: '#34D399',
        roleBadge: '💵 Physical Money, Safe & Alkansya',
        type: 'PHYSICAL_CASH',
      },
    ];
  }, [data]);

  // Filtered History for Ledger
  const filteredHistory = useMemo(() => {
    if (!data?.paymentHistory) return [];
    return data.paymentHistory.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || (item.notes && item.notes.toLowerCase().includes(q));
      const matchesSource = filterSource === 'ALL' || item.source === filterSource;
      const matchesStatus = ledgerStatusFilter === 'ALL' || (ledgerStatusFilter === 'PAID' && item.status !== 'UNPAID') || (ledgerStatusFilter === 'UNPAID' && item.status === 'UNPAID');
      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [data?.paymentHistory, searchQuery, filterSource, ledgerStatusFilter]);

  // Filtered Atome Orders
  const filteredAtomeOrders = useMemo(() => {
    if (!data?.atomeOrders) return [];
    return data.atomeOrders.filter((order) => {
      const q = atomeSearchQuery.toLowerCase();
      const matchesSearch = !q || order.merchantName.toLowerCase().includes(q);
      const matchesTerm = atomeFilterTerm === 'all' || order.termType === atomeFilterTerm;
      const isFullyPaid = order.payments.every((p) => p.isPaid);
      const matchesStatus = atomeFilterStatus === 'all' || (atomeFilterStatus === 'paid' && isFullyPaid) || (atomeFilterStatus === 'unpaid' && !isFullyPaid);
      return matchesSearch && matchesTerm && matchesStatus;
    });
  }, [data?.atomeOrders, atomeSearchQuery, atomeFilterTerm, atomeFilterStatus]);

  if (isLoading && !data) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color="#ee4d2d" />
        <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading Expenses & Master Dashboard...</Text>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const currentWallet = walletCards[activeWalletCardIndex] || walletCards[0];
  const nextMonthDues = data.billsSummary.unpaidBillsMonthlyBreakdown?.[0];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.surface} />

      {/* HEADER BAR */}
      <View style={[styles.headerBar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={20} color={t.textPrimary} />
          </TouchableOpacity>
          <View>
            <View style={styles.badgeRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.badgeText}>S-PAY ADMIN</Text>
            </View>
            <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Expenses & Cash Master</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            onPress={() => setShowExportCsvModal(true)}
            activeOpacity={0.7}
          >
            <FileSpreadsheet size={16} color={t.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            onPress={() => setShowConfig(true)}
            activeOpacity={0.7}
          >
            <Settings size={16} color={t.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <RefreshCw size={16} color={t.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Sparkles size={16} color="#fbbf24" />
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN SCROLL VIEW */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          layout.scrollContentStyle,
          { paddingBottom: insets.bottom + 110 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ee4d2d" />}
        {...scrollHandler}
      >
        {/* 1. TOP STATS BAR HORIZONTAL CAROUSEL */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsBarContainer}
        >
          {/* Stat 1: Cash Right Now */}
          <View style={[styles.statCapsule, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.statCapsuleHeader}>
              <Text style={[styles.statCapsuleLabel, { color: t.textMuted }]}>CASH RIGHT NOW</Text>
              <Wallet size={14} color="#10b981" />
            </View>
            <Text style={[styles.statCapsuleValue, { color: t.textPrimary }]}>
              ₱{data.balances.totalLiquidCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              BDO: ₱{(data.balances.bdoBalance || data.balances.bankBalance).toLocaleString()} • MariBank: ₱{(data.balances.maribankBalance || 0).toLocaleString()}
            </Text>
          </View>

          {/* Stat 2: SPay Bill */}
          <View style={[styles.statCapsule, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.statCapsuleHeader}>
              <Text style={[styles.statCapsuleLabel, { color: t.textMuted }]}>SPAY UNPAID BILLS</Text>
              <CreditCard size={14} color="#ee4d2d" />
            </View>
            <Text style={[styles.statCapsuleValue, { color: '#ee4d2d' }]}>
              ₱{data.billsSummary.spayTotalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              {data.billsSummary.spayCreditUtilizationPct}% of ₱{data.billsSummary.spayCreditLimit.toLocaleString()} Limit
            </Text>
          </View>

          {/* Stat 3: Atome Bill */}
          <View style={[styles.statCapsule, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.statCapsuleHeader}>
              <Text style={[styles.statCapsuleLabel, { color: t.textMuted }]}>ATOME CARD BILL</Text>
              <CreditCard size={14} color="#f59e0b" />
            </View>
            <Text style={[styles.statCapsuleValue, { color: '#f59e0b' }]}>
              ₱{data.billsSummary.atomeTotalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              {data.billsSummary.creditUtilizationPct}% of ₱{data.billsSummary.atomeCreditLimit.toLocaleString()} Limit
            </Text>
          </View>

          {/* Stat 4: Upcoming Monthly Dues */}
          <View style={[styles.statCapsule, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.statCapsuleHeader}>
              <Text style={[styles.statCapsuleLabel, { color: t.textMuted }]}>
                {nextMonthDues ? `${nextMonthDues.month.toUpperCase()} DUES` : 'UPCOMING DUES'}
              </Text>
              <Calendar size={14} color="#8b5cf6" />
            </View>
            <Text style={[styles.statCapsuleValue, { color: t.textPrimary }]}>
              ₱{(nextMonthDues?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              SPay: ₱{(nextMonthDues?.spay || 0).toLocaleString()} • Atome: ₱{(nextMonthDues?.atome || 0).toLocaleString()}
            </Text>
          </View>

          {/* Stat 5: Ipon Saved */}
          <View style={[styles.statCapsule, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.statCapsuleHeader}>
              <Text style={[styles.statCapsuleLabel, { color: t.textMuted }]}>TOTAL IPON SAVINGS</Text>
              <PiggyBank size={14} color="#10b981" />
            </View>
            <Text style={[styles.statCapsuleValue, { color: '#10b981' }]}>
              ₱{data.balances.totalIponSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              Safe Cash: ₱{(data.balances.iponSavingsBySource?.CASH || 0).toLocaleString()} • Vault: ₱{(data.balances.iponSavingsBySource?.MARIBANK || 0).toLocaleString()}
            </Text>
          </View>
        </ScrollView>

        {/* 2. 3D FLIP CARD COUNTDOWN TIMER */}
        <View style={[styles.heroCountdownCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.countdownTitleRow}>
            <Clock size={16} color={heroCountdown.isOverdue ? '#ef4444' : '#ee4d2d'} />
            <Text style={[styles.countdownHeaderLabel, { color: heroCountdown.isOverdue ? '#ef4444' : t.textSecondary }]}>
              {heroCountdown.isOverdue ? 'PAYMENT DEADLINE OVERDUE' : (heroCountdown.title || 'PAYDAY COUNTDOWN')}
            </Text>
          </View>

          <View style={styles.flipCardsRow}>
            <ExpenseFlipCard value={heroCountdown.days} label="DAYS" />
            <View style={styles.colonSeparator}>
              <View style={[styles.colonDot, { backgroundColor: t.textMuted }]} />
              <View style={[styles.colonDot, { backgroundColor: t.textMuted }]} />
            </View>
            <ExpenseFlipCard value={heroCountdown.hours} label="HOURS" />
            <View style={styles.colonSeparator}>
              <View style={[styles.colonDot, { backgroundColor: t.textMuted }]} />
              <View style={[styles.colonDot, { backgroundColor: t.textMuted }]} />
            </View>
            <ExpenseFlipCard value={heroCountdown.minutes} label="MINS" />
            <View style={styles.colonSeparator}>
              <View style={[styles.colonDot, { backgroundColor: t.textMuted }]} />
              <View style={[styles.colonDot, { backgroundColor: t.textMuted }]} />
            </View>
            <ExpenseFlipCard value={heroCountdown.seconds} label="SECS" isSecs />
          </View>

          <View style={styles.countdownFooterRow}>
            <View style={[styles.inflowPill, { backgroundColor: isDarkMode ? '#1a2920' : '#e6f4ea' }]}>
              <Sparkles size={12} color="#10b981" />
              <Text style={styles.inflowPillText}>+₱{data.payday.expectedPaydayIncome.toLocaleString()} Salary Inflow</Text>
            </View>
            <Text style={[styles.runwayText, { color: t.textMuted }]}>
              Runway: <Text style={{ color: t.textPrimary, fontFamily: 'Jakarta-Bold' }}>{data.insights.cashRunwayDays} Days</Text>
            </Text>
          </View>
        </View>

        {/* 3. CASH ON HAND BANNER WITH QUICK MICRO-ADJUSTMENTS */}
        <View style={[styles.cashOnHandBanner, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.cashBannerTopRow}>
            <View>
              <Text style={[styles.cashBannerSub, { color: t.textMuted }]}>LIQUID CASH ON HAND</Text>
              <Text style={[styles.cashBannerMain, { color: t.textPrimary }]}>
                ₱{data.balances.cashOnHand.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.cashBannerActions}>
              <TouchableOpacity
                style={[styles.smallActionPill, { backgroundColor: '#ee4d2d' }]}
                onPress={() => setShowAddExpense(true)}
              >
                <Plus size={14} color="#fff" />
                <Text style={styles.smallActionPillText}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallActionPill, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}
                onPress={() => setShowManageCash(true)}
              >
                <Settings size={14} color={t.textPrimary} />
                <Text style={[styles.smallActionPillText, { color: t.textPrimary }]}>Balances</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Micro Adjust Buttons */}
          <Text style={[styles.microAdjustLabel, { color: t.textMuted }]}>Quick Micro-Adjustments (1-Tap Fast Sync):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.microAdjustRow}>
            <TouchableOpacity style={styles.microChipPlus} onPress={() => handleMicroAdjustCash(100)}>
              <Text style={styles.microChipPlusText}>+₱100</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.microChipPlus} onPress={() => handleMicroAdjustCash(500)}>
              <Text style={styles.microChipPlusText}>+₱500</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.microChipPlus} onPress={() => handleMicroAdjustCash(1000)}>
              <Text style={styles.microChipPlusText}>+₱1,000</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.microChipPlus} onPress={() => handleMicroAdjustCash(5000)}>
              <Text style={styles.microChipPlusText}>+₱5,000</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.microChipMinus} onPress={() => handleMicroAdjustCash(-100)}>
              <Text style={styles.microChipMinusText}>-₱100</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.microChipMinus} onPress={() => handleMicroAdjustCash(-500)}>
              <Text style={styles.microChipMinusText}>-₱500</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.microChipMinus} onPress={() => handleMicroAdjustCash(-1000)}>
              <Text style={styles.microChipMinusText}>-₱1,000</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 4. DIGITAL WALLET CARDS CAROUSEL / DECK */}
        <View style={[styles.walletDeckContainer, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.deckHeader}>
            <View>
              <Text style={[styles.deckTitle, { color: t.textPrimary }]}>Digital Wallet Collection</Text>
              <Text style={[styles.deckSubtitle, { color: t.textMuted }]}>Interactive holding cards & payment channels</Text>
            </View>
            <View style={styles.deckDotsRow}>
              {walletCards.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.deckDot,
                    { backgroundColor: i === activeWalletCardIndex ? '#ee4d2d' : (isDarkMode ? '#334155' : '#cbd5e1') },
                    i === activeWalletCardIndex && styles.deckDotActive,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Swipeable Card Carousel */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 48));
              setActiveWalletCardIndex(idx);
            }}
            contentContainerStyle={styles.cardsScrollView}
          >
            {walletCards.map((c) => (
              <View
                key={c.id}
                style={[
                  styles.walletCardFrame,
                  { backgroundColor: c.bgColor, width: SCREEN_WIDTH - 56 },
                ]}
              >
                {/* Chip & Role Badge */}
                <View style={styles.walletCardTop}>
                  <View style={styles.cardGoldChip}>
                    <View style={styles.chipInner} />
                  </View>
                  <View style={styles.roleBadgeCapsule}>
                    <Text style={styles.roleBadgeText} numberOfLines={1}>{c.roleBadge}</Text>
                  </View>
                </View>

                {/* Account Name & Mask */}
                <View style={styles.cardMid}>
                  <Text style={styles.cardNameText}>{c.name}</Text>
                  <Text style={styles.cardMaskText}>{c.accountMask}</Text>
                </View>

                {/* Balance & Limits */}
                <View style={styles.cardBalanceSection}>
                  <Text style={styles.cardBalanceLabel}>
                    {c.code === 'SPAY' || c.code === 'ATOME' ? 'AVAILABLE CREDIT' : 'TOTAL HOLDING BALANCE'}
                  </Text>
                  <Text style={styles.cardBalanceValue}>
                    ₱{c.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                  {c.usedCredit !== undefined ? (
                    <Text style={styles.cardSubDetails}>
                      Used: ₱{c.usedCredit.toLocaleString()} / Limit: ₱{(c.totalLimit || 0).toLocaleString()}
                    </Text>
                  ) : c.savingsAmount !== undefined ? (
                    <Text style={styles.cardSubDetails}>
                      Liquid: ₱{(c.liquidAmount || 0).toLocaleString()} • Ipon: ₱{c.savingsAmount.toLocaleString()}
                    </Text>
                  ) : null}
                </View>

                {/* Quick Card Action Buttons */}
                <View style={styles.cardActionFooter}>
                  {c.code === 'BDO' || c.code === 'MARIBANK' || c.code === 'GCASH' || c.code === 'CASH' ? (
                    <>
                      <TouchableOpacity
                        style={styles.cardActionBtnPrimary}
                        onPress={() => {
                          setShowSalaryInflowModal(true);
                        }}
                      >
                        <Text style={styles.cardActionBtnTextPrimary}>📥 Salary</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cardActionBtnSecondary}
                        onPress={() => {
                          setIponForm((prev) => ({ ...prev, source: c.code as any }));
                          setShowTransferIpon(true);
                        }}
                      >
                        <Text style={styles.cardActionBtnTextSecondary}>🔒 Save Ipon</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                  {c.code === 'SPAY' ? (
                    <TouchableOpacity
                      style={styles.cardActionBtnPrimary}
                      onPress={() => setShowScheduleSPay(true)}
                    >
                      <Text style={styles.cardActionBtnTextPrimary}>🛒 Schedule Plan</Text>
                    </TouchableOpacity>
                  ) : null}
                  {c.code === 'ATOME' ? (
                    <TouchableOpacity
                      style={styles.cardActionBtnPrimary}
                      onPress={() => setShowAddAtome(true)}
                    >
                      <Text style={styles.cardActionBtnTextPrimary}>💳 Add Plan</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.cardActionBtnSecondary}
                    onPress={() => {
                      setExpenseForm((prev) => ({ ...prev, paymentSource: c.code as any }));
                      setShowAddExpense(true);
                    }}
                  >
                    <Text style={styles.cardActionBtnTextSecondary}>+ Expense</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 5. 1-TAP DAILY SHORTCUTS ROW */}
        <View style={[styles.shortcutsContainer, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.shortcutsHeader}>
            <View style={styles.shortcutsHeaderLeft}>
              <Zap size={16} color="#f59e0b" />
              <Text style={[styles.shortcutsTitle, { color: t.textPrimary }]}>1-Tap Daily Shortcuts</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowManageShortcuts(true)}
              style={[styles.customizeShortcutsBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
            >
              <Settings size={12} color={t.textSecondary} />
              <Text style={[styles.customizeShortcutsText, { color: t.textSecondary }]}>Customize</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsScroll}>
            {shortcutsList.map((sc) => (
              <TouchableOpacity
                key={sc.id}
                style={[styles.shortcutChip, { backgroundColor: isDarkMode ? '#182032' : '#ffffff', borderColor: t.border }]}
                onPress={() => handleTriggerShortcut(sc)}
                activeOpacity={0.7}
              >
                <Text style={styles.shortcutEmoji}>{sc.emoji}</Text>
                <View>
                  <Text style={[styles.shortcutTitle, { color: t.textPrimary }]}>{sc.title}</Text>
                  <Text style={styles.shortcutPrice}>₱{sc.amount.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.addShortcutChip, { borderColor: t.border }]}
              onPress={() => setShowManageShortcuts(true)}
            >
              <Plus size={14} color={t.textMuted} />
              <Text style={[styles.addShortcutText, { color: t.textMuted }]}>Add</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 6. TAB SELECTOR */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContainer}>
          {[
            { key: 'overview', label: 'Overview & Analytics', icon: PieIcon },
            { key: 'reports', label: 'Expense Reports', icon: BarChart3 },
            { key: 'atome', label: `Atome Plans (${data.atomeOrders.length})`, icon: CreditCard },
            { key: 'timeline', label: `Timeline (${data.upcomingPlannedPayments.length})`, icon: Clock },
            { key: 'ledger', label: `History Ledger (${data.paymentHistory.length})`, icon: Layers },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabItem,
                  isActive && { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: t.border },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.key as any);
                }}
              >
                <Icon size={14} color={isActive ? '#ee4d2d' : t.textMuted} />
                <Text
                  style={[
                    styles.tabItemText,
                    { color: isActive ? (isDarkMode ? '#ffffff' : '#0f172a') : t.textMuted },
                    isActive && styles.tabItemTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* TAB 1: OVERVIEW & FORECAST */}
        {activeTab === 'overview' && (
          <View style={styles.tabContentContainer}>
            {/* Category Donut Breakdown */}
            <View style={[styles.analyticsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.analyticsCardHeader}>
                <Text style={[styles.analyticsCardTitle, { color: t.textPrimary }]}>Category Spending Share</Text>
                <Text style={[styles.analyticsCardSub, { color: t.textMuted }]}>Proportional expense distribution</Text>
              </View>

              {/* Need vs Want vs Subscription Distribution Bar */}
              <View style={styles.needWantBarContainer}>
                <Text style={[styles.sectionMiniHeader, { color: t.textMuted }]}>BUDGET ALLOCATION CLASSIFICATION</Text>
                {(() => {
                  const total = (data.insights.needsTotal || 0) + (data.insights.wantsTotal || 0) + (data.insights.subsTotal || 0) || 1;
                  const needPct = Math.round(((data.insights.needsTotal || 0) / total) * 100);
                  const wantPct = Math.round(((data.insights.wantsTotal || 0) / total) * 100);
                  const subPct = 100 - needPct - wantPct;
                  return (
                    <View>
                      <View style={styles.multiColorProgressBar}>
                        <View style={[styles.progressBarSegment, { flex: Math.max(1, needPct), backgroundColor: '#10b981' }]} />
                        <View style={[styles.progressBarSegment, { flex: Math.max(1, wantPct), backgroundColor: '#f43f5e' }]} />
                        <View style={[styles.progressBarSegment, { flex: Math.max(1, subPct), backgroundColor: '#f59e0b' }]} />
                      </View>
                      <View style={styles.progressLegendRow}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                          <Text style={[styles.legendLabel, { color: t.textSecondary }]}>Needs: ₱{(data.insights.needsTotal || 0).toLocaleString()} ({needPct}%)</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#f43f5e' }]} />
                          <Text style={[styles.legendLabel, { color: t.textSecondary }]}>Wants: ₱{(data.insights.wantsTotal || 0).toLocaleString()} ({wantPct}%)</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                          <Text style={[styles.legendLabel, { color: t.textSecondary }]}>Subs: ₱{(data.insights.subsTotal || 0).toLocaleString()} ({subPct}%)</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Category Rows with Percentage Bars */}
              <View style={styles.categoryRowsList}>
                {Object.entries(data.insights.categoryTotals || {}).map(([cat, amt], idx) => {
                  const catColors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6'];
                  const color = catColors[idx % catColors.length];
                  const totalExp = Object.values(data.insights.categoryTotals || {}).reduce((a, b) => a + b, 0) || 1;
                  const pct = Math.round((amt / totalExp) * 100);
                  return (
                    <View key={cat} style={styles.categoryItemRow}>
                      <View style={styles.catLabelRow}>
                        <View style={styles.catLeft}>
                          <View style={[styles.catColorIndicator, { backgroundColor: color }]} />
                          <Text style={[styles.catName, { color: t.textPrimary }]}>{cat}</Text>
                        </View>
                        <Text style={[styles.catAmount, { color: t.textPrimary }]}>
                          ₱{amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({pct}%)
                        </Text>
                      </View>
                      <View style={[styles.catProgressBarBg, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                        <View style={[styles.catProgressBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Spend by Payment Channel Grid */}
            <View style={[styles.analyticsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.analyticsCardTitle, { color: t.textPrimary }]}>Spend by Payment Channel</Text>
              <Text style={[styles.analyticsCardSub, { color: t.textMuted }]}>Breakdown across BDO, MariBank, GCash, SPay & Cash</Text>
              <View style={styles.channelGrid}>
                {Object.entries(data.insights.sourceTotals || {}).map(([src, amt]) => (
                  <View key={src} style={[styles.channelTile, { backgroundColor: isDarkMode ? '#141b2d' : '#f8fafc', borderColor: t.border }]}>
                    <Text style={styles.channelTileName}>{src}</Text>
                    <Text style={[styles.channelTileAmt, { color: t.textPrimary }]}>₱{amt.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: EXPENSE REPORTS */}
        {activeTab === 'reports' && (
          <View style={styles.tabContentContainer}>
            {/* Source Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsScroll}>
              {['ALL', 'BDO', 'MARIBANK', 'GCASH', 'SPAY', 'ATOME', 'CASH'].map((src) => (
                <TouchableOpacity
                  key={src}
                  style={[
                    styles.filterChip,
                    filterSource === src && styles.filterChipActive,
                    { borderColor: t.border },
                  ]}
                  onPress={() => setFilterSource(src)}
                >
                  <Text style={[styles.filterChipText, filterSource === src && styles.filterChipTextActive]}>
                    {src === 'ALL' ? 'All Sources' : src}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Monthly Cash Flow List */}
            <View style={[styles.analyticsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.analyticsCardTitle, { color: t.textPrimary }]}>Monthly Inflows vs Outflows (6 Months)</Text>
              <View style={styles.monthlyFlowList}>
                {(data.analytics?.monthlyCashFlow || []).map((m) => (
                  <View key={m.month} style={[styles.monthlyFlowRow, { borderBottomColor: t.border }]}>
                    <View>
                      <Text style={[styles.monthlyFlowMonth, { color: t.textPrimary }]}>{m.month}</Text>
                      <Text style={[styles.monthlyFlowIncome, { color: '#10b981' }]}>In: +₱{m.income.toLocaleString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.monthlyFlowExpense, { color: '#ef4444' }]}>Out: -₱{m.expense.toLocaleString()}</Text>
                      <Text style={[styles.monthlyFlowNet, { color: m.net >= 0 ? '#10b981' : '#ef4444' }]}>
                        Net: {m.net >= 0 ? '+' : ''}₱{m.net.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* TAB 3: ATOME CARD & PLANS */}
        {activeTab === 'atome' && (
          <View style={styles.tabContentContainer}>
            {/* Header & Mode Switch */}
            <View style={styles.atomeToolbar}>
              <View style={styles.atomeSearchBox}>
                <Search size={14} color={t.textMuted} />
                <TextInput
                  placeholder="Search merchant..."
                  placeholderTextColor={t.textMuted}
                  value={atomeSearchQuery}
                  onChangeText={setAtomeSearchQuery}
                  style={[styles.atomeSearchInput, { color: t.textPrimary }]}
                />
              </View>

              <TouchableOpacity
                style={[styles.viewModeToggle, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}
                onPress={() => setAtomeViewMode(atomeViewMode === 'cards' ? 'list' : 'cards')}
              >
                {atomeViewMode === 'cards' ? <List size={16} color={t.textPrimary} /> : <LayoutGrid size={16} color={t.textPrimary} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addAtomeBtn, { backgroundColor: '#FF4F00' }]}
                onPress={() => setShowAddAtome(true)}
              >
                <Plus size={14} color="#fff" />
                <Text style={styles.addAtomeBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Bulk Action Bar if items selected */}
            {selectedAtomePaymentIds.length > 0 && (
              <View style={styles.bulkPayActionBar}>
                <Text style={styles.bulkPayActionText}>
                  Selected {selectedAtomePaymentIds.length} Payment(s)
                </Text>
                <TouchableOpacity
                  style={styles.bulkPaySubmitBtn}
                  onPress={() => {
                    let total = 0;
                    data.atomeOrders.forEach((o) => {
                      o.payments.forEach((p) => {
                        if (selectedAtomePaymentIds.includes(p.id)) total += p.amountDue;
                      });
                    });
                    setBulkPayAtomeModal({
                      isOpen: true,
                      count: selectedAtomePaymentIds.length,
                      totalAmount: total,
                      paymentSource: 'CASH',
                    });
                  }}
                >
                  <Text style={styles.bulkPaySubmitBtnText}>Settle Bulk</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Atome Orders List / Grid */}
            {filteredAtomeOrders.length === 0 ? (
              <View style={[styles.emptyBox, { borderColor: t.border }]}>
                <Text style={[styles.emptyBoxText, { color: t.textMuted }]}>No matching Atome installment plans found.</Text>
              </View>
            ) : (
              filteredAtomeOrders.map((order) => {
                const unpaidPayments = order.payments.filter((p) => !p.isPaid);
                const nextUnpaid = unpaidPayments[0];
                const paidCount = order.payments.filter((p) => p.isPaid).length;
                const totalCount = order.payments.length;
                const isCompleted = unpaidPayments.length === 0;

                return (
                  <View key={order.id} style={[styles.atomeOrderCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                    <View style={styles.atomeCardTop}>
                      <View>
                        <Text style={[styles.atomeMerchantName, { color: t.textPrimary }]}>{order.merchantName}</Text>
                        <Text style={[styles.atomeTermType, { color: '#FF4F00' }]}>{formatTermType(order.termType)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.atomeTotalAmt, { color: t.textPrimary }]}>₱{order.totalAmount.toLocaleString()}</Text>
                        <Text style={[styles.atomeProgressText, { color: isCompleted ? '#10b981' : t.textMuted }]}>
                          {paidCount}/{totalCount} Settled
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.atomeProgressBarBg, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                      <View style={[styles.atomeProgressBarFill, { width: `${(paidCount / totalCount) * 100}%` }]} />
                    </View>

                    {/* Next Due & Pay Action */}
                    <View style={styles.atomeCardBottomRow}>
                      {nextUnpaid ? (
                        <View style={styles.atomeNextDueCol}>
                          <Text style={[styles.atomeNextDueLabel, { color: t.textMuted }]}>
                            Next: Month #{nextUnpaid.monthNumber} (₱{nextUnpaid.amountDue.toLocaleString()})
                          </Text>
                          <Text style={[styles.atomeNextDueDate, { color: t.textSecondary }]}>
                            Due {new Date(nextUnpaid.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.atomeFullyPaidBadge, { color: '#10b981' }]}>✓ FULLY SETTLED</Text>
                      )}

                      <View style={styles.atomeCardActionsRow}>
                        {nextUnpaid && (
                          <>
                            <TouchableOpacity
                              style={[
                                styles.selectCheckboxBtn,
                                selectedAtomePaymentIds.includes(nextUnpaid.id) && styles.selectCheckboxBtnActive,
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedAtomePaymentIds((prev) =>
                                  prev.includes(nextUnpaid.id) ? prev.filter((id) => id !== nextUnpaid.id) : [...prev, nextUnpaid.id]
                                );
                              }}
                            >
                              <Text style={styles.selectCheckboxBtnText}>
                                {selectedAtomePaymentIds.includes(nextUnpaid.id) ? '✓' : '+'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.paySingleAtomeBtn}
                              onPress={() => {
                                setPayAtomeModal({
                                  isOpen: true,
                                  paymentId: nextUnpaid.id,
                                  merchantName: order.merchantName,
                                  monthNumber: nextUnpaid.monthNumber,
                                  totalMonths: order.installmentMonths,
                                  amount: nextUnpaid.amountDue,
                                  dueDate: nextUnpaid.dueDate,
                                  paymentSource: 'CASH',
                                });
                              }}
                            >
                              <Text style={styles.paySingleAtomeBtnText}>Pay Month #{nextUnpaid.monthNumber}</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 4: PLANNED PAYMENTS TIMELINE */}
        {activeTab === 'timeline' && (
          <View style={styles.tabContentContainer}>
            {/* Monthly Dues Deadlines Bento Cards */}
            <View style={styles.monthlyDeadlinesSection}>
              <Text style={[styles.sectionHeaderTitle, { color: t.textPrimary }]}>Monthly Dues Deadlines</Text>
              {(data.billsSummary.unpaidBillsMonthlyBreakdown || []).map((b) => {
                const isFullyPaid = b.isFullyPaid || b.totalUnpaid === 0;
                const isExpanded = !!expandedMonthCards[b.month];
                return (
                  <TouchableOpacity
                    key={b.month}
                    style={[
                      styles.monthDeadlineCard,
                      { backgroundColor: t.surface, borderColor: isFullyPaid ? '#10b981' : t.border },
                    ]}
                    onPress={() => setExpandedMonthCards((prev) => ({ ...prev, [b.month]: !prev[b.month] }))}
                    activeOpacity={0.8}
                  >
                    <View style={styles.monthCardHeader}>
                      <View style={styles.monthCardTitleRow}>
                        <Calendar size={14} color="#ee4d2d" />
                        <Text style={[styles.monthCardTitle, { color: t.textPrimary }]}>{b.month}</Text>
                      </View>
                      <Text style={[styles.monthCardTotal, { color: isFullyPaid ? '#10b981' : '#ef4444' }]}>
                        {isFullyPaid ? '✓ PAID' : `₱${(b.totalUnpaid || b.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </Text>
                    </View>

                    <View style={styles.monthCardSubRow}>
                      <Text style={[styles.monthCardSubText, { color: t.textSecondary }]}>
                        SPay: ₱{b.spay.toLocaleString()} • Atome: ₱{b.atome.toLocaleString()}
                      </Text>
                      <Text style={[styles.monthCardDetailsToggle, { color: '#ee4d2d' }]}>
                        {isExpanded ? 'Hide Details ▲' : 'View Items ▼'}
                      </Text>
                    </View>

                    {/* Expandable items breakdown */}
                    {isExpanded && b.items && b.items.length > 0 && (
                      <View style={[styles.monthItemsList, { borderTopColor: t.border }]}>
                        {b.items.map((it, idx) => (
                          <View key={idx} style={styles.monthItemRow}>
                            <Text style={[styles.monthItemName, { color: t.textPrimary }]} numberOfLines={1}>{it.name}</Text>
                            <Text style={[styles.monthItemAmt, { color: it.isPaid ? '#10b981' : t.textPrimary }]}>
                              {it.isPaid ? '✓ ' : ''}₱{it.amount.toLocaleString()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Chronological Timeline */}
            <View style={styles.chronologicalSection}>
              <Text style={[styles.sectionHeaderTitle, { color: t.textPrimary }]}>Chronological Timeline</Text>
              {(data.upcomingPlannedPayments || []).map((p) => (
                <View key={p.id} style={[styles.timelineRowCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <View style={[styles.timelineSourceBadge, { backgroundColor: p.source === 'SPAY' ? '#ee4d2d' : '#FF4F00' }]}>
                    <Text style={styles.timelineSourceText}>{p.source}</Text>
                  </View>
                  <View style={styles.timelineMid}>
                    <Text style={[styles.timelineItemTitle, { color: t.textPrimary }]} numberOfLines={1}>{p.title}</Text>
                    <Text style={[styles.timelineItemDate, { color: t.textMuted }]}>
                      Due: {new Date(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.timelineAmount, { color: p.isPaid ? '#10b981' : '#ef4444' }]}>
                      ₱{p.amountDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.timelineStatusBadge, { color: p.isPaid ? '#10b981' : p.daysRemaining < 0 ? '#ef4444' : '#f59e0b' }]}>
                      {p.isPaid ? 'PAID' : p.daysRemaining < 0 ? `OVERDUE ${Math.abs(p.daysRemaining)}d` : `${p.daysRemaining}d left`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TAB 5: COMPREHENSIVE HISTORY LEDGER */}
        {activeTab === 'ledger' && (
          <View style={styles.tabContentContainer}>
            {/* Search and Filters */}
            <View style={styles.ledgerSearchRow}>
              <View style={[styles.ledgerSearchBox, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Search size={14} color={t.textMuted} />
                <TextInput
                  placeholder="Search ledger..."
                  placeholderTextColor={t.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={[styles.ledgerSearchInput, { color: t.textPrimary }]}
                />
              </View>
            </View>

            {/* Ledger List */}
            {filteredHistory.length === 0 ? (
              <View style={[styles.emptyBox, { borderColor: t.border }]}>
                <Text style={[styles.emptyBoxText, { color: t.textMuted }]}>No matching transactions found in history.</Text>
              </View>
            ) : (
              filteredHistory.map((item) => (
                <View key={item.id} style={[styles.ledgerItemCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <View style={styles.ledgerCardLeft}>
                    <Text style={[styles.ledgerItemTitle, { color: t.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.ledgerItemMeta, { color: t.textMuted }]}>
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {item.category} • {item.source}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.ledgerItemAmount, { color: t.textPrimary }]}>
                      ₱{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.ledgerStatusPill, { color: item.status === 'UNPAID' ? '#f59e0b' : '#10b981' }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* 11 MODALS IMPLEMENTATION */}
      {/* ========================================================================= */}

      {/* 1. ADD EXPENSE MODAL */}
      <Modal visible={showAddExpense} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Add Expense Transaction</Text>
              <TouchableOpacity onPress={() => setShowAddExpense(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalFormScroll}>
              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Title</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="e.g. Grocery, Lunch, Coffee"
                placeholderTextColor={t.textMuted}
                value={expenseForm.title}
                onChangeText={(text) => setExpenseForm({ ...expenseForm, title: text })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Amount (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={t.textMuted}
                value={expenseForm.amount ? String(expenseForm.amount) : ''}
                onChangeText={(text) => setExpenseForm({ ...expenseForm, amount: parseFloat(text) || 0 })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Category</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="Food, Transportation, Shopping..."
                placeholderTextColor={t.textMuted}
                value={expenseForm.category}
                onChangeText={(text) => setExpenseForm({ ...expenseForm, category: text })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Payment Source</Text>
              <View style={styles.sourceSelectorRow}>
                {['CASH', 'BDO', 'MARIBANK', 'GCASH', 'SPAY', 'ATOME'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sourcePill, expenseForm.paymentSource === s && styles.sourcePillActive]}
                    onPress={() => setExpenseForm({ ...expenseForm, paymentSource: s as any })}
                  >
                    <Text style={[styles.sourcePillText, expenseForm.paymentSource === s && styles.sourcePillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Classification</Text>
              <View style={styles.sourceSelectorRow}>
                {['NEED', 'WANT', 'SUBSCRIPTION'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.sourcePill, expenseForm.expenseType === type && styles.sourcePillActive]}
                    onPress={() => setExpenseForm({ ...expenseForm, expenseType: type as any })}
                  >
                    <Text style={[styles.sourcePillText, expenseForm.expenseType === type && styles.sourcePillTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={async () => {
                  if (!expenseForm.title || expenseForm.amount <= 0) {
                    PremiumAlert.alert('Required', 'Please enter valid title and amount');
                    return;
                  }
                  setIsLoading(true);
                  const res = await postExpensesAction('add-expense', { expense: expenseForm });
                  if (res.success && res.data) {
                    setData(res.data);
                    setShowAddExpense(false);
                    setExpenseForm({ title: '', amount: 0, category: 'General', paymentSource: 'CASH', expenseType: 'WANT' });
                    PremiumAlert.alert('Success', 'Expense recorded successfully!');
                  }
                  setIsLoading(false);
                }}
              >
                <Text style={styles.modalSubmitBtnText}>Save Expense</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 2. MANAGE CASH ON HAND & BALANCES MODAL */}
      <Modal visible={showManageCash} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Manage Liquid Cash & Balances</Text>
              <TouchableOpacity onPress={() => setShowManageCash(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalFormScroll}>
              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Cash on Hand (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                keyboardType="numeric"
                value={String(cashForm.cashOnHand)}
                onChangeText={(text) => setCashForm({ ...cashForm, cashOnHand: parseFloat(text) || 0 })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>BDO Payroll Balance (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                keyboardType="numeric"
                value={String(cashForm.bdoBalance)}
                onChangeText={(text) => setCashForm({ ...cashForm, bdoBalance: parseFloat(text) || 0 })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>MariBank Savings (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                keyboardType="numeric"
                value={String(cashForm.maribankBalance)}
                onChangeText={(text) => setCashForm({ ...cashForm, maribankBalance: parseFloat(text) || 0 })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>GCash Balance (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                keyboardType="numeric"
                value={String(cashForm.gcashBalance)}
                onChangeText={(text) => setCashForm({ ...cashForm, gcashBalance: parseFloat(text) || 0 })}
              />

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={async () => {
                  setIsLoading(true);
                  const res = await postExpensesAction('update-cash', {
                    cashOnHand: cashForm.cashOnHand,
                    bankBalance: cashForm.bdoBalance,
                    gcashBalance: cashForm.gcashBalance,
                    bdoBalance: cashForm.bdoBalance,
                    maribankBalance: cashForm.maribankBalance,
                  });
                  if (res.success && res.data) {
                    setData(res.data);
                    setShowManageCash(false);
                    PremiumAlert.alert('Balances Updated', 'Liquid balances successfully saved!');
                  }
                  setIsLoading(false);
                }}
              >
                <Text style={styles.modalSubmitBtnText}>Update Balances</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3. CUSTOMIZE SHORTCUTS MODAL */}
      <Modal visible={showManageShortcuts} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Customize 1-Tap Shortcuts</Text>
              <TouchableOpacity onPress={() => setShowManageShortcuts(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalFormScroll}>
              <Text style={[styles.sectionMiniHeader, { color: t.textMuted }]}>ACTIVE SHORTCUTS ({shortcutsList.length})</Text>
              {shortcutsList.map((sc) => (
                <View key={sc.id} style={[styles.shortcutEditRow, { borderColor: t.border }]}>
                  <Text style={styles.shortcutEditEmoji}>{sc.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shortcutEditTitle, { color: t.textPrimary }]}>{sc.title}</Text>
                    <Text style={[styles.shortcutEditSub, { color: t.textMuted }]}>₱{sc.amount} • {sc.paymentSource}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      const updated = shortcutsList.filter((s) => s.id !== sc.id);
                      setShortcutsList(updated);
                      await postExpensesAction('save-shortcuts', { shortcuts: updated });
                    }}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={[styles.sectionMiniHeader, { color: t.textMuted, marginTop: 16 }]}>ADD NEW SHORTCUT</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="Shortcut Name (e.g. Milk Tea)"
                placeholderTextColor={t.textMuted}
                value={newShortcut.title}
                onChangeText={(text) => setNewShortcut({ ...newShortcut, title: text })}
              />
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="Amount (₱)"
                keyboardType="numeric"
                placeholderTextColor={t.textMuted}
                value={String(newShortcut.amount)}
                onChangeText={(text) => setNewShortcut({ ...newShortcut, amount: parseFloat(text) || 0 })}
              />

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={async () => {
                  if (!newShortcut.title || newShortcut.amount <= 0) return;
                  const updated = [...shortcutsList, { ...newShortcut, id: `sc-${Date.now()}` }];
                  setShortcutsList(updated);
                  await postExpensesAction('save-shortcuts', { shortcuts: updated });
                  setNewShortcut({ emoji: '🚌', title: '', amount: 13, category: 'Transportation', paymentSource: 'CASH', expenseType: 'NEED' });
                }}
              >
                <Text style={styles.modalSubmitBtnText}>+ Add Shortcut</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. DEPOSIT CASH TO IPON MODAL */}
      <Modal visible={showTransferIpon} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Deposit Cash to Ipon</Text>
              <TouchableOpacity onPress={() => setShowTransferIpon(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalFormScroll}>
              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Select Holding Source</Text>
              <View style={styles.sourceSelectorRow}>
                {['CASH', 'MARIBANK', 'BDO', 'GCASH'].map((src) => (
                  <TouchableOpacity
                    key={src}
                    style={[styles.sourcePill, iponForm.source === src && styles.sourcePillActive]}
                    onPress={() => setIponForm({ ...iponForm, source: src as any })}
                  >
                    <Text style={[styles.sourcePillText, iponForm.source === src && styles.sourcePillTextActive]}>{src}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Deposit Amount (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={t.textMuted}
                value={iponForm.amount ? String(iponForm.amount) : ''}
                onChangeText={(text) => setIponForm({ ...iponForm, amount: parseFloat(text) || 0 })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Notes / Label</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="e.g. Physical savings in safe vault"
                placeholderTextColor={t.textMuted}
                value={iponForm.note}
                onChangeText={(text) => setIponForm({ ...iponForm, note: text })}
              />

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#10b981' }]}
                onPress={async () => {
                  const targetGoalId = iponForm.goalId || data.iponGoals[0]?.id;
                  if (!targetGoalId || iponForm.amount <= 0) {
                    PremiumAlert.alert('Required', 'Please enter a valid deposit amount and active goal');
                    return;
                  }
                  setIsLoading(true);
                  const res = await postExpensesAction('transfer-ipon', {
                    goalId: targetGoalId,
                    amount: iponForm.amount,
                    note: iponForm.note,
                    source: iponForm.source,
                  });
                  if (res.success && res.data) {
                    setData(res.data);
                    setShowTransferIpon(false);
                    PremiumAlert.alert('Deposit Complete', `₱${iponForm.amount.toLocaleString()} deposited to Ipon!`);
                  }
                  setIsLoading(false);
                }}
              >
                <Text style={styles.modalSubmitBtnText}>Confirm Ipon Deposit</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 5. ADD ATOME PLAN MODAL (SINGLE & BULK) */}
      <Modal visible={showAddAtome} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Add Atome Installment Plan</Text>
              <TouchableOpacity onPress={() => setShowAddAtome(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalFormScroll}>
              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Merchant / Item Name</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="e.g. Shopee / Power Mac"
                placeholderTextColor={t.textMuted}
                value={atomeForm.merchantName}
                onChangeText={(text) => setAtomeForm({ ...atomeForm, merchantName: text })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Total Purchase Amount (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={t.textMuted}
                value={atomeForm.totalAmount ? String(atomeForm.totalAmount) : ''}
                onChangeText={(text) => setAtomeForm({ ...atomeForm, totalAmount: parseFloat(text) || 0 })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Installment Term</Text>
              <View style={styles.sourceSelectorRow}>
                {['PAY_LATER_40D', 'INSTALLMENT_3M', 'INSTALLMENT_6M', 'INSTALLMENT_12M'].map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[styles.sourcePill, atomeForm.termType === term && styles.sourcePillActive]}
                    onPress={() => setAtomeForm({ ...atomeForm, termType: term as any })}
                  >
                    <Text style={[styles.sourcePillText, atomeForm.termType === term && styles.sourcePillTextActive]}>
                      {formatTermType(term)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#FF4F00' }]}
                onPress={async () => {
                  if (!atomeForm.merchantName || atomeForm.totalAmount <= 0) {
                    PremiumAlert.alert('Required', 'Please enter merchant name and valid amount');
                    return;
                  }
                  setIsLoading(true);
                  const res = await postExpensesAction('create-atome-order', { order: atomeForm });
                  if (res.success && res.data) {
                    setData(res.data);
                    setShowAddAtome(false);
                    PremiumAlert.alert('Success', 'Atome installment order created!');
                  }
                  setIsLoading(false);
                }}
              >
                <Text style={styles.modalSubmitBtnText}>Create Atome Plan</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 6. ADD SPAY PLAN MODAL */}
      <Modal visible={showScheduleSPay} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Schedule SPayLater Plan</Text>
              <TouchableOpacity onPress={() => setShowScheduleSPay(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalFormScroll}>
              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Item Name / Description</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="e.g. Mechanical Keyboard"
                placeholderTextColor={t.textMuted}
                value={spayForm.itemName}
                onChangeText={(text) => setSpayForm({ ...spayForm, itemName: text })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Total Amount (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={t.textMuted}
                value={spayForm.amount ? String(spayForm.amount) : ''}
                onChangeText={(text) => setSpayForm({ ...spayForm, amount: parseFloat(text) || 0 })}
              />

              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Months Installment</Text>
              <View style={styles.sourceSelectorRow}>
                {[1, 3, 6, 12].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.sourcePill, spayForm.installmentMonths === m && styles.sourcePillActive]}
                    onPress={() => setSpayForm({ ...spayForm, installmentMonths: m })}
                  >
                    <Text style={[styles.sourcePillText, spayForm.installmentMonths === m && styles.sourcePillTextActive]}>
                      {m} Months
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#ee4d2d' }]}
                onPress={async () => {
                  if (!spayForm.itemName || spayForm.amount <= 0) {
                    PremiumAlert.alert('Required', 'Please enter item name and amount');
                    return;
                  }
                  setIsLoading(true);
                  const res = await postExpensesAction('create-spay-order', { order: spayForm });
                  if (res.success && res.data) {
                    setData(res.data);
                    setShowScheduleSPay(false);
                    PremiumAlert.alert('Success', 'SPayLater installment order created!');
                  }
                  setIsLoading(false);
                }}
              >
                <Text style={styles.modalSubmitBtnText}>Create SPay Plan</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 7. BILLING CONFIG MODAL */}
      <Modal visible={showConfig} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Billing & Cutoff Settings</Text>
              <TouchableOpacity onPress={() => setShowConfig(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalFormScroll}>
              <Text style={[styles.sectionMiniHeader, { color: t.textMuted }]}>SPAYLATER CONFIG</Text>
              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Credit Limit (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                keyboardType="numeric"
                value={String(configForm.spayCreditLimit)}
                onChangeText={(text) => setConfigForm({ ...configForm, spayCreditLimit: parseFloat(text) || 0 })}
              />

              <Text style={[styles.sectionMiniHeader, { color: t.textMuted, marginTop: 12 }]}>ATOME CARD CONFIG</Text>
              <Text style={[styles.formLabel, { color: t.textSecondary }]}>Credit Limit (₱)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', color: t.textPrimary, borderColor: t.border }]}
                keyboardType="numeric"
                value={String(configForm.atomeCreditLimit)}
                onChangeText={(text) => setConfigForm({ ...configForm, atomeCreditLimit: parseFloat(text) || 0 })}
              />

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={async () => {
                  setIsLoading(true);
                  await postExpensesAction('update-bill-config', {
                    cardName: 'SPayLater',
                    billingCutoffDay: configForm.spayCutoffDay,
                    paymentDueDay: configForm.spayDueDay,
                    creditLimit: configForm.spayCreditLimit,
                  });
                  const res = await postExpensesAction('update-bill-config', {
                    cardName: 'Atome Card',
                    billingCutoffDay: configForm.atomeCutoffDay,
                    paymentDueDay: configForm.atomeDueDay,
                    creditLimit: configForm.atomeCreditLimit,
                  });
                  if (res.success && res.data) {
                    setData(res.data);
                    setShowConfig(false);
                    PremiumAlert.alert('Saved', 'Billing configurations saved!');
                  }
                  setIsLoading(false);
                }}
              >
                <Text style={styles.modalSubmitBtnText}>Save Settings</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 8. CONFIRM SINGLE ATOME PAYMENT MODAL */}
      <Modal visible={Boolean(payAtomeModal?.isOpen)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Settle Atome Payment</Text>
              <TouchableOpacity onPress={() => setPayAtomeModal(null)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <View style={styles.modalFormScroll}>
              <Text style={[styles.confirmPaymentTitle, { color: t.textPrimary }]}>{payAtomeModal?.merchantName}</Text>
              <Text style={styles.confirmPaymentAmt}>₱{payAtomeModal?.amount.toLocaleString()}</Text>
              <Text style={[styles.confirmPaymentSub, { color: t.textMuted }]}>Month #{payAtomeModal?.monthNumber}</Text>

              <Text style={[styles.formLabel, { color: t.textSecondary, marginTop: 16 }]}>Funding Source</Text>
              <View style={styles.sourceSelectorRow}>
                {['CASH', 'BDO', 'MARIBANK', 'GCASH'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sourcePill, payAtomeModal?.paymentSource === s && styles.sourcePillActive]}
                    onPress={() => payAtomeModal && setPayAtomeModal({ ...payAtomeModal, paymentSource: s as any })}
                  >
                    <Text style={[styles.sourcePillText, payAtomeModal?.paymentSource === s && styles.sourcePillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#FF4F00', marginTop: 20 }]}
                onPress={handleConfirmPayAtome}
              >
                <Text style={styles.modalSubmitBtnText}>Mark as Paid</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 9. CONFIRM BULK ATOME PAYMENTS MODAL */}
      <Modal visible={Boolean(bulkPayAtomeModal?.isOpen)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Bulk Settle Atome Payments</Text>
              <TouchableOpacity onPress={() => setBulkPayAtomeModal(null)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <View style={styles.modalFormScroll}>
              <Text style={[styles.confirmPaymentTitle, { color: t.textPrimary }]}>{bulkPayAtomeModal?.count} Installments Selected</Text>
              <Text style={styles.confirmPaymentAmt}>₱{bulkPayAtomeModal?.totalAmount.toLocaleString()}</Text>

              <Text style={[styles.formLabel, { color: t.textSecondary, marginTop: 16 }]}>Funding Source</Text>
              <View style={styles.sourceSelectorRow}>
                {['CASH', 'BDO', 'MARIBANK', 'GCASH'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sourcePill, bulkPayAtomeModal?.paymentSource === s && styles.sourcePillActive]}
                    onPress={() => bulkPayAtomeModal && setBulkPayAtomeModal({ ...bulkPayAtomeModal, paymentSource: s as any })}
                  >
                    <Text style={[styles.sourcePillText, bulkPayAtomeModal?.paymentSource === s && styles.sourcePillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#10b981', marginTop: 20 }]}
                onPress={handleConfirmBulkPayAtome}
              >
                <Text style={styles.modalSubmitBtnText}>Settle All ({bulkPayAtomeModal?.count})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 10. SALARY INFLOW MODAL */}
      <Modal visible={showSalaryInflowModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Payday Salary Inflow Drop</Text>
              <TouchableOpacity onPress={() => setShowSalaryInflowModal(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <View style={styles.modalFormScroll}>
              <Text style={[styles.confirmPaymentTitle, { color: t.textPrimary }]}>Credit Salary Inflow</Text>
              <Text style={styles.confirmPaymentAmt}>+₱{(data.payday.expectedPaydayIncome || 15000).toLocaleString()}</Text>
              <Text style={[styles.confirmPaymentSub, { color: t.textMuted }]}>Select destination account for your net paycheck:</Text>

              <View style={styles.salaryDropGrid}>
                {[
                  { id: 'BDO', label: '🏦 BDO Payroll', desc: 'Primary Receiver' },
                  { id: 'MARIBANK', label: '🛡️ MariBank', desc: 'Savings Vault' },
                  { id: 'GCASH', label: '📱 GCash', desc: 'Daily Wallet' },
                  { id: 'CASH', label: '💵 Physical Cash', desc: 'Safe & Cash on Hand' },
                ].map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.salaryAccBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: t.border }]}
                    onPress={() => handleReceiveSalary(acc.id as any)}
                  >
                    <Text style={[styles.salaryAccBtnTitle, { color: t.textPrimary }]}>{acc.label}</Text>
                    <Text style={[styles.salaryAccBtnSub, { color: t.textMuted }]}>{acc.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {lastSalaryDeposit && (
                <TouchableOpacity style={styles.undoSalaryBtn} onPress={handleUndoSalary}>
                  <Text style={styles.undoSalaryBtnText}>
                    ↩️ Undo Last Inflow (₱{lastSalaryDeposit.amount.toLocaleString()} to {lastSalaryDeposit.dest})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* 11. EXPORT CSV MODAL */}
      <Modal visible={showExportCsvModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: t.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Export Expenses & Ledger CSV</Text>
              <TouchableOpacity onPress={() => setShowExportCsvModal(false)}><X size={20} color={t.textMuted} /></TouchableOpacity>
            </View>
            <View style={styles.modalFormScroll}>
              <Text style={[styles.confirmPaymentSub, { color: t.textSecondary, marginTop: 8 }]}>
                Export full history including SPay installments, Atome card settled orders, and liquid outflow entries.
              </Text>
              <View style={styles.exportMetaCard}>
                <Text style={[styles.exportMetaText, { color: t.textPrimary }]}>Total Records: {data.paymentHistory.length}</Text>
                <Text style={[styles.exportMetaText, { color: t.textPrimary }]}>Total Outflows: ₱{data.billsSummary.totalPendingBills.toLocaleString()}</Text>
              </View>

              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#ee4d2d', marginTop: 20 }]} onPress={handleExportCSV}>
                <Share2 size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.modalSubmitBtnText}>Download & Share CSV</Text>
              </TouchableOpacity>
            </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ee4d2d',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#ee4d2d',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: -0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  // 1. Stats Bar Carousel
  statsBarContainer: {
    gap: 10,
    paddingRight: 16,
  },
  statCapsule: {
    width: 170,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  statCapsuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statCapsuleLabel: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.5,
  },
  statCapsuleValue: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
    marginBottom: 4,
  },
  statCapsuleSub: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  // 2. 3D Flip Card Hero
  heroCountdownCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  countdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  countdownHeaderLabel: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
  },
  flipCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  flipCardWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  flipCardContainer: {
    width: 48,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  flipHalf: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 30,
    overflow: 'hidden',
    alignItems: 'center',
  },
  flipHalfTop: {
    top: 0,
    justifyContent: 'flex-end',
  },
  flipHalfBottom: {
    bottom: 0,
    justifyContent: 'flex-start',
  },
  flipFlap: {
    zIndex: 10,
  },
  flipDigitText: {
    fontSize: 26,
    fontFamily: 'Jakarta-Bold',
    lineHeight: 30,
  },
  flipDigitTop: {
    transform: [{ translateY: 15 }],
  },
  flipDigitBottom: {
    transform: [{ translateY: -15 }],
  },
  flipDividerLine: {
    position: 'absolute',
    top: 29.5,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 20,
  },
  flipLabelText: {
    fontSize: 8,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
  },
  colonSeparator: {
    height: 60,
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  colonDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  countdownFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  inflowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inflowPillText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#10b981',
  },
  runwayText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  // 3. Cash on Hand Banner & Micro Adjust
  cashOnHandBanner: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  cashBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cashBannerSub: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
  },
  cashBannerMain: {
    fontSize: 24,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  cashBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  smallActionPillText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
  },
  microAdjustLabel: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    marginBottom: 8,
  },
  microAdjustRow: {
    gap: 6,
  },
  microChipPlus: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  microChipPlusText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    color: '#10b981',
  },
  microChipMinus: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  microChipMinusText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    color: '#ef4444',
  },
  // 4. Wallet Deck
  walletDeckContainer: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  deckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  deckTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  deckSubtitle: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  deckDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  deckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deckDotActive: {
    width: 16,
  },
  cardsScrollView: {
    gap: 12,
  },
  walletCardFrame: {
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 180,
  },
  walletCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardGoldChip: {
    width: 32,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    padding: 2,
  },
  chipInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#B8860B',
    borderRadius: 2,
  },
  roleBadgeCapsule: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 200,
  },
  roleBadgeText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
  },
  cardMid: {
    marginTop: 10,
  },
  cardNameText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  cardMaskText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    color: 'rgba(255,255,255,0.6)',
  },
  cardBalanceSection: {
    marginTop: 8,
  },
  cardBalanceLabel: {
    fontSize: 8,
    fontFamily: 'Jakarta-Bold',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
  },
  cardBalanceValue: {
    fontSize: 20,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
  },
  cardSubDetails: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  cardActionFooter: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  cardActionBtnPrimary: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardActionBtnTextPrimary: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#0f172a',
  },
  cardActionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardActionBtnTextSecondary: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
  },
  // 5. Shortcuts
  shortcutsContainer: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  shortcutsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  shortcutsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shortcutsTitle: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  customizeShortcutsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  customizeShortcutsText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  shortcutsScroll: {
    gap: 8,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  shortcutEmoji: {
    fontSize: 18,
  },
  shortcutTitle: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  shortcutPrice: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    color: '#ee4d2d',
  },
  addShortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addShortcutText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  // 6. Tabs
  tabBarContainer: {
    gap: 6,
    paddingVertical: 4,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabItemText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  tabItemTextActive: {
    fontFamily: 'Jakarta-Bold',
  },
  tabContentContainer: {
    gap: 14,
  },
  // Overview Tab
  analyticsCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  analyticsCardHeader: {
    marginBottom: 12,
  },
  analyticsCardTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  analyticsCardSub: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  needWantBarContainer: {
    marginBottom: 16,
  },
  sectionMiniHeader: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  multiColorProgressBar: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  progressBarSegment: {
    height: '100%',
  },
  progressLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  categoryRowsList: {
    gap: 10,
  },
  categoryItemRow: {
    gap: 4,
  },
  catLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catColorIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catName: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  catAmount: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  catProgressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  channelTile: {
    flex: 1,
    minWidth: '45%',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  channelTileName: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#8b5cf6',
  },
  channelTileAmt: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    marginTop: 2,
  },
  // Reports Tab
  filterChipsScroll: {
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: '#ee4d2d',
    borderColor: '#ee4d2d',
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#fff',
    fontFamily: 'Jakarta-Bold',
  },
  monthlyFlowList: {
    marginTop: 10,
  },
  monthlyFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthlyFlowMonth: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  monthlyFlowIncome: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  monthlyFlowExpense: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  monthlyFlowNet: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  // Atome Tab
  atomeToolbar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  atomeSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    gap: 6,
  },
  atomeSearchInput: {
    flex: 1,
    height: 38,
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  viewModeToggle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAtomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
  },
  addAtomeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  bulkPayActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 79, 0, 0.15)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FF4F00',
  },
  bulkPayActionText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
    color: '#FF4F00',
  },
  bulkPaySubmitBtn: {
    backgroundColor: '#FF4F00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bulkPaySubmitBtnText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  atomeOrderCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  atomeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  atomeMerchantName: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  atomeTermType: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  atomeTotalAmt: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  atomeProgressText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  atomeProgressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  atomeProgressBarFill: {
    height: '100%',
    backgroundColor: '#FF4F00',
    borderRadius: 2,
  },
  atomeCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  atomeNextDueCol: {
    gap: 2,
  },
  atomeNextDueLabel: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  atomeNextDueDate: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
  },
  atomeFullyPaidBadge: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  atomeCardActionsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  selectCheckboxBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF4F00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCheckboxBtnActive: {
    backgroundColor: '#FF4F00',
  },
  selectCheckboxBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
    color: '#FF4F00',
  },
  paySingleAtomeBtn: {
    backgroundColor: '#FF4F00',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  paySingleAtomeBtnText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
  },
  // Timeline Tab
  monthlyDeadlinesSection: {
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    marginBottom: 4,
  },
  monthDeadlineCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  monthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthCardTitle: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  monthCardTotal: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  monthCardSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthCardSubText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  monthCardDetailsToggle: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  monthItemsList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 6,
  },
  monthItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthItemName: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    flex: 1,
    marginRight: 10,
  },
  monthItemAmt: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  chronologicalSection: {
    gap: 8,
    marginTop: 10,
  },
  timelineRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  timelineSourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timelineSourceText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  timelineMid: {
    flex: 1,
  },
  timelineItemTitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  timelineItemDate: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  timelineAmount: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  timelineStatusBadge: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  // Ledger Tab
  ledgerSearchRow: {
    marginBottom: 6,
  },
  ledgerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  ledgerSearchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  ledgerItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  ledgerCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  ledgerItemTitle: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  ledgerItemMeta: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  ledgerItemAmount: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  ledgerStatusPill: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    marginTop: 2,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyBoxText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  // Modals Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
  },
  modalFormScroll: {
    maxHeight: 480,
  },
  formLabel: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    marginBottom: 6,
    marginTop: 10,
  },
  formInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
  },
  sourceSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourcePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.3)',
  },
  sourcePillActive: {
    backgroundColor: '#ee4d2d',
    borderColor: '#ee4d2d',
  },
  sourcePillText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    color: '#94a3b8',
  },
  sourcePillTextActive: {
    color: '#fff',
    fontFamily: 'Jakarta-Bold',
  },
  modalSubmitBtn: {
    backgroundColor: '#ee4d2d',
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
  },
  modalSubmitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  shortcutEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  shortcutEditEmoji: {
    fontSize: 18,
  },
  shortcutEditTitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  shortcutEditSub: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  confirmPaymentTitle: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
  },
  confirmPaymentAmt: {
    fontSize: 28,
    fontFamily: 'Jakarta-Bold',
    color: '#ef4444',
    marginVertical: 4,
  },
  confirmPaymentSub: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  salaryDropGrid: {
    gap: 8,
    marginTop: 14,
  },
  salaryAccBtn: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  salaryAccBtnTitle: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  salaryAccBtnSub: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  undoSalaryBtn: {
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
  },
  undoSalaryBtnText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    color: '#ef4444',
  },
  exportMetaCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.1)',
    marginVertical: 12,
    gap: 4,
  },
  exportMetaText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
});
