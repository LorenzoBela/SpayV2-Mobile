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
import { parseUtcDate } from '../../utils/date';
import { CountdownTimer } from '../../components/CountdownTimer';
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

interface FlipCardProps {
  value: number;
  label: string;
}

const FLIP_PHASE_MS = 330;
const FLIP_TOTAL_MS = FLIP_PHASE_MS * 2;
const flipEaseIn = Easing.bezier(0.42, 0, 1, 1);
const flipEaseOut = Easing.bezier(0, 0, 0.58, 1);

const FlipCard = React.memo(function FlipCard({ value, label }: FlipCardProps) {
  const format = (val: number) => String(val).padStart(2, '0');
  const newValue = format(value);

  const { isDarkMode } = useContext(ThemeContext);

  const [current, setCurrent] = useState(newValue);
  const [previous, setPrevious] = useState(newValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [topRevealed, setTopRevealed] = useState(false);

  const topFlipProgress = useRef(new RNAnimated.Value(1)).current;
  const bottomFlipProgress = useRef(new RNAnimated.Value(1)).current;
  const lastValueRef = useRef(newValue);

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
      ]).start(() => {
        setIsAnimating(false);
        setTopRevealed(false);
      });

      setTimeout(() => {
        setTopRevealed(true);
      }, FLIP_PHASE_MS);

      lastValueRef.current = newValue;
    }
  }, [newValue]);

  const cardBgTop = isDarkMode ? '#1e293b' : '#e2e8f0';
  const cardBgBottom = isDarkMode ? '#161c2a' : '#cbd5e1';
  const textColorTop = isDarkMode ? '#f8fafc' : '#0f172a';
  const textColorBottom = isDarkMode ? '#cbd5e1' : '#334155';
  const cardBorderColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const labelColor = isDarkMode ? '#64748b' : '#475569';

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

  const showFlip = previous !== current;
  const activeFlip = showFlip && isAnimating;
  const topStaticValue = isAnimating && !topRevealed ? previous : current;
  const bottomStaticValue = isAnimating ? previous : current;

  return (
    <View style={styles.flipCardCol}>
      <View style={styles.flipCard}>
        <View style={[styles.flipCardOuter, { backgroundColor: cardBgTop, borderColor: cardBorderColor }]}>
          {/* 1. Top Static */}
          <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
            <Text style={[styles.topText, { color: textColorTop }]}>{topStaticValue}</Text>
          </View>

          {/* 2. Bottom Static */}
          <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
            <Text style={[styles.bottomText, { color: textColorBottom }]}>{bottomStaticValue}</Text>
          </View>

          {/* 3. Animated Top Flap */}
          {activeFlip && (
            <RNAnimated.View
              style={[
                styles.flapAnimated,
                {
                  top: 0,
                  opacity: opacityTop,
                  transform: [
                    { perspective: 400 },
                    { translateY: 13 },
                    { rotateX: rotateTop },
                    { translateY: -13 },
                  ],
                  zIndex: 3,
                },
              ]}
            >
              <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
                <Text style={[styles.topText, { color: textColorTop }]}>{previous}</Text>
              </View>
            </RNAnimated.View>
          )}

          {/* 4. Animated Bottom Flap */}
          {activeFlip && (
            <RNAnimated.View
              style={[
                styles.flapAnimated,
                {
                  top: 26,
                  opacity: opacityBottom,
                  transform: [
                    { perspective: 400 },
                    { translateY: -13 },
                    { rotateX: rotateBottom },
                    { translateY: 13 },
                  ],
                  zIndex: 2,
                },
              ]}
            >
              <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
                <Text style={[styles.bottomText, { color: textColorBottom }]}>{current}</Text>
              </View>
            </RNAnimated.View>
          )}

          <View style={styles.flipCardDivider} />
        </View>
      </View>
      <Text style={[styles.flipCardLabel, { color: labelColor }]}>{label}</Text>
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
      setShortcutsList(res?.quickShortcuts || res?.shortcuts || []);
      if (res?.balances) {
        setCashForm({
          cashOnHand: res.balances.cashOnHand ?? 0,
          bdoBalance: res.balances.bdoBalance || res.balances.bankBalance || 0,
          maribankBalance: res.balances.maribankBalance || 0,
          gcashBalance: res.balances.gcashBalance ?? 0,
        });
      }
      if (res?.billsSummary) {
        setConfigForm({
          spayCutoffDay: res.billsSummary.spayCutoffDay || 25,
          spayDueDay: res.billsSummary.spayDueDay || 15,
          spayCreditLimit: res.billsSummary.spayCreditLimit || 50000,
          atomeCutoffDay: res.billsSummary.atomeCutoffDay || 25,
          atomeDueDay: res.billsSummary.atomeDueDay || 12,
          atomeCreditLimit: res.billsSummary.atomeCreditLimit || 30000,
        });
      }
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

  // Next target deadline resolver for countdown timer
  const nextTarget = useMemo(() => {
    if (!data) {
      return {
        date: null,
        title: 'Billing Cycle Overview',
        formattedDate: '',
      };
    }

    const upcoming = (data.upcomingPlannedPayments || []).filter((p: any) => !p.isPaid);
    const sortedUpcoming = [...upcoming].sort((a: any, b: any) => {
      const ta = parseUtcDate(a.dueDate).getTime() || 0;
      const tb = parseUtcDate(b.dueDate).getTime() || 0;
      return ta - tb;
    });

    const now = new Date();
    const activeUpcoming = sortedUpcoming.find((p: any) => {
      const t = parseUtcDate(p.dueDate);
      return t && t.getTime() > now.getTime();
    });

    if (activeUpcoming) {
      const d = parseUtcDate(activeUpcoming.dueDate);
      return {
        date: d,
        title: activeUpcoming.title || 'Next Billing Deadline',
        formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    }

    if (data.payday?.nextPaydayIso) {
      const d = parseUtcDate(data.payday.nextPaydayIso);
      return {
        date: d,
        title: 'Next Payday Inflow',
        formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    }

    if (sortedUpcoming.length > 0) {
      const d = parseUtcDate(sortedUpcoming[0].dueDate);
      return {
        date: d,
        title: sortedUpcoming[0].title || 'Upcoming Deadline',
        formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    }

    return {
      date: null,
      title: 'Billing Cycle Overview',
      formattedDate: '',
    };
  }, [data]);

  // Micro adjustments on Cash on Hand
  const handleMicroAdjustCash = async (delta: number) => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newCash = Math.max(0, data.balances.cashOnHand + delta);
    // Optimistic update
    setData((prev: any) => {
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
        accountMask: `LIMIT ₱${(data.billsSummary?.spayCreditLimit ?? 50000).toLocaleString()}`,
        balance: Math.max(0, (data.billsSummary?.spayCreditLimit ?? 50000) - (data.billsSummary?.spayUsedCredit ?? 0)),
        usedCredit: data.billsSummary?.spayUsedCredit ?? 0,
        totalLimit: data.billsSummary?.spayCreditLimit ?? 50000,
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
        accountMask: `LIMIT ₱${(data.billsSummary?.atomeCreditLimit ?? 30000).toLocaleString()}`,
        balance: Math.max(0, (data.billsSummary?.atomeCreditLimit ?? 30000) - (data.billsSummary?.atomeUsedCredit ?? 0)),
        usedCredit: data.billsSummary?.atomeUsedCredit ?? 0,
        totalLimit: data.billsSummary?.atomeCreditLimit ?? 30000,
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
        balance: data.balances?.totalPhysicalCash ?? data.balances?.cashOnHand ?? 0,
        liquidAmount: data.balances?.cashOnHand ?? 0,
        savingsAmount: data.balances?.iponSavingsBySource?.CASH || 0,
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
    return (data.paymentHistory as any[]).filter((item: any) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || item.title?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q) || (item.notes && item.notes.toLowerCase().includes(q));
      const matchesSource = filterSource === 'ALL' || item.source === filterSource;
      const matchesStatus = ledgerStatusFilter === 'ALL' || (ledgerStatusFilter === 'PAID' && item.status !== 'UNPAID') || (ledgerStatusFilter === 'UNPAID' && item.status === 'UNPAID');
      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [data?.paymentHistory, searchQuery, filterSource, ledgerStatusFilter]);

  // Filtered Atome Orders
  const filteredAtomeOrders = useMemo(() => {
    if (!data?.atomeOrders) return [];
    return (data.atomeOrders as any[]).filter((order: any) => {
      const q = atomeSearchQuery.toLowerCase();
      const matchesSearch = !q || order.merchantName?.toLowerCase().includes(q);
      const matchesTerm = atomeFilterTerm === 'all' || order.termType === atomeFilterTerm;
      const isFullyPaid = (order.payments || []).every((p: any) => p.isPaid);
      const matchesStatus = atomeFilterStatus === 'all' || (atomeFilterStatus === 'paid' && isFullyPaid) || (atomeFilterStatus === 'unpaid' && !isFullyPaid);
      return matchesSearch && matchesTerm && matchesStatus;
    });
  }, [data?.atomeOrders, atomeSearchQuery, atomeFilterTerm, atomeFilterStatus]);

  // Memoized Tab Items
  const tabItems = useMemo(() => [
    { key: 'overview', label: 'Overview & Analytics', icon: PieIcon },
    { key: 'reports', label: 'Expense Reports', icon: BarChart3 },
    { key: 'atome', label: `Atome Plans (${(data?.atomeOrders || []).length})`, icon: CreditCard },
    { key: 'timeline', label: `Timeline (${(data?.upcomingPlannedPayments || []).length})`, icon: Clock },
    { key: 'ledger', label: `History Ledger (${(data?.paymentHistory || []).length})`, icon: Layers },
  ], [data?.atomeOrders, data?.upcomingPlannedPayments, data?.paymentHistory]);

  if (isLoading && !data) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color="#ee4d2d" />
        <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading Expenses & Master Dashboard...</Text>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AlertTriangle size={40} color="#ee4d2d" style={{ marginBottom: 12 }} />
        <Text style={[styles.loadingText, { color: t.textPrimary, fontWeight: 'bold', fontSize: 16 }]}>
          Unable to Load Expenses Data
        </Text>
        <Text style={{ color: t.textSecondary, fontSize: 12, textAlign: 'center', marginHorizontal: 32, marginTop: 4, marginBottom: 16 }}>
          Please check your connection and tap below to retry.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#ee4d2d', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 }}
          onPress={() => {
            setIsLoading(true);
            loadData(true);
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Retry Loading</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentWallet = walletCards[activeWalletCardIndex] || walletCards[0];
  const nextMonthDues = data.billsSummary?.unpaidBillsMonthlyBreakdown?.[0];

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
            accessibilityRole="button"
            accessibilityLabel="Go back"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={t.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.badgeRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.badgeText}>S-PAY ADMIN</Text>
            </View>
            <Text style={[styles.headerTitle, { color: t.textPrimary }]} numberOfLines={1}>
              Expenses & Cash Master
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            onPress={() => setShowExportCsvModal(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Export CSV"
          >
            <FileSpreadsheet size={16} color={t.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            onPress={() => setShowConfig(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Settings size={16} color={t.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            onPress={onRefresh}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            <RefreshCw size={16} color={t.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Toggle Theme"
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
              ₱{(data.balances?.totalLiquidCash ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              BDO: ₱{(data.balances?.bdoBalance || data.balances?.bankBalance || 0).toLocaleString()} • MariBank: ₱{(data.balances?.maribankBalance || 0).toLocaleString()}
            </Text>
          </View>

          {/* Stat 2: SPay Bill */}
          <View style={[styles.statCapsule, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.statCapsuleHeader}>
              <Text style={[styles.statCapsuleLabel, { color: t.textMuted }]}>SPAY UNPAID BILLS</Text>
              <CreditCard size={14} color="#ee4d2d" />
            </View>
            <Text style={[styles.statCapsuleValue, { color: '#ee4d2d' }]}>
              ₱{(data.billsSummary?.spayTotalUnpaid ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              {data.billsSummary?.spayCreditUtilizationPct ?? 0}% of ₱{(data.billsSummary?.spayCreditLimit ?? 50000).toLocaleString()} Limit
            </Text>
          </View>

          {/* Stat 3: Atome Bill */}
          <View style={[styles.statCapsule, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.statCapsuleHeader}>
              <Text style={[styles.statCapsuleLabel, { color: t.textMuted }]}>ATOME CARD BILL</Text>
              <CreditCard size={14} color="#f59e0b" />
            </View>
            <Text style={[styles.statCapsuleValue, { color: '#f59e0b' }]}>
              ₱{(data.billsSummary?.atomeTotalUnpaid ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              {data.billsSummary?.creditUtilizationPct ?? 0}% of ₱{(data.billsSummary?.atomeCreditLimit ?? 30000).toLocaleString()} Limit
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
              ₱{(data.balances?.totalIponSavings ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statCapsuleSub, { color: t.textSecondary }]}>
              Safe Cash: ₱{(data.balances?.iponSavingsBySource?.CASH || 0).toLocaleString()} • Vault: ₱{(data.balances?.iponSavingsBySource?.MARIBANK || 0).toLocaleString()}
            </Text>
          </View>
        </ScrollView>

        {/* 2. COUNTDOWN TIMER */}
        <View style={[styles.scheduleCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.scheduleHeader}>
            <View style={[styles.scheduleTitleRow, { flex: 1 }]}>
              <Calendar size={18} color={t.primary} />
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.scheduleTitle, { color: t.textPrimary, flexShrink: 1 }]} numberOfLines={1}>
                    {nextTarget.title || 'Billing Cycle Overview'}
                  </Text>
                </View>
                <Text style={styles.scheduleSubtitleText} numberOfLines={1}>
                  {nextTarget.formattedDate ? `Earliest due on ${nextTarget.formattedDate}` : 'No Billing Target'}
                </Text>
              </View>
            </View>
          </View>

          {/* Countdown timer layout */}
          <View style={[
            styles.countdownCardBody,
            {
              backgroundColor: isDarkMode ? 'rgba(22, 28, 42, 0.35)' : 'rgba(148, 163, 184, 0.12)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
            }
          ]}>
            {/* Left section: Countdown Clock */}
            <View style={styles.countdownLeftSection}>
              <CountdownTimer targetDate={nextTarget.date} parseDateFn={parseUtcDate}>
                {(tLeft) => (
                  <>
                    <View style={styles.flipClockRow}>
                      {tLeft.hasTarget ? (
                        <>
                          <FlipCard value={tLeft.days} label="Days" />
                          <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                          <FlipCard value={tLeft.hours} label="Hours" />
                          <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                          <FlipCard value={tLeft.minutes} label="Min" />
                          <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                          <FlipCard value={tLeft.seconds} label="Sec" />
                        </>
                      ) : (
                        <>
                          <FlipCard value={0} label="Days" />
                          <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                          <FlipCard value={0} label="Hours" />
                          <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                          <FlipCard value={0} label="Min" />
                          <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                          <FlipCard value={0} label="Sec" />
                        </>
                      )}
                    </View>
                    <View style={styles.countdownStatusRow}>
                      <Clock size={12} color={t.primary} />
                      <Text style={[styles.countdownStatusText, { color: t.primary }]}>
                        {!tLeft.hasTarget
                          ? 'No payments scheduled'
                          : tLeft.isOverdue
                            ? 'DEADLINE HAS PASSED'
                            : `Time Remaining Until ${nextTarget.formattedDate ? nextTarget.formattedDate : ''}`}
                      </Text>
                    </View>
                  </>
                )}
              </CountdownTimer>
            </View>
          </View>
        </View>

        {/* 3. CASH ON HAND BANNER WITH QUICK MICRO-ADJUSTMENTS */}
        <View style={[styles.cashOnHandBanner, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.cashBannerTopRow}>
            <View>
              <Text style={[styles.cashBannerSub, { color: t.textMuted }]}>LIQUID CASH ON HAND</Text>
              <Text style={[styles.cashBannerMain, { color: t.textPrimary }]}>
                ₱{(data.balances?.cashOnHand ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
            <View style={{ flex: 1, marginRight: 8 }}>
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
            showsHorizontalScrollIndicator={false}
            snapToInterval={SCREEN_WIDTH - 64 + 12}
            decelerationRate="fast"
            snapToAlignment="center"
            onMomentumScrollEnd={(e) => {
              const cardFullWidth = SCREEN_WIDTH - 64 + 12;
              const idx = Math.round(e.nativeEvent.contentOffset.x / cardFullWidth);
              setActiveWalletCardIndex(Math.max(0, Math.min(idx, walletCards.length - 1)));
            }}
            contentContainerStyle={styles.cardsScrollView}
          >
            {walletCards.map((c) => (
              <View
                key={c.id}
                style={[
                  styles.walletCardFrame,
                  { backgroundColor: c.bgColor, width: SCREEN_WIDTH - 64 },
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
          {tabItems.map((tab) => {
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
                {Object.entries((data.insights?.categoryTotals || {}) as Record<string, number>).map(([cat, amt]: [string, any], idx) => {
                  const catColors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6'];
                  const color = catColors[idx % catColors.length];
                  const totalExp = Object.values((data.insights?.categoryTotals || {}) as Record<string, number>).reduce((a: number, b: any) => a + Number(b || 0), 0) || 1;
                  const pct = Math.round((Number(amt || 0) / totalExp) * 100);
                  return (
                    <View key={cat} style={styles.categoryItemRow}>
                      <View style={styles.catLabelRow}>
                        <View style={styles.catLeft}>
                          <View style={[styles.catColorIndicator, { backgroundColor: color }]} />
                          <Text style={[styles.catName, { color: t.textPrimary }]}>{cat}</Text>
                        </View>
                        <Text style={[styles.catAmount, { color: t.textPrimary }]}>
                          ₱{Number(amt || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({pct}%)
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
                {Object.entries((data.insights?.sourceTotals || {}) as Record<string, number>).map(([src, amt]: [string, any]) => (
                  <View key={src} style={[styles.channelTile, { backgroundColor: isDarkMode ? '#141b2d' : '#f8fafc', borderColor: t.border }]}>
                    <Text style={styles.channelTileName}>{src}</Text>
                    <Text style={[styles.channelTileAmt, { color: t.textPrimary }]}>₱{Number(amt || 0).toLocaleString()}</Text>
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
                {(data.analytics?.monthlyCashFlow || []).map((m: any) => (
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
                    (data.atomeOrders || []).forEach((o: any) => {
                      (o.payments || []).forEach((p: any) => {
                        if (selectedAtomePaymentIds.includes(p.id)) total += Number(p.amountDue || 0);
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
              filteredAtomeOrders.map((order: any) => {
                const unpaidPayments = (order.payments || []).filter((p: any) => !p.isPaid);
                const nextUnpaid = unpaidPayments[0];
                const paidCount = (order.payments || []).filter((p: any) => p.isPaid).length;
                const totalCount = (order.payments || []).length;
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
              {(data.billsSummary?.unpaidBillsMonthlyBreakdown || []).map((b: any) => {
                const isFullyPaid = b.isFullyPaid || b.totalUnpaid === 0;
                const isExpanded = !!expandedMonthCards[b.month];
                return (
                  <TouchableOpacity
                    key={b.month}
                    style={[
                      styles.monthDeadlineCard,
                      { backgroundColor: t.surface, borderColor: isFullyPaid ? '#10b981' : t.border },
                    ]}
                    onPress={() => setExpandedMonthCards((prev: any) => ({ ...prev, [b.month]: !prev[b.month] }))}
                    activeOpacity={0.8}
                  >
                    <View style={styles.monthCardHeader}>
                      <View style={styles.monthCardTitleRow}>
                        <Calendar size={14} color="#ee4d2d" />
                        <Text style={[styles.monthCardTitle, { color: t.textPrimary }]}>{b.month}</Text>
                      </View>
                      <Text style={[styles.monthCardTotal, { color: isFullyPaid ? '#10b981' : '#ef4444' }]}>
                        {isFullyPaid ? '✓ PAID' : `₱${Number(b.totalUnpaid || b.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </Text>
                    </View>

                    <View style={styles.monthCardSubRow}>
                      <Text style={[styles.monthCardSubText, { color: t.textSecondary }]}>
                        SPay: ₱{Number(b.spay || 0).toLocaleString()} • Atome: ₱{Number(b.atome || 0).toLocaleString()}
                      </Text>
                      <Text style={[styles.monthCardDetailsToggle, { color: '#ee4d2d' }]}>
                        {isExpanded ? 'Hide Details ▲' : 'View Items ▼'}
                      </Text>
                    </View>

                    {/* Expandable items breakdown */}
                    {isExpanded && b.items && b.items.length > 0 && (
                      <View style={[styles.monthItemsList, { borderTopColor: t.border }]}>
                        {b.items.map((it: any, idx: number) => (
                          <View key={idx} style={styles.monthItemRow}>
                            <Text style={[styles.monthItemName, { color: t.textPrimary }]} numberOfLines={1}>{it.name}</Text>
                            <Text style={[styles.monthItemAmt, { color: it.isPaid ? '#10b981' : t.textPrimary }]}>
                              {it.isPaid ? '✓ ' : ''}₱{Number(it.amount || 0).toLocaleString()}
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
              {(data.upcomingPlannedPayments || []).map((p: any) => (
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
                      ₱{Number(p.amountDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
              filteredHistory.map((item: any) => (
                <View key={item.id} style={[styles.ledgerItemCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <View style={styles.ledgerCardLeft}>
                    <Text style={[styles.ledgerItemTitle, { color: t.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.ledgerItemMeta, { color: t.textMuted }]}>
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {item.category} • {item.source}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.ledgerItemAmount, { color: t.textPrimary }]}>
                      ₱{Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
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
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: -0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    width: 175,
    padding: 12,
    borderRadius: 18,
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
    fontVariant: ['tabular-nums'],
  },
  statCapsuleSub: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
  },
  // 2. Countdown Card & Flip Digits (Identical to Admin Dashboard)
  scheduleCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 16,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  scheduleSubtitleText: {
    fontSize: 11,
    color: '#ee4d2d',
    fontWeight: '600',
    marginTop: 1,
  },
  countdownCardBody: {
    backgroundColor: 'rgba(22, 28, 42, 0.35)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  countdownLeftSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  flipClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownSeparator: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    paddingBottom: 15,
  },
  flipCardCol: {
    alignItems: 'center',
    gap: 6,
  },
  flipCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  flipCardOuter: {
    width: 48,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  topHalfContainer: {
    height: 26,
    overflow: 'hidden',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    justifyContent: 'flex-start',
  },
  bottomHalfContainer: {
    height: 26,
    overflow: 'hidden',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'flex-end',
  },
  topText: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
  },
  bottomText: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
    marginTop: -26,
  },
  flapAnimated: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 26,
    backfaceVisibility: 'hidden',
  },
  flipCardDivider: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  flipCardLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countdownStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  countdownStatusText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // 3. Cash on Hand Banner & Micro Adjust
  cashOnHandBanner: {
    padding: 16,
    borderRadius: 22,
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
    fontVariant: ['tabular-nums'],
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
