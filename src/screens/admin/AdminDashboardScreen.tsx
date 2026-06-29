import { PremiumAlert } from '../../services/PremiumAlertService';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Animated,
  Easing,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldAlert,
  Users,
  TrendingUp,
  Receipt,
  CreditCard,
  Bell,
  Sliders,
  FileSpreadsheet,
  Zap,
  ArrowLeftRight,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  Flame,
  ArrowRight,
  UserPlus,
  LogOut,
  Sparkles,
  BarChart3,
  Settings,
  Sun,
  Moon,
  DollarSign,
  AlertTriangle,
  Activity,
  Layers,
  Trophy,
  FileText,
  CloudSun,
  Search,
  ShoppingBag,
  CheckCircle2,
  Check,
  X,
} from 'lucide-react-native';
import Svg, { Path, Circle, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../utils/supabase';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useNavigation } from '@react-navigation/native';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import { parseUtcDate, getBillingMonthKey, getCalendarMonthKey, getUtc8DateParts, createUtc8Date, getNextCalendarMonthStart } from '../../utils/date';
import { useExitAppConfirmation } from '../../hooks/useExitAppConfirmation';
import ExitConfirmationModal from '../../components/ExitConfirmationModal';
import PremiumLoader from '../../components/PremiumLoader';
import AdminHeader from '../../components/AdminHeader';
import DatePicker from '../../components/DatePicker';
import ActivityHeatmap from '../../components/ActivityHeatmap';
import { fetchAdminDashboardData, callAdminApi } from '../../services/adminService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';


// Helper functions
const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

function formatRelativeDate(value: string) {
  const date = parseUtcDate(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}



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

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { userRole, setActiveRole } = useContext(RoleContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { showExitModal, setShowExitModal, handleExit } = useExitAppConfirmation();
  const layout = useResponsiveLayout();

  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchAdminDashboardData,
    staleTime: 30000,
  });

  const error = queryError ? (queryError as Error).message : (dashboardData && !dashboardData.success ? dashboardData.error : null);

  const stats = dashboardData?.stats || {
    activeLimitExposure: 0,
    outstandingBalance: 0,
    activeClientsCount: 0,
    platformDefaults: 0,
    overduePaymentsCount: 0,
    completionRate: 0,
    collectionEfficiency: 0,
  };

  const unpaidBillingSchedules = dashboardData?.unpaidBillingSchedules || [];
  const [selectedScheduleIndex, setSelectedScheduleIndex] = useState<number>(0);
  const nextBillingSchedule = unpaidBillingSchedules[selectedScheduleIndex] || {
    monthName: '',
    totalDue: 0,
    earliestDueDate: null,
    clients: [],
  };

  // Parity additions states
  const [operationsTab, setOperationsTab] = useState<'orders' | 'timeline'>('orders');
  const [trendsTab, setTrendsTab] = useState<'categories' | 'installments' | 'cashflow'>('categories');
  const [rankingToggle, setRankingToggle] = useState<'spenders' | 'delinquents' | 'signups'>('spenders');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(6); // Default to current month index

  const inflows = dashboardData?.inflows || {
    thisWeekExpected: 0,
    nextWeekExpected: 0,
    nextMonthExpected: 0,
    nextDeadline: null,
    nextDeadlineAmount: 0,
  };

  const recentOrders = dashboardData?.recentOrders || [];
  const activities = dashboardData?.activities || [];
  const productCategories = dashboardData?.productCategories || [];
  const installmentAnalysis = dashboardData?.installmentAnalysis || [];
  const topClients = dashboardData?.topClients || [];
  const problemClients = dashboardData?.problemClients || [];
  const recentClients = dashboardData?.recentClients || [];
  const clientsList = dashboardData?.clientsList || [];

  // Time & Weather Live display
  const [currentTime, setCurrentTime] = useState(() => dayjs());
  const [weatherInfo, setWeatherInfo] = useState({ temp: '31°C', text: 'Sunny' });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals & form state
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isGlobalLimitOpen, setIsGlobalLimitOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // New Order Form state
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [itemName, setItemName] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [installmentMonths, setInstallmentMonths] = useState('6');
  const [purchaseDate, setPurchaseDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [firstPaymentDate, setFirstPaymentDate] = useState('');

  // Shared Orders states
  const [isShared, setIsShared] = useState(false);
  const [sharedParticipants, setSharedParticipants] = useState<string[]>([]);
  const [participantSelectorActiveOrderId, setParticipantSelectorActiveOrderId] = useState<string | null>(null);

  // Form states - New Order (Bulk mode additions)
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkOrders, setBulkOrders] = useState<Array<{ id: string; clientId: string; itemName: string; amount: string; months: string; purchaseDate: string; firstPaymentDate: string; remarks: string; isShared: boolean; participants: string[] }>>([]);
  const [clientSelectorActiveOrderId, setClientSelectorActiveOrderId] = useState<string | null>(null);
  const [bulkClientSearchQuery, setBulkClientSearchQuery] = useState('');

  const addBulkOrderRow = () => {
    setBulkOrders(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        clientId: '',
        itemName: '',
        amount: '',
        months: '6',
        purchaseDate: dayjs().format('YYYY-MM-DD'),
        firstPaymentDate: '',
        remarks: '',
        isShared: false,
        participants: [],
      }
    ]);
  };

  const removeBulkOrderRow = (id: string) => {
    setBulkOrders(prev => prev.filter(o => o.id !== id));
  };

  const updateBulkOrderRow = (id: string, fieldOrUpdates: string | Record<string, any>, value?: any) => {
    setBulkOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      if (typeof fieldOrUpdates === 'string') {
        return { ...o, [fieldOrUpdates]: value };
      }
      return { ...o, ...fieldOrUpdates };
    }));
  };

  useEffect(() => {
    if (isBulkMode && bulkOrders.length === 0) {
      addBulkOrderRow();
    }
  }, [isBulkMode]);

  // Global Limit Input state
  const [globalLimitAmount, setGlobalLimitAmount] = useState('');

  // Expandable list state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOverdue: false,
    hasTarget: false,
  });

  useRealtimeSync(
    ['orders', 'payments', 'account_limits', 'profiles'],
    undefined,
    [['admin-dashboard']]
  );

  // Heatmap data derived from dashboard REST API (cached in Redis)
  const allOrdersList = useMemo(() => {
    const orders = dashboardData?.allOrders || [];
    return orders.map((o: any) => ({
      id: o.id,
      itemName: o.itemName,
      amount: Number(o.amount),
      orderDate: parseUtcDate(o.orderDate),
    }));
  }, [dashboardData?.allOrders]);

  const allPaymentsList = useMemo(() => {
    const payments = dashboardData?.allPayments || [];
    return payments.map((p: any) => ({
      id: p.id,
      dueDate: parseUtcDate(p.dueDate),
      amountDue: Number(p.amountDue),
      isPaid: p.isPaid,
      paymentDate: p.paymentDate ? parseUtcDate(p.paymentDate) : null,
      monthNumber: p.monthNumber,
      order: {
        itemName: p.order?.itemName || 'Payment Settlement',
      },
    }));
  }, [dashboardData?.allPayments]);

  // Cashflow Trends and forecasting chart computations
  const chartData = useMemo(() => {
    if (!allPaymentsList || allPaymentsList.length === 0) return [];

    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    
    const pastPayments = allPaymentsList.filter((p: any) => {
      const d = p.dueDate;
      return d >= threeMonthsAgo && d < today;
    });
    
    const pastExpected = pastPayments.reduce((sum: number, p: any) => sum + p.amountDue, 0);
    const pastCollected = pastPayments.filter((p: any) => p.isPaid).reduce((sum: number, p: any) => sum + p.amountDue, 0);
    const efficiency = pastExpected > 0 ? (pastCollected / pastExpected) : (stats.collectionEfficiency / 100 || 0.9);

    const months = [];
    for (let i = -6; i <= 5; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      
      const monthStart = new Date(year, month, 1);
      const nextMonthStart = new Date(year, month + 1, 1);
      
      const monthPayments = allPaymentsList.filter((p: any) => {
        const d = p.dueDate;
        return d >= monthStart && d < nextMonthStart;
      });

      const expected = monthPayments.reduce((sum: number, p: any) => sum + p.amountDue, 0);
      const collected = monthPayments.filter((p: any) => p.isPaid).reduce((sum: number, p: any) => sum + p.amountDue, 0);
      
      const isFuture = monthStart >= new Date(today.getFullYear(), today.getMonth(), 1);
      const projected = isFuture ? expected * efficiency : collected;

      const monthLabel = targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      months.push({
        monthKey,
        monthLabel,
        expected,
        collected,
        projected,
        isFuture,
        efficiency: expected > 0 ? (collected / expected) * 100 : 100
      });
    }

    return months;
  }, [allPaymentsList, stats.collectionEfficiency]);

  const svgCoords = useMemo(() => {
    if (chartData.length === 0) return null;

    const width = 340;
    const height = 135;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 10;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxAmount = Math.max(...chartData.map(d => Math.max(d.expected, d.collected, d.projected)), 10000);

    const points = chartData.map((d, idx) => {
      const x = paddingLeft + (idx / 11) * chartWidth;
      const yExpected = paddingTop + (1 - d.expected / maxAmount) * chartHeight;
      const yActual = paddingTop + (1 - (d.isFuture ? d.projected : d.collected) / maxAmount) * chartHeight;
      return {
        x,
        yExpected,
        yActual,
        monthLabel: d.monthLabel,
        isFuture: d.isFuture,
        expected: d.expected,
        actual: d.isFuture ? d.projected : d.collected,
        efficiency: d.efficiency
      };
    });

    const expectedPath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yExpected}`).join(' ');
    const collectedPath = points.slice(0, 6).map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yActual}`).join(' ');
    const projectedPath = points.slice(5).map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yActual}`).join(' ');

    const ticksCount = 4;
    const yTicks = Array.from({ length: ticksCount + 1 }, (_, idx) => (maxAmount / ticksCount) * idx);

    return {
      points,
      expectedPath,
      collectedPath,
      projectedPath,
      yTicks,
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      maxAmount,
      chartHeight,
      chartWidth
    };
  }, [chartData]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Flip countdown updater
  useEffect(() => {
    if (!nextBillingSchedule.earliestDueDate) {
      setTimeLeft(prev => ({ ...prev, hasTarget: false }));
      return;
    }

    const targetDate = parseUtcDate(nextBillingSchedule.earliestDueDate);

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
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [nextBillingSchedule.earliestDueDate]);

  const handleScheduleOrderSubmit = async () => {
    if (isBulkMode) {
      if (bulkOrders.length === 0) {
        PremiumAlert.alert('Empty Form', 'Please add at least one order.');
        return;
      }
      for (let i = 0; i < bulkOrders.length; i++) {
        const o = bulkOrders[i];
        if (!o.clientId || !o.itemName || !o.amount) {
          PremiumAlert.alert('Incomplete Form', `Please complete all fields for Order #${i + 1}.`);
          return;
        }
        const parsedAmt = parseFloat(o.amount);
        if (isNaN(parsedAmt) || parsedAmt <= 0) {
          PremiumAlert.alert('Invalid Amount', `Please enter a valid purchase amount for Order #${i + 1}.`);
          return;
        }
      }

      setActionLoading(true);
      try {
        const payload = {
          orders: bulkOrders.map(o => ({
            clientId: o.clientId,
            itemName: o.itemName,
            amount: parseFloat(o.amount),
            months: parseInt(o.months, 10),
            purchaseDate: o.purchaseDate,
            firstPaymentDate: o.firstPaymentDate || undefined,
            remarks: o.remarks || undefined,
            participants: o.isShared ? o.participants : undefined,
          }))
        };

        const response = await callAdminApi('schedule-order', payload);

        if (response.success) {
          PremiumAlert.alert('Success', `Successfully scheduled ${bulkOrders.length} orders!`);
          setIsNewOrderOpen(false);
          // Clear fields
          setSelectedClientId('');
          setItemName('');
          setOrderAmount('');
          setInstallmentMonths('6');
          setFirstPaymentDate('');
          setIsBulkMode(false);
          setBulkOrders([]);
          setClientSelectorActiveOrderId(null);
          setBulkClientSearchQuery('');
          setIsShared(false);
          setSharedParticipants([]);
          setParticipantSelectorActiveOrderId(null);
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
        } else {
          PremiumAlert.alert('Error', response.error || 'Failed to schedule bulk orders.');
        }
      } catch (e: any) {
        PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
      } finally {
        setActionLoading(false);
      }
    } else {
      if (!selectedClientId || !itemName || !orderAmount) {
        PremiumAlert.alert('Incomplete Form', 'Please provide client selection, item name, and amount.');
        return;
      }

      setActionLoading(true);
      try {
        const response = await callAdminApi('schedule-order', {
          clientId: selectedClientId,
          itemName,
          amount: parseFloat(orderAmount),
          months: parseInt(installmentMonths, 10),
          purchaseDate,
          firstPaymentDate: firstPaymentDate || undefined,
          participants: isShared ? sharedParticipants : undefined,
        });

        if (response.success) {
          PremiumAlert.alert('Success', `Installment scheduled for ${itemName}!`);
          setIsNewOrderOpen(false);
          // Clear fields
          setSelectedClientId('');
          setItemName('');
          setOrderAmount('');
          setInstallmentMonths('6');
          setFirstPaymentDate('');
          setIsBulkMode(false);
          setBulkOrders([]);
          setClientSelectorActiveOrderId(null);
          setBulkClientSearchQuery('');
          setIsShared(false);
          setSharedParticipants([]);
          setParticipantSelectorActiveOrderId(null);
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
        } else {
          PremiumAlert.alert('Error', response.error || 'Failed to schedule installment plan.');
        }
      } catch (e: any) {
        PremiumAlert.alert('Network Error', e?.message || 'Server did not respond.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleGlobalLimitSubmit = async () => {
    const limit = parseFloat(globalLimitAmount);
    if (isNaN(limit) || limit <= 0) {
      PremiumAlert.alert('Invalid Input', 'Please provide a valid baseline limit amount.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await callAdminApi('adjust-global-limit', { limit });
      if (response.success) {
        PremiumAlert.alert('Success', `Global baseline limits allocated!`);
        setIsGlobalLimitOpen(false);
        setGlobalLimitAmount('');
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to adjust global limits.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
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
    iconBtnBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
  };

  const activeExposurePercent = stats.activeLimitExposure > 0
    ? Math.min(100, Math.round((stats.outstandingBalance / stats.activeLimitExposure) * 100))
    : 0;
  const filteredClients = clientsList.filter((client: any) => {
    const query = clientSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${client.name} ${client.email}`.toLowerCase().includes(query);
  });
  const selectedClient = clientsList.find((client: any) => client.id === selectedClientId);
  const parsedOrderAmount = isBulkMode
    ? bulkOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
    : (Number(orderAmount) || 0);
  const parsedMonths = Number(installmentMonths) || 1;
  const estimatedMonthlyDue = isBulkMode
    ? bulkOrders.reduce((sum, o) => sum + ((Number(o.amount) || 0) / (Number(o.months) || 1)), 0)
    : (parsedOrderAmount / parsedMonths);
  const projectedOutstanding = stats.outstandingBalance + parsedOrderAmount;
  const projectedExposurePercent = stats.activeLimitExposure > 0
    ? Math.min(100, Math.round((projectedOutstanding / stats.activeLimitExposure) * 100))
    : 0;

  const getCreditPoolMetrics = () => {
    const totalScheduledAmount = parsedOrderAmount;
    const projectedOutstanding = stats.outstandingBalance + totalScheduledAmount;
    const availableAfter = stats.activeLimitExposure - projectedOutstanding;

    const currentUtilPercent = stats.activeLimitExposure > 0 ? (stats.outstandingBalance / stats.activeLimitExposure) * 100 : 0;
    const projectedUtilPercent = stats.activeLimitExposure > 0 ? (projectedOutstanding / stats.activeLimitExposure) * 100 : 0;
    const addedUtilPercent = stats.activeLimitExposure > 0 ? (totalScheduledAmount / stats.activeLimitExposure) * 100 : 0;

    const isOverLimit = projectedOutstanding > stats.activeLimitExposure;
    const isNearingLimit = !isOverLimit && projectedUtilPercent >= 80;
    const overLimitAmount = isOverLimit ? projectedOutstanding - stats.activeLimitExposure : 0;

    return {
      creditLimit: stats.activeLimitExposure,
      currentOutstanding: stats.outstandingBalance,
      totalScheduledAmount,
      monthlyAmortizationSum: estimatedMonthlyDue,
      projectedOutstanding,
      availableAfter,
      currentUtilPercent,
      projectedUtilPercent,
      addedUtilPercent,
      isOverLimit,
      isNearingLimit,
      overLimitAmount
    };
  };

  const parsedGlobalLimit = Number(globalLimitAmount);
  const allocationPerClient = Number.isFinite(parsedGlobalLimit) && parsedGlobalLimit > 0 && clientsList.length > 0
    ? parsedGlobalLimit / clientsList.length
    : 0;

  if (loading) {
    return (
      <PremiumLoader
        title="Admin Control Center"
        subtitle="Loading system metrics and syncing ledgers..."
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      <AdminHeader title="Dashboard Overview" subtitle="S-Pay Admin" />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* Overdue alert */}
        {(stats.overduePaymentsCount > 0) && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => navigation.navigate('AdminPayments')}
            activeOpacity={0.9}
          >
            <View style={styles.alertBannerLeft}>
              <View style={styles.alertIconBox}>
                <AlertCircle size={20} color="#ef4444" />
              </View>
              <View style={styles.alertTextContainer}>
                <Text style={styles.alertTitle}>Overdue Dues Alert</Text>
                <Text style={styles.alertDesc}>
                  Currently {stats.overduePaymentsCount} overdue installments ({formatCurrency(stats.platformDefaults)}) require attention.
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color="#ef4444" />
          </TouchableOpacity>
        )}

        {/* Countdown card */}
        <View style={[styles.scheduleCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.scheduleHeader}>
            <View style={[styles.scheduleTitleRow, { flex: 1 }]}>
              <Calendar size={18} color={t.accent} />
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.scheduleTitle, { color: t.textPrimary }]} numberOfLines={1}>
                  {nextBillingSchedule.monthName ? `${nextBillingSchedule.monthName} Billing Cycle` : 'Billing Cycle Overview'}
                </Text>
                <Text style={styles.scheduleSubtitleText} numberOfLines={1}>
                  {nextBillingSchedule.monthName ? '' : 'No Billing Target'}
                  {nextBillingSchedule.earliestDueDate && `Earliest due on ${formatRelativeDate(nextBillingSchedule.earliestDueDate)}`}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {unpaidBillingSchedules.length > 1 && (
                <View style={styles.carouselNav}>
                  <TouchableOpacity
                    style={[styles.carouselBtn, selectedScheduleIndex === 0 && { opacity: 0.4 }]}
                    disabled={selectedScheduleIndex === 0}
                    onPress={() => setSelectedScheduleIndex(prev => prev - 1)}
                  >
                    <ChevronLeft size={16} color={t.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.carouselBtn, selectedScheduleIndex === unpaidBillingSchedules.length - 1 && { opacity: 0.4 }]}
                    disabled={selectedScheduleIndex === unpaidBillingSchedules.length - 1}
                    onPress={() => setSelectedScheduleIndex(prev => prev + 1)}
                  >
                    <ChevronRight size={16} color={t.textPrimary} />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={() => setIsScheduleOpen(!isScheduleOpen)}>
                {isScheduleOpen ? <ChevronUp size={18} color={t.textSecondary} /> : <ChevronDown size={18} color={t.textSecondary} />}
              </TouchableOpacity>
            </View>
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
              {(nextBillingSchedule.hasShared || nextBillingSchedule.payments?.some((p: any) => p.isShared) || nextBillingSchedule.clients?.some((c: any) => c.hasShared || c.items?.some((i: any) => i.isShared))) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'center' }}>
                  <Users size={12} color="#ee4d2d" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#ee4d2d', fontSize: 10, fontWeight: '700' }}>INCLUDES SHARED EXPENSES</Text>
                </View>
              )}
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
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.clientNameText, { color: t.textPrimary }]}>{client.clientName}</Text>
                            {(client.hasShared || client.items?.some((i: any) => i.isShared)) && (
                              <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6, flexDirection: 'row', alignItems: 'center' }}>
                                <Users size={10} color="#ee4d2d" style={{ marginRight: 2 }} />
                                <Text style={{ color: '#ee4d2d', fontSize: 9, fontWeight: '700' }}>SHARED</Text>
                              </View>
                            )}
                          </View>
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
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.subPaymentItem, { color: t.textPrimary }]}>{item.itemName}</Text>
                                    {item.isShared && (
                                      <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginLeft: 6 }}>
                                        <Text style={{ color: '#ee4d2d', fontSize: 8, fontWeight: '700' }}>SHARED</Text>
                                      </View>
                                    )}
                                  </View>
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

        {/* Stats Grid */}
        <Text style={styles.sectionHeader}>System Metrics</Text>
        <View style={styles.statsGrid}>
          {/* Card 1: Limit Exposure */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>LIMIT EXPOSURE</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(238, 77, 45, 0.06)' }]}>
                <DollarSign size={14} color="#ee4d2d" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{formatCurrency(stats.activeLimitExposure)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Out: {formatCurrency(stats.outstandingBalance)} ({activeExposurePercent}% Utilized)
              </Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Rem: {formatCurrency(Math.max(0, stats.activeLimitExposure - stats.outstandingBalance))} ({Math.max(0, 100 - activeExposurePercent)}% Free)
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${activeExposurePercent}%`, backgroundColor: '#ee4d2d' }]} />
              </View>
            </View>
          </View>

          {/* Card 2: Collections Ledger */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>COLLECTIONS</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.06)' }]}>
                <Receipt size={14} color="#10b981" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{formatCurrency(stats.outstandingBalance)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Efficiency: {stats.collectionEfficiency}% ({stats.completionRate}% Settled)
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${stats.collectionEfficiency}%`, backgroundColor: '#10b981' }]} />
              </View>
            </View>
          </View>

          {/* Card 3: Default Arrears */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>DEFAULTS ARREARS</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.06)' }]}>
                <AlertTriangle size={14} color="#ef4444" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: '#ef4444' }]} numberOfLines={1}>{formatCurrency(stats.platformDefaults)}</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                {stats.overduePaymentsCount} overdue installments
              </Text>
              <View style={styles.alertIndicatorRow}>
                <View style={styles.redPingDot} />
                <Text style={styles.alertIndicatorText}>HIGH EXPOSURE ALERT</Text>
              </View>
            </View>
          </View>

          {/* Card 4: Client Base */}
          <View style={[styles.statCard, { width: '48%', backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardLabel}>CLIENT BASE</Text>
              <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.06)' }]}>
                <Users size={14} color="#3b82f6" />
              </View>
            </View>
            <View style={styles.statCardBody}>
              <Text style={[styles.statCardVal, { color: t.textPrimary }]} numberOfLines={1}>{stats.activeClientsCount} Accounts</Text>
              <Text style={styles.statCardDesc} numberOfLines={1}>
                Settle Rate: {stats.completionRate}%
              </Text>
              <View style={styles.statProgressTrack}>
                <View style={[styles.statProgressBar, { width: `${stats.completionRate}%`, backgroundColor: '#3b82f6' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Platform Activity Heatmap */}
        <ActivityHeatmap
          allOrders={allOrdersList}
          allPayments={allPaymentsList}
          title="Platform Transaction Heatmap"
          subtitle="Aggregate platform-wide visualization of orders placed and payment settlements over the past year."
        />



        {/* Rankings & Leaderboards Card */}
        <View style={[styles.rankingsCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.rankingsHeader}>
            <Text style={[styles.rankingsTitle, { color: t.textPrimary }]}>Rankings & Leaderboards</Text>
            <View style={[styles.toggleContainer, { backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }]}>
              <TouchableOpacity
                style={[styles.toggleBtn, rankingToggle === 'spenders' && styles.toggleBtnActive]}
                onPress={() => setRankingToggle('spenders')}
              >
                <Trophy size={14} color={rankingToggle === 'spenders' ? '#fff' : t.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, rankingToggle === 'delinquents' && styles.toggleBtnActive]}
                onPress={() => setRankingToggle('delinquents')}
              >
                <AlertCircle size={14} color={rankingToggle === 'delinquents' ? '#fff' : t.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, rankingToggle === 'signups' && styles.toggleBtnActive]}
                onPress={() => setRankingToggle('signups')}
              >
                <UserPlus size={14} color={rankingToggle === 'signups' ? '#fff' : t.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.rankingsBody}>
            {rankingToggle === 'spenders' && (
              topClients.length > 0 ? (
                topClients.map((c: any, idx: number) => (
                  <View key={idx} style={styles.rankingRow}>
                    <View style={styles.rankingRowLeft}>
                      <Text style={styles.rankingIndex}>#{idx + 1}</Text>
                      <View>
                        <Text style={[styles.rankingName, { color: t.textPrimary }]}>{c.name}</Text>
                        <Text style={[styles.rankingSubtitle, { color: t.textSecondary }]}>{c.count} orders</Text>
                      </View>
                    </View>
                    <Text style={[styles.rankingAmount, { color: t.textPrimary }]}>{formatCurrency(c.totalSpent)}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: t.textSecondary }]}>No spender data available.</Text>
              )
            )}

            {rankingToggle === 'delinquents' && (
              problemClients.length > 0 ? (
                problemClients.map((c: any, idx: number) => (
                  <View key={idx} style={styles.rankingRow}>
                    <View style={styles.rankingRowLeft}>
                      <Text style={[styles.rankingIndex, { color: '#ef4444' }]}>#{idx + 1}</Text>
                      <Text style={[styles.rankingName, { color: t.textPrimary }]}>{c.name}</Text>
                    </View>
                    <View style={styles.delinquentBadge}>
                      <Text style={styles.delinquentBadgeText}>{c.overdueCount} Overdue</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: '#10b981', fontWeight: 'bold' }]}>✓ Clear ledger: no defaults.</Text>
              )
            )}

            {rankingToggle === 'signups' && (
              recentClients.length > 0 ? (
                recentClients.map((c: any, idx: number) => (
                  <View key={idx} style={styles.rankingRow}>
                    <View>
                      <Text style={[styles.rankingName, { color: t.textPrimary }]}>{c.name}</Text>
                      <Text style={[styles.rankingSubtitle, { color: t.textSecondary }]}>{c.email}</Text>
                    </View>
                    <Text style={[styles.rankingDate, { color: t.textSecondary }]}>
                      {formatRelativeDate(c.createdAt)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: t.textSecondary }]}>No new signups.</Text>
              )
            )}
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionHeader}>Admin Operations</Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={[styles.actionRowBtn, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]} onPress={() => setIsNewOrderOpen(true)}>
            <View style={[styles.actionIconBox, { backgroundColor: t.accentLight }]}>
              <Plus size={20} color={t.accent} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitleText, { color: t.textPrimary }]}>Assign New Order</Text>
              <Text style={styles.actionDescText}>Create a new client installments ledger plan</Text>
            </View>
            <ChevronRight size={16} color={t.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRowBtn, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]} onPress={() => setIsGlobalLimitOpen(true)}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
              <Sliders size={20} color="#10b981" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitleText, { color: t.textPrimary }]}>Adjust Baseline Limits</Text>
              <Text style={styles.actionDescText}>Configure default allocation per registered user</Text>
            </View>
            <ChevronRight size={16} color={t.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Section A: Live Activity Hub (Tabbed) */}
        <Text style={styles.sectionHeader}>Live Activity Hub</Text>
        <View style={[styles.logsContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingVertical: 16 }]}>
          <View style={[styles.tabHeader, { borderBottomColor: t.border }]}>
            <View style={styles.tabButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  operationsTab === 'orders' && { backgroundColor: isDarkMode ? '#1e293b' : '#0f172a' }
                ]}
                onPress={() => setOperationsTab('orders')}
              >
                <FileText size={14} color={operationsTab === 'orders' ? '#fff' : t.textSecondary} />
                <Text style={[styles.tabButtonText, { color: operationsTab === 'orders' ? '#fff' : t.textSecondary }]}>
                  Recent Orders
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  operationsTab === 'timeline' && { backgroundColor: isDarkMode ? '#1e293b' : '#0f172a' }
                ]}
                onPress={() => setOperationsTab('timeline')}
              >
                <Activity size={14} color={operationsTab === 'timeline' ? '#fff' : t.textSecondary} />
                <Text style={[styles.tabButtonText, { color: operationsTab === 'timeline' ? '#fff' : t.textSecondary }]}>
                  Timeline Feed
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            {operationsTab === 'orders' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableContainer}>
                  {/* Table Header */}
                  <View style={[styles.tableHeaderRow, { borderBottomColor: t.border }]}>
                    <Text style={[styles.tableHeaderCell, { width: 100, color: t.textSecondary }]}>CLIENT</Text>
                    <Text style={[styles.tableHeaderCell, { width: 130, color: t.textSecondary }]}>ITEM NAME</Text>
                    <Text style={[styles.tableHeaderCell, { width: 60, textAlign: 'center', color: t.textSecondary }]}>TERM</Text>
                    <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'right', color: t.textSecondary }]}>AMOUNT</Text>
                    <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'right', color: t.textSecondary }]}>STATUS</Text>
                  </View>
                  {/* Table Body */}
                  {recentOrders.length > 0 ? (
                    recentOrders.map((o: any) => (
                      <View key={o.id} style={[styles.tableBodyRow, { 
                        borderBottomColor: t.border,
                        ...(o.isShared && { borderStyle: 'dashed', borderWidth: 1, borderColor: '#ee4d2d' })
                      }]}>
                        <Text style={[styles.tableCell, { width: 100, fontWeight: 'bold', color: t.textPrimary }]} numberOfLines={1}>
                          {o.clientName} {o.isShared && <Text style={{ color: '#ee4d2d', fontSize: 10 }}>[SHARED]</Text>}
                        </Text>
                        <Text style={[styles.tableCell, { width: 130, color: t.textPrimary }]} numberOfLines={1}>
                          {o.itemName}
                        </Text>
                        <Text style={[styles.tableCell, { width: 60, textAlign: 'center', color: t.textPrimary }]}>
                          {o.installmentMonths} Mos
                        </Text>
                        <Text style={[styles.tableCell, { width: 90, textAlign: 'right', fontWeight: 'bold', color: t.textPrimary }]}>
                          {formatCurrency(o.amount)}
                        </Text>
                        <View style={[{ width: 70, alignItems: 'flex-end' }]}>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: o.isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }
                          ]}>
                            <Text style={[
                              styles.statusBadgeText,
                              { color: o.isPaid ? '#10b981' : '#f59e0b' }
                            ]}>
                              {o.isPaid ? 'Paid' : 'Active'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.emptyText, { color: t.textSecondary }]}>No recent orders.</Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.timelineContainer}>
                {activities.length > 0 ? (
                  activities.map((act: any, index: number) => (
                    <View key={index} style={[styles.timelineItem, { 
                      borderLeftColor: t.border,
                      ...(act.isShared && { borderStyle: 'dashed', borderWidth: 1, borderColor: '#ee4d2d', borderRadius: 8, padding: 4, marginBottom: 8 })
                    }]}>
                      <View style={[
                        styles.timelineBullet,
                        { backgroundColor: act.type === 'order' ? '#f97316' : '#10b981' }
                      ]} />
                      <View style={styles.timelineContent}>
                        <Text style={[styles.timelineText, { color: t.textPrimary }]}>
                          <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>{act.name}</Text>
                          {act.isShared && <Text style={{ color: '#ee4d2d', fontSize: 10, fontWeight: 'bold' }}> [SHARED]</Text>}
                          <Text style={{ color: t.textSecondary }}>
                            {act.type === 'order' ? ' scheduled ' : ' paid '}
                          </Text>
                          <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>{act.detail}</Text>
                        </Text>
                        <View style={styles.timelineMetaRow}>
                          <Text style={[styles.timelineTimeText, { color: t.textSecondary }]}>
                            {formatRelativeDate(act.createdAt)}
                          </Text>
                          <Text style={[
                            styles.timelineAmountText,
                            { color: act.type === 'order' ? '#ee4d2d' : '#10b981' }
                          ]}>
                            {act.type === 'order' ? '+' : ''}{formatCurrency(act.amount)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyText, { color: t.textSecondary }]}>No recent events.</Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Section B: Portfolio Analytics (Tabbed) */}
        <Text style={styles.sectionHeader}>Portfolio Analytics</Text>
        <View style={[styles.logsContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingVertical: 16 }]}>
          <View style={[styles.tabHeader, { borderBottomColor: t.border }]}>
            <View style={styles.tabButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  trendsTab === 'categories' && { backgroundColor: isDarkMode ? '#1e293b' : '#0f172a' }
                ]}
                onPress={() => setTrendsTab('categories')}
              >
                <Layers size={14} color={trendsTab === 'categories' ? '#fff' : t.textSecondary} />
                <Text style={[styles.tabButtonText, { color: trendsTab === 'categories' ? '#fff' : t.textSecondary }]}>
                  Categories
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  trendsTab === 'installments' && { backgroundColor: isDarkMode ? '#1e293b' : '#0f172a' }
                ]}
                onPress={() => setTrendsTab('installments')}
              >
                <BarChart3 size={14} color={trendsTab === 'installments' ? '#fff' : t.textSecondary} />
                <Text style={[styles.tabButtonText, { color: trendsTab === 'installments' ? '#fff' : t.textSecondary }]}>
                  Terms
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  trendsTab === 'cashflow' && { backgroundColor: isDarkMode ? '#1e293b' : '#0f172a' }
                ]}
                onPress={() => setTrendsTab('cashflow')}
              >
                <TrendingUp size={14} color={trendsTab === 'cashflow' ? '#fff' : t.textSecondary} />
                <Text style={[styles.tabButtonText, { color: trendsTab === 'cashflow' ? '#fff' : t.textSecondary }]}>
                  Cashflow
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            {trendsTab === 'categories' && (
              <View style={styles.trendsContainer}>
                {productCategories.length > 0 ? (
                  productCategories.map((c: any, idx: number) => {
                    const maxVal = productCategories[0].totalValue || 1;
                    const percentage = Math.max(5, Math.round((c.totalValue / maxVal) * 100));
                    return (
                      <View key={idx} style={styles.categoryRow}>
                        <View style={styles.categoryInfo}>
                          <Text style={[styles.categoryName, { color: t.textPrimary }]}>{c.category}</Text>
                          <Text style={[styles.categoryValue, { color: t.textSecondary }]}>
                            {formatCurrency(c.totalValue)} ({c.orderCount})
                          </Text>
                        </View>
                        <View style={[styles.categoryProgressTrack, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]}>
                          <View
                            style={[
                              styles.categoryProgressBar,
                              { width: `${percentage}%`, backgroundColor: t.accent }
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.emptyText, { color: t.textSecondary }]}>No category statistics.</Text>
                )}
              </View>
            )}

            {trendsTab === 'installments' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableContainer}>
                  <View style={[styles.tableHeaderRow, { borderBottomColor: t.border }]}>
                    <Text style={[styles.tableHeaderCell, { width: 100, color: t.textSecondary }]}>PLAN PERIOD</Text>
                    <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'center', color: t.textSecondary }]}>ORDERS</Text>
                    <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'right', color: t.textSecondary }]}>COLLECTED</Text>
                    <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'right', color: t.textSecondary }]}>OUTSTANDING</Text>
                  </View>
                  {installmentAnalysis.length > 0 ? (
                    installmentAnalysis.map((item: any, idx: number) => (
                      <View key={idx} style={[styles.tableBodyRow, { borderBottomColor: t.border }]}>
                        <Text style={[styles.tableCell, { width: 100, fontWeight: 'bold', color: t.textPrimary }]}>
                          {item.months} Months
                        </Text>
                        <Text style={[styles.tableCell, { width: 90, textAlign: 'center', color: t.textPrimary }]}>
                          {item.count}
                        </Text>
                        <Text style={[styles.tableCell, { width: 120, textAlign: 'right', fontWeight: 'bold', color: '#10b981' }]}>
                          {formatCurrency(item.collected)}
                        </Text>
                        <Text style={[styles.tableCell, { width: 120, textAlign: 'right', fontWeight: 'bold', color: t.textPrimary }]}>
                          {formatCurrency(item.outstanding)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.emptyText, { color: t.textSecondary }]}>No installment term data.</Text>
                  )}
                </View>
              </ScrollView>
            )}

            {trendsTab === 'cashflow' && (
              <View style={styles.trendsContainer}>
                {svgCoords ? (
                  <View style={{ alignItems: 'center' }}>
                    {/* Legend */}
                    <View style={[styles.legendContainer, { marginBottom: 12, width: '100%' }]}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.legendText, { color: t.textSecondary }]}>Collected</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
                        <Text style={[styles.legendText, { color: t.textSecondary }]}>Projected (Forecast)</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#475569' : '#cbd5e1' }]} />
                        <Text style={[styles.legendText, { color: t.textSecondary }]}>Expected Inflow</Text>
                      </View>
                    </View>

                    {/* SVG Chart */}
                    <View style={styles.chartSvgContainer}>
                      <Svg width={svgCoords.width} height={svgCoords.height}>
                        <G>
                          {/* Y Axis Grid Lines & Labels */}
                          {svgCoords.yTicks.map((tickVal, index) => {
                            const y = svgCoords.paddingTop + (1 - tickVal / svgCoords.maxAmount) * svgCoords.chartHeight;
                            return (
                              <G key={index}>
                                <Line
                                  x1={svgCoords.paddingLeft}
                                  y1={y}
                                  x2={svgCoords.width - svgCoords.paddingRight}
                                  y2={y}
                                  stroke={isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
                                  strokeDasharray="2, 2"
                                />
                                <SvgText
                                  x={svgCoords.paddingLeft - 8}
                                  y={y + 3}
                                  fontSize="7"
                                  fontWeight="600"
                                  fill={t.textSecondary}
                                  textAnchor="end"
                                >
                                  {tickVal >= 1000 ? `${(tickVal / 1000).toFixed(0)}k` : tickVal}
                                </SvgText>
                              </G>
                            );
                          })}

                          {/* X Axis Line */}
                          <Line
                            x1={svgCoords.paddingLeft}
                            y1={svgCoords.height - svgCoords.paddingBottom}
                            x2={svgCoords.width - svgCoords.paddingRight}
                            y2={svgCoords.height - svgCoords.paddingBottom}
                            stroke={t.border}
                            strokeWidth="1"
                          />

                          {/* Expected collections path (Dashed grey line) */}
                          {svgCoords.expectedPath && (
                            <Path
                              d={svgCoords.expectedPath}
                              fill="none"
                              stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                              strokeWidth="1.5"
                              strokeDasharray="4, 4"
                            />
                          )}

                          {/* Collected path (Solid green line) */}
                          {svgCoords.collectedPath && (
                            <Path
                              d={svgCoords.collectedPath}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2.5"
                            />
                          )}

                          {/* Projected path (Dashed orange line) */}
                          {svgCoords.projectedPath && (
                            <Path
                              d={svgCoords.projectedPath}
                              fill="none"
                              stroke="#f97316"
                              strokeWidth="2.5"
                              strokeDasharray="4, 4"
                            />
                          )}

                          {/* Points and X Labels */}
                          {svgCoords.points.map((p, idx) => {
                            const showLabel = idx % 2 === 0;

                            return (
                              <G key={idx}>
                                {/* X Label */}
                                {showLabel && (
                                  <SvgText
                                    x={p.x}
                                    y={svgCoords.height - 4}
                                    fontSize="7"
                                    fontWeight="600"
                                    fill={t.textSecondary}
                                    textAnchor="middle"
                                  >
                                    {p.monthLabel}
                                  </SvgText>
                                )}

                                {/* Dot for Actual/Projected */}
                                <Circle
                                  cx={p.x}
                                  cy={p.yActual}
                                  r="3"
                                  fill={p.isFuture ? '#f97316' : '#10b981'}
                                />

                                {/* Subtle hollow dot for Expected */}
                                <Circle
                                  cx={p.x}
                                  cy={p.yExpected}
                                  r="2"
                                  fill="none"
                                  stroke={isDarkMode ? '#94a3b8' : '#64748b'}
                                  strokeWidth="1"
                                />
                              </G>
                            );
                          })}
                        </G>
                      </Svg>
                    </View>

                    {/* Details Cards for Selected / Current Month */}
                    {(() => {
                      const today = new Date();
                      const mLabel = today.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                      const currentPoint = svgCoords.points.find(p => p.monthLabel === mLabel) || svgCoords.points[5];

                      if (!currentPoint) return null;

                      return (
                        <View style={[styles.detailBox, { width: '100%', backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc', borderColor: t.cardBorder }]}>
                          <View style={styles.detailHeader}>
                            <TrendingUp size={12} color={t.accent} />
                            <Text style={[styles.detailTitle, { color: t.textPrimary }]}>
                              {currentPoint.monthLabel} Cashflow Status
                            </Text>
                          </View>
                          <View style={styles.detailGrid}>
                            <View style={styles.detailCol}>
                              <Text style={styles.detailLabel}>EXPECTED INFLOW</Text>
                              <Text style={[styles.detailValue, { color: t.textPrimary }]}>
                                {formatCurrency(currentPoint.expected)}
                              </Text>
                            </View>
                            <View style={styles.detailCol}>
                              <Text style={styles.detailLabel}>
                                {currentPoint.isFuture ? 'PROJECTED' : 'COLLECTED'}
                              </Text>
                              <Text style={[styles.detailValue, { color: currentPoint.isFuture ? '#f97316' : '#10b981' }]}>
                                {formatCurrency(currentPoint.actual)}
                              </Text>
                            </View>
                            <View style={styles.detailCol}>
                              <Text style={styles.detailLabel}>EFFICIENCY</Text>
                              <Text style={[styles.detailValue, { color: currentPoint.efficiency >= 90 ? '#10b981' : currentPoint.efficiency >= 70 ? '#f59e0b' : '#ef4444' }]}>
                                {currentPoint.efficiency.toFixed(1)}%
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                ) : (
                  <Text style={[styles.emptyText, { color: t.textSecondary }]}>No cashflow coordinates computed.</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* New Order Modal */}
      <Modal visible={isNewOrderOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SwipeDismissModal onDismiss={() => setIsNewOrderOpen(false)} disabled={actionLoading}>
            <View style={[styles.premiumSheet, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder }]}>
              <LinearGradient
                colors={isDarkMode ? ['#1f2937', '#111827'] : ['#fff7ed', '#ffffff']}
                style={styles.sheetHero}
              >
                <View style={styles.sheetHeroTop}>
                  <View style={styles.sheetTitleCluster}>
                    <View style={styles.sheetIconBadge}>
                      <ShoppingBag size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>ORDER DESK</Text>
                      <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Schedule New Order</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsNewOrderOpen(false)} disabled={actionLoading}>
                    <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Close</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.sheetMetricRow}>
                  <View style={[styles.sheetMetric, { backgroundColor: isDarkMode ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.72)', borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(238,77,45,0.12)' }]}>
                    <Text style={[styles.sheetMetricLabel, { color: isDarkMode ? '#cbd5e1' : '#64748b' }]}>Monthly due</Text>
                    <Text
                      style={[styles.sheetMetricValue, { color: isDarkMode ? '#ffffff' : t.textPrimary }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      {formatCurrency(estimatedMonthlyDue)}
                    </Text>
                  </View>
                  <View style={[styles.sheetMetric, { backgroundColor: isDarkMode ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.72)', borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(238,77,45,0.12)' }]}>
                    <Text style={[styles.sheetMetricLabel, { color: isDarkMode ? '#cbd5e1' : '#64748b' }]}>Exposure</Text>
                    <Text
                      style={[styles.sheetMetricValue, { color: projectedExposurePercent > 80 ? '#f87171' : (isDarkMode ? '#ffffff' : t.textPrimary) }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                    >
                      {projectedExposurePercent}%
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              <ScrollView contentContainerStyle={styles.premiumFormContainer} showsVerticalScrollIndicator={false}>
                {/* Bulk Mode Toggle */}
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: t.textPrimary }]}>Bulk Order Scheduling</Text>
                  <TouchableOpacity
                    style={[styles.switchTrack, isBulkMode ? styles.switchTrackActive : styles.switchTrackInactive]}
                    onPress={() => setIsBulkMode(!isBulkMode)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.switchThumb, isBulkMode ? styles.switchThumbActive : styles.switchThumbInactive]} />
                  </TouchableOpacity>
                </View>

                {!isBulkMode ? (
                  <>
                    <View style={styles.formSectionHeader}>
                      <Text style={[styles.formSectionTitle, { color: t.textPrimary }]}>Client</Text>
                      <Text style={[styles.formSectionMeta, { color: t.textSecondary }]}>{clientsList.length} accounts</Text>
                    </View>

                    <View style={[styles.searchInputShell, { borderColor: t.cardBorder, backgroundColor: isDarkMode ? '#0b1220' : '#ffffff' }]}>
                      <Search size={15} color={t.textSecondary} />
                      <TextInput
                        style={[styles.searchInput, { color: t.textPrimary }]}
                        placeholder="Search name or email"
                        placeholderTextColor={t.textSecondary}
                        value={clientSearchQuery}
                        onChangeText={setClientSearchQuery}
                      />
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientRail}>
                      {filteredClients.map((client: any) => {
                        const selected = selectedClientId === client.id;
                        return (
                          <TouchableOpacity
                            key={client.id}
                            style={[
                              styles.clientChoiceCard,
                              { backgroundColor: selected ? (isDarkMode ? 'rgba(238, 77, 45, 0.12)' : 'rgba(238, 77, 45, 0.05)') : (isDarkMode ? '#111827' : '#ffffff'), borderColor: selected ? t.accent : t.cardBorder },
                              selected && styles.clientChoiceCardActive,
                            ]}
                            onPress={() => setSelectedClientId(client.id)}
                            activeOpacity={0.86}
                          >
                            <View style={styles.clientAvatarWrapper}>
                              <Image
                                source={{ uri: client.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || client.email || '?')}&background=ee4d2d&color=fff&size=120&bold=true` }}
                                style={[styles.clientAvatar, { borderColor: selected ? t.accent : t.cardBorder }]}
                                contentFit="cover"
                              />
                              {selected && (
                                <View style={[styles.avatarCheckBadge, { backgroundColor: t.accent }]}>
                                  <Check size={10} color="#ffffff" strokeWidth={3} />
                                </View>
                              )}
                            </View>
                            <Text style={[styles.clientChoiceName, { color: t.textPrimary }]} numberOfLines={1}>{client.name}</Text>
                            <Text style={[styles.clientChoiceEmail, { color: t.textSecondary }]} numberOfLines={1}>{client.email}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <View style={[styles.selectedClientStrip, { backgroundColor: isDarkMode ? 'rgba(238,77,45,0.12)' : '#fff7ed', borderColor: t.accentLight }]}>
                      <Users size={15} color={t.accent} />
                      <Text style={[styles.selectedClientText, { color: selectedClient ? t.textPrimary : t.textSecondary }]} numberOfLines={1}>
                        {selectedClient ? `${selectedClient.name} is selected` : 'Select a client to continue'}
                      </Text>
                    </View>

                    {/* Shared Order Toggle */}
                    <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder, marginTop: 12 }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>SHARED ORDER</Text>
                          <Text style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>Split payments across clients</Text>
                        </View>
                        <Switch
                          value={isShared}
                          onValueChange={setIsShared}
                          trackColor={{ false: '#767577', true: isDarkMode ? 'rgba(238, 77, 45, 0.5)' : '#ffb3a1' }}
                          thumbColor={isShared ? '#ee4d2d' : '#f4f3f4'}
                        />
                      </View>
                      
                      {isShared && (
                        <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 16 }}>
                          <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>PARTICIPANTS ({sharedParticipants.length})</Text>
                          <TouchableOpacity
                            style={[styles.inlineClientSelector, { marginTop: 8 }]}
                            onPress={() => {
                              setParticipantSelectorActiveOrderId('single');
                              setBulkClientSearchQuery('');
                            }}
                          >
                            <Text style={[styles.selectedClientName, { color: sharedParticipants.length > 0 ? t.textPrimary : t.textSecondary }]}>
                              {sharedParticipants.length > 0 ? `${sharedParticipants.length} selected` : 'Choose Participants...'}
                            </Text>
                            <ChevronDown size={14} color={t.textSecondary} />
                          </TouchableOpacity>

                          {/* Split-Billing Calculator Inline */}
                          {(() => {
                            const totalAmount = parseFloat(orderAmount) || 0;
                            const monthsCount = parseInt(installmentMonths, 10) || 6;
                            const totalParts = 1 + sharedParticipants.length;
                            const splitPrincipal = totalAmount / totalParts;
                            const splitMonthly = splitPrincipal / monthsCount;
                            return (
                              <View style={{ marginTop: 14, backgroundColor: isDarkMode ? '#1e293b' : '#fff7ed', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#ffedd5', borderRadius: 16, padding: 14 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: t.accent, letterSpacing: 1, marginBottom: 6 }}>SPLIT CALCULATOR</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: t.textPrimary }}>
                                      ₱{splitPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                                    </Text>
                                    <Text style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
                                      ₱{splitMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month for {monthsCount} months
                                    </Text>
                                  </View>
                                  <View style={{ backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.15)' : 'rgba(238, 77, 45, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: t.accent }}>
                                      1 Main + {sharedParticipants.length} Split{sharedParticipants.length === 1 ? '' : 's'}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            );
                          })()}
                        </View>
                      )}
                    </View>

                    <View style={styles.formSectionHeader}>
                      <Text style={[styles.formSectionTitle, { color: t.textPrimary }]}>Order Details</Text>
                      <Text style={[styles.formSectionMeta, { color: t.textSecondary }]}>Installment setup</Text>
                    </View>

                    <View style={styles.inputGrid}>
                      <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                        <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>ITEM NAME</Text>
                        <TextInput
                          style={[styles.premiumInput, { color: t.textPrimary }]}
                          placeholder="MacBook Pro M3"
                          placeholderTextColor={t.textSecondary}
                          value={itemName}
                          onChangeText={setItemName}
                        />
                      </View>

                      <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                        <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>PURCHASE AMOUNT</Text>
                        <View style={styles.amountInputRow}>
                          <Text style={styles.currencyPrefix}>PHP</Text>
                          <TextInput
                            style={[styles.premiumInput, styles.amountInput, { color: t.textPrimary }]}
                            placeholder="79,990"
                            keyboardType="numeric"
                            placeholderTextColor={t.textSecondary}
                            value={orderAmount}
                            onChangeText={setOrderAmount}
                          />
                        </View>
                      </View>
                    </View>

                    <View style={styles.termGrid}>
                      {['1', '3', '6', '12'].map((m) => {
                        const selected = installmentMonths === m;
                        const monthly = Number.isFinite(parsedOrderAmount) && parsedOrderAmount > 0 ? parsedOrderAmount / Number(m) : 0;
                        return (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.termCard,
                              { backgroundColor: selected ? t.accent : (isDarkMode ? '#111827' : '#ffffff'), borderColor: selected ? t.accent : t.cardBorder },
                            ]}
                            onPress={() => setInstallmentMonths(m)}
                            activeOpacity={0.86}
                          >
                            <View style={styles.termTitleRow}>
                              <Text style={[styles.termMonths, { color: selected ? '#ffffff' : t.textPrimary }]}>{m}</Text>
                              <Text style={[styles.termCaption, { color: selected ? 'rgba(255,255,255,0.78)' : t.textSecondary }]}>{Number(m) === 1 ? 'Month' : 'Months'}</Text>
                            </View>
                            <Text style={[styles.termDue, { color: selected ? '#ffffff' : t.textPrimary }]} numberOfLines={1}>
                              {monthly > 0 ? formatCurrency(monthly) : '--'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.dateGrid}>
                      <DatePicker
                        label="Purchase Date"
                        value={purchaseDate}
                        onChange={setPurchaseDate}
                      />
                      <DatePicker
                        label="First Due Date"
                        value={firstPaymentDate}
                        onChange={setFirstPaymentDate}
                        placeholder="Auto: 5th next month"
                      />
                    </View>
                  </>
                ) : (
                  <View style={{ gap: 16 }}>
                    {bulkOrders.map((order, idx) => (
                      <View
                        key={order.id}
                        style={[
                          styles.bulkCard,
                          {
                            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                            borderColor: t.cardBorder,
                          },
                        ]}
                      >
                        <View style={styles.bulkCardHeader}>
                          <Text style={[styles.bulkOrderNumber, { color: t.accent }]}>Order #{idx + 1}</Text>
                          {bulkOrders.length > 1 && (
                            <TouchableOpacity onPress={() => removeBulkOrderRow(order.id)}>
                              <Text style={[styles.removeText, { color: '#ef4444' }]}>Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.cardBorder }]}>
                          <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>ASSIGNED CLIENT *</Text>
                          <TouchableOpacity
                            style={styles.inlineClientSelector}
                            onPress={() => {
                              setClientSelectorActiveOrderId(order.id);
                              setBulkClientSearchQuery('');
                            }}
                          >
                            <Text style={[styles.selectedClientName, { color: order.clientId ? t.textPrimary : t.textSecondary }]}>
                              {order.clientId ? (clientsList.find((p: any) => p.id === order.clientId)?.name || 'Unknown Client') : 'Choose Client...'}
                            </Text>
                            <ChevronDown size={14} color={t.textSecondary} />
                          </TouchableOpacity>
                        </View>

                        {/* Shared Order Toggle for Bulk */}
                        <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.cardBorder }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                              <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>SHARED ORDER</Text>
                            </View>
                            <Switch
                              value={order.isShared || false}
                              onValueChange={(val) => updateBulkOrderRow(order.id, { isShared: val, participants: val ? order.participants || [] : [] })}
                              trackColor={{ false: '#767577', true: isDarkMode ? 'rgba(238, 77, 45, 0.5)' : '#ffb3a1' }}
                              thumbColor={order.isShared ? '#ee4d2d' : '#f4f3f4'}
                            />
                          </View>

                          {order.isShared && (
                            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12 }}>
                              <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>PARTICIPANTS ({(order.participants || []).length})</Text>
                              <TouchableOpacity
                                style={[styles.inlineClientSelector, { marginTop: 8 }]}
                                onPress={() => {
                                  setParticipantSelectorActiveOrderId(order.id);
                                  setBulkClientSearchQuery('');
                                }}
                              >
                                <Text style={[styles.selectedClientName, { color: (order.participants || []).length > 0 ? t.textPrimary : t.textSecondary }]}>
                                  {(order.participants || []).length > 0 ? `${(order.participants || []).length} selected` : 'Choose Participants...'}
                                </Text>
                                <ChevronDown size={14} color={t.textSecondary} />
                              </TouchableOpacity>

                              {/* Split-Billing Calculator Inline */}
                              {(() => {
                                const totalAmount = parseFloat(order.amount) || 0;
                                const monthsCount = parseInt(order.months, 10) || 6;
                                const partsList = order.participants || [];
                                const totalParts = 1 + partsList.length;
                                const splitPrincipal = totalAmount / totalParts;
                                const splitMonthly = splitPrincipal / monthsCount;
                                return (
                                  <View style={{ marginTop: 14, backgroundColor: isDarkMode ? '#1e293b' : '#fff7ed', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#ffedd5', borderRadius: 16, padding: 14 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: t.accent, letterSpacing: 1, marginBottom: 6 }}>SPLIT CALCULATOR</Text>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: t.textPrimary }}>
                                          ₱{splitPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                                        </Text>
                                        <Text style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
                                          ₱{splitMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month for {monthsCount} months
                                        </Text>
                                      </View>
                                      <View style={{ backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.15)' : 'rgba(238, 77, 45, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: t.accent }}>
                                          1 Main + {partsList.length} Split{partsList.length === 1 ? '' : 's'}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                );
                              })()}
                            </View>
                          )}
                        </View>

                        <View style={styles.inputGrid}>
                          <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.cardBorder }]}>
                            <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>ITEM NAME *</Text>
                            <TextInput
                              style={[styles.premiumInput, { color: t.textPrimary }]}
                              placeholder="e.g. Phone, Laptop"
                              placeholderTextColor={t.textSecondary}
                              value={order.itemName}
                              onChangeText={(text) => updateBulkOrderRow(order.id, 'itemName', text)}
                            />
                          </View>

                          <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.cardBorder }]}>
                            <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>PURCHASE AMOUNT (PHP) *</Text>
                            <View style={styles.amountInputRow}>
                              <Text style={styles.currencyPrefix}>PHP</Text>
                              <TextInput
                                style={[styles.premiumInput, styles.amountInput, { color: t.textPrimary }]}
                                placeholder="0.00"
                                keyboardType="numeric"
                                placeholderTextColor={t.textSecondary}
                                value={order.amount}
                                onChangeText={(text) => updateBulkOrderRow(order.id, 'amount', text)}
                              />
                            </View>
                          </View>
                        </View>

                        <View style={styles.termGrid}>
                          {['1', '3', '6', '12'].map((m) => {
                            const selected = order.months === m;
                            const parsedAmt = Number(order.amount) || 0;
                            const monthly = parsedAmt > 0 ? parsedAmt / Number(m) : 0;
                            return (
                              <TouchableOpacity
                                key={m}
                                style={[
                                  styles.termCard,
                                  { backgroundColor: selected ? t.accent : (isDarkMode ? '#0b0f19' : '#f8fafc'), borderColor: selected ? t.accent : t.cardBorder },
                                ]}
                                onPress={() => updateBulkOrderRow(order.id, 'months', m)}
                                activeOpacity={0.86}
                              >
                                <View style={styles.termTitleRow}>
                                  <Text style={[styles.termMonths, { color: selected ? '#ffffff' : t.textPrimary }]}>{m}</Text>
                                  <Text style={[styles.termCaption, { color: selected ? 'rgba(255,255,255,0.78)' : t.textSecondary }]}>{Number(m) === 1 ? 'Month' : 'Months'}</Text>
                                </View>
                                <Text style={[styles.termDue, { color: selected ? '#ffffff' : t.textPrimary }]} numberOfLines={1}>
                                  {monthly > 0 ? formatCurrency(monthly) : '--'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <View style={styles.dateGrid}>
                          <DatePicker
                            label="Purchase Date"
                            value={order.purchaseDate}
                            onChange={(date) => updateBulkOrderRow(order.id, 'purchaseDate', date)}
                          />
                          <DatePicker
                            label="First Due Date"
                            value={order.firstPaymentDate}
                            onChange={(date) => updateBulkOrderRow(order.id, 'firstPaymentDate', date)}
                            placeholder="Auto: 5th next month"
                          />
                        </View>

                        <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.cardBorder }]}>
                          <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>REMARKS / SPECIFICATIONS</Text>
                          <TextInput
                            style={[styles.premiumInput, { color: t.textPrimary, minHeight: 40, textAlignVertical: 'top' }]}
                            placeholder="Write details or remarks..."
                            placeholderTextColor={t.textSecondary}
                            value={order.remarks}
                            onChangeText={(text) => updateBulkOrderRow(order.id, 'remarks', text)}
                          />
                        </View>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={[styles.addOrderBtn, { borderColor: t.accent }]}
                      onPress={addBulkOrderRow}
                      activeOpacity={0.8}
                    >
                      <Plus size={16} color={t.accent} />
                      <Text style={[styles.addOrderBtnText, { color: t.accent }]}>Add Another Order</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Redesigned Shared Credit Pool & Exposure Preview */}
                {(() => {
                  const metrics = getCreditPoolMetrics();
                  return (
                    <View style={[styles.exposureContainer, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                      <View style={[styles.exposureHeader, { borderBottomColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                        <Text style={[styles.exposureTitle, { color: t.textPrimary }]}>Shared Credit Pool Exposure</Text>
                        <View style={[styles.poolBadge, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                          <Text style={[styles.poolBadgeText, { color: t.textSecondary }]}>
                            Limit: {formatCurrency(metrics.creditLimit)}
                          </Text>
                        </View>
                      </View>

                      {/* KPI Grid */}
                      <View style={styles.kpiGrid}>
                        <View style={[styles.kpiCard, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.border }]}>
                          <Text style={styles.kpiLabel}>Current Outstanding</Text>
                          <Text style={[styles.kpiValue, { color: t.textSecondary }]} numberOfLines={1}>
                            {formatCurrency(metrics.currentOutstanding)}
                          </Text>
                          <Text style={styles.kpiSub}>Current Pool</Text>
                        </View>

                        <View style={[styles.kpiCard, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.border }]}>
                          <Text style={[styles.kpiLabel, { color: t.accent }]}>New Exposure</Text>
                          <Text style={[styles.kpiValue, { color: t.textPrimary, fontWeight: 'bold' }]} numberOfLines={1}>
                            {formatCurrency(metrics.projectedOutstanding)}
                          </Text>
                          <Text style={styles.kpiSub}>Projected</Text>
                        </View>

                        <View style={[styles.kpiCard, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.border }]}>
                          <Text style={styles.kpiLabel}>Available Credit</Text>
                          <Text style={[styles.kpiValue, { color: metrics.isOverLimit ? '#ef4444' : '#10b981', fontWeight: 'bold' }]} numberOfLines={1}>
                            {formatCurrency(metrics.availableAfter)}
                          </Text>
                          <Text style={styles.kpiSub}>{metrics.isOverLimit ? 'Over Limit' : 'Remaining'}</Text>
                        </View>
                      </View>

                      {/* Utilization visual bar */}
                      <View style={styles.utilizationRow}>
                        <Text style={[styles.utilizationLabel, { color: t.textSecondary }]}>Pool Limit Utilization</Text>
                        <Text style={[styles.utilizationPercent, { color: metrics.isOverLimit ? '#ef4444' : (metrics.isNearingLimit ? '#f59e0b' : t.textPrimary) }]}>
                          {metrics.currentUtilPercent.toFixed(1)}% → {metrics.projectedUtilPercent.toFixed(1)}%
                        </Text>
                      </View>

                      <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>
                        <View
                          style={[styles.progressCurrent, { width: `${Math.min(100, metrics.currentUtilPercent)}%`, backgroundColor: isDarkMode ? '#475569' : '#94a3b8' }]}
                        />
                        <View
                          style={[
                            styles.progressAdded,
                            {
                              width: `${Math.min(100 - metrics.currentUtilPercent, metrics.addedUtilPercent)}%`,
                              backgroundColor: metrics.isOverLimit ? '#ef4444' : t.accent,
                            }
                          ]}
                        />
                      </View>

                      {/* Alert Banners */}
                      {metrics.isOverLimit && (
                        <View style={[styles.alertCard, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                          <AlertCircle size={16} color="#ef4444" style={{ marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.alertTitleText, { color: isDarkMode ? '#fca5a5' : '#991b1b' }]}>Shared Credit Limit Exceeded</Text>
                            <Text style={[styles.alertDescriptionText, { color: isDarkMode ? '#fecaca' : '#7f1d1d' }]}>
                              This scheduling action will exceed the global shared credit pool limit by {formatCurrency(metrics.overLimitAmount)}.
                            </Text>
                          </View>
                        </View>
                      )}

                      {metrics.isNearingLimit && (
                        <View style={[styles.alertCard, { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                          <AlertTriangle size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.alertTitleText, { color: isDarkMode ? '#fde047' : '#92400e' }]}>High Pool Limit Utilization</Text>
                            <Text style={[styles.alertDescriptionText, { color: isDarkMode ? '#fef08a' : '#78350f' }]}>
                              This scheduling action will consume {metrics.projectedUtilPercent.toFixed(0)}% of the global credit pool capacity.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })()}
              </ScrollView>

              <View style={[styles.sheetActions, { borderTopColor: t.cardBorder }]}>
                <TouchableOpacity style={[styles.secondaryAction, { borderColor: t.cardBorder }]} onPress={() => setIsNewOrderOpen(false)} disabled={actionLoading}>
                  <Text style={[styles.secondaryActionText, { color: t.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryAction, { backgroundColor: t.accent, opacity: actionLoading ? 0.7 : 1 }]} onPress={handleScheduleOrderSubmit} disabled={actionLoading}>
                  <CheckCircle2 size={16} color="#ffffff" />
                  <Text style={styles.primaryActionText}>{actionLoading ? 'Scheduling...' : 'Assign Order'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SwipeDismissModal>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sub-modal to select client for bulk orders */}
      <Modal visible={clientSelectorActiveOrderId !== null} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SwipeDismissModal onDismiss={() => setClientSelectorActiveOrderId(null)}>
            <View style={[styles.premiumSheet, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder, minHeight: 450 }]}>
              <LinearGradient
                colors={isDarkMode ? ['#1f2937', '#111827'] : ['#fff7ed', '#ffffff']}
                style={styles.sheetHero}
              >
                <View style={styles.sheetHeroTop}>
                  <View style={styles.sheetTitleCluster}>
                    <View style={styles.sheetIconBadge}>
                      <Users size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>LEDGER ASSIGNMENT</Text>
                      <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Choose Client</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setClientSelectorActiveOrderId(null)}>
                    <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              <View style={[styles.searchInputShell, { borderColor: t.cardBorder, backgroundColor: isDarkMode ? '#0b1220' : '#ffffff', margin: 16, width: '92%', alignSelf: 'center' }]}>
                <Search size={15} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search name or email"
                  placeholderTextColor={t.textSecondary}
                  value={bulkClientSearchQuery}
                  onChangeText={setBulkClientSearchQuery}
                />
              </View>

              <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
                {clientsList
                  .filter((c: any) => {
                    const q = bulkClientSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return `${c.name} ${c.email}`.toLowerCase().includes(q);
                  })
                  .map((client: any) => {
                    const activeBulkOrder = bulkOrders.find(o => o.id === clientSelectorActiveOrderId);
                    const isSelected = activeBulkOrder?.clientId === client.id;
                    return (
                      <TouchableOpacity
                        key={client.id}
                        style={[
                          styles.clientSelectRow,
                          { borderBottomColor: t.border },
                          isSelected && { backgroundColor: t.accentLight }
                        ]}
                        onPress={() => {
                          if (clientSelectorActiveOrderId) {
                            updateBulkOrderRow(clientSelectorActiveOrderId, 'clientId', client.id);
                          }
                          setClientSelectorActiveOrderId(null);
                          setBulkClientSearchQuery('');
                        }}
                      >
                        <Image
                          source={{ uri: client.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || client.email || '?')}&background=ee4d2d&color=fff&size=100&bold=true` }}
                          style={[styles.clientListAvatar, { borderColor: isSelected ? t.accent : t.border }]}
                          contentFit="cover"
                        />
                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <Text style={[styles.clientListRowName, { color: t.textPrimary, fontWeight: isSelected ? '800' : 'bold' }]}>{client.name}</Text>
                          <Text style={[styles.clientListRowEmail, { color: t.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">{client.email}</Text>
                        </View>
                        {isSelected ? (
                          <CheckCircle2 size={18} color={t.accent} />
                        ) : (
                          <ChevronRight size={16} color={t.textSecondary} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                }
              </ScrollView>
            </View>
          </SwipeDismissModal>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sub-modal to select participants for shared orders */}
      <Modal visible={participantSelectorActiveOrderId !== null} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SwipeDismissModal onDismiss={() => setParticipantSelectorActiveOrderId(null)}>
            <View style={[styles.premiumSheet, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder, minHeight: 480, maxHeight: '88%' }]}>
              <LinearGradient
                colors={isDarkMode ? ['#1f2937', '#111827'] : ['#fff7ed', '#ffffff']}
                style={styles.sheetHero}
              >
                <View style={styles.sheetHeroTop}>
                  <View style={styles.sheetTitleCluster}>
                    <View style={styles.sheetIconBadge}>
                      <Users size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>COLLABORATIVE BILLING</Text>
                      <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Select Participants</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setParticipantSelectorActiveOrderId(null)}>
                    <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Done</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Horizontal Selected Chips Rail */}
              {(() => {
                let currentSelectedIds: string[] = [];
                if (participantSelectorActiveOrderId === 'single') {
                  currentSelectedIds = sharedParticipants;
                } else if (participantSelectorActiveOrderId) {
                  const order = bulkOrders.find(o => o.id === participantSelectorActiveOrderId);
                  if (order) {
                    currentSelectedIds = order.participants || [];
                  }
                }

                if (currentSelectedIds.length === 0) return null;

                return (
                  <View style={{ borderBottomWidth: 1, borderBottomColor: t.border, paddingBottom: 12, paddingHorizontal: 16, paddingTop: 4 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: 'row' }}>
                      {currentSelectedIds.map(id => {
                        const client = clientsList.find((c: any) => c.id === id);
                        if (!client) return null;
                        return (
                          <View
                            key={id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                              borderRadius: 100,
                              paddingLeft: 4,
                              paddingRight: 10,
                              paddingVertical: 4,
                              borderWidth: 1,
                              borderColor: t.accentLight,
                              gap: 6
                            }}
                          >
                            <Image
                              source={{ uri: client.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || client.email || '?')}&background=ee4d2d&color=fff&size=50&bold=true` }}
                              style={{ width: 20, height: 20, borderRadius: 10 }}
                              contentFit="cover"
                            />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: t.textPrimary }}>{client.name}</Text>
                            <TouchableOpacity
                              onPress={() => {
                                if (participantSelectorActiveOrderId === 'single') {
                                  setSharedParticipants(prev => prev.filter(x => x !== id));
                                } else {
                                  const order = bulkOrders.find(o => o.id === participantSelectorActiveOrderId);
                                  if (order) {
                                    const parts = order.participants || [];
                                    updateBulkOrderRow(order.id, { participants: parts.filter(x => x !== id) });
                                  }
                                }
                              }}
                            >
                              <X size={12} color={t.accent} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })()}

              <View style={[styles.searchInputShell, { borderColor: t.cardBorder, backgroundColor: isDarkMode ? '#0b1220' : '#ffffff', margin: 16, width: '92%', alignSelf: 'center', marginBottom: 8 }]}>
                <Search size={15} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search name or email"
                  placeholderTextColor={t.textSecondary}
                  value={bulkClientSearchQuery}
                  onChangeText={setBulkClientSearchQuery}
                />
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                {clientsList
                  .filter((c: any) =>
                    !bulkClientSearchQuery ||
                    c.name.toLowerCase().includes(bulkClientSearchQuery.toLowerCase()) ||
                    c.email.toLowerCase().includes(bulkClientSearchQuery.toLowerCase())
                  )
                  .map((client: any) => {
                    let isSelected = false;
                    let isDisabled = false;

                    if (participantSelectorActiveOrderId === 'single') {
                      isSelected = sharedParticipants.includes(client.id);
                      isDisabled = selectedClientId === client.id;
                    } else if (participantSelectorActiveOrderId) {
                      const order = bulkOrders.find(o => o.id === participantSelectorActiveOrderId);
                      if (order) {
                        isSelected = (order.participants || []).includes(client.id);
                        isDisabled = order.clientId === client.id;
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={client.id}
                        style={[
                          styles.clientSelectRow,
                          { borderBottomColor: t.border },
                          isSelected && { backgroundColor: t.accentLight },
                          isDisabled && { opacity: 0.5 }
                        ]}
                        disabled={isDisabled}
                        onPress={() => {
                          if (participantSelectorActiveOrderId === 'single') {
                            if (isSelected) {
                              setSharedParticipants(prev => prev.filter(id => id !== client.id));
                            } else {
                              setSharedParticipants(prev => [...prev, client.id]);
                            }
                          } else {
                            const order = bulkOrders.find(o => o.id === participantSelectorActiveOrderId);
                            if (order) {
                              const parts = order.participants || [];
                              const newParts = isSelected ? parts.filter(id => id !== client.id) : [...parts, client.id];
                              updateBulkOrderRow(order.id, { participants: newParts });
                            }
                          }
                        }}
                      >
                        <Image
                          source={{ uri: client.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || client.email || '?')}&background=ee4d2d&color=fff&size=100&bold=true` }}
                          style={[styles.clientListAvatar, { borderColor: isSelected ? t.accent : t.border }]}
                          contentFit="cover"
                        />
                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <Text style={[styles.clientListRowName, { color: t.textPrimary, fontWeight: isSelected ? '800' : 'bold' }]}>{client.name}</Text>
                          <Text style={[styles.clientListRowEmail, { color: t.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">{client.email}</Text>
                          {isDisabled && <Text style={{ fontSize: 10, color: t.textSecondary, marginTop: 2 }}>Main client cannot be participant</Text>}
                        </View>
                        {isSelected ? (
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} color="#ffffff" strokeWidth={4} />
                          </View>
                        ) : isDisabled ? (
                          <View style={{ opacity: 0.5 }}>
                            <Users size={16} color={t.textSecondary} />
                          </View>
                        ) : (
                          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: t.textSecondary }} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                }
              </ScrollView>

              {/* Split-Billing Calculator Floating Card */}
              {(() => {
                let currentSelectedIds: string[] = [];
                let totalAmount = 0;
                let installmentMonthsCount = 6;
                if (participantSelectorActiveOrderId === 'single') {
                  currentSelectedIds = sharedParticipants;
                  totalAmount = parseFloat(orderAmount) || 0;
                  installmentMonthsCount = parseInt(installmentMonths, 10) || 6;
                } else if (participantSelectorActiveOrderId) {
                  const order = bulkOrders.find(o => o.id === participantSelectorActiveOrderId);
                  if (order) {
                    currentSelectedIds = order.participants || [];
                    totalAmount = parseFloat(order.amount) || 0;
                    installmentMonthsCount = parseInt(order.months, 10) || 6;
                  }
                }

                const totalParts = 1 + currentSelectedIds.length;
                const splitPrincipal = totalAmount / totalParts;
                const splitMonthly = splitPrincipal / installmentMonthsCount;

                return (
                  <View style={{ marginHorizontal: 16, marginBottom: 20, marginTop: 10, backgroundColor: isDarkMode ? '#1e293b' : '#fff7ed', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#ffedd5', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDarkMode ? 0.3 : 0.08, shadowRadius: 8, elevation: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: t.accent, letterSpacing: 1, marginBottom: 6 }}>SPLIT CALCULATOR</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: t.textPrimary }}>
                          ₱{splitPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                        </Text>
                        <Text style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
                          ₱{splitMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month for {installmentMonthsCount} months
                        </Text>
                      </View>
                      <View style={{ backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.15)' : 'rgba(238, 77, 45, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: t.accent }}>
                          1 Main + {currentSelectedIds.length} Split{currentSelectedIds.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          </SwipeDismissModal>
        </KeyboardAvoidingView>
      </Modal>

      {/* Baseline limit adjust modal */}
      <Modal visible={isGlobalLimitOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SwipeDismissModal onDismiss={() => setIsGlobalLimitOpen(false)} disabled={actionLoading}>
            <View style={[styles.limitSheet, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder }]}>
              <LinearGradient
                colors={isDarkMode ? ['#182235', '#101827'] : ['#fff7ed', '#ffffff']}
                style={styles.limitHero}
              >
                <View style={styles.sheetHeroTop}>
                  <View style={styles.sheetTitleCluster}>
                    <View style={styles.sheetIconBadge}>
                      <Sliders size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>LIMIT CONTROL</Text>
                      <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Adjust Baseline Limits</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsGlobalLimitOpen(false)} disabled={actionLoading}>
                    <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Close</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.limitHeroText, { color: t.textSecondary }]}>
                  Set one platform baseline and allocate it evenly across registered client accounts.
                </Text>
              </LinearGradient>

              <View style={styles.limitBody}>
                <View style={[styles.limitInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                  <View style={styles.limitInputHeader}>
                    <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>GLOBAL BASELINE</Text>
                    <Text style={[styles.formSectionMeta, { color: t.textSecondary }]}>{clientsList.length} clients</Text>
                  </View>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.currencyPrefix}>PHP</Text>
                    <TextInput
                      style={[styles.limitAmountInput, { color: t.textPrimary }]}
                      placeholder="500000"
                      keyboardType="numeric"
                      placeholderTextColor={t.textSecondary}
                      value={globalLimitAmount}
                      onChangeText={setGlobalLimitAmount}
                    />
                  </View>
                </View>

                <View style={styles.quickLimitRow}>
                  {[250000, 500000, 1000000].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[styles.quickLimitChip, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}
                      onPress={() => setGlobalLimitAmount(String(amount))}
                    >
                      <Text style={[styles.quickLimitText, { color: t.textPrimary }]}>{amount >= 1000000 ? '1M' : `${amount / 1000}K`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={[styles.allocationPanel, { backgroundColor: isDarkMode ? '#0b1220' : '#f8fafc', borderColor: t.cardBorder }]}>
                  <View style={styles.allocationRow}>
                    <Text style={[styles.allocationLabel, { color: t.textSecondary }]}>Per client allocation</Text>
                    <Text style={[styles.allocationValue, { color: t.textPrimary }]}>{formatCurrency(allocationPerClient)}</Text>
                  </View>
                  <View style={styles.allocationRow}>
                    <Text style={[styles.allocationLabel, { color: t.textSecondary }]}>Current outstanding</Text>
                    <Text style={[styles.allocationValue, { color: t.textPrimary }]}>{formatCurrency(stats.outstandingBalance)}</Text>
                  </View>
                  <View style={styles.allocationRow}>
                    <Text style={[styles.allocationLabel, { color: t.textSecondary }]}>Current utilization</Text>
                    <Text style={[styles.allocationValue, { color: activeExposurePercent > 80 ? '#ef4444' : '#10b981' }]}>{activeExposurePercent}%</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.sheetActions, { borderTopColor: t.cardBorder }]}>
                <TouchableOpacity style={[styles.secondaryAction, { borderColor: t.cardBorder }]} onPress={() => setIsGlobalLimitOpen(false)} disabled={actionLoading}>
                  <Text style={[styles.secondaryActionText, { color: t.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryAction, { backgroundColor: t.accent, opacity: actionLoading ? 0.7 : 1 }]} onPress={handleGlobalLimitSubmit} disabled={actionLoading}>
                  <CheckCircle2 size={16} color="#ffffff" />
                  <Text style={styles.primaryActionText}>{actionLoading ? 'Allocating...' : 'Set Limit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SwipeDismissModal>
        </KeyboardAvoidingView>
      </Modal>

      <ExitConfirmationModal
        visible={showExitModal}
        onDismiss={() => setShowExitModal(false)}
        onConfirm={handleExit}
      />
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
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 2,
    letterSpacing: -0.3,
  },
  workspaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
  },
  workspaceBtnText: {
    color: '#ee4d2d',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  alertBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  alertIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTextContainer: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: 'bold',
  },
  alertDesc: {
    color: '#94a3b8',
    fontSize: 11,
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
  countdownBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(22, 28, 42, 0.35)',
    borderRadius: 16,
    paddingVertical: 20,
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
  countdownTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  clientNameText: {
    fontSize: 13,
    fontWeight: 'bold',
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
  clientPaymentsList: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
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
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 8,
    marginBottom: 4,
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
  actionsContainer: {
    gap: 10,
  },
  actionRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 12,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
    gap: 2,
  },
  actionTitleText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  actionDescText: {
    fontSize: 10,
    color: '#64748b',
  },
  // Parity additions styles
  tabHeader: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 12,
  },
  tabButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tabButtonActive: {
    // dynamically sets color
  },
  tabButtonText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineItem: {
    position: 'relative',
    borderLeftWidth: 1,
    paddingLeft: 16,
    paddingBottom: 16,
  },
  timelineBullet: {
    position: 'absolute',
    left: -5,
    top: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineContent: {
    gap: 4,
  },
  timelineText: {
    fontSize: 12,
    lineHeight: 16,
  },
  timelineMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineTimeText: {
    fontSize: 9,
    fontWeight: '500',
  },
  timelineAmountText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  trendsContainer: {
    gap: 12,
  },
  categoryRow: {
    gap: 4,
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryValue: {
    fontSize: 10,
  },
  categoryProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  inflowsCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  inflowsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  inflowsList: {
    gap: 10,
  },
  inflowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inflowRowBorder: {
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  inflowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inflowLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inflowValue: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  deadlineHighlightBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  deadlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseIcon: {
    // optional pulse styling
  },
  deadlineLabel: {
    fontSize: 9,
    color: '#ef4444',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  deadlineBody: {
    gap: 2,
  },
  deadlineDate: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  deadlineAmount: {
    fontSize: 10,
    color: '#94a3b8',
  },
  rankingsCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  rankingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankingsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    padding: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
  },
  toggleBtnActive: {
    backgroundColor: '#ee4d2d',
  },
  rankingsBody: {
    gap: 10,
    minHeight: 140,
    justifyContent: 'center',
  },
  rankingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rankingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankingIndex: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    width: 20,
  },
  rankingName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  rankingSubtitle: {
    fontSize: 9,
    marginTop: 1,
  },
  rankingAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  delinquentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  delinquentBadgeText: {
    fontSize: 9,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  rankingDate: {
    fontSize: 10,
    fontWeight: '600',
  },
  logsContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11,
    paddingVertical: 12,
  },
  headerWeatherTime: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 10,
  },
  headerWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerWeatherText: {
    fontSize: 9,
    fontWeight: '700',
  },
  headerTimeText: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.2,
  },
  headerDateText: {
    fontSize: 9,
    fontWeight: '600',
  },
  // Modal layout styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    maxHeight: '90%',
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  formContainer: {
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 4,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 13,
  },
  selectBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 8,
  },
  selectItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  selectItemText: {
    fontSize: 12,
  },
  monthsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthSelector: {
    width: '22%',
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthSelectorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    height: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  confirmBtn: {
    height: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  confirmBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: 'bold',
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
  premiumSheet: {
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
  limitSheet: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  sheetHero: {
    padding: 18,
    gap: 16,
  },
  limitHero: {
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
    fontFamily: 'Outfit-Bold',
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
  sheetMetricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetMetric: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  sheetMetricLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetMetricValue: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    marginTop: 4,
  },
  premiumFormContainer: {
    padding: 18,
    gap: 14,
  },
  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  formSectionMeta: {
    fontSize: 10,
    fontWeight: '700',
  },
  searchInputShell: {
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 0,
  },
  clientRail: {
    gap: 10,
    paddingRight: 18,
  },
  clientChoiceCard: {
    width: 164,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  clientChoiceCardActive: {
    shadowColor: '#ee4d2d',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  clientAvatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  clientAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
  },
  avatarCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2.5,
    elevation: 4,
  },
  clientAvatarText: {
    fontSize: 14,
    fontWeight: '900',
  },
  clientChoiceName: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  clientChoiceEmail: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  clientSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderRadius: 12,
    marginVertical: 2,
  },
  clientListAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  clientListRowName: {
    fontSize: 14,
  },
  clientListRowEmail: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  exposureContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  exposureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  exposureTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: -0.1,
  },
  poolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  poolBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  kpiSub: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  utilizationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  utilizationLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  utilizationPercent: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressCurrent: {
    height: '100%',
  },
  progressAdded: {
    height: '100%',
  },
  alertCard: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  alertTitleText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  alertDescriptionText: {
    fontSize: 10,
    lineHeight: 14,
  },
  selectedClientStrip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedClientText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  inputGrid: {
    gap: 10,
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
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefix: {
    borderRadius: 9,
    backgroundColor: 'rgba(238,77,45,0.1)',
    color: '#ee4d2d',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  amountInput: {
    flex: 1,
  },
  termGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  termCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },
  termTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    flexWrap: 'nowrap',
  },
  termMonths: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    lineHeight: 22,
  },
  termCaption: {
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 11,
  },
  termDue: {
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 12,
  },
  dateGrid: {
    gap: 10,
  },
  dateCard: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateInput: {
    minHeight: 30,
    fontSize: 14,
    fontWeight: '800',
    paddingVertical: 0,
  },
  exposurePreview: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 9,
  },
  exposurePreviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  previewPercent: {
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
  previewTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  previewFill: {
    height: '100%',
    borderRadius: 999,
  },
  previewCaption: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
  secondaryAction: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '900',
  },
  primaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  limitHeroText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  limitBody: {
    padding: 18,
    gap: 14,
  },
  limitInputCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  limitInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  limitAmountInput: {
    flex: 1,
    minHeight: 38,
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    paddingVertical: 0,
  },
  quickLimitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickLimitChip: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLimitText: {
    fontSize: 13,
    fontWeight: '900',
  },
  allocationPanel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  allocationLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  allocationValue: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
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
  carouselNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carouselBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  switchTrack: {
    width: 46,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#ee4d2d',
  },
  switchTrackInactive: {
    backgroundColor: '#cbd5e1',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchThumbInactive: {
    alignSelf: 'flex-start',
  },
  bulkCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  bulkCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: 8,
    marginBottom: 4,
  },
  bulkOrderNumber: {
    fontSize: 13,
    fontWeight: '900',
  },
  removeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  inlineClientSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  selectedClientName: {
    fontSize: 14,
    fontWeight: '700',
  },
  addOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 6,
    marginBottom: 10,
  },
  addOrderBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 4,
  },
  chartHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitleContainer: {
    flex: 1,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  chartSubtitle: {
    fontSize: 9,
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 4,
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
    fontSize: 8,
    fontWeight: '600',
  },
  chartSvgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  detailBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginTop: 6,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailTitle: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  detailGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
  },
});
