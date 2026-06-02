import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Image,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Animated,
  Easing,
  Share,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Receipt,
  Search,
  ChevronRight,
  Sliders,
  Calendar,
  CreditCard,
  User,
  X,
  Check,
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
  MoreVertical,
  CheckSquare,
  Square,
  FileImage,
  TrendingUp,
  DollarSign,
  Clock,
  FileText,
  Mail,
  Share2,
  ChevronUp,
  ChevronDown,
  Activity,
  ListTodo,
  BarChart3,
  History as HistoryIcon,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAllAdminData, callAdminApi } from '../../services/adminService';
import dayjs from 'dayjs';
import AdminHeader from '../../components/AdminHeader';

type PaymentSubTab = 'ledger' | 'breakdown' | 'logs' | 'receipts';

const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getBillingMonthKey(dueDateStr: string): string {
  const d = new Date(dueDateStr);
  if (d.getDate() >= 5) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const prev = new Date(d);
  prev.setMonth(prev.getMonth() - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function formatBillingMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Flip clock sub-component
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

  const topFlipProgress = useRef(new Animated.Value(1)).current;
  const bottomFlipProgress = useRef(new Animated.Value(1)).current;
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

      Animated.parallel([
        Animated.timing(topFlipProgress, {
          toValue: 1,
          duration: FLIP_PHASE_MS,
          easing: flipEaseIn,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(FLIP_PHASE_MS),
          Animated.timing(bottomFlipProgress, {
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
            <Animated.View
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
                }
              ]}
            >
              <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
                <Text style={[styles.topText, { color: textColorTop }]}>{previous}</Text>
              </View>
            </Animated.View>
          )}

          {/* 4. Animated Bottom Flap */}
          {activeFlip && (
            <Animated.View
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
                }
              ]}
            >
              <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
                <Text style={[styles.bottomText, { color: textColorBottom }]}>{current}</Text>
              </View>
            </Animated.View>
          )}

          <View style={styles.flipCardDivider} />
        </View>
      </View>
      <Text style={[styles.flipCardLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
});

export default function AdminPaymentsScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [profiles, setProfiles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);

  // Sub-tab state ('ledger' | 'breakdown' | 'logs' | 'receipts')
  const [subTab, setSubTab] = useState<PaymentSubTab>('ledger');
  const [pendingSubTab, setPendingSubTab] = useState<PaymentSubTab | null>(null);
  const [ledgerViewMode, setLedgerViewMode] = useState<'list' | 'table'>('list');
  const [breakdownViewMode, setBreakdownViewMode] = useState<'list' | 'table'>('list');

  // Tab 1: Ledger Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'proof'>('all');

  // Tab 2: Monthly breakdown expanded states
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [breakdownFilter, setBreakdownFilter] = useState<'all' | 'completed' | 'pending' | 'overdue'>('all');
  const [breakdownPage, setBreakdownPage] = useState(1);

  // Tab 3: Payment Logs Search & filter state
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilterType, setLogFilterType] = useState('all');
  const [logFilterPeriod, setLogFilterPeriod] = useState('all');

  // Tab 4: Receipts Search & filter state
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [receiptClientFilter, setReceiptClientFilter] = useState('');
  const [receiptYearFilter, setReceiptYearFilter] = useState('');
  const [receiptMonthFilter, setReceiptMonthFilter] = useState('');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('');
  const [receiptPickerType, setReceiptPickerType] = useState<'client' | 'year' | 'month' | 'status' | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [receiptPreviewHtml, setReceiptPreviewHtml] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  // Modals state
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Countdown timer & next billing schedule
  const [nextBillingSchedule, setNextBillingSchedule] = useState<any>({
    monthName: '',
    totalDue: 0,
    earliestDueDate: null,
    clients: [],
  });
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOverdue: false,
    hasTarget: false,
  });

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const toggleClientExpand = (clientId: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const result = await fetchAllAdminData();
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync payments record ledger.');
      }
      setProfiles(result.profiles || []);
      setOrders(result.orders || []);
      setPayments(result.payments || []);
      setPaymentLogs(result.paymentLogs || []);
    } catch (err: any) {
      console.warn('[AdminPaymentsScreen] Load error:', err);
      setError(err?.message || 'Sync failed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (pendingSubTab !== subTab) return;
    const timer = setTimeout(() => setPendingSubTab(null), 180);
    return () => clearTimeout(timer);
  }, [pendingSubTab, subTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, ledgerFilter, subTab]);

  useEffect(() => {
    setBreakdownPage(1);
  }, [breakdownFilter, breakdownViewMode, subTab]);

  useEffect(() => {
    if (!selectedReceipt || !isReceiptPreviewOpen) {
      setReceiptPreviewHtml('');
      return;
    }

    const fetchReceiptPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const [yearStr, monthStr] = selectedReceipt.monthKey.split('-');
        const response = await callAdminApi('preview-receipt', {
          clientId: selectedReceipt.clientId,
          year: Number(yearStr),
          month: Number(monthStr),
        });

        if (response.success) {
          setReceiptPreviewHtml(response.html);
        } else {
          Alert.alert('Error', response.error || 'Failed to fetch receipt email preview.');
        }
      } catch (err) {
        console.warn('Failed to load receipt email preview:', err);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchReceiptPreview();
  }, [selectedReceipt, isReceiptPreviewOpen]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleSubTabPress = (nextTab: PaymentSubTab) => {
    if (nextTab === subTab) return;
    setPendingSubTab(nextTab);
    setSelectedIds([]);
    setBulkMode(false);
    requestAnimationFrame(() => {
      setSubTab(nextTab);
    });
  };

  const orderById = useMemo(() => new Map(orders.map(order => [order.id, order])), [orders]);
  const profileById = useMemo(() => new Map(profiles.map(profile => [profile.id, profile])), [profiles]);

  // Process payments list once per data refresh instead of rejoining on every render.
  const processedPayments = useMemo(() => {
    const now = Date.now();
    return payments.map(p => {
      const order = orderById.get(p.order_id);
      const client = profileById.get(order?.user_id);
      const isOverdue = !p.is_paid && new Date(p.due_date).getTime() < now;

      return {
        ...p,
        itemName: order?.item_name || 'Purchase Order',
        totalMonths: order?.installment_months || 0,
        clientName: client?.name || 'Unknown Client',
        clientEmail: client?.email || '',
        clientId: client?.id || '',
        isOverdue,
      };
    });
  }, [orderById, payments, profileById]);

  // Calculation for stat cards & countdown (client-side)
  const {
    totalAmount,
    totalCollected,
    collectionRate,
    overdueItems,
    totalOverdueAmount,
    totalUpcomingAmount,
  } = useMemo(() => {
    let total = 0;
    let collected = 0;
    let overdueAmount = 0;
    let upcomingAmount = 0;
    const overdue: any[] = [];

    processedPayments.forEach(payment => {
      const amount = Number(payment.amount_due);
      total += amount;
      if (payment.is_paid) {
        collected += amount;
        return;
      }
      if (payment.isOverdue) {
        overdue.push(payment);
        overdueAmount += amount;
      } else {
        upcomingAmount += amount;
      }
    });

    return {
      totalAmount: total,
      totalCollected: collected,
      collectionRate: total > 0 ? (collected / total) * 100 : 0,
      overdueItems: overdue,
      totalOverdueAmount: overdueAmount,
      totalUpcomingAmount: upcomingAmount,
    };
  }, [processedPayments]);

  // Next Billing Month Schedule calculation
  useEffect(() => {
    if (payments.length === 0) return;
    const now = new Date();
    const unpaid = payments.filter(p => !p.is_paid);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const fromMonthKey = `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}`;
    
    const unpaidByMonth = new Map<string, any[]>();
    unpaid.forEach(payment => {
      const monthKey = getBillingMonthKey(payment.due_date);
      if (monthKey < fromMonthKey) return;
      const list = unpaidByMonth.get(monthKey) || [];
      list.push(payment);
      unpaidByMonth.set(monthKey, list);
    });
    
    const sortedKeys = Array.from(unpaidByMonth.keys()).sort();
    const nextMonthKey = sortedKeys[0];
    
    if (nextMonthKey) {
      const monthPayments = unpaidByMonth.get(nextMonthKey) || [];
      const earliestDue = monthPayments.length > 0
        ? monthPayments.map(p => p.due_date).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
        : null;
        
      const [yearStr, monthStr] = nextMonthKey.split('-');
      const monthName = new Date(Number(yearStr), Number(monthStr) - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      
    const clientBillingMap = new Map<string, any>();
    monthPayments.forEach(payment => {
        const order = orderById.get(payment.order_id);
        if (!order) return;
        const profile = profileById.get(order.user_id);
        if (!profile) return;
        
        const clientData = clientBillingMap.get(profile.id) || {
          clientId: profile.id,
          clientName: profile.name,
          email: profile.email,
          totalOwed: 0,
          items: [],
        };
        
        clientData.totalOwed += Number(payment.amount_due);
        clientData.items.push({
          itemName: order.item_name,
          amountDue: Number(payment.amount_due),
          dueDate: payment.due_date,
          monthNumber: payment.month_number,
          installmentMonths: order.installment_months,
        });
        clientBillingMap.set(profile.id, clientData);
      });
      
      const nextBillingClients = Array.from(clientBillingMap.values()).sort((a, b) => b.totalOwed - a.totalOwed);
      const nextBillingTotal = nextBillingClients.reduce((sum, c) => sum + c.totalOwed, 0);
      
      setNextBillingSchedule({
        monthName,
        totalDue: nextBillingTotal,
        earliestDueDate: earliestDue,
        clients: nextBillingClients,
      });
    } else {
      setNextBillingSchedule({
        monthName: '',
        totalDue: 0,
        earliestDueDate: null,
        clients: [],
      });
    }
  }, [orderById, payments, profileById]);

  // Countdown timer clock
  useEffect(() => {
    if (!nextBillingSchedule.earliestDueDate) {
      setTimeLeft(prev => ({ ...prev, hasTarget: false }));
      return;
    }
    const targetDate = new Date(nextBillingSchedule.earliestDueDate);
    const calc = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: true, hasTarget: true });
      } else {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60),
          isOverdue: false,
          hasTarget: true,
        });
      }
    };
    calc();
    const clockTimer = setInterval(calc, 1000);
    return () => clearInterval(clockTimer);
  }, [nextBillingSchedule.earliestDueDate]);

  // Tab 1: Filtered payments
  const filteredPayments = useMemo(() => processedPayments.filter(p => {
    const matchesSearch = p.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (ledgerFilter === 'paid') {
      return p.is_paid;
    } else if (ledgerFilter === 'pending') {
      return !p.is_paid;
    } else if (ledgerFilter === 'overdue') {
      return p.isOverdue;
    } else if (ledgerFilter === 'proof') {
      return !p.is_paid && p.proof_of_payment !== null && p.proof_of_payment !== '';
    }
    return true;
  }), [ledgerFilter, processedPayments, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const paginatedPayments = useMemo(
    () => filteredPayments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredPayments]
  );

  // Tab 2: Monthly Breakdown Data Builder
  const monthlyBreakdown = useMemo(() => {
    if (subTab !== 'breakdown' && subTab !== 'receipts') return {};

    const monthsGroup: Record<string, {
      monthName: string;
      totalAmount: number;
      paidAmount: number;
      pendingAmount: number;
      totalCount: number;
      paidCount: number;
      pendingCount: number;
      collectionRate: number;
      clients: Record<string, {
        name: string;
        email: string;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
        totalCount: number;
        paidCount: number;
        pendingCount: number;
        collectionRate: number;
        payments: any[];
      }>;
    }> = {};

    processedPayments.forEach(payment => {
      if (subTab === 'breakdown') {
        if (breakdownFilter === 'completed' && !payment.is_paid) return;
        if (breakdownFilter === 'pending' && payment.is_paid) return;
        if (breakdownFilter === 'overdue' && (!payment.isOverdue || payment.is_paid)) return;
      }

      const monthKey = getBillingMonthKey(payment.due_date);
      const monthName = formatBillingMonthKey(monthKey);

      if (!monthsGroup[monthKey]) {
        monthsGroup[monthKey] = {
          monthName,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          totalCount: 0,
          paidCount: 0,
          pendingCount: 0,
          collectionRate: 0,
          clients: {},
        };
      }

      const m = monthsGroup[monthKey];
      const clientId = payment.clientId;

      if (!m.clients[clientId]) {
        m.clients[clientId] = {
          name: payment.clientName,
          email: payment.clientEmail || '',
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          totalCount: 0,
          paidCount: 0,
          pendingCount: 0,
          collectionRate: 0,
          payments: [],
        };
      }

      const c = m.clients[clientId];
      c.payments.push(payment);

      m.totalAmount += Number(payment.amount_due);
      m.totalCount++;
      c.totalAmount += Number(payment.amount_due);
      c.totalCount++;

      if (payment.is_paid) {
        m.paidAmount += Number(payment.amount_due);
        m.paidCount++;
        c.paidAmount += Number(payment.amount_due);
        c.paidCount++;
      } else {
        m.pendingAmount += Number(payment.amount_due);
        m.pendingCount++;
        c.pendingAmount += Number(payment.amount_due);
        c.pendingCount++;
      }
    });

    Object.keys(monthsGroup).forEach(mKey => {
      const m = monthsGroup[mKey];
      m.collectionRate = m.totalAmount > 0 ? (m.paidAmount / m.totalAmount) * 100 : 0;

      Object.keys(m.clients).forEach(cId => {
        const c = m.clients[cId];
        c.collectionRate = c.totalAmount > 0 ? (c.paidAmount / c.totalAmount) * 100 : 0;
        c.payments.sort((a, b) => a.month_number - b.month_number);
      });
    });

    return monthsGroup;
  }, [breakdownFilter, processedPayments, subTab]);

  const BREAKDOWN_PAGE_SIZE = 5;

  const sortedMonthKeys = useMemo(() => Object.keys(monthlyBreakdown)
    .sort()
    .reverse()
    .filter(mKey => {
      const monthData = monthlyBreakdown[mKey];
      return Object.keys(monthData.clients).length > 0;
    }), [monthlyBreakdown]);

  const totalBreakdownListPages = Math.max(1, Math.ceil(sortedMonthKeys.length / BREAKDOWN_PAGE_SIZE));
  const paginatedMonthKeys = useMemo(
    () => sortedMonthKeys.slice(
      (breakdownPage - 1) * BREAKDOWN_PAGE_SIZE,
      breakdownPage * BREAKDOWN_PAGE_SIZE
    ),
    [breakdownPage, sortedMonthKeys]
  );

  const filteredBreakdownPayments = useMemo(() => {
    if (subTab !== 'breakdown') return [];
    return processedPayments
    .filter(payment => {
      if (breakdownFilter === 'completed') return payment.is_paid;
      if (breakdownFilter === 'pending') return !payment.is_paid;
      if (breakdownFilter === 'overdue') return payment.isOverdue && !payment.is_paid;
      return true;
    })
    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
  }, [breakdownFilter, processedPayments, subTab]);

  const totalBreakdownTablePages = Math.max(1, Math.ceil(filteredBreakdownPayments.length / PAGE_SIZE));
  const paginatedBreakdownPayments = useMemo(
    () => filteredBreakdownPayments.slice(
      (breakdownPage - 1) * PAGE_SIZE,
      breakdownPage * PAGE_SIZE
    ),
    [breakdownPage, filteredBreakdownPayments]
  );

  const getUnpaidIdsForMonth = (monthData: any): string[] => {
    const ids: string[] = [];
    Object.values(monthData.clients).forEach((client: any) => {
      client.payments.forEach((payment: any) => {
        if (!payment.is_paid) {
          ids.push(payment.id);
        }
      });
    });
    return ids;
  };

  const getUnpaidIdsForClient = (clientData: any): string[] => {
    return clientData.payments.filter((p: any) => !p.is_paid).map((p: any) => p.id);
  };

  const toggleSelectMonth = (monthData: any) => {
    const unpaidIds = getUnpaidIdsForMonth(monthData);
    if (unpaidIds.length === 0) return;
    const allSelected = unpaidIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !unpaidIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const next = [...prev];
        unpaidIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const toggleSelectClient = (clientData: any) => {
    const unpaidIds = getUnpaidIdsForClient(clientData);
    if (unpaidIds.length === 0) return;
    const allSelected = unpaidIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !unpaidIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const next = [...prev];
        unpaidIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Tab 3: Processed Activity Logs
  const paymentById = useMemo(() => new Map(payments.map(payment => [payment.id, payment])), [payments]);

  const processedLogs = useMemo(() => {
    if (subTab !== 'logs') return [];

    return paymentLogs.map(log => {
      const performer = profileById.get(log.performed_by_id);
      const payment = paymentById.get(log.payment_id);
      const order = payment ? orderById.get(payment.order_id) : null;
      const client = order ? profileById.get(order.user_id) : null;

      return {
        ...log,
        performerName: performer?.name || 'System',
        performerRole: performer?.role || 'SYSTEM',
        amountDue: payment?.amount_due || null,
        itemName: order?.item_name || null,
        clientName: client?.name || null,
      };
    });
  }, [orderById, paymentById, paymentLogs, profileById, subTab]);

  const filteredLogs = useMemo(() => processedLogs.filter(log => {
    const matchesSearch = log.action_description.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.performerName.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.clientName && log.clientName.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
      (log.itemName && log.itemName.toLowerCase().includes(logSearchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (logFilterType !== 'all' && log.action_type !== logFilterType) return false;

    if (logFilterPeriod !== 'all') {
      const logDate = new Date(log.performed_at).getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      if (logFilterPeriod === 'today' && nowMs - logDate > dayMs) return false;
      if (logFilterPeriod === 'week' && nowMs - logDate > 7 * dayMs) return false;
      if (logFilterPeriod === 'month' && nowMs - logDate > 30 * dayMs) return false;
    }

    return true;
  }), [logFilterPeriod, logFilterType, logSearchQuery, processedLogs]);

  // Tab 4: Receipts lists
  const receiptsList = useMemo(() => {
    if (subTab !== 'receipts') return [];

    const list: any[] = [];
    Object.keys(monthlyBreakdown).forEach(mKey => {
      const m = monthlyBreakdown[mKey];
      Object.keys(m.clients).forEach(cId => {
        const c = m.clients[cId];
        let paymentStatus: 'fully_paid' | 'partially_paid' | 'unpaid' = 'unpaid';
        if (c.pendingCount === 0) {
          paymentStatus = 'fully_paid';
        } else if (c.paidCount > 0) {
          paymentStatus = 'partially_paid';
        }

        list.push({
          key: `${cId}-${mKey}`,
          clientId: cId,
          clientName: c.name,
          clientEmail: c.email,
          monthKey: mKey,
          monthName: m.monthName,
          totalAmount: c.totalAmount,
          paidAmount: c.paidAmount,
          pendingAmount: c.pendingAmount,
          totalCount: c.totalCount,
          paidCount: c.paidCount,
          pendingCount: c.pendingCount,
          collectionRate: c.collectionRate,
          paymentStatus,
          payments: c.payments,
        });
      });
    });
    return list;
  }, [monthlyBreakdown, subTab]);

  const filteredReceipts = useMemo(() => receiptsList.filter(r => {
    const matchesSearch = r.clientName.toLowerCase().includes(receiptSearchQuery.toLowerCase()) ||
      r.clientEmail.toLowerCase().includes(receiptSearchQuery.toLowerCase()) ||
      r.monthName.toLowerCase().includes(receiptSearchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (receiptClientFilter && r.clientId !== receiptClientFilter) return false;

    if (receiptYearFilter) {
      const [year] = r.monthKey.split('-');
      if (year !== receiptYearFilter) return false;
    }

    if (receiptMonthFilter) {
      const [, month] = r.monthKey.split('-');
      if (Number(month) !== Number(receiptMonthFilter)) return false;
    }

    if (receiptStatusFilter) {
      if (receiptStatusFilter === 'fully_paid' && r.paymentStatus !== 'fully_paid') return false;
      if (receiptStatusFilter === 'partially_paid' && r.paymentStatus !== 'partially_paid') return false;
      if (receiptStatusFilter === 'unpaid' && r.paymentStatus !== 'unpaid') return false;
    }

    return true;
  }), [receiptClientFilter, receiptMonthFilter, receiptSearchQuery, receiptStatusFilter, receiptYearFilter, receiptsList]);

  // Action Handlers
  const handleSelectToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleBulkClear = async () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      'Bulk Mark Paid',
      `Clear installment dues for all ${selectedIds.length} selected items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Clear',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await callAdminApi('bulk-mark-paid', { ids: selectedIds });
              if (response.success) {
                Alert.alert('Success', `Successfully cleared ${response.count} payments.`);
                setSelectedIds([]);
                setBulkMode(false);
                loadData(false);
              } else {
                Alert.alert('Error', response.error || 'Failed bulk marks.');
              }
            } catch (e: any) {
              Alert.alert('Network Error', e?.message || 'Server did not respond.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkPaid = async (paymentId: string) => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('mark-payment-paid', { id: paymentId });
      if (response.success) {
        Alert.alert('Success', 'Payment marked as cleared.');
        setIsDetailsOpen(false);
        loadData(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to mark payment as paid.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveProof = async (paymentId: string) => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('approve-payment-proof', { id: paymentId });
      if (response.success) {
        Alert.alert('Success', 'Payment proof approved and verified.');
        setIsDetailsOpen(false);
        loadData(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to verify payment proof.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectProofSubmit = async () => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('reject-payment-proof', {
        id: selectedPayment.id,
        reason: rejectReason || undefined,
      });

      if (response.success) {
        Alert.alert('Rejected', 'Payment proof rejected. Client notified.');
        setIsRejectOpen(false);
        setIsDetailsOpen(false);
        setRejectReason('');
        loadData(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to reject payment proof.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendReceipt = async (clientId: string, dateStr: string) => {
    setActionLoading(true);
    try {
      const date = new Date(dateStr);
      const response = await callAdminApi('resend-receipt', {
        clientId,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
      });

      if (response.success) {
        Alert.alert('Success', 'Monthly payment receipt resent to client email.');
      } else {
        Alert.alert('Error', response.error || 'Failed to resend receipt.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareReceipt = async (receipt: any) => {
    try {
      const message = `S-Pay Payment Receipt\n\nClient: ${receipt.clientName}\nPeriod: ${receipt.monthName}\nTotal Due: ${formatCurrency(receipt.totalAmount)}\nPaid: ${formatCurrency(receipt.paidAmount)}\nPending: ${formatCurrency(receipt.pendingAmount)}\nCollection Rate: ${receipt.collectionRate.toFixed(1)}%\nStatus: ${receipt.paymentStatus.toUpperCase().replace('_', ' ')}`;
      await Share.share({
        message,
        title: `Receipt - ${receipt.clientName}`,
      });
    } catch (e) {
      console.warn('Share error', e);
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

  // Years for filter dropdowns. Keep hooks above early returns to preserve hook order.
  const availableYears = useMemo(
    () => Array.from(new Set(receiptsList.map(r => r.monthKey.split('-')[0]))).sort(),
    [receiptsList]
  );

  const clientsList = useMemo(() => {
    const clientMap = new Map<string, { id: string; name: string }>();
    profiles.forEach(p => {
      if (p.role === 'CLIENT' || p.role === 'client') {
        clientMap.set(p.id, { id: p.id, name: p.name });
      }
    });
    receiptsList.forEach(r => {
      if (!clientMap.has(r.clientId)) {
        clientMap.set(r.clientId, { id: r.clientId, name: r.clientName });
      }
    });
    return Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, receiptsList]);
  const tabLabels: Record<PaymentSubTab, string> = {
    ledger: 'Ledger',
    breakdown: 'Breakdown',
    logs: 'Activity Logs',
    receipts: 'Receipts',
  };

  if (loading) {
    return (
      <PremiumLoader
        title="Admin Control Center"
        subtitle="Loading payments ledger and verifying receipts..."
        error={error}
        onRetry={() => loadData()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <AdminHeader title="Payments Ledger" subtitle="Operations Center" />

      <ScrollView
        contentContainerStyle={[styles.mainScrollContent]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* Countdown card */}
        {nextBillingSchedule.earliestDueDate && (
          <View style={[styles.scheduleCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.scheduleHeader}>
              <View style={styles.scheduleTitleRow}>
                <Calendar size={18} color={t.accent} />
                <View>
                  <Text style={[styles.scheduleTitle, { color: t.textPrimary }]}>Next Billing Cycle Overview</Text>
                  <Text style={styles.scheduleSubtitleText}>
                    {nextBillingSchedule.monthName || 'No Billing Target'}
                    {nextBillingSchedule.earliestDueDate && ` • Earliest due on ${formatRelativeDate(nextBillingSchedule.earliestDueDate)}`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsScheduleOpen(!isScheduleOpen)}>
                {isScheduleOpen ? <ChevronUp size={18} color={t.textSecondary} /> : <ChevronDown size={18} color={t.textSecondary} />}
              </TouchableOpacity>
            </View>

            {/* Countdown timer layout */}
            <View style={[styles.countdownCardBody, layout.isTablet && styles.rowLayout]}>
              {/* Left section: Countdown Clock */}
              <View style={[styles.countdownLeftSection, layout.isTablet && { flex: 7, borderBottomWidth: 0, paddingBottom: 0 }]}>
                <View style={styles.flipClockRow}>
                  {timeLeft.hasTarget ? (
                    <>
                      <FlipCard value={timeLeft.days} label="Days" />
                      <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                      <FlipCard value={timeLeft.hours} label="Hours" />
                      <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                      <FlipCard value={timeLeft.minutes} label="Min" />
                      <Text style={[styles.countdownSeparator, { color: t.textSecondary }]}>:</Text>
                      <FlipCard value={timeLeft.seconds} label="Sec" />
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
                  <Clock size={12} color={t.accent} />
                  <Text style={[styles.countdownStatusText, { color: t.accent }]}>
                    {!timeLeft.hasTarget
                      ? 'No payments scheduled'
                      : timeLeft.isOverdue
                      ? 'DEADLINE HAS PASSED'
                      : `Time Remaining Until ${nextBillingSchedule.earliestDueDate ? formatRelativeDate(nextBillingSchedule.earliestDueDate) : ''}`}
                  </Text>
                </View>
              </View>

              {/* Divider line */}
              {layout.isTablet ? (
                <View style={[styles.verticalDivider, { backgroundColor: t.border }]} />
              ) : (
                <View style={[styles.horizontalDivider, { backgroundColor: t.border }]} />
              )}

              {/* Right section: Total Collection Due */}
              <View style={[styles.collectionRightSection, layout.isTablet && { flex: 5, paddingLeft: 20, alignItems: 'flex-start' }]}>
                <Text style={styles.collectionLabel}>TOTAL COLLECTION DUE</Text>
                <Text style={[styles.collectionValue, { color: t.textPrimary }]} numberOfLines={1}>
                  {formatCurrency(nextBillingSchedule.totalDue)}
                </Text>
                <Text style={[styles.collectionSubtext, { color: t.textSecondary }]}>
                  Total outstanding due from <Text style={{ color: t.accent, fontWeight: '800' }}>{nextBillingSchedule.clients.length}</Text> active clients.
                </Text>
              </View>
            </View>

            {isScheduleOpen && (
              <View style={styles.scheduleExpandedList}>
                {nextBillingSchedule.clients.length > 0 ? (
                  nextBillingSchedule.clients.map((client: any) => {
                    const expanded = !!expandedClients[client.clientId];
                    return (
                      <View key={client.clientId} style={[styles.scheduleItemRow, { borderBottomColor: t.border }]}>
                        <TouchableOpacity
                          style={styles.scheduleItemTop}
                          onPress={() => toggleClientExpand(client.clientId)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.scheduleItemLeft}>
                            <Text style={[styles.clientNameText, { color: t.textPrimary }]}>{client.clientName}</Text>
                            <Text style={styles.clientEmailText}>{client.email}</Text>
                          </View>
                          <View style={styles.scheduleItemRight}>
                            <Text style={[styles.clientOwedText, { color: t.textPrimary }]}>{formatCurrency(client.totalOwed)}</Text>
                            {expanded ? <ChevronUp size={14} color={t.textSecondary} /> : <ChevronDown size={14} color={t.textSecondary} />}
                          </View>
                        </TouchableOpacity>

                        {expanded && (
                          <View style={styles.clientPaymentsList}>
                            {client.items.map((item: any, idx: number) => (
                              <View key={idx} style={styles.subPaymentRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.subPaymentItem, { color: t.textPrimary }]}>{item.itemName}</Text>
                                  <Text style={styles.subPaymentTerm}>Month {item.monthNumber} of {item.installmentMonths}</Text>
                                </View>
                                <Text style={[styles.subPaymentAmount, { color: t.textPrimary }]}>{formatCurrency(item.amountDue)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No upcoming billing schedule.</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Statistics Cards */}
        <View style={styles.statsGrid}>
          {/* Card 1: Total Portfolio */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statCardLabel, { color: t.textSecondary }]}>TOTAL PORTFOLIO</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(238, 77, 45, 0.06)' }]}>
                <Receipt size={14} color="#ee4d2d" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{formatCurrency(totalAmount)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Upcoming: {formatCurrency(totalUpcomingAmount)}
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${collectionRate}%`, backgroundColor: '#ee4d2d' }]} />
              </View>
            </View>
          </View>

          {/* Card 2: Total Collected */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statCardLabel, { color: t.textSecondary }]}>TOTAL COLLECTED</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.06)' }]}>
                <DollarSign size={14} color="#10b981" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{formatCurrency(totalCollected)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Rate: {collectionRate.toFixed(1)}% Settled
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${collectionRate}%`, backgroundColor: '#10b981' }]} />
              </View>
            </View>
          </View>

          {/* Card 3: Default Arrears */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statCardLabel, { color: t.textSecondary }]}>OVERDUE ARREARS</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.06)' }]}>
                <AlertCircle size={14} color="#ef4444" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: '#ef4444' }]} numberOfLines={1}>{formatCurrency(totalOverdueAmount)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                {overdueItems.length} overdue installments
              </Text>
              {totalOverdueAmount > 0 ? (
                <View style={styles.alertIndicatorRow}>
                  <View style={styles.redPingDot} />
                  <Text style={styles.alertIndicatorText}>HIGH EXPOSURE ALERT</Text>
                </View>
              ) : (
                <View style={styles.alertIndicatorRow}>
                  <View style={[styles.redPingDot, { backgroundColor: '#10b981' }]} />
                  <Text style={[styles.alertIndicatorText, { color: '#10b981' }]}>HEALTHY PORTFOLIO</Text>
                </View>
              )}
            </View>
          </View>

          {/* Card 4: Client Base */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statCardLabel, { color: t.textSecondary }]}>CLIENT BASE</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.06)' }]}>
                <User size={14} color="#3b82f6" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{profiles.length} Accounts</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Settle Rate: {collectionRate.toFixed(0)}%
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${collectionRate}%`, backgroundColor: '#3b82f6' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Collection Portfolio Breakdown Row Chart */}
        <View style={[styles.breakdownRowCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.breakdownHeaderRow}>
            <Text style={[styles.breakdownTitle, { color: t.textSecondary }]}>COLLECTION PORTFOLIO BREAKDOWN</Text>
            <Text style={[styles.breakdownTotal, { color: t.textPrimary }]}>Total: {formatCurrency(totalAmount)}</Text>
          </View>
          <View style={styles.segmentedProgressBar}>
            {totalAmount > 0 ? (
              <>
                {totalCollected > 0 && (
                  <View style={[styles.progressSegment, { backgroundColor: '#10b981', flex: totalCollected }]} />
                )}
                {totalUpcomingAmount > 0 && (
                  <View style={[styles.progressSegment, { backgroundColor: isDarkMode ? '#475569' : '#94a3b8', flex: totalUpcomingAmount }]} />
                )}
                {totalOverdueAmount > 0 && (
                  <View style={[styles.progressSegment, { backgroundColor: '#ef4444', flex: totalOverdueAmount }]} />
                )}
              </>
            ) : (
              <View style={[styles.progressSegment, { backgroundColor: t.border, flex: 1 }]} />
            )}
          </View>
          <View style={styles.progressLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={[styles.legendText, { color: t.textSecondary }]}>Paid ({totalAmount > 0 ? ((totalCollected/totalAmount)*100).toFixed(0) : 0}%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#475569' : '#94a3b8' }]} />
              <Text style={[styles.legendText, { color: t.textSecondary }]}>Upcoming ({totalAmount > 0 ? ((totalUpcomingAmount/totalAmount)*100).toFixed(0) : 0}%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={[styles.legendText, { color: t.textSecondary }]}>Overdue ({totalAmount > 0 ? ((totalOverdueAmount/totalAmount)*100).toFixed(0) : 0}%)</Text>
            </View>
          </View>
        </View>

        {/* Navigation Sub-Tabs */}
        <View style={styles.subTabNav}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabNavContainer}>
            {[
              { id: 'ledger', label: 'Ledger', icon: ListTodo },
              { id: 'breakdown', label: 'Breakdown', icon: BarChart3 },
              { id: 'logs', label: 'Activity Logs', icon: HistoryIcon },
              { id: 'receipts', label: 'Receipts', icon: Receipt },
            ].map(tab => {
              const TabIcon = tab.icon;
              const tabId = tab.id as PaymentSubTab;
              const active = subTab === tabId;
              const pending = pendingSubTab === tabId;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.subTabBtn, active && { backgroundColor: t.accentLight, borderColor: t.accent }]}
                  onPress={() => handleSubTabPress(tabId)}
                  disabled={pending}
                >
                  {pending ? (
                    <ActivityIndicator size="small" color={t.accent} />
                  ) : (
                    <TabIcon size={14} color={active ? t.accent : t.textSecondary} />
                  )}
                  <Text style={[styles.subTabBtnText, { color: active || pending ? t.accent : t.textSecondary }]}>
                    {pending ? 'Loading...' : tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {(pendingSubTab || refreshing) && (
          <View style={[styles.fetchingBanner, { backgroundColor: t.accentLight, borderColor: t.accent }]}>
            <ActivityIndicator size="small" color={t.accent} />
            <Text style={[styles.fetchingBannerText, { color: t.accent }]}>
              {refreshing ? 'Fetching latest payment data...' : `Preparing ${tabLabels[pendingSubTab ?? subTab]} view...`}
            </Text>
          </View>
        )}

        {/* Tab content rendering */}

        {/* ─── TAB 1: LEDGER ─── */}
        {subTab === 'ledger' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Filter Toolbar */}
            <View style={[styles.searchSection, { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 0 }]}>
              <View style={[styles.searchBox, { flex: 1, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Search size={18} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search by client name, item..."
                  placeholderTextColor={t.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.bulkToggleBtn, { borderColor: t.cardBorder, borderWidth: 1.5, marginTop: 0 }]}
                onPress={() => setLedgerViewMode(ledgerViewMode === 'list' ? 'table' : 'list')}
              >
                {ledgerViewMode === 'list' ? (
                  <>
                    <FileText size={14} color={t.textSecondary} />
                    <Text style={[styles.bulkToggleText, { color: t.textSecondary, fontSize: 11 }]}>Table</Text>
                  </>
                ) : (
                  <>
                    <ListTodo size={14} color={t.textSecondary} />
                    <Text style={[styles.bulkToggleText, { color: t.textSecondary, fontSize: 11 }]}>List</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkToggleBtn, bulkMode && { backgroundColor: t.accentLight }, { borderColor: t.cardBorder, borderWidth: 1.5, marginTop: 0 }]}
                onPress={() => {
                  setBulkMode(!bulkMode);
                  setSelectedIds([]);
                }}
              >
                <CheckSquare size={16} color={bulkMode ? t.accent : t.textSecondary} />
                <Text style={[styles.bulkToggleText, { color: bulkMode ? t.accent : t.textSecondary, fontSize: 11 }]}>Bulk</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Pills */}
            <View style={styles.tabsWrapper}>
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'paid', label: 'Cleared' },
                  { key: 'overdue', label: 'Overdue' },
                  { key: 'proof', label: 'Requires Review' },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabBtn,
                      ledgerFilter === tab.key && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setLedgerFilter(tab.key as any)}
                  >
                    <Text style={[styles.tabBtnText, { color: ledgerFilter === tab.key ? t.accent : t.textSecondary }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Ledger content based on view mode */}
            {ledgerViewMode === 'list' ? (
              <View style={styles.ledgerList}>
                {paginatedPayments.length > 0 ? (
                  paginatedPayments.map((payment) => {
                    const selected = selectedIds.includes(payment.id);
                    const hasProof = payment.proof_of_payment !== null && payment.proof_of_payment !== '';
                    return (
                      <TouchableOpacity
                        key={payment.id}
                        style={[
                          styles.paymentCard,
                          { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                          selected && { borderColor: t.accent, borderWidth: 1.5 }
                        ]}
                        onPress={() => {
                          if (bulkMode) {
                            handleSelectToggle(payment.id);
                          } else {
                            setSelectedPayment(payment);
                            setIsDetailsOpen(true);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.paymentCardLeft}>
                          {bulkMode && (
                            <TouchableOpacity style={styles.checkboxWrapper} onPress={() => handleSelectToggle(payment.id)}>
                              {selected ? <CheckSquare size={20} color={t.accent} /> : <Square size={20} color={t.textSecondary} />}
                            </TouchableOpacity>
                          )}
                          <View style={styles.paymentMainInfo}>
                            <Text style={[styles.paymentItemName, { color: t.textPrimary }]} numberOfLines={1}>{payment.itemName}</Text>
                            <Text style={styles.clientLabelText}>{payment.clientName} • Term {payment.month_number} of {payment.totalMonths}</Text>
                            <Text style={styles.dateLabelText}>Due date: {formatDate(payment.due_date)}</Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text style={[styles.amountValText, { color: t.textPrimary }]}>{formatCurrency(payment.amount_due)}</Text>
                          <View style={styles.badgeRow}>
                            {hasProof && !payment.is_paid && (
                              <View style={styles.proofBadge}>
                                <FileImage size={10} color="#eab308" />
                                <Text style={styles.proofBadgeText}>Proof</Text>
                              </View>
                            )}
                            <View style={[
                              styles.statusBadge,
                              payment.is_paid ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (payment.isOverdue ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })
                            ]}>
                              <Text style={[
                                styles.statusBadgeText,
                                payment.is_paid ? { color: '#10b981' } : (payment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary })
                              ]}>
                                {payment.is_paid ? 'Cleared' : (payment.isOverdue ? 'Overdue' : 'Pending')}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No payments match criteria.</Text>
                )}
              </View>
            ) : (
              // Table view mode
              <View style={[styles.tableCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, borderWidth: 1.5, borderRadius: 18, padding: 14, overflow: 'hidden' }]}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                  <View style={styles.tableContainer}>
                    {/* Header */}
                    <View style={[styles.tableHeaderRow, { borderBottomColor: t.border }]}>
                      {bulkMode && <Text style={[styles.tableHeaderCell, { width: 35, color: t.textSecondary }]}>✓</Text>}
                      <Text style={[styles.tableHeaderCell, { width: 110, color: t.textSecondary }]}>CLIENT</Text>
                      <Text style={[styles.tableHeaderCell, { width: 140, color: t.textSecondary }]}>ITEM PURCHASED</Text>
                      <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'center', color: t.textSecondary }]}>TERM</Text>
                      <Text style={[styles.tableHeaderCell, { width: 90, color: t.textSecondary }]}>DUE DATE</Text>
                      <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'right', color: t.textSecondary }]}>AMOUNT</Text>
                      <Text style={[styles.tableHeaderCell, { width: 80, textAlign: 'center', color: t.textSecondary }]}>STATUS</Text>
                    </View>

                    {/* Body */}
                    {paginatedPayments.length > 0 ? (
                      paginatedPayments.map((payment) => {
                        const selected = selectedIds.includes(payment.id);
                        return (
                          <TouchableOpacity
                            key={payment.id}
                            style={[styles.tableBodyRow, { borderBottomColor: t.border }, selected && { backgroundColor: t.accentLight }]}
                            onPress={() => {
                              if (bulkMode) {
                                handleSelectToggle(payment.id);
                              } else {
                                setSelectedPayment(payment);
                                setIsDetailsOpen(true);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            {bulkMode && (
                              <View style={{ width: 35 }}>
                                {selected ? <CheckSquare size={16} color={t.accent} /> : <Square size={16} color={t.textSecondary} />}
                              </View>
                            )}
                            <Text style={[styles.tableCell, { width: 110, fontWeight: 'bold', color: t.textPrimary }]} numberOfLines={1}>
                              {payment.clientName}
                            </Text>
                            <Text style={[styles.tableCell, { width: 140, color: t.textPrimary }]} numberOfLines={1}>
                              {payment.itemName}
                            </Text>
                            <Text style={[styles.tableCell, { width: 70, textAlign: 'center', color: t.textPrimary }]}>
                              {payment.month_number}/{payment.totalMonths}
                            </Text>
                            <Text style={[styles.tableCell, { width: 90, color: t.textPrimary }]}>
                              {formatDate(payment.due_date)}
                            </Text>
                            <Text style={[styles.tableCell, { width: 90, textAlign: 'right', fontWeight: 'bold', color: t.textPrimary }]}>
                              {formatCurrency(payment.amount_due)}
                            </Text>
                            <View style={{ width: 80, alignItems: 'center' }}>
                              <View style={[
                                styles.statusBadge,
                                payment.is_paid ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (payment.isOverdue ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })
                              ]}>
                                <Text style={[
                                  styles.statusBadgeText,
                                  payment.is_paid ? { color: '#10b981' } : (payment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary }),
                                  { fontSize: 8 }
                                ]}>
                                  {payment.is_paid ? 'Cleared' : (payment.isOverdue ? 'Overdue' : 'Pending')}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>No payments match criteria.</Text>
                    )}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(1)}
                  style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, currentPage === 1 && { opacity: 0.4 }]}
                >
                  <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>First</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, currentPage === 1 && { opacity: 0.4 }]}
                >
                  <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Prev</Text>
                </TouchableOpacity>
                
                <Text style={[styles.paginationInfo, { color: t.textSecondary }]}>
                  Page {currentPage} of {totalPages}
                </Text>
                
                <TouchableOpacity
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, currentPage === totalPages && { opacity: 0.4 }]}
                >
                  <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Next</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage(totalPages)}
                  style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, currentPage === totalPages && { opacity: 0.4 }]}
                >
                  <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Last</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ─── TAB 2: MONTHLY BREAKDOWN ─── */}
        {subTab === 'breakdown' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Filter Toolbar for Breakdown */}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              {/* Filter Pills */}
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexGrow: 1 }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'completed', label: 'Completed' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'overdue', label: 'Overdue' },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabBtn,
                      breakdownFilter === tab.key && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setBreakdownFilter(tab.key as any)}
                  >
                    <Text style={[styles.tabBtnText, { color: breakdownFilter === tab.key ? t.accent : t.textSecondary }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* View Mode Toggle */}
              <TouchableOpacity
                style={[styles.bulkToggleBtn, { borderColor: t.cardBorder, borderWidth: 1.5, marginTop: 0 }]}
                onPress={() => setBreakdownViewMode(breakdownViewMode === 'list' ? 'table' : 'list')}
              >
                {breakdownViewMode === 'list' ? (
                  <>
                    <FileText size={14} color={t.textSecondary} />
                    <Text style={[styles.bulkToggleText, { color: t.textSecondary, fontSize: 11 }]}>Table</Text>
                  </>
                ) : (
                  <>
                    <ListTodo size={14} color={t.textSecondary} />
                    <Text style={[styles.bulkToggleText, { color: t.textSecondary, fontSize: 11 }]}>List</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {breakdownViewMode === 'list' ? (
              sortedMonthKeys.length > 0 ? (
                paginatedMonthKeys.map(mKey => {
                  const monthData = monthlyBreakdown[mKey];
                  const isMonthExpanded = expandedMonths[mKey] === true; // defaults to collapsed (hidden)
                  const monthUnpaidIds = getUnpaidIdsForMonth(monthData);
                  const allMonthSelected = monthUnpaidIds.length > 0 && monthUnpaidIds.every(id => selectedIds.includes(id));
                  const monthStatus = monthData.pendingCount === 0 ? 'paid' : (Object.values(monthData.clients).some((c: any) => c.payments.some((p: any) => p.isOverdue)) ? 'overdue' : 'pending');

                  // If filtering makes a month empty of matching elements, hide it!
                  const clientKeys = Object.keys(monthData.clients);
                  if (clientKeys.length === 0) return null;

                  return (
                    <View key={mKey} style={[styles.monthGroupContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                      <TouchableOpacity
                        style={styles.monthHeaderRow}
                        activeOpacity={0.8}
                        onPress={() => setExpandedMonths(prev => ({ ...prev, [mKey]: !isMonthExpanded }))}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <TouchableOpacity
                            disabled={monthUnpaidIds.length === 0}
                            onPress={() => toggleSelectMonth(monthData)}
                          >
                            {monthUnpaidIds.length === 0 ? (
                              <CheckSquare size={20} color="#10b981" />
                            ) : allMonthSelected ? (
                              <CheckSquare size={20} color={t.accent} />
                            ) : (
                              <Square size={20} color={t.textSecondary} />
                            )}
                          </TouchableOpacity>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.monthHeaderTitle, { color: t.textPrimary }]}>{monthData.monthName}</Text>
                            <Text style={styles.clientLabelText}>
                              {formatCurrency(monthData.paidAmount)} Collected • {formatCurrency(monthData.pendingAmount)} Pending
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.statusBadge, monthStatus === 'paid' ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (monthStatus === 'overdue' ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })]}>
                            <Text style={[styles.statusBadgeText, monthStatus === 'paid' ? { color: '#10b981' } : (monthStatus === 'overdue' ? { color: '#ef4444' } : { color: t.textSecondary })]}>
                              {monthStatus === 'paid' ? 'Paid' : monthStatus === 'overdue' ? 'Overdue' : 'Pending'}
                            </Text>
                          </View>
                          {isMonthExpanded ? <ChevronUp size={16} color={t.textSecondary} /> : <ChevronDown size={16} color={t.textSecondary} />}
                        </View>
                      </TouchableOpacity>

                      {isMonthExpanded && (
                        <View style={styles.monthClientsList}>
                          {clientKeys.map(clientId => {
                            const clientData = monthData.clients[clientId];
                            const clientExpandedKey = `${mKey}-${clientId}`;
                            const isClientExpanded = expandedClients[clientExpandedKey] === true; // defaults to collapsed
                            const clientUnpaidIds = getUnpaidIdsForClient(clientData);
                            const allClientSelected = clientUnpaidIds.length > 0 && clientUnpaidIds.every(id => selectedIds.includes(id));

                            return (
                              <View key={clientId} style={[styles.clientSectionContainer, { borderColor: t.border }]}>
                                <TouchableOpacity
                                  style={styles.clientHeaderRow}
                                  activeOpacity={0.8}
                                  onPress={() => setExpandedClients(prev => ({ ...prev, [clientExpandedKey]: !isClientExpanded }))}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <TouchableOpacity
                                      disabled={clientUnpaidIds.length === 0}
                                      onPress={() => toggleSelectClient(clientData)}
                                    >
                                      {clientUnpaidIds.length === 0 ? (
                                        <CheckSquare size={18} color="#10b981" />
                                      ) : allClientSelected ? (
                                        <CheckSquare size={18} color={t.accent} />
                                      ) : (
                                        <Square size={18} color={t.textSecondary} />
                                      )}
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                      <Text style={[styles.clientNameText, { color: t.textPrimary }]} numberOfLines={1}>{clientData.name}</Text>
                                      <Text style={styles.dateLabelText}>Rate: {clientData.collectionRate.toFixed(0)}% • {formatCurrency(clientData.pendingAmount)} Pending</Text>
                                    </View>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={[styles.amountValText, { color: t.textPrimary }]}>{formatCurrency(clientData.totalAmount)}</Text>
                                    {isClientExpanded ? <ChevronUp size={14} color={t.textSecondary} /> : <ChevronDown size={14} color={t.textSecondary} />}
                                  </View>
                                </TouchableOpacity>

                                {isClientExpanded && (
                                  <View style={styles.clientPaymentsList}>
                                    {clientData.payments.map((p: any) => {
                                      const isSel = selectedIds.includes(p.id);
                                      return (
                                        <TouchableOpacity
                                          key={p.id}
                                          style={[styles.miniPaymentRow, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }]}
                                          onPress={() => {
                                            if (!p.is_paid) {
                                              handleSelectToggle(p.id);
                                            } else {
                                              setSelectedPayment(p);
                                              setIsDetailsOpen(true);
                                            }
                                          }}
                                        >
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                            {!p.is_paid ? (
                                              <TouchableOpacity onPress={() => handleSelectToggle(p.id)}>
                                                {isSel ? <CheckSquare size={16} color={t.accent} /> : <Square size={16} color={t.textSecondary} />}
                                              </TouchableOpacity>
                                            ) : (
                                              <CheckCircle size={16} color="#10b981" />
                                            )}
                                            <View style={{ flex: 1 }}>
                                              <Text style={[styles.miniPaymentItemName, { color: t.textPrimary }]} numberOfLines={1}>
                                                {p.itemName} (Term {p.month_number}/{p.totalMonths})
                                              </Text>
                                              <Text style={styles.dateLabelText}>Due: {formatDate(p.due_date)}</Text>
                                            </View>
                                          </View>
                                          <Text style={[styles.miniPaymentAmount, { color: p.is_paid ? '#10b981' : t.textPrimary }]}>
                                            {formatCurrency(p.amount_due)}
                                          </Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No monthly data available.</Text>
              )
            ) : (
              // Table view mode for Breakdown
              <View style={[styles.tableCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, borderWidth: 1.5, borderRadius: 18, padding: 14, overflow: 'hidden' }]}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                  <View style={styles.tableContainer}>
                    {/* Header */}
                    <View style={[styles.tableHeaderRow, { borderBottomColor: t.border }]}>
                      <Text style={[styles.tableHeaderCell, { width: 35, color: t.textSecondary }]}>✓</Text>
                      <Text style={[styles.tableHeaderCell, { width: 90, color: t.textSecondary }]}>MONTH</Text>
                      <Text style={[styles.tableHeaderCell, { width: 110, color: t.textSecondary }]}>CLIENT</Text>
                      <Text style={[styles.tableHeaderCell, { width: 130, color: t.textSecondary }]}>ITEM DETAILS</Text>
                      <Text style={[styles.tableHeaderCell, { width: 60, textAlign: 'center', color: t.textSecondary }]}>TERM</Text>
                      <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'right', color: t.textSecondary }]}>AMOUNT</Text>
                      <Text style={[styles.tableHeaderCell, { width: 85, textAlign: 'center', color: t.textSecondary }]}>STATUS</Text>
                    </View>

                    {/* Body */}
                    {filteredBreakdownPayments.length > 0 ? (
                      paginatedBreakdownPayments.map((payment) => {
                        const selected = selectedIds.includes(payment.id);
                        const monthKey = getBillingMonthKey(payment.due_date);
                        const monthName = formatBillingMonthKey(monthKey);
                        return (
                          <TouchableOpacity
                            key={payment.id}
                            style={[styles.tableBodyRow, { borderBottomColor: t.border }, selected && { backgroundColor: t.accentLight }]}
                            onPress={() => {
                              if (!payment.is_paid) {
                                handleSelectToggle(payment.id);
                              } else {
                                setSelectedPayment(payment);
                                setIsDetailsOpen(true);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <TouchableOpacity
                              style={{ width: 35 }}
                              disabled={payment.is_paid}
                              onPress={() => handleSelectToggle(payment.id)}
                            >
                              {payment.is_paid ? (
                                <CheckSquare size={16} color="#10b981" />
                              ) : selected ? (
                                <CheckSquare size={16} color={t.accent} />
                              ) : (
                                <Square size={16} color={t.textSecondary} />
                              )}
                            </TouchableOpacity>
                            <Text style={[styles.tableCell, { width: 90, color: t.textPrimary }]} numberOfLines={1}>
                              {monthName}
                            </Text>
                            <Text style={[styles.tableCell, { width: 110, fontWeight: 'bold', color: t.textPrimary }]} numberOfLines={1}>
                              {payment.clientName}
                            </Text>
                            <Text style={[styles.tableCell, { width: 130, color: t.textPrimary }]} numberOfLines={1}>
                              {payment.itemName}
                            </Text>
                            <Text style={[styles.tableCell, { width: 60, textAlign: 'center', color: t.textPrimary }]}>
                              {payment.month_number}/{payment.totalMonths}
                            </Text>
                            <Text style={[styles.tableCell, { width: 90, textAlign: 'right', fontWeight: 'bold', color: t.textPrimary }]}>
                              {formatCurrency(payment.amount_due)}
                            </Text>
                            <View style={{ width: 85, alignItems: 'center' }}>
                              <View style={[
                                styles.statusBadge,
                                payment.is_paid ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (payment.isOverdue ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })
                              ]}>
                                <Text style={[
                                  styles.statusBadgeText,
                                  payment.is_paid ? { color: '#10b981' } : (payment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary }),
                                  { fontSize: 8 }
                                ]}>
                                  {payment.is_paid ? 'Cleared' : (payment.isOverdue ? 'Overdue' : 'Pending')}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>No breakdown records found.</Text>
                    )}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Breakdown pagination controls */}
            {breakdownViewMode === 'list' ? (
              totalBreakdownListPages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    disabled={breakdownPage === 1}
                    onPress={() => setBreakdownPage(1)}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>First</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={breakdownPage === 1}
                    onPress={() => setBreakdownPage(prev => Math.max(1, prev - 1))}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Prev</Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.paginationInfo, { color: t.textSecondary }]}>
                    Page {breakdownPage} of {totalBreakdownListPages}
                  </Text>
                  
                  <TouchableOpacity
                    disabled={breakdownPage === totalBreakdownListPages}
                    onPress={() => setBreakdownPage(prev => Math.min(totalBreakdownListPages, prev + 1))}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === totalBreakdownListPages && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={breakdownPage === totalBreakdownListPages}
                    onPress={() => setBreakdownPage(totalBreakdownListPages)}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === totalBreakdownListPages && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Last</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              totalBreakdownTablePages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    disabled={breakdownPage === 1}
                    onPress={() => setBreakdownPage(1)}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>First</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={breakdownPage === 1}
                    onPress={() => setBreakdownPage(prev => Math.max(1, prev - 1))}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === 1 && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Prev</Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.paginationInfo, { color: t.textSecondary }]}>
                    Page {breakdownPage} of {totalBreakdownTablePages}
                  </Text>
                  
                  <TouchableOpacity
                    disabled={breakdownPage === totalBreakdownTablePages}
                    onPress={() => setBreakdownPage(prev => Math.min(totalBreakdownTablePages, prev + 1))}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === totalBreakdownTablePages && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={breakdownPage === totalBreakdownTablePages}
                    onPress={() => setBreakdownPage(totalBreakdownTablePages)}
                    style={[styles.paginationBtn, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, breakdownPage === totalBreakdownTablePages && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.paginationBtnText, { color: t.textPrimary }]}>Last</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </View>
        )}

        {/* ─── TAB 3: ACTIVITY LOGS ─── */}
        {subTab === 'logs' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Filters */}
            <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder, marginBottom: 12 }]}>
              <Search size={18} color={t.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: t.textPrimary }]}
                placeholder="Search activity logs..."
                placeholderTextColor={t.textSecondary}
                value={logSearchQuery}
                onChangeText={setLogSearchQuery}
              />
              {logSearchQuery ? (
                <TouchableOpacity onPress={() => setLogSearchQuery('')}>
                  <X size={16} color={t.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <View style={[styles.filterSelectWrapper, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Sliders size={12} color={t.textSecondary} />
                <TextInput
                  style={[styles.filterSelectInput, { color: t.textPrimary }]}
                  placeholder="All Types"
                  value={logFilterType === 'all' ? '' : logFilterType}
                  onChangeText={(val) => setLogFilterType(val || 'all')}
                />
              </View>
              <View style={[styles.filterSelectWrapper, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Calendar size={12} color={t.textSecondary} />
                <TextInput
                  style={[styles.filterSelectInput, { color: t.textPrimary }]}
                  placeholder="All Time"
                  value={logFilterPeriod === 'all' ? '' : logFilterPeriod}
                  onChangeText={(val) => setLogFilterPeriod(val || 'all')}
                />
              </View>
            </View>

            {/* Logs List */}
            <View style={styles.logsListContainer}>
              {filteredLogs.length > 0 ? (
                filteredLogs.map(log => {
                  const isPaidEvent = log.action_type === 'payment_marked_paid';
                  return (
                    <View key={log.id} style={[styles.logCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                      <View style={styles.logCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <View style={[styles.logIndicator, { backgroundColor: isPaidEvent ? '#10b981' : '#f59e0b' }]} />
                          <Text style={[styles.logActionText, { color: t.textPrimary }]} numberOfLines={1}>{log.action_description}</Text>
                        </View>
                        <Text style={[styles.logRoleBadge, { color: t.textSecondary, borderColor: t.cardBorder }]}>
                          {log.performerRole}
                        </Text>
                      </View>
                      
                      <View style={styles.logCardBody}>
                        <Text style={styles.logDetailText}>
                          Client: <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>{log.clientName || 'N/A'}</Text>
                          {log.itemName ? ` • ${log.itemName}` : ''}
                        </Text>
                        <Text style={styles.logDetailText}>
                          Amount: <Text style={{ color: t.accent, fontWeight: 'bold' }}>{log.amountDue ? formatCurrency(log.amountDue) : 'N/A'}</Text>
                        </Text>
                        <Text style={styles.logMetaText}>
                          By {log.performerName} • {dayjs(log.performed_at).format('MMM D, YYYY h:mm A')}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No logs found matching filters.</Text>
              )}
            </View>
          </View>
        )}

        {/* ─── TAB 4: RECEIPTS ─── */}
        {subTab === 'receipts' && (
          <View style={styles.tabContentWrapper}>
            {/* Search & Filter Toolbar for Receipts */}
            <View style={{ gap: 8, marginBottom: 4 }}>
              <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Search size={18} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search receipts by client..."
                  placeholderTextColor={t.textSecondary}
                  value={receiptSearchQuery}
                  onChangeText={setReceiptSearchQuery}
                />
                {receiptSearchQuery ? (
                  <TouchableOpacity onPress={() => setReceiptSearchQuery('')}>
                    <X size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Horizontal Scroll Filter Chips */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {/* Client Filter Chip */}
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      receiptClientFilter !== '' && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setReceiptPickerType('client')}
                  >
                    <Text style={[styles.tabBtnText, { color: receiptClientFilter !== '' ? t.accent : t.textSecondary }]}>
                      {receiptClientFilter !== '' ? `Client: ${profiles.find(p => p.id === receiptClientFilter)?.name || 'Selected'}` : 'All Clients'}
                    </Text>
                  </TouchableOpacity>

                  {/* Year Filter Chip */}
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      receiptYearFilter !== '' && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setReceiptPickerType('year')}
                  >
                    <Text style={[styles.tabBtnText, { color: receiptYearFilter !== '' ? t.accent : t.textSecondary }]}>
                      {receiptYearFilter !== '' ? `Year: ${receiptYearFilter}` : 'All Years'}
                    </Text>
                  </TouchableOpacity>

                  {/* Month Filter Chip */}
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      receiptMonthFilter !== '' && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setReceiptPickerType('month')}
                  >
                    <Text style={[styles.tabBtnText, { color: receiptMonthFilter !== '' ? t.accent : t.textSecondary }]}>
                      {receiptMonthFilter !== '' ? `Month: ${MONTH_NAMES[Number(receiptMonthFilter) - 1]}` : 'All Months'}
                    </Text>
                  </TouchableOpacity>

                  {/* Status Filter Chip */}
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      receiptStatusFilter !== '' && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => setReceiptPickerType('status')}
                  >
                    <Text style={[styles.tabBtnText, { color: receiptStatusFilter !== '' ? t.accent : t.textSecondary }]}>
                      {receiptStatusFilter !== '' ? `Status: ${receiptStatusFilter === 'fully_paid' ? 'Fully Paid' : receiptStatusFilter === 'partially_paid' ? 'Partial' : 'Unpaid'}` : 'All Statuses'}
                    </Text>
                  </TouchableOpacity>

                  {/* Clear Filters Button */}
                  {(receiptSearchQuery !== '' || receiptClientFilter !== '' || receiptYearFilter !== '' || receiptMonthFilter !== '' || receiptStatusFilter !== '') && (
                    <TouchableOpacity
                      style={[styles.tabBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: t.cardBorder }]}
                      onPress={() => {
                        setReceiptSearchQuery('');
                        setReceiptClientFilter('');
                        setReceiptYearFilter('');
                        setReceiptMonthFilter('');
                        setReceiptStatusFilter('');
                      }}
                    >
                      <Text style={[styles.tabBtnText, { color: t.textPrimary }]}>Clear Filters</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </View>

            {/* Receipts Grid */}
            <View style={styles.receiptsGrid}>
              {filteredReceipts.length > 0 ? (
                filteredReceipts.map(receipt => {
                  const rate = receipt.collectionRate;
                  return (
                    <View key={receipt.key} style={[styles.receiptCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                      <View style={styles.receiptCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.receiptClientName, { color: t.textPrimary }]} numberOfLines={1}>{receipt.clientName}</Text>
                          <Text style={styles.clientLabelText} numberOfLines={1}>{receipt.clientEmail}</Text>
                        </View>
                        <View style={[styles.statusBadge, receipt.paymentStatus === 'fully_paid' ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (receipt.paymentStatus === 'partially_paid' ? { backgroundColor: 'rgba(245, 158, 11, 0.12)' } : { backgroundColor: 'rgba(239, 68, 68, 0.12)' })]}>
                          <Text style={[styles.statusBadgeText, receipt.paymentStatus === 'fully_paid' ? { color: '#10b981' } : (receipt.paymentStatus === 'partially_paid' ? { color: '#f59e0b' } : { color: '#ef4444' })]}>
                            {receipt.paymentStatus === 'fully_paid' ? 'Fully Paid' : receipt.paymentStatus === 'partially_paid' ? 'Partial' : 'Unpaid'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.receiptCardTotals, { borderColor: t.border }]}>
                        <View style={styles.totalBoxMini}>
                          <Text style={styles.totalBoxMiniLabel}>TOTAL DUE</Text>
                          <Text style={[styles.totalBoxMiniVal, { color: t.textPrimary }]}>{formatCurrency(receipt.totalAmount)}</Text>
                        </View>
                        <View style={styles.totalBoxMini}>
                          <Text style={styles.totalBoxMiniLabel}>PAID</Text>
                          <Text style={[styles.totalBoxMiniVal, { color: '#10b981' }]}>{formatCurrency(receipt.paidAmount)}</Text>
                        </View>
                        <View style={styles.totalBoxMini}>
                          <Text style={styles.totalBoxMiniLabel}>PENDING</Text>
                          <Text style={[styles.totalBoxMiniVal, { color: '#ef4444' }]}>{formatCurrency(receipt.pendingAmount)}</Text>
                        </View>
                      </View>

                      <View style={styles.receiptCardProgress}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={[styles.legendText, { color: t.textSecondary }]}>Collection progress</Text>
                          <Text style={[styles.legendText, { color: t.textPrimary, fontWeight: 'bold' }]}>{rate.toFixed(0)}%</Text>
                        </View>
                        <View style={[styles.progressBarOuter, { backgroundColor: t.border }]}>
                          <View style={[styles.progressBarInner, { backgroundColor: t.accent, width: `${rate}%` }]} />
                        </View>
                      </View>

                      <View style={styles.receiptCardActions}>
                        <TouchableOpacity
                          style={[styles.receiptBtn, { backgroundColor: t.accentLight }]}
                          onPress={() => {
                            setSelectedReceipt(receipt);
                            setIsReceiptPreviewOpen(true);
                          }}
                        >
                          <Eye size={12} color={t.accent} />
                          <Text style={[styles.receiptBtnText, { color: t.accent }]}>Preview</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.receiptBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
                          onPress={() => handleResendReceipt(receipt.clientId, receipt.payments[0].due_date)}
                        >
                          <Mail size={12} color={t.textPrimary} />
                          <Text style={[styles.receiptBtnText, { color: t.textPrimary }]}>Email</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.receiptBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingHorizontal: 10 }]}
                          onPress={() => handleShareReceipt(receipt)}
                        >
                          <Share2 size={12} color={t.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No receipts found.</Text>
              )}
            </View>
          </View>
        )}
        
        {/* Extra spacing at bottom for lists */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <View style={[styles.floatingBulkBar, { backgroundColor: t.cardBg, borderTopColor: t.border }]}>
          <Text style={[styles.bulkLabel, { color: t.textPrimary }]}>{selectedIds.length} Selected</Text>
          <View style={styles.bulkBtnRow}>
            <TouchableOpacity style={styles.bulkCancelBtn} onPress={() => setSelectedIds([])}>
              <Text style={styles.bulkCancelBtnText}>Deselect</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkConfirmBtn, { backgroundColor: t.accent }]} onPress={handleBulkClear} disabled={actionLoading}>
              <Text style={styles.bulkConfirmBtnText}>{actionLoading ? 'Clearing...' : 'Verify Paid'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && (
        <Modal visible={isDetailsOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            <View style={[styles.detailsHeroBanner, { backgroundColor: t.cardBg, borderBottomColor: t.border, borderBottomWidth: 1.5 }]}>
              <View style={styles.detailsHeroTopRow}>
                <View style={styles.detailsHeroTitleCluster}>
                  <Receipt size={18} color={t.accent} />
                  <View>
                    <Text style={[styles.detailsHeroEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>TRANSACTION DETAILS</Text>
                    <Text style={[styles.detailsHeroTitle, { color: t.textPrimary }]}>Receipt Overview</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.detailsHeroCloseBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff', borderColor: t.cardBorder }]} 
                  onPress={() => setIsDetailsOpen(false)}
                >
                  <X size={16} color={t.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailsHeroCardRow}>
                <View style={styles.detailsHeroAvatarWrapper}>
                  <View style={[styles.detailsHeroAvatarPlaceholder, { backgroundColor: t.accentLight }]}>
                    <Receipt size={24} color={t.accent} />
                  </View>
                </View>

                <View style={styles.detailsHeroMeta}>
                  <Text style={[styles.detailsHeroName, { color: t.textPrimary }]} numberOfLines={1}>{selectedPayment.itemName}</Text>
                  <View style={styles.detailsHeroSubRow}>
                    <View style={[
                      styles.statusBadge,
                      { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: selectedPayment.is_paid ? 'rgba(16, 185, 129, 0.12)' : (selectedPayment.isOverdue ? 'rgba(239, 68, 68, 0.12)' : t.border) }
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        selectedPayment.is_paid ? { color: '#10b981' } : (selectedPayment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary })
                      ]}>
                        {selectedPayment.is_paid ? 'Cleared' : (selectedPayment.isOverdue ? 'Overdue' : 'Pending')}
                      </Text>
                    </View>
                    <Text style={[styles.detailsHeroId, { color: t.textSecondary }]} numberOfLines={1}>Term {selectedPayment.month_number} of {selectedPayment.totalMonths}</Text>
                  </View>
                </View>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Installment Metadata</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Client Name</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{selectedPayment.clientName}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Client Email</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]} numberOfLines={1}>{selectedPayment.clientEmail}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Amortization Due</Text>
                    <Text style={[styles.detailBoxValue, { color: t.accent }]}>{formatCurrency(selectedPayment.amount_due)}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Scheduled Due Date</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatDate(selectedPayment.due_date)}</Text>
                  </View>
                  {selectedPayment.is_paid && selectedPayment.payment_date && (
                    <View style={styles.detailBox}>
                      <Text style={styles.detailBoxLabel}>Settle Date</Text>
                      <Text style={[styles.detailBoxValue, { color: '#10b981' }]}>{formatDate(selectedPayment.payment_date)}</Text>
                    </View>
                  )}
                </View>
              </View>

              {selectedPayment.proof_of_payment ? (
                <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                  <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Uploaded Receipt Proof</Text>
                  <Image
                    source={{ uri: selectedPayment.proof_of_payment }}
                    style={styles.proofImage}
                    resizeMode="contain"
                  />
                  {!selectedPayment.is_paid && (
                    <View style={styles.proofActionsRow}>
                      <TouchableOpacity
                        style={[styles.proofActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: '#ef4444' }]}
                        onPress={() => setIsRejectOpen(true)}
                        disabled={actionLoading}
                      >
                        <X size={14} color="#ef4444" />
                        <Text style={[styles.proofActionText, { color: '#ef4444' }]}>Reject Proof</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.proofActionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: '#10b981' }]}
                        onPress={() => handleApproveProof(selectedPayment.id)}
                        disabled={actionLoading}
                      >
                        <Check size={14} color="#10b981" />
                        <Text style={[styles.proofActionText, { color: '#10b981' }]}>Approve Proof</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.standardActionsCol}>
                {!selectedPayment.is_paid && !selectedPayment.proof_of_payment && (
                  <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: t.accent }]}
                    onPress={() => handleMarkPaid(selectedPayment.id)}
                    disabled={actionLoading}
                  >
                    <CheckCircle size={16} color="#fff" />
                    <Text style={styles.mainActionText}>Record Manual Payment</Text>
                  </TouchableOpacity>
                )}

                {selectedPayment.is_paid && (
                  <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: t.accentLight, borderColor: t.accent, borderWidth: 1.5 }]}
                    onPress={() => handleResendReceipt(selectedPayment.clientId, selectedPayment.due_date)}
                    disabled={actionLoading}
                  >
                    <Send size={16} color={t.accent} />
                    <Text style={[styles.mainActionText, { color: t.accent }]}>Resend Payment Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Reject Reason input dialog modal */}
      <Modal visible={isRejectOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheetContainer, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder }]}>
            <LinearGradient
              colors={isDarkMode ? ['#1f2937', '#111827'] : ['#fff7ed', '#ffffff']}
              style={styles.sheetHero}
            >
              <View style={styles.sheetHeroTop}>
                <View style={styles.sheetTitleCluster}>
                  <View style={styles.sheetIconBadge}>
                    <AlertCircle size={18} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>LEDGER OPERATIONS</Text>
                    <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Reject Payment Proof</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsRejectOpen(false)} disabled={actionLoading}>
                  <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sheetHeroText, { color: t.textSecondary }]}>
                Provide a clear feedback reason to the client explaining why their uploaded payment receipt was rejected.
              </Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.premiumFormContainer} showsVerticalScrollIndicator={false}>
              <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>FEEDBACK / REASON</Text>
                <TextInput
                  style={[styles.premiumInput, { color: t.textPrimary, minHeight: 80, textAlignVertical: 'top', paddingTop: 8 }]}
                  placeholder="e.g. Receipt image is blurry, wrong amount, duplicate receipt..."
                  placeholderTextColor={t.textSecondary}
                  multiline={true}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                />
              </View>
            </ScrollView>

            <View style={[styles.sheetActions, { borderTopColor: t.cardBorder }]}>
              <TouchableOpacity style={[styles.secondaryAction, { borderColor: t.cardBorder }]} onPress={() => setIsRejectOpen(false)} disabled={actionLoading}>
                <Text style={[styles.secondaryActionText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryAction, { backgroundColor: '#ef4444', opacity: actionLoading ? 0.7 : 1 }]} onPress={handleRejectProofSubmit} disabled={actionLoading}>
                <CheckCircle size={16} color="#ffffff" />
                <Text style={styles.primaryActionText}>{actionLoading ? 'Rejecting...' : 'Reject Proof'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Receipts Preview Modal */}
      {selectedReceipt && (
        <Modal visible={isReceiptPreviewOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <View style={[styles.detailsHeroBanner, { backgroundColor: t.cardBg, borderBottomColor: t.border, borderBottomWidth: 1.5, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
              <View style={styles.detailsHeroTopRow}>
                <View style={styles.detailsHeroTitleCluster}>
                  <Receipt size={18} color={t.accent} />
                  <View>
                    <Text style={[styles.detailsHeroEyebrow, { color: t.accent }]}>RECEIPT MANAGER</Text>
                    <Text style={[styles.detailsHeroTitle, { color: t.textPrimary }]}>Receipt Statement</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.detailsHeroCloseBtn, { borderColor: t.cardBorder }]}
                  onPress={() => setIsReceiptPreviewOpen(false)}
                >
                  <X size={16} color={t.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {isLoadingPreview ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg }}>
                <ActivityIndicator size="large" color={t.accent} />
                <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '600', color: t.textSecondary }}>Generating live receipt preview...</Text>
              </View>
            ) : receiptPreviewHtml ? (
              <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
                <WebView
                  originWhitelist={['*']}
                  source={{ html: receiptPreviewHtml }}
                  style={{ flex: 1, backgroundColor: '#ffffff' }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                />
                
                <View style={{ padding: 16, gap: 12, borderTopWidth: 1.5, borderTopColor: t.border, backgroundColor: t.cardBg }}>
                  <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: t.accent }]}
                    onPress={() => handleResendReceipt(selectedReceipt.clientId, selectedReceipt.payments[0].due_date)}
                  >
                    <Mail size={16} color="#fff" />
                    <Text style={styles.mainActionText}>Resend Email Receipt</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1.5, borderColor: t.cardBorder }]}
                    onPress={() => handleShareReceipt(selectedReceipt)}
                  >
                    <Share2 size={16} color={t.textPrimary} />
                    <Text style={[styles.mainActionText, { color: t.textPrimary }]}>Share Receipt DTO</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text style={{ color: t.textSecondary, fontStyle: 'italic' }}>Failed to load receipt email preview.</Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      )}
      {/* Option Selector Modal for Filters */}
      <Modal visible={receiptPickerType !== null} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheetContainer, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder, maxHeight: '60%' }]}>
            <LinearGradient
              colors={isDarkMode ? ['#1f2937', '#111827'] : ['#fff7ed', '#ffffff']}
              style={[styles.sheetHero, { paddingVertical: 14 }]}
            >
              <View style={styles.sheetHeroTop}>
                <View style={styles.sheetTitleCluster}>
                  <View style={[styles.sheetIconBadge, { backgroundColor: t.accent }]}>
                    <Sliders size={18} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetEyebrow, { color: t.accent }]}>FILTER SELECTION</Text>
                    <Text style={[styles.sheetTitle, { color: t.textPrimary, fontSize: 18 }]}>
                      {receiptPickerType === 'client' ? 'Select Client' :
                       receiptPickerType === 'year' ? 'Select Year' :
                       receiptPickerType === 'month' ? 'Select Month' :
                       'Select Status'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setReceiptPickerType(null)}>
                  <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} showsVerticalScrollIndicator={true}>
              {/* Option Rows */}
              {(() => {
                if (receiptPickerType === 'client') {
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterOptionRow,
                          { borderBottomColor: t.border },
                          receiptClientFilter === '' && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          setReceiptClientFilter('');
                          setReceiptPickerType(null);
                        }}
                      >
                        <Text style={[styles.filterOptionText, { color: t.textPrimary }, receiptClientFilter === '' && { color: t.accent, fontWeight: 'bold' }]}>
                          All Clients
                        </Text>
                        {receiptClientFilter === '' && <Check size={16} color={t.accent} />}
                      </TouchableOpacity>
                      {clientsList.map(c => {
                        const isSelected = receiptClientFilter === c.id;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[
                              styles.filterOptionRow,
                              { borderBottomColor: t.border },
                              isSelected && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => {
                              setReceiptClientFilter(c.id);
                              setReceiptPickerType(null);
                            }}
                          >
                            <Text style={[styles.filterOptionText, { color: t.textPrimary }, isSelected && { color: t.accent, fontWeight: 'bold' }]}>
                              {c.name}
                            </Text>
                            {isSelected && <Check size={16} color={t.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                }
                if (receiptPickerType === 'year') {
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterOptionRow,
                          { borderBottomColor: t.border },
                          receiptYearFilter === '' && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          setReceiptYearFilter('');
                          setReceiptPickerType(null);
                        }}
                      >
                        <Text style={[styles.filterOptionText, { color: t.textPrimary }, receiptYearFilter === '' && { color: t.accent, fontWeight: 'bold' }]}>
                          All Years
                        </Text>
                        {receiptYearFilter === '' && <Check size={16} color={t.accent} />}
                      </TouchableOpacity>
                      {availableYears.map(year => {
                        const isSelected = receiptYearFilter === year;
                        return (
                          <TouchableOpacity
                            key={year}
                            style={[
                              styles.filterOptionRow,
                              { borderBottomColor: t.border },
                              isSelected && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => {
                              setReceiptYearFilter(year);
                              setReceiptPickerType(null);
                            }}
                          >
                            <Text style={[styles.filterOptionText, { color: t.textPrimary }, isSelected && { color: t.accent, fontWeight: 'bold' }]}>
                              {year}
                            </Text>
                            {isSelected && <Check size={16} color={t.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                }
                if (receiptPickerType === 'month') {
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterOptionRow,
                          { borderBottomColor: t.border },
                          receiptMonthFilter === '' && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          setReceiptMonthFilter('');
                          setReceiptPickerType(null);
                        }}
                      >
                        <Text style={[styles.filterOptionText, { color: t.textPrimary }, receiptMonthFilter === '' && { color: t.accent, fontWeight: 'bold' }]}>
                          All Months
                        </Text>
                        {receiptMonthFilter === '' && <Check size={16} color={t.accent} />}
                      </TouchableOpacity>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const mStr = String(m);
                        const isSelected = receiptMonthFilter === mStr;
                        return (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.filterOptionRow,
                              { borderBottomColor: t.border },
                              isSelected && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => {
                              setReceiptMonthFilter(mStr);
                              setReceiptPickerType(null);
                            }}
                          >
                            <Text style={[styles.filterOptionText, { color: t.textPrimary }, isSelected && { color: t.accent, fontWeight: 'bold' }]}>
                              {MONTH_NAMES[m - 1]}
                            </Text>
                            {isSelected && <Check size={16} color={t.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                }
                if (receiptPickerType === 'status') {
                  const statuses = [
                    { key: 'fully_paid', label: 'Fully Paid' },
                    { key: 'partially_paid', label: 'Partially Paid' },
                    { key: 'unpaid', label: 'Unpaid' },
                  ];
                  return (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.filterOptionRow,
                          { borderBottomColor: t.border },
                          receiptStatusFilter === '' && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          setReceiptStatusFilter('');
                          setReceiptPickerType(null);
                        }}
                      >
                        <Text style={[styles.filterOptionText, { color: t.textPrimary }, receiptStatusFilter === '' && { color: t.accent, fontWeight: 'bold' }]}>
                          All Statuses
                        </Text>
                        {receiptStatusFilter === '' && <Check size={16} color={t.accent} />}
                      </TouchableOpacity>
                      {statuses.map(s => {
                        const isSelected = receiptStatusFilter === s.key;
                        return (
                          <TouchableOpacity
                            key={s.key}
                            style={[
                              styles.filterOptionRow,
                              { borderBottomColor: t.border },
                              isSelected && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => {
                              setReceiptStatusFilter(s.key);
                              setReceiptPickerType(null);
                            }}
                          >
                            <Text style={[styles.filterOptionText, { color: t.textPrimary }, isSelected && { color: t.accent, fontWeight: 'bold' }]}>
                              {s.label}
                            </Text>
                            {isSelected && <Check size={16} color={t.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  );
                }
                return null;
              })()}
            </ScrollView>
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
  mainScrollContent: {
    padding: 16,
    paddingTop: 10,
    gap: 16,
  },
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
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  countdownLeftSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    marginHorizontal: 12,
  },
  horizontalDivider: {
    height: 1,
    width: '100%',
    marginVertical: 16,
    opacity: 0.5,
  },
  collectionRightSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  collectionLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  collectionValue: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    marginVertical: 2,
  },
  collectionSubtext: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  statCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 125,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCardBody: {
    marginTop: 8,
    gap: 4,
  },
  statCardVal: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
  },
  statCardDesc: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
  },
  statProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  statProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  breakdownRowCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownTitle: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  breakdownTotal: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  segmentedProgressBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
  },
  progressLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '700',
  },
  subTabNav: {
    marginBottom: 4,
  },
  subTabNavContainer: {
    gap: 8,
  },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  subTabBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  fetchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 6,
    marginBottom: 4,
  },
  fetchingBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  tabContentWrapper: {
    gap: 12,
  },
  searchSection: {
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  bulkToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  bulkToggleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabsWrapper: {
    marginBottom: 4,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  ledgerList: {
    gap: 12,
  },
  paymentCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  checkboxWrapper: {
    paddingRight: 4,
  },
  paymentMainInfo: {
    flex: 1,
    gap: 2,
  },
  paymentItemName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  clientLabelText: {
    fontSize: 11,
    color: '#64748b',
  },
  dateLabelText: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  amountValText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(234, 180, 8, 0.12)',
  },
  proofBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#eab308',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    paddingVertical: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  paginationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  paginationBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  paginationInfo: {
    fontSize: 11,
    fontWeight: '600',
  },
  floatingBulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  bulkLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  bulkBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkCancelBtn: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  bulkCancelBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 'bold',
  },
  bulkConfirmBtn: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  bulkConfirmBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Flip clock sizes
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
  scheduleExpandedList: {
    gap: 8,
    paddingTop: 8,
  },
  scheduleItemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  scheduleItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleItemLeft: {
    flex: 1,
    gap: 2,
  },
  clientEmailText: {
    fontSize: 10,
    color: '#64748b',
  },
  scheduleItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientOwedText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  subPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subPaymentItem: {
    fontSize: 11,
    fontWeight: '600',
  },
  subPaymentTerm: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  subPaymentAmount: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  alertIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  redPingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  alertIndicatorText: {
    fontSize: 7,
    color: '#ef4444',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // Tab 2: Monthly Breakdown styling
  monthGroupContainer: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  monthHeaderRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  monthClientsList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  clientSectionContainer: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 10,
    overflow: 'hidden',
  },
  clientHeaderRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientNameText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  clientPaymentsList: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  miniPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
  },
  miniPaymentItemName: {
    fontSize: 12,
    fontWeight: '600',
  },
  miniPaymentAmount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Tab 3: Activity Logs styling
  filterSelectWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 10,
    gap: 6,
  },
  filterSelectInput: {
    flex: 1,
    fontSize: 11,
    height: '100%',
    padding: 0,
  },
  logsListContainer: {
    gap: 10,
  },
  logCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  logActionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logRoleBadge: {
    fontSize: 8,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  logCardBody: {
    gap: 3,
  },
  logDetailText: {
    fontSize: 11,
    color: '#64748b',
  },
  logMetaText: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 2,
  },
  // Tab 4: Receipts styling
  receiptsGrid: {
    gap: 12,
  },
  receiptCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  receiptCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  receiptClientName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  receiptCardTotals: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  totalBoxMini: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  totalBoxMiniLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  totalBoxMiniVal: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  receiptCardProgress: {
    gap: 4,
  },
  progressBarOuter: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 2,
  },
  receiptCardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  receiptBtn: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  receiptBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Receipts Preview Paper details
  receiptPreviewContainer: {
    padding: 16,
  },
  receiptPaper: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  receiptPaperHeader: {
    alignItems: 'center',
    gap: 6,
  },
  receiptBrand: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#ee4d2d',
  },
  receiptPaperTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  receiptSerialNumber: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#94a3b8',
  },
  receiptDividerLine: {
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    width: '100%',
  },
  receiptMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  receiptMetaItem: {
    width: '50%',
    gap: 2,
  },
  receiptMetaLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  receiptMetaValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  receiptSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  receiptItemsList: {
    gap: 10,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  receiptItemNameText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  receiptTotalsWrapper: {
    gap: 6,
  },
  receiptTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotalLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  receiptTotalValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  receiptTotalLabelBold: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  receiptTotalValueBold: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  paidWatermarkSeal: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    right: '15%',
    borderWidth: 4,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 15,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-15deg' }],
  },
  paidSealInner: {
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 5,
    alignItems: 'center',
  },
  paidSealText: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(16, 185, 129, 0.3)',
    letterSpacing: 1,
  },
  paidSealSubText: {
    fontSize: 8,
    fontWeight: '900',
    color: 'rgba(16, 185, 129, 0.3)',
    marginTop: 2,
  },

  // Modal layouts
  modalScrollContainer: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    gap: 16,
  },
  modalProfileCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailBox: {
    width: '47%',
    gap: 4,
  },
  detailBoxLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  detailBoxValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  proofImage: {
    width: '100%',
    height: 260,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  proofActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    alignSelf: 'stretch',
  },
  proofActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  proofActionText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  standardActionsCol: {
    gap: 10,
  },
  mainActionBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  mainActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  sheetContainer: {
    borderRadius: 28,
    borderWidth: 1.5,
    width: '100%',
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  sheetHero: {
    padding: 18,
    gap: 12,
  },
  sheetHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  sheetIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#ee4d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0,
    marginTop: 1,
  },
  sheetCloseButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sheetHeroText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 4,
  },
  premiumFormContainer: {
    padding: 18,
    gap: 14,
  },
  premiumInputCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  premiumLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  premiumInput: {
    minHeight: 32,
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0,
  },
  sheetActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  secondaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  primaryAction: {
    flex: 1.5,
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  detailsHeroBanner: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  detailsHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailsHeroTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailsHeroEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  detailsHeroTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailsHeroCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsHeroCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  detailsHeroAvatarWrapper: {
    position: 'relative',
  },
  detailsHeroAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsHeroMeta: {
    flex: 1,
    gap: 4,
  },
  detailsHeroName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsHeroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailsHeroId: {
    fontSize: 10,
    fontWeight: '600',
  },
  tableCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    overflow: 'hidden',
  },
  tableContainer: {
    flexDirection: 'column',
    minWidth: 450,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  tableCell: {
    fontSize: 11,
  },
  filterOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderRadius: 10,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
