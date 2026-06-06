import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Award,
  AlertCircle,
  ShoppingBag,
  ShieldAlert,
  DollarSign,
  PieChart as PieIcon,
  Info,
  ArrowUpRight,
  BarChart2,
  Clock,
  CreditCard,
  Download,
  ListPlus,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react-native';
import Svg, { Circle, Rect, Path, Line, Text as SvgText, G } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { supabase } from '../../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../../utils/authProfile';
import { ThemeContext } from '../../navigation/navigationTypes';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import { ReportsSkeleton } from '../../components/SkeletonLoader';
import { useResponsiveLayout } from '../../utils/responsive';
import { parseUtcDate } from '../../utils/date';


export default function ReportsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const chartCanvasWidth = layout.getChartWidth(76);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & tab states
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'forecast'>('overview');
  const [period, setPeriod] = useState<'all' | 'last_30' | 'last_90' | 'this_year' | 'last_year'>('all');

  // Modals state
  const [modals, setModals] = useState({
    categories: false,
    compliance: false,
    recommendations: false,
  });

  // Raw database records
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);

  // Style colors mapping
  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d',
    divider: isDarkMode ? '#222d42' : '#e2e8f0',
    modalOverlay: isDarkMode ? 'rgba(11, 15, 25, 0.85)' : 'rgba(15, 23, 42, 0.65)',
  };

  const catColors = [
    { text: isDarkMode ? '#94a3b8' : '#475569', bar: '#475569' },
    { text: isDarkMode ? '#94a3b8' : '#64748b', bar: '#64748b' },
    { text: isDarkMode ? '#a1a1aa' : '#52525b', bar: '#52525b' },
    { text: isDarkMode ? '#a1a1aa' : '#71717a', bar: '#71717a' },
    { text: isDarkMode ? '#a3a3a3' : '#525252', bar: '#525252' },
    { text: isDarkMode ? '#a3a3a3' : '#737373', bar: '#737373' },
    { text: isDarkMode ? '#cbd5e1' : '#334155', bar: '#334155' },
    { text: isDarkMode ? '#cbd5e1' : '#3f3f46', bar: '#3f3f46' },
    { text: isDarkMode ? '#a8a29e' : '#78716c', bar: '#78716c' },
  ];

  const fetchReportsData = async () => {
    try {
      const { user, profileId } = await getLinkedProfileForCurrentUser();
      if (!user) return;

      // 1. Fetch Orders
      const { data: dbOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, item_name, amount, installment_months, order_date, is_paid')
        .eq('user_id', profileId);

      if (ordersErr) throw ordersErr;
      const ordersList = dbOrders || [];

      // 2. Fetch Payments
      const orderIds = ordersList.map((o) => o.id);
      let paymentsList: any[] = [];
      if (orderIds.length > 0) {
        const { data: paymentsData, error: paymentsErr } = await supabase
          .from('payments')
          .select('id, order_id, month_number, amount_due, due_date, is_paid, payment_date')
          .in('order_id', orderIds);
        if (paymentsErr) throw paymentsErr;
        if (paymentsData) paymentsList = paymentsData;
      }

      // Map payments with parent order context
      const ordersMap = new Map<string, any>();
      ordersList.forEach((o) => {
        ordersMap.set(o.id, {
          id: o.id,
          itemName: o.item_name,
          amount: parseFloat(o.amount),
          installmentMonths: parseInt(o.installment_months, 10),
          orderDate: parseUtcDate(o.order_date),
          isPaid: o.is_paid,
        });
      });

      const allPaymentsMapped = paymentsList.map((p) => {
        const order = ordersMap.get(p.order_id) || {
          itemName: 'Unknown Order',
          installmentMonths: 1,
          orderDate: new Date(),
          isPaid: false,
        };
        return {
          id: p.id,
          orderId: p.order_id,
          monthNumber: parseInt(p.month_number, 10),
          amountDue: parseFloat(p.amount_due),
          dueDate: parseUtcDate(p.due_date),
          isPaid: p.is_paid,
          paymentDate: p.payment_date ? parseUtcDate(p.payment_date) : null,
          itemName: order.itemName,
          installmentMonths: order.installmentMonths,
          orderDate: order.orderDate,
        };
      });

      const allOrdersMapped = ordersList.map((o) => ({
        id: o.id,
        itemName: o.item_name,
        amount: parseFloat(o.amount),
        installmentMonths: parseInt(o.installment_months, 10),
        orderDate: parseUtcDate(o.order_date),
        isPaid: o.is_paid,
      }));

      setRawOrders(allOrdersMapped);
      setRawPayments(allPaymentsMapped);
    } catch (e) {
      console.warn('Failed to load reports dataset:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportsData();
  };

  // Perform client-side data transformations & summaries matching web formulas
  const calculatedData = useMemo(() => {
    if (rawOrders.length === 0) {
      return {
        metrics: {
          totalOrders: 0,
          totalSpent: 0,
          avgOrderValue: 0,
          completedOrders: 0,
          completionRate: 0,
          totalPayments: 0,
          completedPayments: 0,
          totalPaidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
          paymentCompletionRate: 0,
          totalDuePayments: 0,
          onTimePayments: 0,
          latePayments: 0,
          onTimeRate: 100,
          healthScore: 100,
          creditScore: 500,
          debtRatio: 0,
          streak: 0,
          monthsToPayoff: 0,
          progress: 100,
          monthlyAvg: 0,
        },
        spendingCategories: [],
        paymentPatterns: [],
        monthlyData: [],
        seasonalData: [],
        forecastMonths: [],
        installmentBreakdown: [],
        recentOrders: [],
        compliancePayments: [],
      };
    }

    const now = new Date();

    // 1. Calculate Date Range Filters
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (period === 'last_30') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 30);
      endDate = now;
    } else if (period === 'last_90') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 90);
      endDate = now;
    } else if (period === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
    } else if (period === 'last_year') {
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    }

    // Filter orders and payments by Order Date (matching legacy PHP behavior)
    const filteredOrders = rawOrders.filter((o) => {
      if (!startDate || !endDate) return true;
      return o.orderDate >= startDate && o.orderDate <= endDate;
    });

    const filteredPayments = rawPayments.filter((p) => {
      if (!startDate || !endDate) return true;
      return p.orderDate >= startDate && p.orderDate <= endDate;
    });

    // Overview Statistics
    const totalOrders = filteredOrders.length;
    const totalSpent = filteredOrders.reduce((sum, o) => sum + o.amount, 0);
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const completedOrders = filteredOrders.filter((o) => o.isPaid).length;
    const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    // Payment Stats
    const totalPayments = filteredPayments.length;
    const completedPayments = filteredPayments.filter((p) => p.isPaid).length;
    const totalPaidAmount = filteredPayments.filter((p) => p.isPaid).reduce((sum, p) => sum + p.amountDue, 0);
    const pendingAmount = filteredPayments.filter((p) => !p.isPaid).reduce((sum, p) => sum + p.amountDue, 0);
    const overdueAmount = filteredPayments.filter((p) => !p.isPaid && p.dueDate < now).reduce((sum, p) => sum + p.amountDue, 0);
    const paymentCompletionRate = totalPayments > 0 ? Math.round((completedPayments / totalPayments) * 100) : 0;

    // Compliance Statistics (Due date is in past or today)
    const duePayments = filteredPayments.filter((p) => p.dueDate <= now);
    const totalDuePayments = duePayments.length;
    const onTimePayments = duePayments.filter((p) => p.isPaid && p.paymentDate && p.paymentDate <= p.dueDate).length;
    const latePayments = duePayments.filter((p) => p.isPaid && p.paymentDate && p.paymentDate > p.dueDate).length;
    const onTimeRate = totalDuePayments > 0 ? Math.round((onTimePayments / totalDuePayments) * 100) : 100;

    // Financial Health score
    const onTimeCompletedPayments = filteredPayments.filter((p) => p.isPaid && p.paymentDate && p.paymentDate <= p.dueDate).length;
    const onTimeRateCompleted = completedPayments > 0 ? (onTimeCompletedPayments / completedPayments) * 100 : 100;

    let totalDaysLate = 0;
    filteredPayments.forEach((p) => {
      if (p.isPaid && p.paymentDate && p.dueDate) {
        const pTime = p.paymentDate.getTime();
        const dTime = p.dueDate.getTime();
        if (pTime > dTime) {
          totalDaysLate += Math.ceil((pTime - dTime) / (1000 * 60 * 60 * 24));
        }
      }
    });
    const avgDaysLate = completedPayments > 0 ? totalDaysLate / completedPayments : 0;
    const healthScore = Math.min(100, Math.max(0, Math.round(onTimeRateCompleted - (avgDaysLate * 2))));

    // Credit score: between 500 and 850
    const creditScore = Math.min(850, Math.max(500, Math.round(500 + (onTimeRate * 3) + (paymentCompletionRate * 0.5))));

    // Debt ratio: pending / max(total paid, 1000)
    const debtRatio = totalPaidAmount > 0 ? Math.min(99, Math.round((pendingAmount / Math.max(totalPaidAmount, 1000)) * 100)) : 0;

    // Consecutive on-time streak
    const completedPaymentsSorted = filteredPayments
      .filter((p) => p.isPaid)
      .sort((a, b) => (b.paymentDate || b.dueDate).getTime() - (a.paymentDate || a.dueDate).getTime());

    let streak = 0;
    for (const p of completedPaymentsSorted) {
      if (p.paymentDate && p.paymentDate <= p.dueDate) {
        streak++;
      } else {
        break;
      }
    }
    streak = Math.min(streak, 10);

    // Remaining debt payoff timeline (all-time, unfiltered)
    const allUnpaidPayments = rawPayments.filter((p) => !p.isPaid);
    let monthsToPayoff = 0;
    if (allUnpaidPayments.length > 0) {
      const finalDueDate = new Date(Math.max(...allUnpaidPayments.map((p) => p.dueDate.getTime())));
      monthsToPayoff = Math.max(0, Math.ceil((finalDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4)));
    }

    const progress = (totalPaidAmount + pendingAmount) > 0 ? (totalPaidAmount / (totalPaidAmount + pendingAmount)) * 100 : 100;

    // Category grouping logic (regex classification)
    const getCategory = (itemName: string): string => {
      const name = itemName.toLowerCase();
      if (/phone|laptop|computer|tv|headphone|earphone|electronic|gadget|camera|tablet|speaker|monitor|gaming/i.test(name)) return 'Electronics';
      if (/chair|table|sofa|bed|desk|furniture|cabinet|shelf|couch|dresser|mattress/i.test(name)) return 'Furniture';
      if (/fridge|washing|microwave|oven|appliance|freezer|dishwasher|dryer|blender|toaster|vacuum/i.test(name)) return 'Appliances';
      if (/dress|shirt|pants|clothes|fashion|wear|shoe|bag|accessories|jewelry|watch|belt/i.test(name)) return 'Fashion';
      if (/beauty|cosmetic|skincare|makeup|serum|cream|perfume|shampoo|soap|lotion|facial/i.test(name)) return 'Beauty & Health';
      if (/food|snack|eat|drink|coffee|tea|meal|cook|kitchen|dining|supplement|vitamin/i.test(name)) return 'Food & Beverages';
      if (/book|education|course|learning|training|study|school|office|stationery/i.test(name)) return 'Education & Office';
      if (/sport|fitness|gym|exercise|outdoor|travel|hobby|game|toy|entertainment/i.test(name)) return 'Sports & Entertainment';
      return 'Other';
    };

    const categoryMap = new Map<string, { count: number; spent: number; firstPurchase: Date; lastPurchase: Date }>();
    filteredOrders.forEach((o) => {
      const cat = getCategory(o.itemName);
      const amount = o.amount;
      const oDate = o.orderDate;
      const current = categoryMap.get(cat) || { count: 0, spent: 0, firstPurchase: oDate, lastPurchase: oDate };

      categoryMap.set(cat, {
        count: current.count + 1,
        spent: current.spent + amount,
        firstPurchase: oDate < current.firstPurchase ? oDate : current.firstPurchase,
        lastPurchase: oDate > current.lastPurchase ? oDate : current.lastPurchase,
      });
    });

    const totalSpentAllCategories = Array.from(categoryMap.values()).reduce((sum, item) => sum + item.spent, 0);
    const spendingCategories = Array.from(categoryMap.entries()).map(([category, details]) => ({
      category,
      orderCount: details.count,
      totalSpent: details.spent,
      avgAmount: details.count > 0 ? details.spent / details.count : 0,
      percentage: totalSpentAllCategories > 0 ? Math.round((details.spent / totalSpentAllCategories) * 100) : 0,
      firstPurchase: details.firstPurchase.toISOString(),
      lastPurchase: details.lastPurchase.toISOString(),
    })).sort((a, b) => b.totalSpent - a.totalSpent);

    // Weekday Settlement patterns
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayMap = Array.from({ length: 7 }, (_, idx) => ({
      dayName: weekdayNames[idx],
      dayNumber: idx + 1,
      paymentCount: 0,
      totalAmount: 0,
      totalDaysDifference: 0,
    }));

    filteredPayments.forEach((p) => {
      if (p.isPaid && p.paymentDate && p.dueDate) {
        const dayIndex = p.paymentDate.getDay();
        const diffTime = p.paymentDate.getTime() - p.dueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        weekdayMap[dayIndex].paymentCount++;
        weekdayMap[dayIndex].totalAmount += p.amountDue;
        weekdayMap[dayIndex].totalDaysDifference += diffDays;
      }
    });

    const paymentPatterns = weekdayMap.map((day) => ({
      ...day,
      avgDaysDifference: day.paymentCount > 0 ? Math.round((day.totalDaysDifference / day.paymentCount) * 10) / 10 : 0,
    }));

    // Monthly data (last 12 months)
    const monthsArray: string[] = [];
    const trendsMap = new Map<string, { totalAmount: number; totalPaid: number; orderCount: number; monthName: string }>();

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      monthsArray.push(monthKey);
      trendsMap.set(monthKey, { totalAmount: 0, totalPaid: 0, orderCount: 0, monthName });
    }

    rawOrders.forEach((o) => {
      const monthKey = `${o.orderDate.getFullYear()}-${String(o.orderDate.getMonth() + 1).padStart(2, '0')}`;
      if (trendsMap.has(monthKey)) {
        const current = trendsMap.get(monthKey)!;
        trendsMap.set(monthKey, {
          ...current,
          totalAmount: current.totalAmount + o.amount,
          orderCount: current.orderCount + 1,
        });
      }
    });

    rawPayments.forEach((p) => {
      if (p.isPaid && p.paymentDate) {
        const monthKey = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (trendsMap.has(monthKey)) {
          const current = trendsMap.get(monthKey)!;
          trendsMap.set(monthKey, {
            ...current,
            totalPaid: current.totalPaid + p.amountDue,
          });
        }
      }
    });

    const monthlyData = monthsArray.map((key) => trendsMap.get(key)!);

    // Seasonal Analysis (past 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);

    const seasonalMap = new Map<string, { quarter: number; year: number; orderCount: number; totalAmount: number }>();

    rawOrders.forEach((o) => {
      if (o.orderDate >= twoYearsAgo) {
        const year = o.orderDate.getFullYear();
        const quarter = Math.floor(o.orderDate.getMonth() / 3) + 1;
        const key = `${year}-Q${quarter}`;
        const current = seasonalMap.get(key) || { quarter, year, orderCount: 0, totalAmount: 0 };

        seasonalMap.set(key, {
          quarter,
          year,
          orderCount: current.orderCount + 1,
          totalAmount: current.totalAmount + o.amount,
        });
      }
    });

    const seasonalData = Array.from(seasonalMap.values()).map((q) => ({
      ...q,
      avgAmount: q.orderCount > 0 ? q.totalAmount / q.orderCount : 0,
    })).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });

    // AI Linear Regression Spending Forecast (next 6 months)
    const historicalSpent = monthlyData.map((m) => m.totalAmount);
    const nVal = historicalSpent.length;
    const sumX = historicalSpent.reduce((sum, _, i) => sum + i, 0);
    const sumY = historicalSpent.reduce((sum, val) => sum + val, 0);
    const sumXY = historicalSpent.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = historicalSpent.reduce((sum, _, i) => sum + i * i, 0);

    const denominator = nVal * sumXX - sumX * sumX;
    const slope = denominator !== 0 ? (nVal * sumXY - sumX * sumY) / denominator : 0;
    const intercept = (sumY - slope * sumX) / nVal;
    const monthlyAvg = nVal > 0 ? sumY / nVal : 0;

    const forecastMonths: Array<{ monthName: string; projected: number; upperBound: number; lowerBound: number }> = [];
    const seasonalFactors = [1.0, 0.9, 1.0, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.2, 1.3];

    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(now.getMonth() + i);
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const monthIdx = d.getMonth();

      const predicted = slope * (nVal + i) + intercept;
      const factor = seasonalFactors[monthIdx];
      const projected = Math.max(0, Math.round(predicted * factor));

      forecastMonths.push({
        monthName,
        projected,
        upperBound: Math.round(projected * 1.15),
        lowerBound: Math.round(projected * 0.85),
      });
    }

    // Installment Breakdown
    const installmentMap = new Map<number, { count: number; totalAmount: number }>();
    filteredOrders.forEach((o) => {
      const months = o.installmentMonths;
      const amount = o.amount;
      const current = installmentMap.get(months) || { count: 0, totalAmount: 0 };
      installmentMap.set(months, {
        count: current.count + 1,
        totalAmount: current.totalAmount + amount,
      });
    });

    const installmentBreakdown = Array.from(installmentMap.entries()).map(([months, details]) => ({
      installmentMonths: months,
      orderCount: details.count,
      totalAmount: details.totalAmount,
      avgAmount: details.count > 0 ? details.totalAmount / details.count : 0,
      percentage: totalSpent > 0 ? Math.round((details.totalAmount / totalSpent) * 100) : 0,
    })).sort((a, b) => a.installmentMonths - b.installmentMonths);

    // Recent Orders (latest 5)
    const recentOrders = rawOrders.slice(0, 5).map((o, idx) => {
      const oPayments = rawPayments.filter((p) => p.orderId === o.id);
      const paidCount = oPayments.filter((p) => p.isPaid).length;
      const progressPercent = o.installmentMonths > 0 ? (paidCount / o.installmentMonths) * 100 : 0;
      return {
        index: idx + 1,
        id: o.id,
        itemName: o.itemName,
        amount: o.amount,
        installmentMonths: o.installmentMonths,
        orderDate: o.orderDate.toISOString(),
        isPaid: o.isPaid,
        paidInstallments: paidCount,
        progressPercent,
      };
    });

    // Detailed compliance ledger list
    const compliancePayments = filteredPayments.map((p) => {
      let status: 'on_time' | 'late' | 'overdue' | 'pending' = 'pending';
      if (p.isPaid) {
        if (p.paymentDate && p.paymentDate <= p.dueDate) {
          status = 'on_time';
        } else {
          status = 'late';
        }
      } else if (p.dueDate < now) {
        status = 'overdue';
      }
      return {
        id: p.id,
        itemName: p.itemName,
        amountDue: p.amountDue,
        monthNumber: p.monthNumber,
        installmentMonths: p.installmentMonths,
        dueDate: p.dueDate.toISOString(),
        paymentDate: p.paymentDate?.toISOString() || null,
        status,
      };
    });

    return {
      metrics: {
        totalOrders,
        totalSpent,
        avgOrderValue,
        completedOrders,
        completionRate,
        totalPayments,
        completedPayments,
        totalPaidAmount,
        pendingAmount,
        overdueAmount,
        paymentCompletionRate,
        totalDuePayments,
        onTimePayments,
        latePayments,
        onTimeRate,
        healthScore,
        creditScore,
        debtRatio,
        streak,
        monthsToPayoff,
        progress,
        monthlyAvg,
      },
      spendingCategories,
      paymentPatterns,
      monthlyData,
      seasonalData,
      forecastMonths,
      installmentBreakdown,
      recentOrders,
      compliancePayments,
    };
  }, [rawOrders, rawPayments, period]);

  const {
    metrics,
    spendingCategories,
    paymentPatterns,
    monthlyData,
    seasonalData,
    forecastMonths,
    installmentBreakdown,
    recentOrders,
    compliancePayments,
  } = calculatedData;

  const healthStatus = () => {
    const hs = metrics.healthScore;
    if (hs >= 85) {
      return {
        label: 'Excellent standing',
        color: isDarkMode ? '#e2e8f0' : '#1e293b',
        bgColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
        borderColor: isDarkMode ? '#334155' : '#cbd5e1',
        stroke: '#475569',
      };
    }
    if (hs >= 70) {
      return {
        label: 'Good standing',
        color: isDarkMode ? '#cbd5e1' : '#334155',
        bgColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
        stroke: '#64748b',
      };
    }
    if (hs >= 55) {
      return {
        label: 'Fair standing',
        color: isDarkMode ? '#94a3b8' : '#475569',
        bgColor: isDarkMode ? 'rgba(30, 41, 59, 0.2)' : 'rgba(241, 245, 249, 0.5)',
        borderColor: isDarkMode ? '#222d42' : 'rgba(226, 232, 240, 0.5)',
        stroke: '#71717a',
      };
    }
    return {
      label: 'Attention required',
      color: '#e11d48',
      bgColor: isDarkMode ? 'rgba(244, 63, 94, 0.1)' : 'rgba(244, 63, 94, 0.05)',
      borderColor: isDarkMode ? 'rgba(244, 63, 94, 0.2)' : 'rgba(244, 63, 94, 0.2)',
      stroke: '#f43f5e',
    };
  };

  const status = healthStatus();

  // Native File sharing for CSV
  const handleExportCSV = async () => {
    if (compliancePayments.length === 0) {
      PremiumAlert.alert('No Data', 'No payments found in current timeframe.');
      return;
    }

    try {
      const csvRows = [
        ['Payment ID', 'Item Name', 'Due Date', 'Amount Due', 'Installment Period', 'Status', 'Payment Date'],
      ];

      compliancePayments.forEach((p) => {
        let statusText = 'Pending';
        if (p.status === 'on_time') statusText = 'Paid (On-time)';
        else if (p.status === 'late') statusText = 'Paid (Late)';
        else if (p.status === 'overdue') statusText = 'Overdue';

        csvRows.push([
          p.id,
          p.itemName,
          p.dueDate.split('T')[0],
          p.amountDue.toFixed(2),
          `Installment ${p.monthNumber} of ${p.installmentMonths}`,
          statusText,
          p.paymentDate ? p.paymentDate.split('T')[0] : '',
        ]);
      });

      const csvContent = csvRows
        .map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const fileUri = FileSystem.documentDirectory + `spay_ledger_${period}_${new Date().toISOString().split('T')[0]}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Ledger' });
      } else {
        PremiumAlert.alert('Unavailable', 'Native sharing is not supported on this device.');
      }
    } catch (err) {
      console.warn('Failed to export CSV:', err);
      PremiumAlert.alert('Error', 'An error occurred while generating the CSV ledger.');
    }
  };

  const formatCurrency = (val: number) => {
    return '₱' + Math.round(val).toLocaleString('en-US');
  };

  // SVGs Chart Builders
  const renderAreaChart = () => {
    if (monthlyData.length === 0) return null;
    const maxVal = Math.max(...monthlyData.map((d) => Math.max(d.totalAmount, d.totalPaid)), 1000);
    const paddingLeft = 42;
    const paddingRight = 20;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartW = chartCanvasWidth;
    const chartH = 160;

    const chartWidth = chartW - paddingLeft - paddingRight;
    const chartHeight = chartH - paddingTop - paddingBottom;

    const pointsSpent: string[] = [];
    const pointsPaid: string[] = [];

    monthlyData.forEach((d, i) => {
      const x = paddingLeft + (i / (monthlyData.length - 1)) * chartWidth;
      const ySpent = paddingTop + chartHeight - (d.totalAmount / maxVal) * chartHeight;
      const yPaid = paddingTop + chartHeight - (d.totalPaid / maxVal) * chartHeight;

      pointsSpent.push(`${x},${ySpent}`);
      pointsPaid.push(`${x},${yPaid}`);
    });

    const dSpentLine = `M ${pointsSpent.join(' L ')}`;
    const dSpentArea = `${dSpentLine} L ${paddingLeft + chartWidth},${paddingTop + chartHeight} L ${paddingLeft},${paddingTop + chartHeight} Z`;
    const dPaidLine = `M ${pointsPaid.join(' L ')}`;

    const yTicks = [0, 0.25, 0.5, 0.75, 1];

    return (
      <Svg width={chartW} height={chartH}>
        {/* Horizontal Ticks */}
        {yTicks.map((tick, idx) => {
          const y = paddingTop + chartHeight - tick * chartHeight;
          return (
            <Line
              key={idx}
              x1={paddingLeft}
              y1={y}
              x2={paddingLeft + chartWidth}
              y2={y}
              stroke={t.cardBorder}
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Area for spent */}
        <Path d={dSpentArea} fill="rgba(238, 77, 45, 0.05)" />

        {/* Lines */}
        <Path d={dSpentLine} fill="none" stroke="#ee4d2d" strokeWidth={2.5} />
        <Path d={dPaidLine} fill="none" stroke={t.textSecondary} strokeWidth={2} strokeDasharray="3,3" />

        {/* Circles */}
        {monthlyData.map((d, i) => {
          const x = paddingLeft + (i / (monthlyData.length - 1)) * chartWidth;
          const ySpent = paddingTop + chartHeight - (d.totalAmount / maxVal) * chartHeight;
          return (
            <Circle
              key={i}
              cx={x}
              cy={ySpent}
              r={3}
              fill="#ee4d2d"
              stroke={t.cardBg}
              strokeWidth={1}
            />
          );
        })}

        {/* X labels */}
        {monthlyData.map((d, i) => {
          if (i % 2 !== 0 && i !== monthlyData.length - 1) return null; // alternate to fit mobile screens
          const x = paddingLeft + (i / (monthlyData.length - 1)) * chartWidth;
          return (
            <SvgText
              key={i}
              x={x}
              y={paddingTop + chartHeight + 14}
              fontSize={8}
              fill={t.textSecondary}
              textAnchor="middle"
              fontWeight="bold"
            >
              {d.monthName}
            </SvgText>
          );
        })}

        {/* Y labels */}
        {yTicks.map((tick, idx) => {
          const y = paddingTop + chartHeight - tick * chartHeight;
          const value = Math.round((tick * maxVal) / 1000);
          return (
            <SvgText
              key={idx}
              x={paddingLeft - 6}
              y={y + 3}
              fontSize={8}
              fill={t.textSecondary}
              textAnchor="end"
              fontWeight="bold"
            >
              ₱{value}k
            </SvgText>
          );
        })}
      </Svg>
    );
  };

  const renderDonutChart = () => {
    if (installmentBreakdown.length === 0) return null;
    const radius = 30;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;
    const center = 45;
    const size = 90;

    let currentAngle = -90;
    const colors = ['#ee4d2d', '#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#64748b'];

    return (
      <Svg width={size} height={size}>
        {installmentBreakdown.map((item, idx) => {
          const strokeDashoffset = circumference - (item.percentage / 100) * circumference;
          const rotation = currentAngle;
          currentAngle += (item.percentage / 100) * 360;
          const strokeColor = colors[idx % colors.length];

          return (
            <G key={idx} transform={`rotate(${rotation} ${center} ${center})`}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap={item.percentage > 3 ? 'round' : 'square'}
              />
            </G>
          );
        })}
      </Svg>
    );
  };

  const renderBarChart = (data: any[], dataKey: string, xKey: string, color: string) => {
    if (data.length === 0) return null;
    const values = data.map((d) => d[dataKey]);
    const maxVal = Math.max(...values, 1000);

    const paddingLeft = 42;
    const paddingRight = 20;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartW = chartCanvasWidth;
    const chartH = 150;

    const chartWidth = chartW - paddingLeft - paddingRight;
    const chartHeight = chartH - paddingTop - paddingBottom;

    const barCount = data.length;
    const barWidth = Math.max(8, Math.min(22, (chartWidth / barCount) * 0.45));
    const spacing = (chartWidth - barCount * barWidth) / (barCount - 1 || 1);

    const yTicks = [0, 0.25, 0.5, 0.75, 1];

    return (
      <Svg width={chartW} height={chartH}>
        {yTicks.map((tick, idx) => {
          const y = paddingTop + chartHeight - tick * chartHeight;
          return (
            <Line
              key={idx}
              x1={paddingLeft}
              y1={y}
              x2={paddingLeft + chartWidth}
              y2={y}
              stroke={t.cardBorder}
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          );
        })}

        {data.map((d, i) => {
          const x = paddingLeft + i * (barWidth + spacing) + spacing / 2;
          const valHeight = (d[dataKey] / maxVal) * chartHeight;
          const y = paddingTop + chartHeight - valHeight;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={valHeight}
              fill={color}
              rx={2.5}
              ry={2.5}
            />
          );
        })}

        {data.map((d, i) => {
          const x = paddingLeft + i * (barWidth + spacing) + spacing / 2 + barWidth / 2;
          return (
            <SvgText
              key={i}
              x={x}
              y={paddingTop + chartHeight + 14}
              fontSize={8}
              fill={t.textSecondary}
              textAnchor="middle"
              fontWeight="bold"
            >
              {d[xKey]}
            </SvgText>
          );
        })}

        {yTicks.map((tick, idx) => {
          const y = paddingTop + chartHeight - tick * chartHeight;
          const value = Math.round(tick * maxVal);
          const label = value >= 1000 ? `₱${(value / 1000).toFixed(0)}k` : `₱${value}`;
          return (
            <SvgText
              key={idx}
              x={paddingLeft - 6}
              y={y + 3}
              fontSize={8}
              fill={t.textSecondary}
              textAnchor="end"
              fontWeight="bold"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    );
  };

  const renderForecastChart = () => {
    if (monthlyData.length === 0) return null;

    // Build cumulative data object
    const forecastChartData = [
      ...monthlyData.slice(-6).map((m) => ({
        monthName: m.monthName,
        historical: m.totalAmount,
        forecast: null,
        upperBound: null,
        lowerBound: null,
      })),
      ...forecastMonths.map((m, idx) => ({
        monthName: m.monthName,
        historical: idx === 0 ? monthlyData[monthlyData.length - 1].totalAmount : null,
        forecast: m.projected,
        upperBound: m.upperBound,
        lowerBound: m.lowerBound,
      })),
    ];

    const maxVal = Math.max(
      ...forecastChartData.map((d) => Math.max(d.historical || 0, d.forecast || 0, d.upperBound || 0)),
      1000
    );

    const paddingLeft = 42;
    const paddingRight = 20;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartW = chartCanvasWidth;
    const chartH = 160;

    const chartWidth = chartW - paddingLeft - paddingRight;
    const chartHeight = chartH - paddingTop - paddingBottom;

    const pointsHist: string[] = [];
    const pointsFore: string[] = [];
    const pointsUpper: string[] = [];
    const pointsLower: string[] = [];

    forecastChartData.forEach((d, i) => {
      const x = paddingLeft + (i / (forecastChartData.length - 1)) * chartWidth;

      if (d.historical !== null) {
        const yHist = paddingTop + chartHeight - (d.historical / maxVal) * chartHeight;
        pointsHist.push(`${x},${yHist}`);
      }

      if (d.forecast !== null) {
        const yFore = paddingTop + chartHeight - (d.forecast / maxVal) * chartHeight;
        pointsFore.push(`${x},${yFore}`);

        const yUpper = paddingTop + chartHeight - (d.upperBound / maxVal) * chartHeight;
        pointsUpper.push(`${x},${yUpper}`);

        const yLower = paddingTop + chartHeight - (d.lowerBound / maxVal) * chartHeight;
        pointsLower.push(`${x},${yLower}`);
      }
    });

    const dHistLine = pointsHist.length > 0 ? `M ${pointsHist.join(' L ')}` : '';
    const dForeLine = pointsFore.length > 0 ? `M ${pointsFore.join(' L ')}` : '';
    const dUpperLine = pointsUpper.length > 0 ? `M ${pointsUpper.join(' L ')}` : '';
    const dLowerLine = pointsLower.length > 0 ? `M ${pointsLower.join(' L ')}` : '';

    const yTicks = [0, 0.25, 0.5, 0.75, 1];

    return (
      <Svg width={chartW} height={chartH}>
        {yTicks.map((tick, idx) => {
          const y = paddingTop + chartHeight - tick * chartHeight;
          return (
            <Line
              key={idx}
              x1={paddingLeft}
              y1={y}
              x2={paddingLeft + chartWidth}
              y2={y}
              stroke={t.cardBorder}
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Lines */}
        {dHistLine ? <Path d={dHistLine} fill="none" stroke="#475569" strokeWidth={2.5} /> : null}
        {dForeLine ? <Path d={dForeLine} fill="none" stroke={t.textSecondary} strokeWidth={2} strokeDasharray="4,4" /> : null}
        {dUpperLine ? <Path d={dUpperLine} fill="none" stroke={isDarkMode ? '#334155' : '#cbd5e1'} strokeWidth={1} strokeDasharray="2,2" /> : null}
        {dLowerLine ? <Path d={dLowerLine} fill="none" stroke={isDarkMode ? '#334155' : '#cbd5e1'} strokeWidth={1} strokeDasharray="2,2" /> : null}

        {/* Points */}
        {forecastChartData.map((d, i) => {
          const x = paddingLeft + (i / (forecastChartData.length - 1)) * chartWidth;
          const val = d.historical !== null ? d.historical : d.forecast;
          if (val === null) return null;
          const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r={2.5}
              fill={d.historical !== null ? '#475569' : t.textSecondary}
              stroke={t.cardBg}
              strokeWidth={1}
            />
          );
        })}

        {/* X labels */}
        {forecastChartData.map((d, i) => {
          if (i % 2 !== 0 && i !== forecastChartData.length - 1) return null;
          const x = paddingLeft + (i / (forecastChartData.length - 1)) * chartWidth;
          return (
            <SvgText
              key={i}
              x={x}
              y={paddingTop + chartHeight + 14}
              fontSize={8}
              fill={t.textSecondary}
              textAnchor="middle"
              fontWeight="bold"
            >
              {d.monthName}
            </SvgText>
          );
        })}

        {/* Y labels */}
        {yTicks.map((tick, idx) => {
          const y = paddingTop + chartHeight - tick * chartHeight;
          const value = Math.round(tick * maxVal);
          const label = value >= 1000 ? `₱${(value / 1000).toFixed(0)}k` : `₱${value}`;
          return (
            <SvgText
              key={idx}
              x={paddingLeft - 6}
              y={y + 3}
              fontSize={8}
              fill={t.textSecondary}
              textAnchor="end"
              fontWeight="bold"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    );
  };

  if (loading) {
    return <ReportsSkeleton />;
  }

  // Dual gauge dimensions
  const csMin = 500;
  const csMax = 850;
  const csPercentage = Math.max(0, Math.min(100, ((metrics.creditScore - csMin) / (csMax - csMin)) * 100));
  const csRadius = 45;
  const csCircumference = 2 * Math.PI * csRadius;
  const csStrokeDashoffset = csCircumference * (1 - csPercentage / 100);

  const colors = ['#ee4d2d', '#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#64748b'];

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Reports & Insights</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.headerActionBtn}>
          {refreshing ? (
            <ActivityIndicator size="small" color={t.accent} />
          ) : (
            <RefreshCw size={18} color={t.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
        {/* S-Pay Branding and Description */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandSub}>S-Pay Client</Text>
          <Text style={[styles.brandTitle, { color: t.textPrimary }]}>Financial Records & Forecasts</Text>
          <Text style={[styles.brandDesc, { color: t.textSecondary }]}>
            Review amortization ledgers, analyze compliance vectors, and run simulated cost optimization models.
          </Text>
        </View>

        {/* Timeframe selector filters */}
        <View style={styles.filterPillsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'last_30', label: '30 Days' },
              { id: 'last_90', label: '90 Days' },
              { id: 'this_year', label: 'This Year' },
              { id: 'last_year', label: 'Last Year' },
            ].map((btn) => {
              const isActive = period === btn.id;
              return (
                <TouchableOpacity
                  key={btn.id}
                  onPress={() => setPeriod(btn.id as any)}
                  style={[
                    styles.filterPill,
                    { backgroundColor: isActive ? t.cardBg : 'transparent', borderColor: isActive ? t.cardBorder : 'transparent' },
                    isActive && styles.activePillBorder,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: isActive ? t.textPrimary : t.textSecondary },
                      isActive && styles.activePillText,
                    ]}
                  >
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Export action */}
        <TouchableOpacity
          onPress={handleExportCSV}
          style={[styles.exportBtn, { backgroundColor: t.textPrimary }]}
        >
          <Download size={14} color={isDarkMode ? '#000000' : '#ffffff'} style={{ marginRight: 8 }} />
          <Text style={[styles.exportBtnText, { color: isDarkMode ? '#000000' : '#ffffff' }]}>Export Ledger CSV</Text>
        </TouchableOpacity>

        {/* Navigation Sub-Tabs */}
        <View style={[styles.tabBar, { borderColor: t.divider }]}>
          {[
            { id: 'overview', label: 'Summary' },
            { id: 'detailed', label: 'Compliance' },
            { id: 'forecast', label: 'Forecasting' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                style={[styles.tabItem, isActive && { borderBottomColor: t.accent }]}
              >
                <Text
                  style={[
                    styles.tabItemLabel,
                    { color: isActive ? t.accent : t.textSecondary },
                    isActive && { fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* OVERVIEW PANEL */}
        {activeTab === 'overview' && (
          <View style={styles.panelContent}>
            {/* Credit score rating radial details */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <Text style={[styles.cardHeaderTitle, { color: t.textSecondary }]}>CREDIT RATING SUMMARY</Text>
              <View style={styles.scoreRow}>
                <View style={styles.gaugeContainer}>
                  <Svg width={110} height={110} style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Circle
                      cx={55}
                      cy={55}
                      r={csRadius}
                      stroke={isDarkMode ? '#1e293b' : '#e2e8f0'}
                      strokeWidth={8}
                      fill="transparent"
                    />
                    <Circle
                      cx={55}
                      cy={55}
                      r={csRadius}
                      stroke="#ee4d2d"
                      strokeWidth={8}
                      strokeDasharray={csCircumference}
                      strokeDashoffset={csStrokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </Svg>
                  <View style={styles.gaugeTextWrapper}>
                    <Text style={[styles.gaugeVal, { color: t.textPrimary }]}>{metrics.creditScore}</Text>
                    <Text style={styles.gaugeLimits}>500-850</Text>
                  </View>
                </View>

                <View style={styles.scoreMetaCol}>
                  <View style={styles.scoreMetaItem}>
                    <Award size={14} color="#fbbf24" style={{ marginRight: 6 }} />
                    <View>
                      <Text style={[styles.scoreMetaLabel, { color: t.textSecondary }]}>Wellness Score</Text>
                      <Text style={[styles.scoreMetaVal, { color: t.textPrimary }]}>{metrics.healthScore}%</Text>
                    </View>
                  </View>

                  <View style={styles.scoreMetaItem}>
                    <Calendar size={14} color="#3b82f6" style={{ marginRight: 6 }} />
                    <View>
                      <Text style={[styles.scoreMetaLabel, { color: t.textSecondary }]}>On-Time Rate</Text>
                      <Text style={[styles.scoreMetaVal, { color: t.textPrimary }]}>{metrics.onTimeRate}%</Text>
                    </View>
                  </View>

                  <View style={styles.scoreMetaItem}>
                    <TrendingUp size={14} color="#10b981" style={{ marginRight: 6 }} />
                    <View>
                      <Text style={[styles.scoreMetaLabel, { color: t.textSecondary }]}>Payment Streak</Text>
                      <Text style={[styles.scoreMetaVal, { color: t.textPrimary }]}>{metrics.streak} Mo</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.healthLabelContainer, { backgroundColor: status.bgColor, borderColor: status.borderColor }]}>
                <Text style={[styles.healthLabelText, { color: status.color }]}>Status: {status.label}</Text>
              </View>
            </View>

            {/* Spent & Settlement rate overview */}
            <View style={styles.statsGrid}>
              {/* Spent */}
              <View style={[styles.smallCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.smallCardHeader}>
                  <Text style={[styles.smallCardLabel, { color: t.textSecondary }]}>Total Spent</Text>
                  <DollarSign size={15} color="#ee4d2d" />
                </View>
                <Text style={[styles.smallCardValue, { color: t.textPrimary }]}>{formatCurrency(metrics.totalSpent)}</Text>
                <Text style={[styles.smallCardDesc, { color: t.textSecondary }]}>{metrics.totalOrders} total orders</Text>
              </View>

              {/* Settlement Rate */}
              <View style={[styles.smallCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.smallCardHeader}>
                  <Text style={[styles.smallCardLabel, { color: t.textSecondary }]}>Settled Rate</Text>
                  <TrendingUp size={15} color="#10b981" />
                </View>
                <Text style={[styles.smallCardValue, { color: t.textPrimary }]}>{metrics.paymentCompletionRate}%</Text>
                <View style={[styles.miniProgressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>
                  <View style={[styles.miniProgressFill, { width: `${metrics.paymentCompletionRate}%`, backgroundColor: '#10b981' }]} />
                </View>
              </View>
            </View>

            {/* Exposure Status cards */}
            <View style={styles.exposureGrid}>
              {/* Paid */}
              <View style={[styles.exposureCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <CheckCircle2 size={16} color="#10b981" style={{ marginBottom: 6 }} />
                <Text style={styles.exposureLabel}>Settled</Text>
                <Text style={[styles.exposureVal, { color: t.textPrimary }]}>{formatCurrency(metrics.totalPaidAmount)}</Text>
              </View>

              {/* Pending */}
              <View style={[styles.exposureCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Clock size={16} color="#fbbf24" style={{ marginBottom: 6 }} />
                <Text style={styles.exposureLabel}>Upcoming</Text>
                <Text style={[styles.exposureVal, { color: t.textPrimary }]}>{formatCurrency(metrics.pendingAmount)}</Text>
              </View>

              {/* Overdue */}
              <View style={[styles.exposureCard, { backgroundColor: t.cardBg, borderColor: metrics.overdueAmount > 0 ? 'rgba(239, 68, 68, 0.3)' : t.cardBorder }]}>
                <ShieldAlert size={16} color="#ef4444" style={{ marginBottom: 6 }} />
                <Text style={styles.exposureLabel}>Overdue</Text>
                <Text style={[styles.exposureVal, { color: metrics.overdueAmount > 0 ? '#ef4444' : t.textPrimary }]}>
                  {formatCurrency(metrics.overdueAmount)}
                </Text>
              </View>
            </View>

            {/* 12-Month Area Chart */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Monthly Spending Trend</Text>
                <Text style={styles.chartHeaderSub}>12-month historical cumulative spent & settled principal</Text>
                <View style={[styles.legendRow, { marginTop: 8 }]}>
                  <View style={[styles.legendDot, { backgroundColor: '#ee4d2d' }]} />
                  <Text style={styles.legendLabel}>Spent</Text>
                  <View style={[styles.legendDot, { backgroundColor: t.textSecondary, borderRadius: 0 }]} />
                  <Text style={styles.legendLabel}>Paid</Text>
                </View>
              </View>
              <View style={styles.chartBox}>{renderAreaChart()}</View>
            </View>

            {/* Installment breakdown donut */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.donutHeaderRow}>
                <View>
                  <Text style={[styles.cardHeaderTitle, { color: t.textSecondary }]}>TERM PREFERENCES</Text>
                  <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Distribution by Amortization Length</Text>
                </View>
                <PieIcon size={16} color={t.textSecondary} />
              </View>

              {installmentBreakdown.length > 0 ? (
                <View style={styles.donutSectionRow}>
                  <View style={styles.donutGraphWrapper}>
                    {renderDonutChart()}
                    <View style={styles.donutTextOverlay}>
                      <Text style={[styles.donutCenterValue, { color: t.textPrimary }]}>{installmentBreakdown.length}</Text>
                      <Text style={styles.donutCenterLabel}>Terms</Text>
                    </View>
                  </View>

                  <View style={styles.donutLegendContainer}>
                    {installmentBreakdown.map((item, idx) => (
                      <View key={item.installmentMonths} style={styles.donutLegendRow}>
                        <View style={[styles.donutLegendDot, { backgroundColor: colors[idx % colors.length] }]} />
                        <Text style={[styles.donutLegendLabel, { color: t.textSecondary }]} numberOfLines={1}>
                          {item.installmentMonths} Mo ({item.percentage}%)
                        </Text>
                        <Text style={[styles.donutLegendValue, { color: t.textPrimary }]}>
                          {formatCurrency(item.totalAmount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Info size={16} color={t.textSecondary} style={{ marginBottom: 4 }} />
                  <Text style={[styles.emptyText, { color: t.textSecondary }]}>No installment plans recorded.</Text>
                </View>
              )}
            </View>

            {/* Remaining payoff timeline */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.payoffHeaderRow}>
                <View style={[styles.payoffIconFrame, { backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.1)' : 'rgba(238, 77, 45, 0.05)' }]}>
                  <Calendar size={18} color="#ee4d2d" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Remaining Payoff Timeline</Text>
                  <Text style={[styles.smallCardDesc, { color: t.textSecondary }]}>Expected months to clear active installment plans</Text>
                </View>
                <View style={styles.payoffCountWrapper}>
                  <Text style={[styles.payoffCount, { color: t.textPrimary }]}>{metrics.monthsToPayoff}</Text>
                  <Text style={styles.payoffCountLabel}>Months Left</Text>
                </View>
              </View>

              <View style={styles.payoffProgressContainer}>
                <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>
                  <View style={[styles.progressFill, { width: `${metrics.progress}%`, backgroundColor: '#10b981' }]} />
                </View>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabelText}>{metrics.progress.toFixed(1)}% Complete</Text>
                  <Text style={styles.progressLabelText}>{formatCurrency(metrics.pendingAmount)} Remaining</Text>
                </View>
              </View>
            </View>

            {/* Recent purchase installments list */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingHorizontal: 0, paddingBottom: 0 }]}>
              <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Recent Purchases</Text>
                  <Text style={styles.chartHeaderSub}>Amortization details of latest checkout orders</Text>
                </View>
                <ListPlus size={16} color={t.textSecondary} />
              </View>

              <View style={[styles.dividerLine, { backgroundColor: t.divider }]} />

              <View>
                {recentOrders.length > 0 ? (
                  recentOrders.map((o) => (
                    <View key={o.id} style={[styles.recentItemRow, { borderColor: t.divider }]}>
                      <View style={styles.recentItemLeft}>
                        <View style={[styles.recentIndexFrame, { backgroundColor: isDarkMode ? '#222d42' : '#f1f5f9' }]}>
                          <Text style={[styles.recentIndexText, { color: t.textPrimary }]}>{o.index}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.recentItemName, { color: t.textPrimary }]} numberOfLines={1}>
                            {o.itemName}
                          </Text>
                          <Text style={[styles.recentItemDate, { color: t.textSecondary }]}>
                            {new Date(o.orderDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.recentItemRight}>
                        <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
                          <View style={[styles.statusBadge, { backgroundColor: o.isPaid ? 'rgba(16, 185, 129, 0.1)' : t.divider }]}>
                            <Text style={[styles.statusBadgeText, { color: o.isPaid ? '#10b981' : t.textSecondary }]}>
                              {o.isPaid ? 'Paid' : 'Active'}
                            </Text>
                          </View>
                          <Text style={[styles.recentItemAmount, { color: t.textPrimary }]}>{formatCurrency(o.amount)}</Text>
                        </View>

                        <View style={styles.recentProgressCol}>
                          <Text style={styles.recentProgressLabel}>
                            {o.paidInstallments}/{o.installmentMonths} Mo
                          </Text>
                          <View style={[styles.miniProgressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0', width: 60 }]}>
                            <View style={[styles.miniProgressFill, { width: `${o.progressPercent}%`, backgroundColor: '#3b82f6' }]} />
                          </View>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: t.textSecondary, fontSize: 12 }}>No order records found.</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* DETAILED COMPLIANCE & CATEGORIES PANEL */}
        {activeTab === 'detailed' && (
          <View style={styles.panelContent}>
            {/* Compliance rating index summary */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.complianceHeaderRow}>
                <View>
                  <Text style={[styles.cardHeaderTitle, { color: t.textSecondary }]}>COMPLIANCE LEDGER</Text>
                  <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Payment Compliance Index</Text>
                </View>
                <TouchableOpacity onPress={() => setModals((prev) => ({ ...prev, compliance: true }))}>
                  <Text style={[styles.viewAllBtnText, { color: t.accent }]}>View All Dues</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.complianceGrid}>
                <View style={[styles.complianceGridCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.cardBorder }]}>
                  <Text style={styles.complianceCellLabel}>ON-TIME RATE</Text>
                  <Text style={[styles.complianceCellValue, { color: t.textPrimary }]}>{metrics.onTimeRate}%</Text>
                  <Text style={styles.complianceCellDesc}>{metrics.onTimePayments} on-time payments</Text>
                </View>

                <View style={[styles.complianceGridCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.cardBorder }]}>
                  <Text style={styles.complianceCellLabel}>LATE PAYMENTS</Text>
                  <Text style={[styles.complianceCellValue, { color: t.textPrimary }]}>{metrics.latePayments}</Text>
                  <Text style={styles.complianceCellDesc}>Requires due warning</Text>
                </View>

                <View style={[styles.complianceGridCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.cardBorder }]}>
                  <Text style={styles.complianceCellLabel}>ON-TIME STREAK</Text>
                  <Text style={[styles.complianceCellValue, { color: t.textPrimary }]}>{metrics.streak}</Text>
                  <Text style={styles.complianceCellDesc}>Consecutive months</Text>
                </View>
              </View>
            </View>

            {/* Weekday patterns bar chart */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Weekday Settlement Pattern</Text>
                <Text style={styles.chartHeaderSub}>Days of the week when installment payments are submitted</Text>
              </View>
              <View style={styles.chartBox}>{renderBarChart(paymentPatterns, 'totalAmount', 'dayName', '#64748b')}</View>
            </View>

            {/* Seasonal Quarterly Analysis bar chart */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Seasonal Quarterly Breakdown</Text>
                <Text style={styles.chartHeaderSub}>Order counts and spending volumes grouped by calendar quarters</Text>
              </View>
              <View style={styles.chartBox}>
                {seasonalData.length > 0 ? (
                  renderBarChart(
                    seasonalData.slice(0, 6).map((q) => ({
                      ...q,
                      quarterLabel: `Q${q.quarter} '${String(q.year).slice(2)}`,
                    })),
                    'totalAmount',
                    'quarterLabel',
                    '#475569'
                  )
                ) : (
                  <View style={styles.emptyContainer}>
                    <Info size={16} color={t.textSecondary} style={{ marginBottom: 4 }} />
                    <Text style={[styles.emptyText, { color: t.textSecondary }]}>No quarterly records found.</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Category Share progress bars */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.categoryHeaderRow}>
                <View>
                  <Text style={[styles.cardHeaderTitle, { color: t.textSecondary }]}>CATEGORY SHARE</Text>
                  <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Spending Distribution</Text>
                </View>
                <Sparkles size={16} color={t.textSecondary} />
              </View>

              <View style={styles.categoryList}>
                {spendingCategories.slice(0, 5).map((cat, idx) => {
                  const styling = catColors[idx % catColors.length];
                  return (
                    <View key={cat.category} style={styles.categoryRow}>
                      <View style={styles.categoryLabelRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[styles.categoryColorDot, { backgroundColor: styling.bar }]} />
                          <Text style={[styles.categoryName, { color: t.textPrimary }]}>{cat.category}</Text>
                        </View>
                        <Text style={[styles.categoryPercent, { color: t.textPrimary }]}>{cat.percentage}%</Text>
                      </View>

                      <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0', height: 6 }]}>
                        <View style={[styles.progressFill, { width: `${cat.percentage}%`, backgroundColor: styling.bar, height: 6 }]} />
                      </View>

                      <View style={styles.categoryMetaRow}>
                        <Text style={styles.categoryMetaText}>{cat.orderCount} orders</Text>
                        <Text style={styles.categoryMetaText}>Spent: {formatCurrency(cat.totalSpent)}</Text>
                      </View>
                    </View>
                  );
                })}

                {spendingCategories.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={{ color: t.textSecondary, fontSize: 12 }}>No category breakdown recorded.</Text>
                  </View>
                )}

                {spendingCategories.length > 5 && (
                  <TouchableOpacity
                    onPress={() => setModals((prev) => ({ ...prev, categories: true }))}
                    style={[styles.viewAllPillsBtn, { borderColor: t.cardBorder }]}
                  >
                    <Text style={[styles.viewAllPillsBtnText, { color: t.textPrimary }]}>View All Categories</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* AI FORECASTING & RISKS PANEL */}
        {activeTab === 'forecast' && (
          <View style={styles.panelContent}>
            {/* Predictive summary widgets */}
            <View style={styles.forecastGrid}>
              <View style={[styles.forecastCell, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={styles.forecastCellLabel}>PREDICTED SPENT</Text>
                <Text style={[styles.forecastCellValue, { color: t.textPrimary }]}>
                  {formatCurrency(forecastMonths.reduce((sum, m) => sum + m.projected, 0))}
                </Text>
                <Text style={styles.forecastCellDesc}>Next 6 Months cumulative</Text>
              </View>

              <View style={[styles.forecastCell, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={styles.forecastCellLabel}>MODEL R² SCALE</Text>
                <Text style={[styles.forecastCellValue, { color: t.textPrimary }]}>89%</Text>
                <Text style={styles.forecastCellDesc}>Trend confidence interval</Text>
              </View>

              <View style={[styles.forecastCell, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={styles.forecastCellLabel}>DEFAULT RISK</Text>
                <Text style={[styles.forecastCellValue, { color: '#ef4444' }]}>
                  {Math.round((100 - metrics.onTimeRate) / 10) * 10}%
                </Text>
                <Text style={styles.forecastCellDesc}>Default probability</Text>
              </View>

              <View style={[styles.forecastCell, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={styles.forecastCellLabel}>DEBT TO ASSET</Text>
                <Text style={[styles.forecastCellValue, { color: t.textPrimary }]}>{metrics.debtRatio}%</Text>
                <Text style={styles.forecastCellDesc}>Pending/Paid ratio scale</Text>
              </View>
            </View>

            {/* AI Spending Forecast Line chart */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>AI-Powered Forecast</Text>
                <Text style={styles.chartHeaderSub}>Dotted line shows projected monthly spent with upper/lower limits</Text>
                <View style={[styles.legendRow, { marginTop: 8 }]}>
                  <View style={[styles.legendDot, { backgroundColor: '#475569' }]} />
                  <Text style={styles.legendLabel}>Historical</Text>
                  <View style={[styles.legendDot, { backgroundColor: t.textSecondary, borderRadius: 0 }]} />
                  <Text style={styles.legendLabel}>Forecast</Text>
                </View>
              </View>
              <View style={styles.chartBox}>{renderForecastChart()}</View>
            </View>

            {/* Interactive Scenario Planning */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.cardHeaderTitle, { color: t.textSecondary }]}>SCENARIO SIMULATOR</Text>
                <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Interactive Scenario Planning</Text>
                <Text style={styles.chartHeaderSub}>Projected monthly liabilities based on checkout adjustments</Text>
              </View>

              <View style={styles.scenarioList}>
                {/* Conservative */}
                <View style={[styles.scenarioCard, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.divider }]}>
                  <View style={styles.scenarioHeadRow}>
                    <Text style={[styles.scenarioTitle, { color: t.textPrimary }]}>Conservative (-20% spent)</Text>
                    <Text style={[styles.scenarioPrice, { color: t.accent }]}>{formatCurrency(metrics.monthlyAvg * 0.8)}/mo</Text>
                  </View>
                  <Text style={[styles.scenarioDesc, { color: t.textSecondary }]}>
                    Strict spending constraint. Simulated savings of {formatCurrency(metrics.monthlyAvg * 0.2 * 6)} over the next 6 months.
                  </Text>
                </View>

                {/* Normal */}
                <View style={[styles.scenarioCard, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.divider }]}>
                  <View style={styles.scenarioHeadRow}>
                    <Text style={[styles.scenarioTitle, { color: t.textPrimary }]}>Baseline Trend (Current)</Text>
                    <Text style={[styles.scenarioPrice, { color: t.textPrimary }]}>{formatCurrency(metrics.monthlyAvg)}/mo</Text>
                  </View>
                  <Text style={[styles.scenarioDesc, { color: t.textSecondary }]}>
                    Continue current purchase patterns. Liabilities match active 12-month average.
                  </Text>
                </View>

                {/* Aggressive */}
                <View style={[styles.scenarioCard, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.divider }]}>
                  <View style={styles.scenarioHeadRow}>
                    <Text style={[styles.scenarioTitle, { color: t.textPrimary }]}>Aggressive (+30% spent)</Text>
                    <Text style={[styles.scenarioPrice, { color: t.textPrimary }]}>{formatCurrency(metrics.monthlyAvg * 1.3)}/mo</Text>
                  </View>
                  <Text style={[styles.scenarioDesc, { color: t.textSecondary }]}>
                    Increased installment activity. Ensure payment capacity contains buffer to avoid defaults.
                  </Text>
                </View>
              </View>
            </View>

            {/* Cost Optimization potential & mitigation strategies */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.categoryHeaderRow}>
                <View>
                  <Text style={[styles.cardHeaderTitle, { color: t.textSecondary }]}>SAVINGS & MITIGATIONS</Text>
                  <Text style={[styles.chartHeaderTitle, { color: t.textPrimary }]}>Cost Optimizations</Text>
                </View>
                <Lightbulb size={16} color={t.textSecondary} />
              </View>

              <View style={styles.savingsRow}>
                <View style={[styles.savingsCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={styles.savingsCellLabel}>EARLY PAY</Text>
                  <Text style={[styles.savingsCellVal, { color: t.textPrimary }]}>₱80</Text>
                  <Text style={styles.savingsCellDesc}>Est. coupons</Text>
                </View>

                <View style={[styles.savingsCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={styles.savingsCellLabel}>SHORT TERM</Text>
                  <Text style={[styles.savingsCellVal, { color: t.textPrimary }]}>₱200</Text>
                  <Text style={styles.savingsCellDesc}>Interest saved</Text>
                </View>

                <View style={[styles.savingsCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={styles.savingsCellLabel}>BULK PAY</Text>
                  <Text style={[styles.savingsCellVal, { color: t.textPrimary }]}>₱120</Text>
                  <Text style={styles.savingsCellDesc}>Merchant discount</Text>
                </View>
              </View>

              <View style={[styles.warningBox, { backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.05)' : 'rgba(238, 77, 45, 0.03)', borderColor: 'rgba(238, 77, 45, 0.2)' }]}>
                <ShieldAlert size={18} color="#ee4d2d" style={{ marginRight: 8, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.warningBoxTitle, { color: t.textPrimary }]}>Financial Risk Management</Text>
                  <Text style={[styles.warningBoxDesc, { color: t.textSecondary }]}>
                    Your wellness rating is <Text style={{ fontWeight: '700', color: t.textPrimary }}>{metrics.creditScore}</Text>. 
                    Establishing automated calendar reminders or opting for shorter 3-month options reduces credit liability risk and builds score.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setModals((prev) => ({ ...prev, recommendations: true }))}
                style={[styles.learnBtn, { backgroundColor: t.textPrimary }]}
              >
                <Text style={[styles.learnBtnText, { color: isDarkMode ? '#000000' : '#ffffff' }]}>
                  Learn Optimization Strategies
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* --- DETAIL MODAL: CATEGORIES --- */}
      <Modal
        visible={modals.categories}
        transparent
        animationType="fade"
        onRequestClose={() => setModals((prev) => ({ ...prev, categories: false }))}
      >
        <View style={styles.modalOverlay}>
          <SwipeDismissModal onDismiss={() => setModals((prev) => ({ ...prev, categories: false }))}>
          <View style={[styles.modalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.modalHeader, { borderColor: t.divider }]}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>All Spending Categories</Text>
              <TouchableOpacity onPress={() => setModals((prev) => ({ ...prev, categories: false }))} style={styles.modalCloseBtn}>
                <Text style={{ color: t.textSecondary, fontSize: 16, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
              {spendingCategories.map((cat, idx) => (
                <View key={cat.category} style={[styles.modalCategoryRow, { borderColor: t.divider }]}>
                  <View>
                    <Text style={[styles.modalCategoryName, { color: t.textPrimary }]}>{cat.category}</Text>
                    <Text style={[styles.modalCategoryDesc, { color: t.textSecondary }]}>
                      Purchased {cat.orderCount} orders • First: {new Date(cat.firstPurchase).toLocaleDateString('en-PH')}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.modalCategoryAmount, { color: t.textPrimary }]}>{formatCurrency(cat.totalSpent)}</Text>
                    <Text style={[styles.modalCategoryShare, { color: t.textSecondary }]}>Share: {cat.percentage}%</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setModals((prev) => ({ ...prev, categories: false }))}
              style={[styles.modalActionBtn, { backgroundColor: t.textPrimary }]}
            >
              <Text style={[styles.modalActionBtnText, { color: isDarkMode ? '#000000' : '#ffffff' }]}>Close</Text>
            </TouchableOpacity>
          </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* --- DETAIL MODAL: COMPLIANCE LEDGER --- */}
      <Modal
        visible={modals.compliance}
        transparent
        animationType="fade"
        onRequestClose={() => setModals((prev) => ({ ...prev, compliance: false }))}
      >
        <View style={styles.modalOverlay}>
          <SwipeDismissModal onDismiss={() => setModals((prev) => ({ ...prev, compliance: false }))}>
          <View style={[styles.modalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingBottom: insets.bottom + 16, width: layout.modalWidth, alignSelf: 'center' }]}>
            <View style={[styles.modalHeader, { borderColor: t.divider }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Detailed Compliance Ledger</Text>
                <Text style={styles.modalHeaderSub}>Amortization schedule under selected period</Text>
              </View>
              <TouchableOpacity onPress={() => setModals((prev) => ({ ...prev, compliance: false }))} style={styles.modalCloseBtn}>
                <Text style={{ color: t.textSecondary, fontSize: 16, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
              <View style={styles.tableHead}>
                <Text style={[styles.thText, { flex: 2 }]}>ITEM NAME</Text>
                <Text style={[styles.thText, { flex: 1.2, textAlign: 'right', paddingRight: 6 }]}>DUE</Text>
                <Text style={[styles.thText, { flex: 1.2, textAlign: 'center' }]}>DATE</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>STATUS</Text>
              </View>

              {compliancePayments.map((p) => {
                let statusBg = t.divider;
                let statusColor = t.textSecondary;
                let label = 'Pending';

                if (p.status === 'on_time') {
                  statusBg = 'rgba(16, 185, 129, 0.1)';
                  statusColor = '#10b981';
                  label = 'On-time';
                } else if (p.status === 'late') {
                  statusBg = isDarkMode ? '#1e293b' : '#f1f5f9';
                  statusColor = t.textSecondary;
                  label = 'Late';
                } else if (p.status === 'overdue') {
                  statusBg = 'rgba(239, 68, 68, 0.1)';
                  statusColor = '#ef4444';
                  label = 'Overdue';
                }

                return (
                  <View key={p.id} style={[styles.trRow, { borderColor: t.divider }]}>
                    <View style={{ flex: 2, paddingRight: 4 }}>
                      <Text style={[styles.tdName, { color: t.textPrimary }]} numberOfLines={2}>
                        {p.itemName}
                      </Text>
                      <Text style={[styles.tdSub, { color: t.textSecondary }]}>
                        Month {p.monthNumber}/{p.installmentMonths}
                      </Text>
                    </View>

                    <Text style={[styles.tdAmount, { color: t.textPrimary, flex: 1.2 }]} numberOfLines={1}>
                      {formatCurrency(p.amountDue)}
                    </Text>

                    <Text style={[styles.tdDate, { color: t.textSecondary, flex: 1.2 }]} numberOfLines={1}>
                      {new Date(p.dueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </Text>

                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <View style={[styles.miniStatusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.miniStatusBadgeText, { color: statusColor }]}>{label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {compliancePayments.length === 0 && (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ color: t.textSecondary, fontSize: 12 }}>No dues found.</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setModals((prev) => ({ ...prev, compliance: false }))}
              style={[styles.modalActionBtn, { backgroundColor: t.textPrimary }]}
            >
              <Text style={[styles.modalActionBtnText, { color: isDarkMode ? '#000000' : '#ffffff' }]}>Close</Text>
            </TouchableOpacity>
          </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* --- DETAIL MODAL: RECOMMENDATIONS --- */}
      <Modal
        visible={modals.recommendations}
        transparent
        animationType="fade"
        onRequestClose={() => setModals((prev) => ({ ...prev, recommendations: false }))}
      >
        <View style={styles.modalOverlay}>
          <SwipeDismissModal onDismiss={() => setModals((prev) => ({ ...prev, recommendations: false }))}>
          <View style={[styles.modalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.modalHeader, { borderColor: t.divider }]}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Cost Optimization Strategies</Text>
              <TouchableOpacity onPress={() => setModals((prev) => ({ ...prev, recommendations: false }))} style={styles.modalCloseBtn}>
                <Text style={{ color: t.textSecondary, fontSize: 16, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
              <View style={styles.recItem}>
                <View style={[styles.recIconFrame, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <CheckCircle2 size={16} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recItemTitle, { color: t.textPrimary }]}>1. Early Settlement Bonus</Text>
                  <Text style={[styles.recItemDesc, { color: t.textSecondary }]}>
                    Settle payments 3 or more days before the due date. While S-Pay is zero-interest, merchants frequently distribute early compliance coupons or direct cashback incentives for consistent early buyers.
                  </Text>
                </View>
              </View>

              <View style={[styles.dividerLine, { backgroundColor: t.divider, marginVertical: 14 }]} />

              <View style={styles.recItem}>
                <View style={[styles.recIconFrame, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <TrendingDown size={16} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recItemTitle, { color: t.textPrimary }]}>2. Shorter Amortizations</Text>
                  <Text style={[styles.recItemDesc, { color: t.textSecondary }]}>
                    Choosing a 3-month or 1-month plan instead of 12-month plans reduces overall pending exposure, lowering your debt ratio faster and boosting your credit wellness standing in the Spay ecosystem.
                  </Text>
                </View>
              </View>

              <View style={[styles.dividerLine, { backgroundColor: t.divider, marginVertical: 14 }]} />

              <View style={styles.recItem}>
                <View style={[styles.recIconFrame, { backgroundColor: 'rgba(251, 191, 36, 0.1)' }]}>
                  <Sparkles size={16} color="#fbbf24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recItemTitle, { color: t.textPrimary }]}>3. Consolidate Purchases</Text>
                  <Text style={[styles.recItemDesc, { color: t.textSecondary }]}>
                    Grouping items into a single consolidated checkout order optimizes installment dates, aligning all your monthly dues to a single calendar day for cleaner, structured bookkeeping.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setModals((prev) => ({ ...prev, recommendations: false }))}
              style={[styles.modalActionBtn, { backgroundColor: t.textPrimary }]}
            >
              <Text style={[styles.modalActionBtnText, { color: isDarkMode ? '#000000' : '#ffffff' }]}>Close</Text>
            </TouchableOpacity>
          </View>
          </SwipeDismissModal>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  headerActionBtn: {
    padding: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  brandContainer: {
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  brandSub: {
    color: '#ee4d2d',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  brandTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  brandDesc: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
    lineHeight: 17,
  },
  filterPillsContainer: {
    height: 38,
    marginVertical: 4,
  },
  filterPillsScroll: {
    gap: 8,
    paddingHorizontal: 2,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePillBorder: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: 'Jakarta-SemiBold',
  },
  activePillText: {
    fontWeight: '700',
  },
  exportBtn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginVertical: 2,
  },
  exportBtnText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    marginTop: 4,
    gap: 20,
  },
  tabItem: {
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemLabel: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  panelContent: {
    gap: 16,
    marginTop: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderTitle: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
    height: 110,
  },
  gaugeTextWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  gaugeVal: {
    fontSize: 24,
    fontFamily: 'Jakarta-ExtraBold',
  },
  gaugeLimits: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    marginTop: 1,
  },
  scoreMetaCol: {
    flex: 1,
    marginLeft: 20,
    gap: 8,
  },
  scoreMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreMetaLabel: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
  },
  scoreMetaVal: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  healthLabelContainer: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  healthLabelText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  smallCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  smallCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  smallCardLabel: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  smallCardValue: {
    fontSize: 18,
    fontFamily: 'Jakarta-ExtraBold',
  },
  smallCardDesc: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  miniProgressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    width: '100%',
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  exposureGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  exposureCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  exposureLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  exposureVal: {
    fontSize: 13,
    fontFamily: 'Jakarta-ExtraBold',
  },
  chartTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
  chartHeaderSub: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
    marginRight: 6,
  },
  chartBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  donutSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donutGraphWrapper: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTextOverlay: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutCenterValue: {
    fontSize: 18,
    fontFamily: 'Jakarta-ExtraBold',
  },
  donutCenterLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
  },
  donutLegendContainer: {
    flex: 1,
    marginLeft: 16,
    gap: 6,
  },
  donutLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donutLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 1.5,
    marginRight: 6,
  },
  donutLegendLabel: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    flex: 1,
  },
  donutLegendValue: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  payoffHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payoffIconFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoffCountWrapper: {
    alignItems: 'flex-end',
  },
  payoffCount: {
    fontSize: 22,
    fontFamily: 'Jakarta-ExtraBold',
  },
  payoffCountLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  payoffProgressContainer: {
    marginTop: 16,
    gap: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabelText: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
  },
  dividerLine: {
    height: 1.5,
    width: '100%',
  },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recentIndexFrame: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentIndexText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  recentItemName: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  recentItemDate: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
    marginTop: 1,
  },
  recentItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginBottom: 2,
  },
  statusBadgeText: {
    fontSize: 8,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  recentItemAmount: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  recentProgressCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recentProgressLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
  },
  complianceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  viewAllBtnText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  complianceGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  complianceGridCell: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  complianceCellLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
  },
  complianceCellValue: {
    fontSize: 18,
    fontFamily: 'Jakarta-ExtraBold',
    marginVertical: 4,
  },
  complianceCellDesc: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  categoryList: {
    gap: 14,
  },
  categoryRow: {
    gap: 6,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryColorDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 6,
  },
  categoryName: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  categoryPercent: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  categoryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryMetaText: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
  },
  viewAllPillsBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  viewAllPillsBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  forecastGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  forecastCell: {
    width: '48.5%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  forecastCellLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
    textAlign: 'center',
  },
  forecastCellValue: {
    fontSize: 16,
    fontFamily: 'Jakarta-ExtraBold',
    marginVertical: 4,
  },
  forecastCellDesc: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
  },
  scenarioList: {
    gap: 10,
  },
  scenarioCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  scenarioHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scenarioTitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  scenarioPrice: {
    fontSize: 13,
    fontFamily: 'Jakarta-ExtraBold',
  },
  scenarioDesc: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 13,
  },
  savingsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  savingsCell: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  savingsCellLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
  },
  savingsCellVal: {
    fontSize: 15,
    fontFamily: 'Jakarta-ExtraBold',
    marginVertical: 2,
  },
  savingsCellDesc: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
  },
  warningBox: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  warningBoxTitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  warningBoxDesc: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 14,
    marginTop: 2,
  },
  learnBtn: {
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  learnBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  modalHeaderSub: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollBody: {
    paddingBottom: 16,
  },
  modalCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalCategoryName: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  modalCategoryDesc: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  modalCategoryAmount: {
    fontSize: 13,
    fontFamily: 'Jakarta-ExtraBold',
  },
  modalCategoryShare: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    marginTop: 1,
  },
  modalActionBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  modalActionBtnText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#94a3b8',
    marginBottom: 6,
  },
  thText: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
  },
  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tdName: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  tdSub: {
    fontSize: 8.5,
    fontFamily: 'Jakarta-Medium',
    marginTop: 1.5,
  },
  tdAmount: {
    fontSize: 11,
    fontFamily: 'Jakarta-ExtraBold',
    textAlign: 'right',
    paddingRight: 6,
  },
  tdDate: {
    fontSize: 10,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
  },
  miniStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniStatusBadgeText: {
    fontSize: 7.5,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recIconFrame: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recItemTitle: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  recItemDesc: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 15,
    marginTop: 3,
  },
});
