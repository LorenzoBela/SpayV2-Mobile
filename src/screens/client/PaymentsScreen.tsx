import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  TextInput,
  Modal,
  Dimensions,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreditCard,
  Calendar as CalendarIcon,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Info,
  Banknote,
  UserCheck,
  Search,
  LayoutGrid,
  List as ListIcon,
  Flame,
  ArrowRight,
  Sparkles,
  Clock,
  ChevronDown,
  X,
  Bell,
  Sun,
  Moon,
  CloudUpload,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, ThemeContext } from '../../navigation/navigationTypes';
import { supabase } from '../../utils/supabase';
import { PaymentsSkeleton } from '../../components/SkeletonLoader';
import SwipeDismissModal from '../../components/SwipeDismissModal';

const { width } = Dimensions.get('window');

// --- DATABASE INTERFACES ---
interface PaymentReschedule {
  id: string;
  old_due_date: string;
  new_due_date: string;
  reason: string | null;
  admin_approved: boolean;
  created_at: string;
}

interface PaymentItem {
  id: string;
  orderId: string;
  itemName: string;
  installmentMonths: number;
  monthNumber: number;
  amountDue: number;
  dueDate: string;
  rawDueDate: string;
  isPaid: boolean;
  paymentDate: string | null;
  proofOfPayment: string | null;
  status: 'paid' | 'overdue' | 'pending';
  rescheduleHistory: PaymentReschedule[];
}

interface MonthlyGroup {
  monthKey: string;
  monthName: string;
  totalPayments: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  collectionRate: number;
  earliestDueDate: string;
  latestDueDate: string;
  monthStatus: 'paid' | 'overdue' | 'current' | 'upcoming';
  payments: PaymentItem[];
}

interface ForecastMonth {
  monthKey: string;
  monthName: string;
  projectedPayments: number;
  unpaidProjectedAmount: number;
  confidence: number;
}

// --- BILLING TIMELINE & COUNTDOWN CALCULATIONS ---
function getBillingMonthKey(dueDate: Date): string {
  const d = new Date(dueDate);
  if (d.getDate() >= 5) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const prev = new Date(d);
  prev.setMonth(prev.getMonth() - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function getCalendarMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatBillingMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getNextCalendarMonthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function findNextUnpaidBillingMonth(payments: PaymentItem[], fromDate: Date) {
  const fromMonthKey = getCalendarMonthKey(fromDate);
  const unpaidPaymentsByMonth = new Map<string, PaymentItem[]>();

  payments.forEach(p => {
    if (p.isPaid) return;
    const monthKey = getBillingMonthKey(new Date(p.rawDueDate));
    if (monthKey < fromMonthKey) return;

    const list = unpaidPaymentsByMonth.get(monthKey) || [];
    list.push(p);
    unpaidPaymentsByMonth.set(monthKey, list);
  });

  const nextMonthKey = Array.from(unpaidPaymentsByMonth.keys()).sort()[0];
  if (!nextMonthKey) return null;

  const monthPayments = unpaidPaymentsByMonth.get(nextMonthKey)!.sort(
    (a, b) => new Date(a.rawDueDate).getTime() - new Date(b.rawDueDate).getTime()
  );

  const earliestDueDate = new Date(monthPayments[0].rawDueDate);
  const totalDue = monthPayments.reduce((sum, p) => sum + p.amountDue, 0);

  return {
    monthKey: nextMonthKey,
    dueDate: earliestDueDate.toISOString(),
    totalAmount: totalDue,
    paymentCount: monthPayments.length,
    payments: monthPayments.map(p => ({
      id: p.id,
      itemName: p.itemName,
      amount: p.amountDue,
      dueDate: p.rawDueDate,
      orderId: p.orderId,
    })),
  };
}

// Flip Card Subcomponent — matches the web's CSS animation approach
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

  const { isDarkMode } = React.useContext(ThemeContext);

  const [current, setCurrent] = useState(newValue);
  const [previous, setPrevious] = useState(newValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [topRevealed, setTopRevealed] = useState(false);

  const topFlipProgress = useRef(new Animated.Value(1)).current;
  const bottomFlipProgress = useRef(new Animated.Value(1)).current;
  const lastValueRef = useRef(newValue);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const cardBgTop = isDarkMode ? '#1e293b' : '#e2e8f0';
  const cardBgBottom = isDarkMode ? '#161c2a' : '#cbd5e1';
  const textColorTop = isDarkMode ? '#f8fafc' : '#0f172a';
  const textColorBottom = isDarkMode ? '#cbd5e1' : '#334155';
  const cardBorderColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const labelColor = isDarkMode ? '#64748b' : '#475569';

  // Rotations mirror the web card's separate top and bottom phases.
  const rotateTop = topFlipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg'],
  });

  const rotateBottom = bottomFlipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });

  // Keep each flap visible through its own phase to avoid midpoint flicker.
  const opacityTop = topFlipProgress.interpolate({
    inputRange: [0, 0.98, 1],
    outputRange: [1, 1, 0],
  });

  const opacityBottom = bottomFlipProgress.interpolate({
    inputRange: [0, 0.02, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <View style={styles.flipCardCol}>
      <View style={styles.flipCard}>
        <View style={[styles.flipCardOuter, { backgroundColor: cardBgTop, borderColor: cardBorderColor }]}>
          {/* 1. Top Static - reveal the new value only after the top flap folds away */}
          <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
            <Text style={[styles.topText, { color: textColorTop }]}>{topStaticValue}</Text>
          </View>

          {/* 2. Bottom Static - web keeps the old bottom half until the flip ends */}
          <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
            <Text style={[styles.bottomText, { color: textColorBottom }]}>{bottomStaticValue}</Text>
          </View>

          {/* 3. Animated Top Flap (old value flipping away) */}
          {activeFlip && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 26,
                  opacity: opacityTop,
                  transform: [
                    { perspective: 400 },
                    { translateY: 13 },
                    { rotateX: rotateTop },
                    { translateY: -13 },
                  ],
                  zIndex: 3,
                  backfaceVisibility: 'hidden',
                } as any
              ]}
            >
              <View style={[styles.topHalfContainer, { backgroundColor: cardBgTop }]}>
                <Text style={[styles.topText, { color: textColorTop }]}>{previous}</Text>
              </View>
            </Animated.View>
          )}

          {/* 4. Animated Bottom Flap (new value flipping into place) */}
          {activeFlip && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 26,
                  left: 0,
                  right: 0,
                  height: 26,
                  opacity: opacityBottom,
                  transform: [
                    { perspective: 400 },
                    { translateY: -13 },
                    { rotateX: rotateBottom },
                    { translateY: 13 },
                  ],
                  zIndex: 2,
                  backfaceVisibility: 'hidden',
                } as any
              ]}
            >
              <View style={[styles.bottomHalfContainer, { backgroundColor: cardBgBottom }]}>
                <Text style={[styles.bottomText, { color: textColorBottom }]}>{current}</Text>
              </View>
            </Animated.View>
          )}

          {/* Horizontal Split Line */}
          <View style={styles.flipCardDivider} />
        </View>
      </View>
      <Text style={[styles.flipCardLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
});

export default function PaymentsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);

  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  
  // Analytics
  const [analytics, setAnalytics] = useState({
    totalPayments: 0,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    totalDebt: 0,
    healthScore: 100,
    currentStreak: 0,
    maxStreak: 0,
    onTimeRate: 100,
    budgetSuggestion: 0,
  });

  // Tab & Filter UI state
  const [activeTab, setActiveTab] = useState<'dues' | 'timeline'>('dues');
  const [duesSearch, setDuesSearch] = useState('');
  const [duesFilter, setDuesFilter] = useState<'all' | 'paid' | 'pending' | 'upcoming' | 'overdue'>('pending');
  const [duesSort, setDuesSort] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [currentPage, setCurrentPage] = useState(1);
  const paymentsPerPage = 5;

  // Monthly Breakdown group data
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthlyGroup[]>([]);
  const [cashFlowForecast, setCashFlowForecast] = useState<ForecastMonth[]>([]);
  const [nextPaymentCountdown, setNextPaymentCountdown] = useState<any>(null);

  // Countdown timer clock
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: false });

  // Modal controls
  const [selectedPayDetails, setSelectedPayDetails] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);



  const [selectedMonthGroup, setSelectedMonthGroup] = useState<MonthlyGroup | null>(null);
  const [isMonthDetailModalOpen, setIsMonthDetailModalOpen] = useState(false);

  // Fetch Payments from Supabase
  const fetchPayments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch user orders first to filter payments
      const { data: userOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', user.id);

      if (ordersErr) throw ordersErr;

      if (!userOrders || userOrders.length === 0) {
        setPayments([]);
        calculateAdvancedAnalytics([]);
        return;
      }

      const orderIds = userOrders.map(o => o.id);

      // 2. Fetch payments belonging only to those orders
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          due_date,
          amount_due,
          month_number,
          is_paid,
          payment_date,
          proof_of_payment,
          order:orders (
            id,
            item_name,
            installment_months
          ),
          payment_reschedule_history (
            id,
            old_due_date,
            new_due_date,
            reason,
            admin_approved,
            created_at
          )
        `)
        .in('order_id', orderIds)
        .order('due_date', { ascending: true });

      if (error) throw error;

      if (data) {
        const nowMs = Date.now();

        const formatted: PaymentItem[] = data.map((p: any) => {
          const rescheduleArr: PaymentReschedule[] = (p.payment_reschedule_history || []).map((r: any) => ({
            id: r.id,
            old_due_date: r.old_due_date,
            new_due_date: r.new_due_date,
            reason: r.reason,
            admin_approved: r.admin_approved,
            created_at: r.created_at,
          }));

          const rawDueDate = p.due_date;
          const isPaid = p.is_paid;
          const isOverdue = !isPaid && new Date(rawDueDate).getTime() < nowMs;

          return {
            id: p.id,
            orderId: p.order?.id || '',
            itemName: p.order?.item_name || 'Installment Order',
            amountDue: parseFloat(p.amount_due),
            monthNumber: p.month_number,
            installmentMonths: p.order?.installment_months || 12,
            dueDate: new Date(rawDueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            rawDueDate,
            isPaid,
            paymentDate: p.payment_date,
            proofOfPayment: p.proof_of_payment,
            status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
            rescheduleHistory: rescheduleArr,
          };
        });

        setPayments(formatted);
        calculateAdvancedAnalytics(formatted);
      }
    } catch (error) {
      console.warn('Error fetching payments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAdvancedAnalytics = (allPayments: PaymentItem[]) => {
    const nowMs = Date.now();

    const totalPayments = allPayments.length;
    const paidPayments = allPayments.filter(p => p.isPaid);
    const paidCount = paidPayments.length;

    const unpaidPayments = allPayments.filter(p => !p.isPaid);
    const pendingPayments = unpaidPayments.filter(p => new Date(p.rawDueDate).getTime() >= nowMs);
    const pendingCount = pendingPayments.length;

    const overduePayments = unpaidPayments.filter(p => new Date(p.rawDueDate).getTime() < nowMs);
    const overdueCount = overduePayments.length;

    const paidAmount = paidPayments.reduce((sum, p) => sum + p.amountDue, 0);
    const pendingAmount = unpaidPayments.reduce((sum, p) => sum + p.amountDue, 0);
    const totalDebt = pendingAmount;

    // Streaks
    const onTimePayments = paidPayments.filter(
      p => p.paymentDate && new Date(p.paymentDate).getTime() <= new Date(p.rawDueDate).getTime()
    );
    const onTimeRate = paidCount > 0 ? Math.round((onTimePayments.length / paidCount) * 100) : 100;

    const completedPaymentsSorted = [...paidPayments].sort((a, b) => {
      const dateA = a.paymentDate ? new Date(a.paymentDate).getTime() : new Date(a.rawDueDate).getTime();
      const dateB = b.paymentDate ? new Date(b.paymentDate).getTime() : new Date(b.rawDueDate).getTime();
      return dateB - dateA;
    });

    let currentStreak = 0;
    for (const p of completedPaymentsSorted) {
      if (p.paymentDate && new Date(p.paymentDate).getTime() <= new Date(p.rawDueDate).getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }

    let maxStreak = 0;
    let tempStreak = 0;
    const completedPaymentsChronological = [...completedPaymentsSorted].reverse();
    for (const p of completedPaymentsChronological) {
      if (p.paymentDate && new Date(p.paymentDate).getTime() <= new Date(p.rawDueDate).getTime()) {
        tempStreak++;
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }
    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
    }

    // Health Score
    let totalDaysLate = 0;
    const latePaymentsCount = paidCount - onTimePayments.length;
    paidPayments.forEach(p => {
      if (p.paymentDate && new Date(p.paymentDate).getTime() > new Date(p.rawDueDate).getTime()) {
        const days = Math.ceil((new Date(p.paymentDate).getTime() - new Date(p.rawDueDate).getTime()) / (1000 * 60 * 60 * 24));
        totalDaysLate += Math.max(0, days);
      }
    });
    const avgDaysLate = latePaymentsCount > 0 ? totalDaysLate / latePaymentsCount : 0;
    const healthScore = Math.min(100, Math.max(0, Math.round(onTimeRate - (avgDaysLate * 2))));

    // Budget suggestion
    const unpaidMonthsList = Array.from(new Set(unpaidPayments.map(p => getBillingMonthKey(new Date(p.rawDueDate)))));
    const unpaidInstallmentMonths = Math.max(1, unpaidMonthsList.length);
    const budgetSuggestion = totalDebt > 0 ? Math.ceil(totalDebt / unpaidInstallmentMonths) : 0;

    setAnalytics({
      totalPayments,
      paidCount,
      pendingCount,
      overdueCount,
      paidAmount,
      pendingAmount,
      totalDebt,
      healthScore,
      currentStreak,
      maxStreak,
      onTimeRate,
      budgetSuggestion,
    });

    // 5th-of-Month Due Date Grouping
    const breakdownGroupsMap = new Map<string, PaymentItem[]>();
    allPayments.forEach(p => {
      const key = getBillingMonthKey(new Date(p.rawDueDate));
      const list = breakdownGroupsMap.get(key) || [];
      list.push(p);
      breakdownGroupsMap.set(key, list);
    });

    const unpaidMonthsSorted = Array.from(breakdownGroupsMap.entries())
      .filter((entry) => entry[1].some(p => !p.isPaid))
      .map(([key]) => key)
      .sort();
    const oldestUnpaidMonthKey = unpaidMonthsSorted.length > 0 ? unpaidMonthsSorted[0] : null;

    const sortedMonthKeys = Array.from(breakdownGroupsMap.keys()).sort();

    const monthlyGroupsData: MonthlyGroup[] = sortedMonthKeys.map(key => {
      const groupPayments = breakdownGroupsMap.get(key)!;
      const monthTotalAmount = groupPayments.reduce((sum, p) => sum + p.amountDue, 0);
      const monthPaidAmount = groupPayments.filter(p => p.isPaid).reduce((sum, p) => sum + p.amountDue, 0);
      const monthPendingAmount = groupPayments.filter(p => !p.isPaid).reduce((sum, p) => sum + p.amountDue, 0);

      const monthTotalPayments = groupPayments.length;
      const monthPaidCount = groupPayments.filter(p => p.isPaid).length;
      const monthPendingCount = groupPayments.filter(p => !p.isPaid && new Date(p.rawDueDate).getTime() >= nowMs).length;
      const monthOverdueCount = groupPayments.filter(p => !p.isPaid && new Date(p.rawDueDate).getTime() < nowMs).length;

      const earliestDue = new Date(Math.min(...groupPayments.map(p => new Date(p.rawDueDate).getTime())));
      const latestDue = new Date(Math.max(...groupPayments.map(p => new Date(p.rawDueDate).getTime())));

      const collectionRate = monthTotalAmount > 0 ? (monthPaidAmount / monthTotalAmount) * 100 : 100;

      let monthStatus: 'paid' | 'overdue' | 'current' | 'upcoming' = 'upcoming';
      if (monthPaidCount === monthTotalPayments) {
        monthStatus = 'paid';
      } else if (monthOverdueCount > 0) {
        monthStatus = 'overdue';
      } else if (key === oldestUnpaidMonthKey) {
        monthStatus = 'current';
      }

      return {
        monthKey: key,
        monthName: formatBillingMonthKey(key),
        totalPayments: monthTotalPayments,
        totalAmount: monthTotalAmount,
        paidAmount: monthPaidAmount,
        pendingAmount: monthPendingAmount,
        paidCount: monthPaidCount,
        pendingCount: monthPendingCount + monthOverdueCount,
        overdueCount: monthOverdueCount,
        collectionRate,
        earliestDueDate: earliestDue.toISOString(),
        latestDueDate: latestDue.toISOString(),
        monthStatus,
        payments: groupPayments,
      };
    });

    setMonthlyBreakdown(monthlyGroupsData);

    // Countdown Clock Calculation
    const nextUnpaid = findNextUnpaidBillingMonth(allPayments, getNextCalendarMonthStart(new Date(nowMs)));
    setNextPaymentCountdown(nextUnpaid);

    // Projections forecast for next 6 months
    const cashFlowForecastData: ForecastMonth[] = [];
    const currentMonthDate = new Date();
    for (let i = 0; i < 6; i++) {
      const futureDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + i, 1);
      const key = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;
      const paymentsForMonth = breakdownGroupsMap.get(key) || [];
      const projectedAmount = paymentsForMonth.reduce((sum, p) => sum + p.amountDue, 0);
      const unpaidProjectedAmount = paymentsForMonth.filter(p => !p.isPaid).reduce((sum, p) => sum + p.amountDue, 0);

      cashFlowForecastData.push({
        monthKey: key,
        monthName: futureDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        projectedPayments: projectedAmount,
        unpaidProjectedAmount,
        confidence: onTimeRate,
      });
    }
    setCashFlowForecast(cashFlowForecastData);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  // Clock Countdown logic
  useEffect(() => {
    if (!nextPaymentCountdown || !nextPaymentCountdown.dueDate) return;

    const targetDate = new Date(nextPaymentCountdown.dueDate);
    const calculateTime = () => {
      const difference = targetDate.getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: true });
      } else {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
          isOverdue: false,
        });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [nextPaymentCountdown]);

  // Reset pagination on filter or search
  useEffect(() => {
    setCurrentPage(1);
  }, [duesSearch, duesFilter, duesSort]);

  // Bulk Payment toggle
  const handleToggleSelect = (paymentId: string) => {
    setSelectedPaymentIds(prev =>
      prev.includes(paymentId) ? prev.filter(id => id !== paymentId) : [...prev, paymentId]
    );
  };

  const handleOpenBulkPayModal = () => {
    const selected = payments
      .filter(p => selectedPaymentIds.includes(p.id))
      .map(p => ({ id: p.id, name: `${p.itemName} (Month ${p.monthNumber})`, amount: p.amountDue }));
    setSelectedPayDetails(selected);
    setIsPaymentModalOpen(true);
  };

  const handleOpenSinglePayModal = (pay: { id: string; itemName: string; monthNumber?: number; amountDue: number }) => {
    const suffix = pay.monthNumber ? ` (Month ${pay.monthNumber})` : '';
    setSelectedPayDetails([{ id: pay.id, name: `${pay.itemName}${suffix}`, amount: pay.amountDue }]);
    setIsPaymentModalOpen(true);
  };



  // Dynamic colors
  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d',
    divider: isDarkMode ? '#222d42' : '#e2e8f0',
    tabActiveBg: isDarkMode ? '#1e293b' : '#ffffff',
    tabInactiveBg: isDarkMode ? 'rgba(30, 41, 59, 0.2)' : 'rgba(226, 232, 240, 0.5)',
    modalOverlay: isDarkMode ? 'rgba(11, 15, 25, 0.9)' : 'rgba(15, 23, 42, 0.7)',
    successText: '#10b981',
    warningBg: isDarkMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)',
    warningBorder: 'rgba(245, 158, 11, 0.3)',
    infoBg: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)',
    infoBorder: 'rgba(59, 130, 246, 0.3)',
    overdueBg: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
    overdueBorder: 'rgba(239, 68, 68, 0.3)'
  };

  const formatCurrency = (val: number) => {
    return '₱' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Filter dues list
  const nowMs = Date.now();
  const filteredPayments = payments.filter(pay => {
    const matchesSearch =
      pay.itemName.toLowerCase().includes(duesSearch.toLowerCase()) ||
      pay.id.toLowerCase().includes(duesSearch.toLowerCase()) ||
      pay.orderId.toLowerCase().includes(duesSearch.toLowerCase());
    if (!matchesSearch) return false;

    if (duesFilter === 'paid') return pay.isPaid;
    if (duesFilter === 'pending') return !pay.isPaid;
    if (duesFilter === 'upcoming') return !pay.isPaid && new Date(pay.rawDueDate).getTime() >= nowMs;
    if (duesFilter === 'overdue') return !pay.isPaid && new Date(pay.rawDueDate).getTime() < nowMs;

    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.rawDueDate).getTime();
    const timeB = new Date(b.rawDueDate).getTime();
    return duesSort === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const totalPages = Math.ceil(filteredPayments.length / paymentsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * paymentsPerPage,
    currentPage * paymentsPerPage
  );

  const selectedPaymentsTotal = payments
    .filter(p => selectedPaymentIds.includes(p.id))
    .reduce((sum, p) => sum + p.amountDue, 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Header bar matches dashboard */}
      <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
        <View style={styles.webHeaderLeft}>
          <Text style={styles.webHeaderSubtitle}>S-Pay Ledger</Text>
          <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Timeline & Payments</Text>
          <Text style={[styles.webHeaderDesc, { color: t.textSecondary }]}>
            Track custom monthly due cycles, evaluate financial wellness trends, and plan installments.
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.backButtonFrame, { backgroundColor: t.tabInactiveBg }]}
        >
          {isDarkMode ? (
            <Sun size={18} color="#fbbf24" />
          ) : (
            <Moon size={18} color="#475569" />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <PaymentsSkeleton />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ee4d2d" />
          }
        >
          {/* Billing Countdown Card */}
          {nextPaymentCountdown && (
            <View style={[styles.countdownCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={[styles.countdownCardHeader, { borderColor: t.divider }]}>
                <View style={styles.countdownTitleRow}>
                  <View style={[styles.calendarIconBg, { backgroundColor: 'rgba(238, 77, 45, 0.1)' }]}>
                    <CalendarIcon size={16} color={t.accent} />
                  </View>
                  <View>
                    <Text style={[styles.countdownSubtitle, { color: t.textSecondary }]}>
                      NEXT BILLING CYCLE OVERVIEW
                    </Text>
                    <Text style={[styles.countdownTitleText, { color: t.textPrimary }]}>
                      Due {new Date(nextPaymentCountdown.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.countdownClockSection, { backgroundColor: isDarkMode ? '#111827' : '#f8fafc', borderColor: t.divider }]}>
                {/* 3D Skeuomorphic Flip Countdown */}
                <View style={styles.countdownRow}>
                  <FlipCard value={timeLeft.days} label="Days" />
                  <Text style={[styles.countdownColon, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={timeLeft.hours} label="Hours" />
                  <Text style={[styles.countdownColon, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={timeLeft.minutes} label="Mins" />
                  <Text style={[styles.countdownColon, { color: t.textSecondary }]}>:</Text>
                  <FlipCard value={timeLeft.seconds} label="Secs" />
                </View>

                <View style={styles.countdownBottomAmountCol}>
                  <Text style={[styles.billLabel, { color: t.textSecondary }]}>Your Amount Due</Text>
                  <Text style={[styles.billValue, { color: t.textPrimary }]}>{formatCurrency(nextPaymentCountdown.totalAmount)}</Text>
                  
                  <TouchableOpacity
                    onPress={() => handleOpenSinglePayModal({
                      id: 'next-cycle',
                      itemName: 'Combined Month Amortizations',
                      amountDue: nextPaymentCountdown.totalAmount
                    })}
                    style={styles.payNowBtnCountdown}
                  >
                    <Text style={styles.payNowBtnCountdownText}>Pay Now</Text>
                    <ArrowRight size={12} color="#ffffff" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.breakdownBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.divider }]}>
                <Text style={[styles.breakdownTitle, { color: t.textSecondary }]}>COMBINED BILL BREAKDOWN</Text>
                {nextPaymentCountdown.payments.map((p: any, idx: number) => (
                  <View key={p.id || idx} style={styles.breakdownRow}>
                    <Text style={[styles.breakdownItemName, { color: t.textPrimary }]} numberOfLines={1}>
                      {p.itemName}
                    </Text>
                    <View style={styles.breakdownItemRight}>
                      <Text style={[styles.breakdownItemDate, { color: t.textSecondary }]}>
                        Due {new Date(p.dueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </Text>
                      <Text style={[styles.breakdownItemAmount, { color: t.textPrimary }]}>
                        {formatCurrency(p.amount)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Analytics stats */}
          <View style={styles.analyticsGrid}>
            <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>Total Dues</Text>
                <CalendarIcon size={14} color={t.textSecondary} />
              </View>
              <Text style={[styles.statValue, { color: t.textPrimary }]}>{analytics.totalPayments}</Text>
              <Text style={[styles.statSubText, { color: t.textSecondary }]}>Installments logged</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>Paid / Left</Text>
                <CheckCircle2 size={14} color={t.successText} />
              </View>
              <Text style={[styles.statValue, { color: t.textPrimary }]}>
                {analytics.paidCount} <Text style={{ fontSize: 12, color: t.textSecondary }}>/ {analytics.pendingCount + analytics.overdueCount}</Text>
              </Text>
              <Text style={[styles.statSubText, { color: t.successText, fontWeight: '700' }]}>
                {formatCurrency(analytics.paidAmount)} Paid
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>Streak</Text>
                <Flame size={14} color={t.accent} />
              </View>
              <Text style={[styles.statValue, { color: t.textPrimary }]}>
                {analytics.currentStreak} <Text style={{ fontSize: 10, color: t.textSecondary }}>max {analytics.maxStreak}</Text>
              </Text>
              <Text style={[styles.statSubText, { color: t.textSecondary }]}>Consecutive on-time</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>Overdue</Text>
                <AlertTriangle size={14} color={analytics.overdueCount > 0 ? '#ef4444' : t.textSecondary} />
              </View>
              <Text style={[styles.statValue, { color: analytics.overdueCount > 0 ? '#ef4444' : t.textPrimary }]}>
                {analytics.overdueCount}
              </Text>
              <Text style={[styles.statSubText, { color: t.textSecondary }]}>Past due deadlines</Text>
            </View>
          </View>

          {/* Premium Glassmorphic Tab switcher */}
          <View style={styles.tabToggleRow}>
            <TouchableOpacity
              onPress={() => setActiveTab('dues')}
              style={[styles.tabToggleBtn, activeTab === 'dues' && { backgroundColor: t.tabActiveBg, borderColor: t.cardBorder }]}
            >
              <CreditCard size={14} color={activeTab === 'dues' ? t.textPrimary : t.textSecondary} />
              <Text style={[styles.tabToggleText, { color: activeTab === 'dues' ? t.textPrimary : t.textSecondary }]}>
                Active Dues
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('timeline')}
              style={[styles.tabToggleBtn, activeTab === 'timeline' && { backgroundColor: t.tabActiveBg, borderColor: t.cardBorder }]}
            >
              <CalendarIcon size={14} color={activeTab === 'timeline' ? t.textPrimary : t.textSecondary} />
              <Text style={[styles.tabToggleText, { color: activeTab === 'timeline' ? t.textPrimary : t.textSecondary }]}>
                Monthly Cycles
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'dues' ? (
            <View style={{ gap: 12 }}>
              {/* Controls bar: Search & Filters */}
              <View style={styles.controlsBar}>
                <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                  <Search size={16} color={t.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    value={duesSearch}
                    onChangeText={setDuesSearch}
                    placeholder="Search payments..."
                    placeholderTextColor={t.textSecondary}
                    style={[styles.searchInput, { color: t.textPrimary }]}
                  />
                  {duesSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setDuesSearch('')}>
                      <X size={16} color={t.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filters horizontal scroll */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsScroll}>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'pending', label: 'Unpaid' },
                    { id: 'upcoming', label: 'Upcoming' },
                    { id: 'overdue', label: 'Overdue' },
                    { id: 'paid', label: 'Settled' },
                  ].map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setDuesFilter(item.id as any)}
                      style={[
                        styles.filterPill,
                        { backgroundColor: duesFilter === item.id ? t.tabActiveBg : t.divider },
                      ]}
                    >
                      <Text style={[styles.filterPillText, { color: duesFilter === item.id ? t.textPrimary : t.textSecondary }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Grid Mode & Sort */}
                <View style={styles.sortToggleRow}>
                  <TouchableOpacity
                    onPress={() => setDuesSort(prev => prev === 'asc' ? 'desc' : 'asc')}
                    style={[styles.sortBtn, { backgroundColor: t.divider }]}
                  >
                    <TrendingUp size={12} color={t.textSecondary} style={{ transform: [{ rotate: duesSort === 'desc' ? '180deg' : '0deg' }] }} />
                    <Text style={[styles.sortBtnText, { color: t.textSecondary }]}>
                      Due Date: {duesSort === 'asc' ? 'Soonest' : 'Latest'}
                    </Text>
                  </TouchableOpacity>

                  <View style={[styles.viewToggleContainer, { backgroundColor: t.divider }]}>
                    <TouchableOpacity
                      onPress={() => setViewMode('card')}
                      style={[styles.viewToggleButton, viewMode === 'card' && { backgroundColor: t.tabActiveBg }]}
                    >
                      <LayoutGrid size={16} color={viewMode === 'card' ? t.textPrimary : t.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setViewMode('list')}
                      style={[styles.viewToggleButton, viewMode === 'list' && { backgroundColor: t.tabActiveBg }]}
                    >
                      <ListIcon size={16} color={viewMode === 'list' ? t.textPrimary : t.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Payments List */}
              <View style={styles.listContainer}>
                {paginatedPayments.length > 0 ? (
                  paginatedPayments.map(item => {
                    const isSelected = selectedPaymentIds.includes(item.id);
                    const isExpanded = false; // Expanded detailed schedules can open a modal or inline reschedule
                    const reschedulePending = item.rescheduleHistory.some(r => !r.admin_approved);

                    let statusLabel = 'Unpaid';
                    let labelColor = t.textSecondary;
                    let badgeBg = t.divider;

                    if (item.isPaid) {
                      statusLabel = 'Paid';
                      labelColor = t.successText;
                      badgeBg = 'rgba(16, 185, 129, 0.1)';
                    } else if (item.status === 'overdue') {
                      statusLabel = 'Overdue';
                      labelColor = '#ef4444';
                      badgeBg = 'rgba(239, 68, 68, 0.1)';
                    } else if (reschedulePending) {
                      statusLabel = 'Rescheduling';
                      labelColor = '#f59e0b';
                      badgeBg = 'rgba(245, 158, 11, 0.1)';
                    }

                    if (viewMode === 'card') {
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.paymentCard,
                            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                            reschedulePending && { borderColor: '#f59e0b' }
                          ]}
                        >
                          <View style={styles.cardHeader}>
                            <View style={styles.itemBadge}>
                              {/* Bulk check option */}
                              {!item.isPaid && (
                                <TouchableOpacity
                                  onPress={() => handleToggleSelect(item.id)}
                                  style={[styles.checkboxFrame, { borderColor: t.cardBorder }, isSelected && { backgroundColor: t.accent, borderColor: t.accent }]}
                                >
                                  {isSelected && <CheckCircle2 size={10} color="#ffffff" />}
                                </TouchableOpacity>
                              )}
                              <Text style={[styles.itemNameText, { color: t.textPrimary }]} numberOfLines={1}>
                                {item.itemName}
                              </Text>
                            </View>
                            <View style={[styles.statusTagBadge, { backgroundColor: badgeBg }]}>
                              <Text style={[styles.statusTagBadgeText, { color: labelColor }]}>{statusLabel}</Text>
                            </View>
                          </View>

                          <View style={styles.cardBody}>
                            <View style={styles.col}>
                              <Text style={styles.bodyLabel}>AMOUNT DUE</Text>
                              <Text style={[styles.amountText, { color: t.textPrimary }]}>{formatCurrency(item.amountDue)}</Text>
                            </View>
                            <View style={styles.col}>
                              <Text style={styles.bodyLabel}>INSTALLMENT MONTH</Text>
                              <Text style={[styles.monthText, { color: t.textSecondary }]}>
                                Month {item.monthNumber} of {item.installmentMonths}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.cardDivider, { backgroundColor: t.divider }]} />

                          <View style={styles.cardFooter}>
                            <View style={styles.dateContainer}>
                              <Clock size={13} color={t.textSecondary} />
                              <Text style={[styles.dateText, { color: t.textSecondary }]}>
                                {item.isPaid
                                  ? `Paid: ${new Date(item.paymentDate || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                  : `Due: ${item.dueDate}`}
                              </Text>
                            </View>

                            <View style={styles.footerActionRow}>
                              {!item.isPaid && (
                                <TouchableOpacity
                                  onPress={() => handleOpenSinglePayModal(item)}
                                  style={styles.smallFillBtn}
                                >
                                  <Banknote size={12} color="#ffffff" />
                                  <Text style={styles.smallFillBtnText}>
                                    Settle
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    } else {
                      // List View
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.listRowCard,
                            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                            isSelected && { borderColor: t.accent }
                          ]}
                        >
                          <View style={styles.listRowHeader}>
                            <View style={styles.listRowLeft}>
                              {!item.isPaid && (
                                <TouchableOpacity
                                  onPress={() => handleToggleSelect(item.id)}
                                  style={[styles.checkboxFrame, { borderColor: t.cardBorder }, isSelected && { backgroundColor: t.accent, borderColor: t.accent }]}
                                >
                                  {isSelected && <CheckCircle2 size={10} color="#ffffff" />}
                                </TouchableOpacity>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.listRowName, { color: t.textPrimary }]} numberOfLines={1}>
                                  {item.itemName}
                                </Text>
                                <Text style={[styles.listRowSub, { color: t.textSecondary }]}>
                                  Month {item.monthNumber}/{item.installmentMonths} • Due {item.dueDate}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.listRowRight}>
                              <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                                <Text style={[styles.listRowAmount, { color: t.textPrimary }]}>{formatCurrency(item.amountDue)}</Text>
                                <Text style={[styles.listRowStatus, { color: labelColor }]}>{statusLabel}</Text>
                              </View>
                              
                              {!item.isPaid && (
                                <TouchableOpacity
                                  onPress={() => handleOpenSinglePayModal(item)}
                                  style={[styles.iconActionCircle, { backgroundColor: t.divider }]}
                                >
                                  <Banknote size={14} color={t.accent} />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    }
                  })
                ) : (
                  <View style={styles.emptyContainer}>
                    <Info size={40} color={t.textSecondary} style={{ marginBottom: 12 }} />
                    <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No Payments Found</Text>
                    <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>
                      Try clearing search parameters or filters.
                    </Text>
                  </View>
                )}
              </View>

              {/* Dues Pagination */}
              {totalPages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    onPress={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    style={[
                      styles.pageBtn,
                      { borderColor: t.cardBorder, backgroundColor: t.cardBg, minWidth: 32 },
                      currentPage === 1 && { opacity: 0.4 }
                    ]}
                  >
                    <Text style={[styles.pageBtnText, { color: t.textPrimary }]}>«</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={[
                      styles.pageBtn,
                      { borderColor: t.cardBorder, backgroundColor: t.cardBg },
                      currentPage === 1 && { opacity: 0.4 }
                    ]}
                  >
                    <Text style={[styles.pageBtnText, { color: t.textPrimary }]}>Prev</Text>
                  </TouchableOpacity>

                  <View style={styles.pageNumbersContainer}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      const isCurrent = page === currentPage;
                      return (
                        <TouchableOpacity
                          key={page}
                          onPress={() => setCurrentPage(page)}
                          style={[
                            styles.pageNumberBtn,
                            isCurrent && { backgroundColor: t.accent }
                          ]}
                        >
                          <Text
                            style={[
                              styles.pageNumberText,
                              { color: isCurrent ? '#ffffff' : t.textSecondary }
                            ]}
                          >
                            {page}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={[
                      styles.pageBtn,
                      { borderColor: t.cardBorder, backgroundColor: t.cardBg },
                      currentPage === totalPages && { opacity: 0.4 }
                    ]}
                  >
                    <Text style={[styles.pageBtnText, { color: t.textPrimary }]}>Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    style={[
                      styles.pageBtn,
                      { borderColor: t.cardBorder, backgroundColor: t.cardBg, minWidth: 32 },
                      currentPage === totalPages && { opacity: 0.4 }
                    ]}
                  >
                    <Text style={[styles.pageBtnText, { color: t.textPrimary }]}>»</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {/* TIMELINE MONTHLY CYCLES */}
              <View style={styles.timelineHeaderRow}>
                <Text style={[styles.timelineHeaderTitle, { color: t.textPrimary }]}>Amortization Timeline</Text>
                <Text style={[styles.timelineHeaderDesc, { color: t.textSecondary }]}>
                  Monthly billing cycles grouped by 5th of each calendar month.
                </Text>
              </View>

              <View style={styles.timelineList}>
                {monthlyBreakdown.map((group, idx) => {
                  let statusBg = t.divider;
                  let statusColor = t.textSecondary;

                  if (group.monthStatus === 'paid') {
                    statusBg = 'rgba(16, 185, 129, 0.1)';
                    statusColor = t.successText;
                  } else if (group.monthStatus === 'overdue') {
                    statusBg = 'rgba(239, 68, 68, 0.1)';
                    statusColor = '#ef4444';
                  } else if (group.monthStatus === 'current') {
                    statusBg = 'rgba(59, 130, 246, 0.1)';
                    statusColor = '#3b82f6';
                  }

                  const isLast = idx === monthlyBreakdown.length - 1;

                  return (
                    <TouchableOpacity
                      key={group.monthKey}
                      onPress={() => {
                        setSelectedMonthGroup(group);
                        setIsMonthDetailModalOpen(true);
                      }}
                      style={styles.timelineRow}
                    >
                      {/* Left timeline line drawing */}
                      <View style={styles.timelineIndicatorCol}>
                        <View style={[styles.timelineDot, { backgroundColor: statusColor }]} />
                        {!isLast && <View style={[styles.timelineLine, { backgroundColor: t.divider }]} />}
                      </View>

                      {/* Content Card */}
                      <View style={[styles.timelineCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                        <View style={styles.timelineCardHead}>
                          <View>
                            <Text style={[styles.timelineCardName, { color: t.textPrimary }]}>{group.monthName}</Text>
                            <Text style={[styles.timelineCardCount, { color: t.textSecondary }]}>
                              {group.paidCount}/{group.totalPayments} Settled
                            </Text>
                          </View>
                          <View style={[styles.statusTagBadge, { backgroundColor: statusBg }]}>
                            <Text style={[styles.statusTagBadgeText, { color: statusColor }]}>
                              {group.monthStatus}
                            </Text>
                          </View>
                        </View>

                        {/* Collection Progress bar */}
                        <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0', marginTop: 8 }]}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${group.collectionRate}%`, backgroundColor: statusColor },
                            ]}
                          />
                        </View>

                        <View style={styles.timelineCardFooter}>
                          <Text style={[styles.timelineFooterText, { color: t.textSecondary }]}>
                            Paid: {formatCurrency(group.paidAmount)}
                          </Text>
                          <Text style={[styles.timelineFooterAmount, { color: t.textPrimary }]}>
                            Total: {formatCurrency(group.totalAmount)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Cash Flow Forecast shelf */}
              <View style={styles.forecastHeaderRow}>
                <Sparkles size={16} color={t.accent} />
                <Text style={[styles.timelineHeaderTitle, { color: t.textPrimary, marginLeft: 6 }]}>
                  6-Month Billing Forecasts
                </Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.forecastShelf}>
                {cashFlowForecast.map(forecast => (
                  <View
                    key={forecast.monthKey}
                    style={[styles.forecastCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                  >
                    <Text style={[styles.forecastMonthName, { color: t.textPrimary }]}>{forecast.monthName}</Text>
                    <Text style={[styles.forecastLabel, { color: t.textSecondary }]}>PROJECTED DUES</Text>
                    <Text style={[styles.forecastValue, { color: t.textPrimary }]}>
                      {formatCurrency(forecast.projectedPayments)}
                    </Text>

                    <View style={[styles.cardDivider, { backgroundColor: t.divider }]} />
                    <View style={styles.forecastFooterRow}>
                      <Text style={[styles.forecastConfidence, { color: t.successText }]}>
                        {forecast.confidence}% Confidence
                      </Text>
                      <Text style={[styles.forecastUnpaid, { color: t.textSecondary }]}>
                        {formatCurrency(forecast.unpaidProjectedAmount)} Unpaid
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      {/* Sticky Bottom Actions Bar for Bulk Payments Selection */}
      {selectedPaymentIds.length > 0 && (
        <View style={[styles.stickyBottomBar, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View>
            <Text style={[styles.stickySelectedCount, { color: t.textSecondary }]}>
              {selectedPaymentIds.length} Dues Selected
            </Text>
            <Text style={[styles.stickyTotalAmount, { color: t.textPrimary }]}>
              {formatCurrency(selectedPaymentsTotal)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenBulkPayModal}
            style={styles.stickyPayBtn}
          >
            <Banknote size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.stickyPayBtnText}>Pay Selected</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- PAYMENT MODAL --- */}
      <Modal
        visible={isPaymentModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPaymentModalOpen(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: t.modalOverlay }]}>
          <SwipeDismissModal onDismiss={() => setIsPaymentModalOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={[styles.modalHeader, { borderColor: t.divider }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Pay Installment Dues</Text>
                <Text style={[styles.modalSubtitle, { color: t.textSecondary }]}>
                  Submit cash payment for selected installments.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsPaymentModalOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBodyScroll} style={{ maxHeight: 320 }}>
              {/* Cash-Only Notice */}
              <View style={[styles.warningBox, { backgroundColor: t.warningBg, borderColor: t.warningBorder }]}>
                <Banknote size={20} color="#f59e0b" style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningBoxTitle}>Cash Payment Only</Text>
                  <Text style={styles.warningBoxDesc}>
                    S-Pay uses Cash payment only. GCash and online payments are not accepted in the current S-Pay flow. Please pay your installment dues in cash directly to the admin in person.
                  </Text>
                </View>
              </View>

              {/* Dues Breakdown */}
              <Text style={[styles.modalListLabel, { color: t.textSecondary }]}>INSTALLMENTS LIST</Text>
              <View style={styles.duesContainer}>
                {selectedPayDetails.map((p, idx) => (
                  <View key={p.id || idx} style={[styles.dueRow, { borderColor: t.divider }]}>
                    <Text style={[styles.dueRowMonth, { color: t.textPrimary, flex: 1 }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.dueRowAmount, { color: t.textPrimary }]}>{formatCurrency(p.amount)}</Text>
                  </View>
                ))}
              </View>

              {/* Total amount summary */}
              <View style={[styles.duesSummaryBlock, { backgroundColor: t.divider }]}>
                <Text style={[styles.summaryLabel, { color: t.textSecondary }]}>Total Amount Due</Text>
                <Text style={[styles.summaryValue, { color: t.textPrimary }]}>
                  {formatCurrency(selectedPayDetails.reduce((sum, p) => sum + p.amount, 0))}
                </Text>
              </View>

              {/* Instructions */}
              <View style={[styles.instructionBox, { backgroundColor: t.divider }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <UserCheck size={16} color={t.textSecondary} />
                  <Text style={[styles.instructionHeader, { color: t.textPrimary }]}>Instructions</Text>
                </View>
                <Text style={[styles.instructionItem, { color: t.textSecondary }]}>1. Withdraw or prepare the exact cash amount for all selected installments.</Text>
                <Text style={[styles.instructionItem, { color: t.textSecondary }]}>2. Meet the administrator in person.</Text>
                <Text style={[styles.instructionItem, { color: t.textSecondary }]}>3. Hand over the cash payment to the administrator, and they will verify and mark it paid instantly.</Text>
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { borderColor: t.divider }]}>
              <TouchableOpacity
                onPress={() => {
                  setIsPaymentModalOpen(false);
                  setSelectedPaymentIds([]);
                }}
                style={styles.understoodBtn}
              >
                <Text style={styles.understoodBtnText}>Understood</Text>
              </TouchableOpacity>
            </View>
          </View>
          </SwipeDismissModal>
        </View>
      </Modal>



      {/* --- MONTH DETAIL MODAL --- */}
      <Modal
        visible={isMonthDetailModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMonthDetailModalOpen(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: t.modalOverlay }]}>
          <SwipeDismissModal onDismiss={() => setIsMonthDetailModalOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={[styles.modalHeader, { borderColor: t.divider }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>{selectedMonthGroup?.monthName}</Text>
                <Text style={[styles.modalSubtitle, { color: t.textSecondary }]}>
                  All installment amortizations belonging to this billing cycle.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsMonthDetailModalOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBodyScroll} style={{ maxHeight: 360 }}>
              <View style={{ gap: 10 }}>
                {selectedMonthGroup?.payments.map((p, idx) => {
                  const reschedulePending = p.rescheduleHistory.some(rh => !rh.admin_approved);
                  let statusText = 'Pending';
                  let labelColor = t.textSecondary;
                  let statusBg = t.divider;

                  if (p.isPaid) {
                    statusText = 'Settled';
                    labelColor = t.successText;
                    statusBg = 'rgba(16, 185, 129, 0.1)';
                  } else if (p.status === 'overdue') {
                    statusText = 'Overdue';
                    labelColor = '#ef4444';
                    statusBg = 'rgba(239, 68, 68, 0.1)';
                  } else if (reschedulePending) {
                    statusText = 'Rescheduling';
                    labelColor = '#f59e0b';
                    statusBg = 'rgba(245, 158, 11, 0.1)';
                  }

                  return (
                    <View key={p.id || idx} style={[styles.monthPaymentRow, { borderColor: t.divider, backgroundColor: t.divider }]}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.monthPaymentName, { color: t.textPrimary }]} numberOfLines={1}>
                          {p.itemName}
                        </Text>
                        <Text style={[styles.monthPaymentSub, { color: t.textSecondary }]}>
                          Month {p.monthNumber}/{p.installmentMonths} • Due {p.dueDate}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.monthPaymentAmt, { color: t.textPrimary }]}>{formatCurrency(p.amountDue)}</Text>
                        <View style={[styles.statusTagBadge, { backgroundColor: statusBg, marginTop: 4 }]}>
                          <Text style={[styles.statusTagBadgeText, { color: labelColor, fontSize: 8 }]}>{statusText}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { borderColor: t.divider }]}>
              <TouchableOpacity
                onPress={() => setIsMonthDetailModalOpen(false)}
                style={styles.understoodBtn}
              >
                <Text style={styles.understoodBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          </SwipeDismissModal>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  webHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  webHeaderSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  webHeaderTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  webHeaderDesc: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
    lineHeight: 15,
  },
  backButtonFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  countdownCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
  },
  countdownCardHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  countdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownSubtitle: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  countdownTitleText: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    fontWeight: '700',
    marginTop: 2,
  },
  countdownClockSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 16,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  flipCardCol: {
    alignItems: 'center',
    gap: 4,
  },
  flipCard: {},
  flipCardOuter: {
    width: 44,
    height: 52,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  topHalfContainer: {
    height: 26,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    justifyContent: 'flex-start',
  },
  topText: {
    color: '#f8fafc',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
  },
  bottomHalfContainer: {
    height: 26,
    overflow: 'hidden',
    backgroundColor: '#161c2a',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'flex-end',
  },
  bottomText: {
    color: '#cbd5e1',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    height: 52,
    lineHeight: 52,
    marginTop: -26,
  },
  flipCardDivider: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  flipCardLabel: {
    color: '#64748b',
    fontFamily: 'Jakarta-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  countdownColon: {
    fontSize: 20,
    fontWeight: '800',
  },
  countdownBottomAmountCol: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  billLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  billValue: {
    fontSize: 26,
    fontFamily: 'Jakarta-Bold',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  payNowBtnCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ee4d2d',
    borderRadius: 10,
    paddingHorizontal: 20,
    height: 34,
    marginTop: 8,
  },
  payNowBtnCountdownText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  breakdownBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
    gap: 8,
  },
  breakdownTitle: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownItemName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  breakdownItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownItemDate: {
    fontSize: 10,
  },
  breakdownItemAmount: {
    fontSize: 12,
    fontWeight: '800',
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: (width - 42) / 2,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Jakarta-Bold',
    fontWeight: '800',
    marginTop: 6,
  },
  statSubText: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: '600',
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 14,
    padding: 3,
    marginTop: 4,
  },
  tabToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabToggleText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  controlsBar: {
    gap: 8,
    marginTop: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  filterTabsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sortToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
    gap: 4,
  },
  sortBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
  },
  viewToggleButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  listContainer: {
    gap: 12,
  },
  paymentCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  checkboxFrame: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
    flex: 1,
  },
  statusTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  col: {
    flex: 1,
  },
  bodyLabel: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  monthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '600',
  },
  footerActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  smallOutlineBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallOutlineBtnText: {
    fontSize: 9,
    fontWeight: '700',
  },
  smallFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ee4d2d',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 28,
    justifyContent: 'center',
  },
  smallFillBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  listRowCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
  },
  listRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  listRowName: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  listRowSub: {
    fontSize: 10,
    marginTop: 1,
  },
  listRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listRowAmount: {
    fontSize: 12,
    fontWeight: '800',
  },
  listRowStatus: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  iconActionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 10,
  },
  pageBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 54,
    alignItems: 'center',
  },
  pageBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pageNumbersContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  pageNumberBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timelineHeaderRow: {
    gap: 2,
    marginTop: 4,
  },
  timelineHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
  },
  timelineHeaderDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  timelineList: {
    marginTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineIndicatorCol: {
    alignItems: 'center',
    width: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 18,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 12,
  },
  timelineCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineCardName: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Jakarta-Bold',
  },
  timelineCardCount: {
    fontSize: 10,
    marginTop: 1,
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  timelineCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  timelineFooterText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timelineFooterAmount: {
    fontSize: 11,
    fontWeight: '700',
  },
  forecastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  forecastShelf: {
    gap: 12,
    paddingBottom: 8,
  },
  forecastCard: {
    width: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
  },
  forecastMonthName: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Jakarta-Bold',
  },
  forecastLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  forecastValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  forecastFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forecastConfidence: {
    fontSize: 8,
    fontWeight: '800',
  },
  forecastUnpaid: {
    fontSize: 8,
    fontWeight: '500',
  },
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  stickySelectedCount: {
    fontSize: 10,
    fontWeight: '700',
  },
  stickyTotalAmount: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Jakarta-Bold',
    marginTop: 1,
  },
  stickyPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ee4d2d',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 38,
  },
  stickyPayBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  modalBodyScroll: {
    paddingVertical: 12,
  },
  warningBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warningBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  warningBoxDesc: {
    fontSize: 10,
    color: '#b45309',
    marginTop: 2,
    lineHeight: 14,
  },
  modalListLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  duesContainer: {
    gap: 8,
    marginBottom: 12,
  },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
  },
  dueRowMonth: {
    fontSize: 11,
    fontWeight: '700',
  },
  dueRowAmount: {
    fontSize: 12,
    fontWeight: '800',
  },
  duesSummaryBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  instructionBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  instructionHeader: {
    fontSize: 11,
    fontWeight: '700',
  },
  instructionItem: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  modalActions: {
    borderTopWidth: 1,
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  understoodBtn: {
    backgroundColor: '#ee4d2d',
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  understoodBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  inputValueStatic: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    fontSize: 12,
    marginBottom: 10,
  },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitReschedBtn: {
    backgroundColor: '#ee4d2d',
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitReschedBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  monthPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
  },
  monthPaymentName: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  monthPaymentSub: {
    fontSize: 10,
    marginTop: 2,
  },
  monthPaymentAmt: {
    fontSize: 12,
    fontWeight: '800',
  },
});
