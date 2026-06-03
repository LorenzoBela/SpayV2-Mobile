import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
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
} from 'react-native';
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
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { useNavigation } from '@react-navigation/native';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import { useExitAppConfirmation } from '../../hooks/useExitAppConfirmation';
import ExitConfirmationModal from '../../components/ExitConfirmationModal';
import PremiumLoader from '../../components/PremiumLoader';
import AdminHeader from '../../components/AdminHeader';
import DatePicker from '../../components/DatePicker';
import { fetchAllAdminData, callAdminApi } from '../../services/adminService';
import dayjs from 'dayjs';


// Helper functions
const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats variables
  const [stats, setStats] = useState({
    activeLimitExposure: 0,
    outstandingBalance: 0,
    activeClientsCount: 0,
    platformDefaults: 0,
    overduePaymentsCount: 0,
    completionRate: 0,
    collectionEfficiency: 0,
  });

  const [nextBillingSchedule, setNextBillingSchedule] = useState<{
    monthName: string;
    totalDue: number;
    earliestDueDate: string | null;
    clients: Array<{
      clientId: string;
      clientName: string;
      email: string;
      totalOwed: number;
      items: Array<{
        itemName: string;
        amountDue: number;
        dueDate: string;
        monthNumber: number;
        installmentMonths: number;
      }>;
    }>;
  }>({
    monthName: '',
    totalDue: 0,
    earliestDueDate: null,
    clients: [],
  });

  // Parity additions states
  const [operationsTab, setOperationsTab] = useState<'orders' | 'timeline'>('orders');
  const [trendsTab, setTrendsTab] = useState<'categories' | 'installments'>('categories');
  const [rankingToggle, setRankingToggle] = useState<'spenders' | 'delinquents' | 'signups'>('spenders');

  const [inflows, setInflows] = useState({
    thisWeekExpected: 0,
    nextWeekExpected: 0,
    nextMonthExpected: 0,
    nextDeadline: null as string | null,
    nextDeadlineAmount: 0,
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const [installmentAnalysis, setInstallmentAnalysis] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [problemClients, setProblemClients] = useState<any[]>([]);
  const [recentClients, setRecentClients] = useState<any[]>([]);

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
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [itemName, setItemName] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [installmentMonths, setInstallmentMonths] = useState('6');
  const [purchaseDate, setPurchaseDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [firstPaymentDate, setFirstPaymentDate] = useState('');

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

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const dbData = await fetchAllAdminData();
      if (!dbData.success) {
        throw new Error(dbData.error || 'Failed to pull ledger metrics.');
      }

      const { profiles = [], accountLimits = [], orders = [], payments = [], reminderLogs = [] } = dbData;

      // 1. Calculate active limits exposure
      const totalLimit = accountLimits.reduce((sum, limit) => sum + Number(limit.credit_limit), 0);

      // 2. Outstanding Balance (unpaid payments)
      const unpaid = payments.filter((p: any) => !p.is_paid);
      const outstanding = unpaid.reduce((sum, p) => sum + Number(p.amount_due), 0);

      // 3. Active clients
      const activeClients = profiles.length;

      // 4. Overdue payments & defaults
      const now = new Date();
      const overdue = unpaid.filter((p: any) => new Date(p.due_date) < now);
      const defaults = overdue.reduce((sum, p) => sum + Number(p.amount_due), 0);

      // 5. Completion Rate & Collection Efficiency
      const totalDueAmount = payments.reduce((sum: any, p: any) => sum + Number(p.amount_due), 0);
      const collectedAmount = payments.filter((p: any) => p.is_paid).reduce((sum: any, p: any) => sum + Number(p.amount_due), 0);
      const efficiency = totalDueAmount > 0 ? Math.round((collectedAmount / totalDueAmount) * 100) : 0;

      const totalPaymentsCount = payments.length;
      const paidPaymentsCount = payments.filter((p: any) => p.is_paid).length;
      const rate = totalPaymentsCount > 0 ? Math.round((paidPaymentsCount / totalPaymentsCount) * 100) : 0;

      setStats({
        activeLimitExposure: totalLimit,
        outstandingBalance: outstanding,
        activeClientsCount: activeClients,
        platformDefaults: defaults,
        overduePaymentsCount: overdue.length,
        completionRate: rate,
        collectionEfficiency: efficiency,
      });

      // 6. Next Billing schedule (earliest unpaid billing month)
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const fromMonthKey = `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}`;

      // Group future unpaid payments by billing month key
      const unpaidPaymentsByMonth = new Map<string, any[]>();
      unpaid.forEach((payment: any) => {
        const monthKey = getBillingMonthKey(payment.due_date);
        if (monthKey < fromMonthKey) return;
        const list = unpaidPaymentsByMonth.get(monthKey) || [];
        list.push(payment);
        unpaidPaymentsByMonth.set(monthKey, list);
      });

      const sortedKeys = Array.from(unpaidPaymentsByMonth.keys()).sort();
      const nextMonthKey = sortedKeys[0];

      if (nextMonthKey) {
        const monthPayments = unpaidPaymentsByMonth.get(nextMonthKey) || [];
        const earliestDue = monthPayments.length > 0
          ? monthPayments.map((p: any) => p.due_date).sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime())[0]
          : null;

        const [yearStr, monthStr] = nextMonthKey.split('-');
        const nextMonthName = new Date(Number(yearStr), Number(monthStr) - 1, 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });

        const clientBillingMap = new Map<string, any>();
        monthPayments.forEach((payment: any) => {
          const order = orders.find((o: any) => o.id === payment.order_id);
          if (!order) return;
          const profile = profiles.find((pr: any) => pr.id === order.user_id);
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
          monthName: nextMonthName,
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

      // 7. Calculate all cash inflows, activities, categories, terms, and rankings client-side
      const todayDate = new Date();
      const startOfWeek = new Date(todayDate);
      startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const endOfNextWeek = new Date(endOfWeek);
      endOfNextWeek.setDate(endOfWeek.getDate() + 7);

      const nextMonthStartInflow = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 1);
      const endOfNextMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 2, 0, 23, 59, 59, 999);

      const thisWeekExp = unpaid
        .filter((p: any) => {
          const d = new Date(p.due_date);
          return d >= startOfWeek && d < endOfWeek;
        })
        .reduce((sum: number, p: any) => sum + Number(p.amount_due), 0);

      const nextWeekExp = unpaid
        .filter((p: any) => {
          const d = new Date(p.due_date);
          return d >= endOfWeek && d < endOfNextWeek;
        })
        .reduce((sum: number, p: any) => sum + Number(p.amount_due), 0);

      const nextMonthExp = payments
        .filter((p: any) => {
          const d = new Date(p.due_date);
          return d >= nextMonthStartInflow && d <= endOfNextMonth;
        })
        .reduce((sum: number, p: any) => sum + Number(p.amount_due), 0);

      const nextUpcoming = unpaid
        .filter((p: any) => new Date(p.due_date) > todayDate)
        .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

      setInflows({
        thisWeekExpected: thisWeekExp,
        nextWeekExpected: nextWeekExp,
        nextMonthExpected: nextMonthExp,
        nextDeadline: nextUpcoming ? nextUpcoming.due_date : null,
        nextDeadlineAmount: nextUpcoming ? Number(nextUpcoming.amount_due) : 0,
      });

      // 8. Recent Orders
      const recentOrdersMapped = orders.slice(0, 10).map((o: any) => {
        const clientProfile = profiles.find((p: any) => p.id === o.user_id);
        return {
          id: o.id,
          itemName: o.item_name,
          clientName: clientProfile ? clientProfile.name : 'Unknown',
          amount: Number(o.amount),
          installmentMonths: o.installment_months,
          orderDate: o.order_date,
          isPaid: o.is_paid,
        };
      });
      setRecentOrders(recentOrdersMapped);

      // 9. Timeline Feed Activities
      const recentOrdersForActivity = orders.slice(0, 10);
      const recentPaymentsForActivity = payments.filter((p: any) => p.is_paid).slice(0, 10);

      const activitiesMapped = [
        ...recentOrdersForActivity.map((o: any) => {
          const clientProfile = profiles.find((p: any) => p.id === o.user_id);
          return {
            type: 'order' as const,
            createdAt: o.order_date,
            name: clientProfile ? clientProfile.name : 'Client',
            detail: o.item_name,
            amount: Number(o.amount),
          };
        }),
        ...recentPaymentsForActivity.map((p: any) => {
          const order = orders.find((o: any) => o.id === p.order_id);
          const clientProfile = order ? profiles.find((pr: any) => pr.id === order.user_id) : null;
          return {
            type: 'payment' as const,
            createdAt: p.payment_date || p.due_date,
            name: clientProfile ? clientProfile.name : 'Client',
            detail: `Payment for Order: ${order ? order.item_name : 'Unknown Item'}`,
            amount: Number(p.amount_due),
          };
        })
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15);
      setActivities(activitiesMapped);

      // 10. Product Categories Share
      const categoriesMap: Record<string, { category: string; orderCount: number; totalValue: number }> = {};
      const categorizeItem = (name: string) => {
        const lower = (name || '').toLowerCase();
        if (/phone|laptop|computer|tv|headphone|earbuds|electronic|fan|led|clock|gadget|tablet|camera/.test(lower)) return 'Electronics';
        if (/serum|cosmetic|makeup|lashes|brow|pencil|skincare|beauty|hair|keratin/.test(lower)) return 'Beauty & Cosmetics';
        if (/dress|pants|rashguard|clothes|fashion|shirt|wear|shoe|bag/.test(lower)) return 'Fashion & Clothing';
        if (/ramen|food|snack|eat|drink|beverage|coffee|tea/.test(lower)) return 'Food & Beverages';
        if (/diaper|pet|care/.test(lower)) return 'Pet Care';
        return 'Other';
      };

      orders.forEach((o: any) => {
        const cat = categorizeItem(o.item_name);
        if (!categoriesMap[cat]) {
          categoriesMap[cat] = { category: cat, orderCount: 0, totalValue: 0 };
        }
        categoriesMap[cat].orderCount += 1;
        categoriesMap[cat].totalValue += Number(o.amount);
      });
      const productCategoriesMapped = Object.values(categoriesMap).sort((a, b) => b.totalValue - a.totalValue);
      setProductCategories(productCategoriesMapped);

      // 11. Installment Term Analysis
      const analysisMap = new Map<number, { months: number; count: number; total: number; collected: number; outstanding: number }>();
      orders.forEach((o: any) => {
        const term = Number(o.installment_months);
        if (!analysisMap.has(term)) {
          analysisMap.set(term, { months: term, count: 0, total: 0, collected: 0, outstanding: 0 });
        }
        const data = analysisMap.get(term)!;
        data.count += 1;
        data.total += Number(o.amount);
      });

      payments.forEach((p: any) => {
        const order = orders.find((o: any) => o.id === p.order_id);
        if (!order) return;
        const term = Number(order.installment_months);
        if (!analysisMap.has(term)) {
          analysisMap.set(term, { months: term, count: 0, total: 0, collected: 0, outstanding: 0 });
        }
        const data = analysisMap.get(term)!;
        if (p.is_paid) {
          data.collected += Number(p.amount_due);
        } else {
          data.outstanding += Number(p.amount_due);
        }
      });

      const installmentAnalysisMapped = Array.from(analysisMap.values()).sort((a, b) => a.months - b.months);
      setInstallmentAnalysis(installmentAnalysisMapped);

      // 12. Rankings
      const spendersMap = new Map<string, { userId: string; totalSpent: number; count: number }>();
      orders.forEach((o: any) => {
        const uid = o.user_id;
        const entry = spendersMap.get(uid) || { userId: uid, totalSpent: 0, count: 0 };
        entry.totalSpent += Number(o.amount);
        entry.count += 1;
        spendersMap.set(uid, entry);
      });

      const topClientsMapped = Array.from(spendersMap.values())
        .map(entry => {
          const clientProfile = profiles.find((p: any) => p.id === entry.userId);
          return {
            name: clientProfile ? clientProfile.name : 'Unknown',
            email: clientProfile ? clientProfile.email : 'Unknown',
            totalSpent: entry.totalSpent,
            count: entry.count,
          };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);
      setTopClients(topClientsMapped);

      const overduePayments = unpaid.filter((p: any) => new Date(p.due_date) < todayDate);
      const delinquentsMap = new Map<string, { userId: string; overdueCount: number }>();
      overduePayments.forEach((p: any) => {
        const order = orders.find((o: any) => o.id === p.order_id);
        if (!order) return;
        const uid = order.user_id;
        const entry = delinquentsMap.get(uid) || { userId: uid, overdueCount: 0 };
        entry.overdueCount += 1;
        delinquentsMap.set(uid, entry);
      });

      const problemClientsMapped = Array.from(delinquentsMap.values())
        .map(entry => {
          const clientProfile = profiles.find((p: any) => p.id === entry.userId);
          return {
            name: clientProfile ? clientProfile.name : 'Unknown',
            email: clientProfile ? clientProfile.email : 'Unknown',
            overdueCount: entry.overdueCount,
          };
        })
        .sort((a, b) => b.overdueCount - a.overdueCount)
        .slice(0, 5);
      setProblemClients(problemClientsMapped);

      const clientProfiles = profiles.filter((p: any) => p.role === 'CLIENT' || p.email === 'lorenzo91145@gmail.com');
      const recentClientsMapped = clientProfiles
        .map((p: any) => ({
          name: p.name,
          email: p.email,
          createdAt: p.created_at,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setRecentClients(recentClientsMapped);

      // Save clients list for forms
      setClientsList(profiles.map((p: any) => ({ id: p.id, name: p.name, email: p.email })));
    } catch (err: any) {
      console.warn('[AdminDashboardScreen] Loading error:', err);
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

  // Flip countdown updater
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
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [nextBillingSchedule.earliestDueDate]);

  const handleScheduleOrderSubmit = async () => {
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
        loadData(false);
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to schedule installment plan.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server did not respond.');
    } finally {
      setActionLoading(false);
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
        loadData(false);
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
  const filteredClients = clientsList.filter((client) => {
    const query = clientSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${client.name} ${client.email}`.toLowerCase().includes(query);
  });
  const selectedClient = clientsList.find((client) => client.id === selectedClientId);
  const parsedOrderAmount = Number(orderAmount);
  const parsedMonths = Number(installmentMonths) || 1;
  const estimatedMonthlyDue = Number.isFinite(parsedOrderAmount) && parsedOrderAmount > 0
    ? parsedOrderAmount / parsedMonths
    : 0;
  const projectedOutstanding = Number.isFinite(parsedOrderAmount) && parsedOrderAmount > 0
    ? stats.outstandingBalance + parsedOrderAmount
    : stats.outstandingBalance;
  const projectedExposurePercent = stats.activeLimitExposure > 0
    ? Math.min(100, Math.round((projectedOutstanding / stats.activeLimitExposure) * 100))
    : 0;
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
        onRetry={() => loadData()}
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
                nextBillingSchedule.clients.map((client) => {
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
                          {client.items.map((item, idx) => (
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

        {/* Expected Cash Inflows Card */}
        <View style={[styles.inflowsCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.inflowsTitle, { color: t.textPrimary }]}>Expected Cash Inflows</Text>
          
          <View style={styles.inflowsList}>
            <View style={styles.inflowRow}>
              <View style={styles.inflowLabelContainer}>
                <View style={[styles.bulletPoint, { backgroundColor: '#3b82f6' }]} />
                <Text style={[styles.inflowLabel, { color: t.textSecondary }]}>This Week expected</Text>
              </View>
              <Text style={[styles.inflowValue, { color: t.textPrimary }]}>{formatCurrency(inflows.thisWeekExpected)}</Text>
            </View>
            
            <View style={styles.inflowRow}>
              <View style={styles.inflowLabelContainer}>
                <View style={[styles.bulletPoint, { backgroundColor: '#10b981' }]} />
                <Text style={[styles.inflowLabel, { color: t.textSecondary }]}>Next Week expected</Text>
              </View>
              <Text style={[styles.inflowValue, { color: t.textPrimary }]}>{formatCurrency(inflows.nextWeekExpected)}</Text>
            </View>
            
            <View style={[styles.inflowRow, styles.inflowRowBorder, { borderBottomColor: t.border }]}>
              <View style={styles.inflowLabelContainer}>
                <View style={[styles.bulletPoint, { backgroundColor: '#ee4d2d' }]} />
                <Text style={[styles.inflowLabel, { color: t.textSecondary }]}>Next Month expected</Text>
              </View>
              <Text style={[styles.inflowValue, { color: t.textPrimary }]}>{formatCurrency(inflows.nextMonthExpected)}</Text>
            </View>
          </View>

          {/* Next pending deadline highlight */}
          <View style={[styles.deadlineHighlightBox, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderColor: t.border }]}>
            <View style={styles.deadlineHeader}>
              <Clock size={14} color="#ef4444" />
              <Text style={styles.deadlineLabel}>NEXT PENDING DEADLINE</Text>
            </View>
            {inflows.nextDeadline ? (
              <View style={styles.deadlineBody}>
                <Text style={[styles.deadlineDate, { color: t.textPrimary }]}>{formatRelativeDate(inflows.nextDeadline)}</Text>
                <Text style={styles.deadlineAmount}>
                  Expect collection of <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>{formatCurrency(inflows.nextDeadlineAmount)}</Text>
                </Text>
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: t.textSecondary, paddingVertical: 4 }]}>Clear queue: no pending deadlines.</Text>
            )}
          </View>
        </View>

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
                topClients.map((c, idx) => (
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
                problemClients.map((c, idx) => (
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
                recentClients.map((c, idx) => (
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
                    recentOrders.map((o) => (
                      <View key={o.id} style={[styles.tableBodyRow, { borderBottomColor: t.border }]}>
                        <Text style={[styles.tableCell, { width: 100, fontWeight: 'bold', color: t.textPrimary }]} numberOfLines={1}>
                          {o.clientName}
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
                  activities.map((act, index) => (
                    <View key={index} style={[styles.timelineItem, { borderLeftColor: t.border }]}>
                      <View style={[
                        styles.timelineBullet,
                        { backgroundColor: act.type === 'order' ? '#f97316' : '#10b981' }
                      ]} />
                      <View style={styles.timelineContent}>
                        <Text style={[styles.timelineText, { color: t.textPrimary }]}>
                          <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>{act.name}</Text>
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
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            {trendsTab === 'categories' ? (
              <View style={styles.trendsContainer}>
                {productCategories.length > 0 ? (
                  productCategories.map((c, idx) => {
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
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableContainer}>
                  <View style={[styles.tableHeaderRow, { borderBottomColor: t.border }]}>
                    <Text style={[styles.tableHeaderCell, { width: 100, color: t.textSecondary }]}>PLAN PERIOD</Text>
                    <Text style={[styles.tableHeaderCell, { width: 90, textAlign: 'center', color: t.textSecondary }]}>ORDERS</Text>
                    <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'right', color: t.textSecondary }]}>COLLECTED</Text>
                    <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'right', color: t.textSecondary }]}>OUTSTANDING</Text>
                  </View>
                  {installmentAnalysis.length > 0 ? (
                    installmentAnalysis.map((item, idx) => (
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
          </View>
        </View>
      </ScrollView>

      {/* New Order Modal */}
      <Modal visible={isNewOrderOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
                {filteredClients.map((client) => {
                  const selected = selectedClientId === client.id;
                  return (
                    <TouchableOpacity
                      key={client.id}
                      style={[
                        styles.clientChoiceCard,
                        { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: selected ? t.accent : t.cardBorder },
                        selected && styles.clientChoiceCardActive,
                      ]}
                      onPress={() => setSelectedClientId(client.id)}
                      activeOpacity={0.86}
                    >
                      <View style={[styles.clientAvatar, { backgroundColor: selected ? t.accent : t.accentLight }]}>
                        <Text style={[styles.clientAvatarText, { color: selected ? '#ffffff' : t.accent }]}>
                          {(client.name || client.email || '?').slice(0, 1).toUpperCase()}
                        </Text>
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
                {['3', '6', '12', '24'].map((m) => {
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
                        <Text style={[styles.termCaption, { color: selected ? 'rgba(255,255,255,0.78)' : t.textSecondary }]}>Months</Text>
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

              <View style={[styles.exposurePreview, { backgroundColor: isDarkMode ? '#0b1220' : '#f8fafc', borderColor: t.cardBorder }]}>
                <View style={styles.exposurePreviewTop}>
                  <Text style={[styles.previewTitle, { color: t.textPrimary }]}>Limit Impact Preview</Text>
                  <Text style={[styles.previewPercent, { color: projectedExposurePercent > 80 ? '#ef4444' : '#10b981' }]}>
                    {projectedExposurePercent}%
                  </Text>
                </View>
                <View style={[styles.previewTrack, { backgroundColor: isDarkMode ? '#1f2937' : '#e5e7eb' }]}>
                  <View style={[styles.previewFill, { width: `${projectedExposurePercent}%`, backgroundColor: projectedExposurePercent > 80 ? '#ef4444' : t.accent }]} />
                </View>
                <Text style={[styles.previewCaption, { color: t.textSecondary }]}>
                  Projected exposure after this order: {formatCurrency(projectedOutstanding)}
                </Text>
              </View>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Baseline limit adjust modal */}
      <Modal visible={isGlobalLimitOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabButtonActive: {
    // dynamically sets color
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  premiumSheet: {
    borderRadius: 28,
    borderWidth: 1,
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
    width: 148,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  clientChoiceCardActive: {
    shadowColor: '#ee4d2d',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  clientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    fontSize: 14,
    fontWeight: '900',
  },
  clientChoiceName: {
    fontSize: 13,
    fontWeight: '900',
  },
  clientChoiceEmail: {
    fontSize: 10,
    fontWeight: '600',
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
});
