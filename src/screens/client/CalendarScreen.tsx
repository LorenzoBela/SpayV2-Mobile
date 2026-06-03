import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  PiggyBank,
  TrendingUp,
  BarChart2,
  RotateCcw,
  X,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { supabase } from '../../utils/supabase';
import { ThemeContext } from '../../navigation/navigationTypes';
import { CalendarSkeleton } from '../../components/SkeletonLoader';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import { useResponsiveLayout } from '../../utils/responsive';


export interface CalendarEvent {
  id: string;
  orderId: string;
  title: string;
  date: string; // YYYY-MM-DD format
  dueDate: string;
  amount: number;
  status: 'paid' | 'overdue' | 'upcoming';
  itemName: string;
  monthNumber: number;
  installmentMonths: number;
  paymentDate: string | null;
  paymentMethod: string | null;
  clientName: string;
  canReschedule: boolean;
  hasPendingReschedule: boolean;
  rescheduleHistory: {
    id: string;
    oldDueDate: string;
    newDueDate: string;
    reason: string | null;
    adminApproved: boolean;
    createdAt: string;
  }[];
}

export interface CalendarStats {
  monthlyDue: number;
  thisWeekDue: number;
  totalPaid: number;
  totalDue: number;
  pendingCount: number;
  overdueCount: number;
  completionRate: number;
}

export interface PaymentActivity {
  id: string;
  itemName: string;
  amount: number;
  paymentDate: string;
  method: string;
}

export interface InstallmentSummary {
  installmentMonths: number;
  orderCount: number;
  totalValue: number;
  averageValue: number;
}

export interface CalendarBudgetCategory {
  id: string;
  category: string;
  monthlyLimit: number;
  currentSpent: number;
  alertThreshold: number;
  color: string;
  usagePercentage: number;
}

interface MonthlyTrend {
  month: string;
  paymentCount: number;
  totalAmount: number;
  paidAmount: number;
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const toDateKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const toMonthKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

function getWeekBounds(now: Date) {
  const start = new Date(now);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function buildCalendarCells(currentDate: Date) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIdx = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: { date: Date; dateKey: string; day: number; current: boolean }[] = [];

  for (let i = firstDayIdx - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i);
    cells.push({ date, dateKey: toDateKey(date), day: date.getDate(), current: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ date, dateKey: toDateKey(date), day, current: true });
  }

  while (cells.length < 42) {
    const date = new Date(year, month + 1, cells.length - firstDayIdx - daysInMonth + 1);
    cells.push({ date, dateKey: toDateKey(date), day: date.getDate(), current: false });
  }

  return cells;
}

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const cellWidth = Math.floor((layout.contentInnerWidth - 12) / 7);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calendar core navigation states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(toDateKey(new Date()));

  // Active sub-panel segment state
  const [activePanel, setActivePanel] = useState<'activities' | 'trends' | 'budgets'>('activities');

  // Modals visibility and target states
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [reschedulePayment, setReschedulePayment] = useState<CalendarEvent | null>(null);

  // Reschedule Form states
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  // Raw Database states
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [rawPayments, setRawPayments] = useState<any[]>([]);
  const [rawBudgets, setRawBudgets] = useState<any[]>([]);
  const [profileName, setProfileName] = useState('Client');

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d',
    divider: isDarkMode ? '#222d42' : '#e2e8f0',
    modalOverlay: isDarkMode ? 'rgba(11, 15, 25, 0.85)' : 'rgba(15, 23, 42, 0.65)',
    inputBg: isDarkMode ? '#0b0f19' : '#f8fafc',
    inputBorder: isDarkMode ? '#222d42' : '#cbd5e1',
  };

  const fetchCalendarPayments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Profile Name
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      setProfileName(dbProfile?.name || 'Client');

      // 2. Fetch Orders
      const { data: dbOrders } = await supabase
        .from('orders')
        .select('id, item_name, amount, installment_months')
        .eq('user_id', user.id);

      const ordersList = dbOrders || [];
      setRawOrders(ordersList);

      if (ordersList.length === 0) {
        setRawPayments([]);
        setLoading(false);
        return;
      }
      const orderIds = ordersList.map((o) => o.id);

      // 3. Fetch Payments
      const { data: dbPayments, error: paymentsErr } = await supabase
        .from('payments')
        .select('id, order_id, due_date, amount_due, is_paid, payment_date, proof_of_payment, month_number')
        .in('order_id', orderIds);

      if (paymentsErr) throw paymentsErr;
      const paymentsList = dbPayments || [];

      // 4. Fetch Reschedule History
      let reschedulesList: any[] = [];
      if (paymentsList.length > 0) {
        const { data: dbReschedules } = await supabase
          .from('payment_reschedule_history')
          .select('id, payment_id, old_due_date, new_due_date, reason, admin_approved, created_at')
          .in('payment_id', paymentsList.map((p) => p.id));
        if (dbReschedules) reschedulesList = dbReschedules;
      }

      // Merge and set payments
      const reschedulesByPaymentId = new Map<string, any[]>();
      reschedulesList.forEach((r) => {
        const list = reschedulesByPaymentId.get(r.payment_id) || [];
        list.push({
          id: r.id,
          oldDueDate: r.old_due_date,
          newDueDate: r.new_due_date,
          reason: r.reason,
          adminApproved: r.admin_approved,
          createdAt: r.created_at,
        });
        reschedulesByPaymentId.set(r.payment_id, list);
      });

      const mappedPayments = paymentsList.map((p) => {
        const history = reschedulesByPaymentId.get(p.id) || [];
        return {
          ...p,
          rescheduleHistory: history,
        };
      });
      setRawPayments(mappedPayments);

      // 5. Fetch Budget Categories
      const { data: dbBudgets } = await supabase
        .from('user_budget_categories')
        .select('id, category, monthly_limit, current_spent, alert_threshold, color')
        .eq('user_id', user.id)
        .order('current_spent', { ascending: false })
        .limit(3);
      setRawBudgets(dbBudgets || []);

    } catch (e) {
      console.warn('Failed to fetch calendar dataset:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCalendarPayments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCalendarPayments();
  };

  // Perform calculations identical to web
  const calculatedData = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const currentMonthKey = toMonthKey(now);
    const { start: weekStart, end: weekEnd } = getWeekBounds(now);

    const ordersMap = new Map<string, any>();
    rawOrders.forEach((o) => {
      ordersMap.set(o.id, {
        itemName: o.item_name,
        installmentMonths: parseInt(o.installment_months, 10) || 1,
        amount: parseFloat(o.amount) || 0,
      });
    });

    // 1. Build list of all events
    const events: CalendarEvent[] = rawPayments.map((p) => {
      const order = ordersMap.get(p.order_id) || { itemName: 'Purchase Installment', installmentMonths: 1, amount: 0 };
      const due = new Date(p.due_date);
      const dueMs = due.getTime();
      const isPaid = p.is_paid;

      let status: 'paid' | 'overdue' | 'upcoming' = 'upcoming';
      if (isPaid) {
        status = 'paid';
      } else if (dueMs < nowMs) {
        status = 'overdue';
      }

      const hasPendingReschedule = (p.rescheduleHistory || []).some((r: any) => !r.adminApproved);

      return {
        id: p.id,
        orderId: p.order_id,
        title: `${order.itemName} - Installment ${p.month_number}`,
        date: toDateKey(due),
        dueDate: p.due_date,
        amount: parseFloat(p.amount_due) || 0,
        status,
        itemName: order.itemName,
        monthNumber: parseInt(p.month_number, 10) || 1,
        installmentMonths: order.installmentMonths,
        paymentDate: p.payment_date,
        paymentMethod: p.proof_of_payment || (isPaid ? 'Direct Payment' : null),
        clientName: profileName,
        canReschedule: !isPaid && status !== 'overdue',
        hasPendingReschedule,
        rescheduleHistory: (p.rescheduleHistory || []).map((entry: any) => ({
          id: entry.id,
          oldDueDate: entry.oldDueDate,
          newDueDate: entry.newDueDate,
          reason: entry.reason,
          adminApproved: entry.adminApproved,
          createdAt: entry.createdAt,
        })),
      };
    });

    // 2. Stats
    const totalPaid = events.filter((e) => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
    const totalDue = events.filter((e) => e.status !== 'paid').reduce((sum, e) => sum + e.amount, 0);
    const monthlyDue = events
      .filter((e) => e.status !== 'paid' && e.date.substring(0, 7) === currentMonthKey)
      .reduce((sum, e) => sum + e.amount, 0);
    const thisWeekDue = events
      .filter((e) => {
        const due = new Date(e.dueDate);
        return e.status !== 'paid' && due >= weekStart && due <= weekEnd;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const paidCount = events.filter((e) => e.status === 'paid').length;
    const stats: CalendarStats = {
      monthlyDue,
      thisWeekDue,
      totalPaid,
      totalDue,
      pendingCount: events.filter((e) => e.status === 'upcoming').length,
      overdueCount: events.filter((e) => e.status === 'overdue').length,
      completionRate: events.length > 0 ? Math.round((paidCount / events.length) * 1000) / 10 : 0,
    };

    // 3. Upcoming events (next 5)
    const upcomingEvents = events
      .filter((e) => e.status !== 'paid' && new Date(e.dueDate).getTime() >= nowMs)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    // 4. Recent completed activity
    const recentActivities: PaymentActivity[] = events
      .filter((e) => e.status === 'paid' && e.paymentDate)
      .sort((a, b) => new Date(b.paymentDate!).getTime() - new Date(a.paymentDate!).getTime())
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        itemName: e.itemName,
        amount: e.amount,
        paymentDate: e.paymentDate!,
        method: e.paymentMethod || 'Direct Payment',
      }));

    // 5. Monthly trends
    const monthlyTrendMap = new Map<string, { month: string; paymentCount: number; totalAmount: number; paidAmount: number }>();
    events.forEach((e) => {
      const key = e.date.substring(0, 7);
      const current = monthlyTrendMap.get(key) || { month: key, paymentCount: 0, totalAmount: 0, paidAmount: 0 };
      current.paymentCount += 1;
      current.totalAmount += e.amount;
      if (e.status === 'paid') {
        current.paidAmount += e.amount;
      }
      monthlyTrendMap.set(key, current);
    });
    const monthlyTrends = Array.from(monthlyTrendMap.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6)
      .reverse();

    // 6. Installment summary
    const installmentSummaryMap = new Map<number, InstallmentSummary>();
    rawOrders.forEach((order) => {
      const months = parseInt(order.installment_months, 10) || 1;
      const existing = installmentSummaryMap.get(months) || {
        installmentMonths: months,
        orderCount: 0,
        totalValue: 0,
        averageValue: 0,
      };
      existing.orderCount += 1;
      existing.totalValue += parseFloat(order.amount) || 0;
      existing.averageValue = existing.totalValue / existing.orderCount;
      installmentSummaryMap.set(months, existing);
    });

    const installmentSummary = Array.from(installmentSummaryMap.values()).sort((a, b) => a.installmentMonths - b.installmentMonths);

    // 7. Budget Overview
    const budgetOverview: CalendarBudgetCategory[] = rawBudgets.map((b) => {
      const monthlyLimit = parseFloat(b.monthly_limit) || 0;
      const currentSpent = parseFloat(b.current_spent) || 0;
      return {
        id: b.id,
        category: b.category,
        monthlyLimit,
        currentSpent,
        alertThreshold: parseFloat(b.alert_threshold) || 80,
        color: b.color,
        usagePercentage: monthlyLimit > 0 ? Math.round((currentSpent / monthlyLimit) * 1000) / 10 : 0,
      };
    });

    // 8. General Analytics stats
    const avgPayment = events.length > 0 ? events.reduce((sum, e) => sum + e.amount, 0) / events.length : 0;
    const minPayment = events.length > 0 ? Math.min(...events.map((e) => e.amount)) : 0;
    const maxPayment = events.length > 0 ? Math.max(...events.map((e) => e.amount)) : 0;
    const paymentStats = { average: avgPayment, min: minPayment, max: maxPayment };

    return {
      events,
      stats,
      upcomingEvents,
      recentActivities,
      monthlyTrends,
      installmentSummary,
      budgetOverview,
      paymentStats,
    };

  }, [rawOrders, rawPayments, rawBudgets, profileName]);

  const {
    events,
    stats,
    upcomingEvents,
    recentActivities,
    monthlyTrends,
    installmentSummary,
    budgetOverview,
    paymentStats,
  } = calculatedData;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarCells = useMemo(() => buildCalendarCells(currentDate), [currentDate]);
  
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const bucket = map.get(event.date) || [];
      bucket.push(event);
      map.set(event.date, bucket);
    });
    return map;
  }, [events]);

  const selectedDayEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) || [] : [];
  const selectedDateLabel = selectedDateKey
    ? new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const maxTrendAmount = Math.max(...monthlyTrends.map((trend) => trend.totalAmount), 1);

  // Native JSON Ledger Export
  const handleExportJSON = async () => {
    if (events.length === 0) {
      PremiumAlert.alert('No Data', 'No payment schedules found to export.');
      return;
    }

    try {
      const payload = events.map((event) => ({
        paymentId: event.id,
        orderId: event.orderId,
        title: event.title,
        dueDate: event.date,
        amount: event.amount,
        status: event.status,
        itemName: event.itemName,
        installment: `${event.monthNumber}/${event.installmentMonths}`,
        paymentDate: event.paymentDate,
        canReschedule: event.canReschedule,
      }));

      const jsonContent = JSON.stringify(payload, null, 2);
      const fileUri = FileSystem.documentDirectory + `spay_calendar_${new Date().toISOString().split('T')[0]}.json`;

      await FileSystem.writeAsStringAsync(fileUri, jsonContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export Calendar Ledger' });
      } else {
        PremiumAlert.alert('Unavailable', 'Native sharing is not supported on this device.');
      }
    } catch (err) {
      console.warn('Failed to export calendar ledger:', err);
      PremiumAlert.alert('Error', 'An error occurred while generating the JSON ledger.');
    }
  };

  const validateDate = (dateStr: string) => {
    const reg = /^\d{4}-\d{2}-\d{2}$/;
    if (!reg.test(dateStr)) return false;
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return false;
    if (d.getTime() <= Date.now()) return false;
    return true;
  };

  // Submit Reschedule Proposal
  const handleSubmitReschedule = async () => {
    if (!reschedulePayment || !rescheduleDate || !rescheduleReason.trim()) {
      PremiumAlert.alert('Validation Error', 'Please select a date and enter a reason.');
      return;
    }

    if (!validateDate(rescheduleDate)) {
      PremiumAlert.alert('Validation Error', 'Proposed due date must be in the future (YYYY-MM-DD).');
      return;
    }

    setSubmittingReschedule(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const proposedDate = new Date(`${rescheduleDate}T00:00:00`);

      // Check if there is already a pending reschedule request
      const { data: existingRequest } = await supabase
        .from('payment_reschedule_history')
        .select('id')
        .eq('payment_id', reschedulePayment.id)
        .eq('admin_approved', false)
        .maybeSingle();

      if (existingRequest) {
        // Update the existing request
        const { error: updateErr } = await supabase
          .from('payment_reschedule_history')
          .update({
            new_due_date: proposedDate.toISOString(),
            reason: rescheduleReason,
            created_at: new Date().toISOString()
          })
          .eq('id', existingRequest.id);

        if (updateErr) throw updateErr;

        try {
          await supabase.from('payment_logs').insert({
            payment_id: reschedulePayment.id,
            action_type: 'payment_reschedule_updated',
            action_description: `Client updated pending reschedule request for ${reschedulePayment.itemName} (Month ${reschedulePayment.monthNumber}). Requested change to ${proposedDate.toLocaleDateString('en-PH')}.`,
            performed_by_id: user.id,
            performed_at: new Date().toISOString(),
            old_values: JSON.stringify({ new_due_date: reschedulePayment.dueDate }),
            new_values: JSON.stringify({ new_due_date: proposedDate.toISOString(), reason: rescheduleReason })
          });
        } catch (logErr) {
          console.warn('Logging reschedule update failed:', logErr);
        }
      } else {
        // Create new request
        const { error: insertErr } = await supabase
          .from('payment_reschedule_history')
          .insert({
            payment_id: reschedulePayment.id,
            old_due_date: reschedulePayment.dueDate,
            new_due_date: proposedDate.toISOString(),
            reason: rescheduleReason,
            updated_by_id: user.id,
            admin_approved: false
          });

        if (insertErr) throw insertErr;

        try {
          await supabase.from('payment_logs').insert({
            payment_id: reschedulePayment.id,
            action_type: 'payment_reschedule_requested',
            action_description: `Client requested reschedule for ${reschedulePayment.itemName} (Month ${reschedulePayment.monthNumber}). Proposed due date: ${proposedDate.toLocaleDateString('en-PH')}.`,
            performed_by_id: user.id,
            performed_at: new Date().toISOString(),
            old_values: JSON.stringify({ due_date: reschedulePayment.dueDate }),
            new_values: JSON.stringify({ due_date: proposedDate.toISOString(), reason: rescheduleReason })
          });
        } catch (logErr) {
          console.warn('Logging reschedule request failed:', logErr);
        }
      }

      PremiumAlert.alert('Success', 'Reschedule request submitted successfully.');
      setReschedulePayment(null);
      setSelectedEvent(null);
      setRescheduleDate('');
      setRescheduleReason('');
      fetchCalendarPayments(); // refresh data
    } catch (e: any) {
      console.warn('Error rescheduling payment:', e);
      PremiumAlert.alert('Error', e.message || 'An error occurred while submitting the request.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const formatCurrency = (val: number) => {
    return '₱' + Math.round(val).toLocaleString('en-PH');
  };

  const formatCurrencyPrecise = (val: number) => {
    return '₱' + val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatMonthKey = (key: string) => {
    const [yr, mo] = key.split('-');
    const d = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, 1);
    return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
  };

  const statusStyles = {
    paid: {
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      label: 'Settled',
      icon: CheckCircle2,
    },
    overdue: {
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      label: 'Overdue',
      icon: AlertCircle,
    },
    upcoming: {
      color: '#fbbf24',
      bgColor: 'rgba(251, 191, 36, 0.1)',
      label: 'Upcoming',
      icon: Clock,
    },
  };

  if (loading) {
    return <CalendarSkeleton />;
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Amortization Calendar</Text>
        <TouchableOpacity onPress={handleExportJSON} style={styles.headerActionBtn}>
          <Download size={18} color={t.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ee4d2d" />
        }
      >
        {/* S-Pay Branding and Description */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandSub}>S-Pay Client</Text>
          <Text style={[styles.brandTitle, { color: t.textPrimary }]}>Calendar & Schedules</Text>
          <Text style={[styles.brandDesc, { color: t.textSecondary }]}>
            Track real installment due dates, repayment status, upcoming cycles, and reschedule requests.
          </Text>
        </View>

        {/* Calendar Navigation and Today Button */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            onPress={() => {
              const today = new Date();
              setCurrentDate(today);
              setSelectedDateKey(toDateKey(today));
            }}
            style={[styles.todayBtn, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
          >
            <CalendarIcon size={14} color={t.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.todayBtnText, { color: t.textPrimary }]}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* 2x2 Stats Widgets */}
        <View style={styles.statsGrid}>
          {/* This Month Due */}
          <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>THIS MONTH DUE</Text>
              <View style={[styles.statIconFrame, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <CalendarIcon size={12} color="#ef4444" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: t.textPrimary }]}>{formatCurrency(stats.monthlyDue)}</Text>
            <Text style={styles.statDesc}>{stats.pendingCount} upcoming bills</Text>
          </View>

          {/* This Week Due */}
          <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>THIS WEEK DUE</Text>
              <View style={[styles.statIconFrame, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Clock size={12} color="#3b82f6" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: t.textPrimary }]}>{formatCurrency(stats.thisWeekDue)}</Text>
            <Text style={styles.statDesc}>Mon through Sun</Text>
          </View>

          {/* Overdue */}
          <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>OVERDUE COUNT</Text>
              <View style={[styles.statIconFrame, { backgroundColor: 'rgba(251, 191, 36, 0.1)' }]}>
                <AlertCircle size={12} color="#fbbf24" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: t.textPrimary }]}>{stats.overdueCount}</Text>
            <Text style={styles.statDesc}>{formatCurrency(stats.totalDue)} outstanding</Text>
          </View>

          {/* Completion Rate */}
          <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>COMPLETION RATE</Text>
              <View style={[styles.statIconFrame, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <CheckCircle2 size={12} color="#10b981" />
              </View>
            </View>
            <Text style={[styles.statValue, { color: t.textPrimary }]}>{stats.completionRate}%</Text>
            <Text style={styles.statDesc}>{formatCurrency(stats.totalPaid)} collected</Text>
          </View>
        </View>

        {/* Main Monthly Calendar Grid Card */}
        <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <View style={styles.calendarHeaderRow}>
            <View>
              <Text style={[styles.calendarMonthName, { color: t.textPrimary }]}>
                {monthNames[month]} {year}
              </Text>
              <Text style={styles.calendarSubtitle}>{events.length} scheduled installments</Text>
            </View>
            <View style={styles.monthNavActions}>
              <TouchableOpacity
                onPress={() => setCurrentDate(new Date(year, month - 1, 1))}
                style={[styles.navBtn, { borderColor: t.divider }]}
              >
                <ChevronLeft size={16} color={t.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCurrentDate(new Date(year, month + 1, 1))}
                style={[styles.navBtn, { borderColor: t.divider }]}
              >
                <ChevronRight size={16} color={t.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Weekday Titles */}
          <View style={styles.weekdayRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={[styles.weekdayLabel, { width: cellWidth }]}>
                {day}
              </Text>
            ))}
          </View>

          {/* Day Cells Grid */}
          <View style={styles.calendarGrid}>
            {calendarCells.map((cell) => {
              const dayEvents = eventsByDate.get(cell.dateKey) || [];
              const isToday = cell.dateKey === toDateKey(new Date());
              const isSelected = cell.dateKey === selectedDateKey;
              const isDefaultInstallmentDay = cell.current && cell.day === 5;

              return (
                <TouchableOpacity
                  key={cell.dateKey}
                  onPress={() => setSelectedDateKey(cell.dateKey)}
                  style={[
                    styles.cellButton,
                    { width: cellWidth },
                    {
                      backgroundColor: cell.current ? t.cardBg : (isDarkMode ? '#131926' : '#f8fafc'),
                      borderColor: isToday ? '#3b82f6' : (isSelected ? t.accent : t.divider),
                    },
                    isSelected && styles.selectedCellBorder,
                    isDefaultInstallmentDay && { backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.08)' : 'rgba(238, 77, 45, 0.03)' },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dayNumWrapper, isToday && styles.todayNumWrapper]}>
                    <Text
                      style={[
                        styles.dayNumText,
                        {
                          color: isToday ? '#ffffff' : (cell.current ? t.textPrimary : t.textSecondary),
                        },
                        isToday && { fontWeight: '700' },
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>

                  <View style={styles.dotsRow}>
                    {dayEvents.slice(0, 3).map((event) => (
                      <View
                        key={event.id}
                        style={[
                          styles.eventDot,
                          {
                            backgroundColor:
                              event.status === 'paid'
                                ? '#10b981'
                                : event.status === 'overdue'
                                  ? '#ef4444'
                                  : '#fbbf24',
                          },
                        ]}
                      />
                    ))}
                    {dayEvents.length > 3 && <Text style={styles.plusMoreText}>+</Text>}
                  </View>

                  {isDefaultInstallmentDay && dayEvents.length === 0 && (
                    <View style={styles.cycleDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legends */}
          <View style={styles.calendarLegends}>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Settled</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: '#fbbf24' }]} />
              <Text style={styles.legendText}>Upcoming</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Overdue</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: t.accent, borderRadius: 1 }]} />
              <Text style={styles.legendText}>5th Cycle</Text>
            </View>
          </View>
        </View>

        {/* Selected Date Details Box */}
        <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.cardHeaderTitle, { color: t.textSecondary }]}>SELECTED DATE DETAILS</Text>
          <Text style={[styles.selectedDateLabelText, { color: t.textPrimary }]}>
            {selectedDateLabel || 'No date selected'}
          </Text>

          <View style={{ marginTop: 12, gap: 10 }}>
            {selectedDayEvents.length > 0 ? (
              selectedDayEvents.map((event) => {
                const styling = statusStyles[event.status];
                const StatusIcon = styling.icon;
                return (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => setSelectedEvent(event)}
                    style={[styles.dueEventItem, { backgroundColor: isDarkMode ? '#1e2638' : '#f8fafc', borderColor: t.divider }]}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.dueItemName, { color: t.textPrimary }]} numberOfLines={1}>
                        {event.itemName}
                      </Text>
                      <Text style={[styles.dueItemInstallment, { color: t.textSecondary }]}>
                        Installment {event.monthNumber} of {event.installmentMonths}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: styling.bgColor, alignSelf: 'flex-start', marginTop: 4 }]}>
                        <StatusIcon size={10} color={styling.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: styling.color }]}>{styling.label}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text style={[styles.dueItemAmount, { color: t.textPrimary }]}>
                        {formatCurrency(event.amount)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={[styles.emptyDetailsBox, { borderColor: t.divider }]}>
                <Info size={16} color={t.textSecondary} style={{ marginRight: 8 }} />
                <Text style={[styles.emptyDetailsText, { color: t.textSecondary }]}>
                  No scheduled payments on this day.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Dashboard Segments tab navigation */}
        <View style={[styles.segmentContainer, { backgroundColor: isDarkMode ? '#161c2a' : '#e2e8f0', borderColor: t.cardBorder }]}>
          {[
            { id: 'activities', label: 'Recent Paid' },
            { id: 'trends', label: 'Trends & Stats' },
            { id: 'budgets', label: 'Budgets' },
          ].map((tab) => {
            const isActive = activePanel === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActivePanel(tab.id as any)}
                style={[
                  styles.segmentButton,
                  isActive && [styles.activeSegmentButton, { backgroundColor: isDarkMode ? '#222d42' : '#ffffff' }],
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: isActive ? t.textPrimary : t.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SEGMENT CONTENTS */}
        {activePanel === 'activities' && (
          <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.cardHeaderTitle, { color: t.textSecondary }]}>RECENT PAYMENT ACTIVITY</Text>
            <View style={{ gap: 10, marginTop: 4 }}>
              {recentActivities.length > 0 ? (
                recentActivities.map((act) => (
                  <View key={act.id} style={[styles.activityRow, { borderColor: t.divider }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.activityName, { color: t.textPrimary }]} numberOfLines={1}>
                        {act.itemName}
                      </Text>
                      <Text style={[styles.activityDate, { color: t.textSecondary }]}>
                        {formatDate(act.paymentDate)} • {act.method}
                      </Text>
                    </View>
                    <Text style={styles.activityAmount}>{formatCurrency(act.amount)}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptySectionText, { color: t.textSecondary }]}>
                  No completed payment activity recorded.
                </Text>
              )}
            </View>
          </View>
        )}

        {activePanel === 'trends' && (
          <View style={{ gap: 16 }}>
            {/* Trends */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <TrendingUp size={16} color="#3b82f6" />
                <Text style={[styles.cardHeaderTitle, { color: t.textSecondary, marginBottom: 0 }]}>MONTHLY TRENDS</Text>
              </View>
              <View style={{ gap: 12 }}>
                {monthlyTrends.length > 0 ? (
                  monthlyTrends.map((trend) => (
                    <View key={trend.month} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.trendMonthLabel, { color: t.textPrimary }]}>
                          {formatMonthKey(trend.month)}
                        </Text>
                        <Text style={[styles.trendAmountText, { color: t.textPrimary }]}>
                          {formatCurrency(trend.totalAmount)}
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0', height: 6 }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.max(4, (trend.totalAmount / maxTrendAmount) * 100)}%`,
                              backgroundColor: '#3b82f6',
                              height: 6,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptySectionText, { color: t.textSecondary }]}>No trend data recorded.</Text>
                )}
              </View>
            </View>

            {/* Payment Analytics Grid & Summaries */}
            <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <BarChart2 size={16} color={t.accent} />
                <Text style={[styles.cardHeaderTitle, { color: t.textSecondary, marginBottom: 0 }]}>PAYMENT ANALYTICS</Text>
              </View>

              <View style={styles.analyticsStatsRow}>
                <View style={[styles.analyticsCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={[styles.analyticsVal, { color: t.textPrimary }]}>
                    {formatCurrency(paymentStats.average)}
                  </Text>
                  <Text style={styles.analyticsLabel}>Average</Text>
                </View>
                <View style={[styles.analyticsCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={[styles.analyticsVal, { color: t.textPrimary }]}>
                    {formatCurrency(paymentStats.min)}
                  </Text>
                  <Text style={styles.analyticsLabel}>Minimum</Text>
                </View>
                <View style={[styles.analyticsCell, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <Text style={[styles.analyticsVal, { color: t.textPrimary }]}>
                    {formatCurrency(paymentStats.max)}
                  </Text>
                  <Text style={styles.analyticsLabel}>Maximum</Text>
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 8 }}>
                {installmentSummary.slice(0, 3).map((summary) => (
                  <View key={summary.installmentMonths} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.summaryLabel, { color: t.textSecondary }]}>
                      {summary.installmentMonths}-month plans
                    </Text>
                    <Text style={[styles.summaryVal, { color: t.textPrimary }]}>
                      {summary.orderCount} orders
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {activePanel === 'budgets' && (
          <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <PiggyBank size={16} color="#10b981" />
              <Text style={[styles.cardHeaderTitle, { color: t.textSecondary, marginBottom: 0 }]}>BUDGET OVERVIEW</Text>
            </View>
            <View style={{ gap: 12 }}>
              {budgetOverview.length > 0 ? (
                budgetOverview.map((category) => (
                  <View key={category.id} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.trendMonthLabel, { color: t.textPrimary }]}>{category.category}</Text>
                      <Text style={[styles.trendAmountText, { color: t.textPrimary }]}>
                        {category.usagePercentage}%
                      </Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0', height: 6 }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, category.usagePercentage)}%`,
                            backgroundColor: category.color || '#10b981',
                            height: 6,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptySectionText, { color: t.textSecondary }]}>
                  No budget categories configured.
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* --- EVENT DETAIL MODAL --- */}
      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedEvent && (
            <SwipeDismissModal onDismiss={() => setSelectedEvent(null)}>
            <View style={[styles.modalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingBottom: insets.bottom + 16 }]}>
              <View style={[styles.modalHeader, { borderColor: t.divider }]}>
                <View>
                  <Text style={styles.modalSubHeader}>Payment Details</Text>
                  <Text style={[styles.modalTitle, { color: t.textPrimary }]} numberOfLines={1}>
                    {selectedEvent.itemName}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedEvent(null)} style={styles.modalCloseBtn}>
                  <X size={20} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.detailGrid}>
                  <View style={[styles.detailCell, { backgroundColor: isDarkMode ? '#1e2938' : '#f8fafc' }]}>
                    <Text style={styles.detailLabel}>Amount</Text>
                    <Text style={[styles.detailValue, { color: t.textPrimary }]} numberOfLines={1}>
                      {formatCurrencyPrecise(selectedEvent.amount)}
                    </Text>
                  </View>
                  <View style={[styles.detailCell, { backgroundColor: isDarkMode ? '#1e2938' : '#f8fafc' }]}>
                    <Text style={styles.detailLabel}>Due Date</Text>
                    <Text style={[styles.detailValue, { color: t.textPrimary }]} numberOfLines={1}>
                      {formatDate(selectedEvent.dueDate)}
                    </Text>
                  </View>
                  <View style={[styles.detailCell, { backgroundColor: isDarkMode ? '#1e2938' : '#f8fafc' }]}>
                    <Text style={styles.detailLabel}>Installment</Text>
                    <Text style={[styles.detailValue, { color: t.textPrimary }]}>
                      {selectedEvent.monthNumber} of {selectedEvent.installmentMonths}
                    </Text>
                  </View>
                  <View style={[styles.detailCell, { backgroundColor: isDarkMode ? '#1e2938' : '#f8fafc' }]}>
                    <Text style={styles.detailLabel}>Client</Text>
                    <Text style={[styles.detailValue, { color: t.textPrimary }]} numberOfLines={1}>
                      {selectedEvent.clientName}
                    </Text>
                  </View>
                  <View style={[styles.detailCell, { backgroundColor: isDarkMode ? '#1e2938' : '#f8fafc', width: '100%' }]}>
                    <Text style={styles.detailLabel}>Order ID</Text>
                    <Text style={[styles.detailValue, { color: t.textPrimary }]} numberOfLines={1}>
                      #{selectedEvent.orderId.substring(0, 8)}
                    </Text>
                  </View>
                  <View style={[styles.detailCell, { backgroundColor: isDarkMode ? '#1e2938' : '#f8fafc', width: '100%' }]}>
                    <Text style={styles.detailLabel}>Payment Date</Text>
                    <Text style={[styles.detailValue, { color: t.textPrimary }]}>
                      {selectedEvent.paymentDate ? formatDate(selectedEvent.paymentDate) : 'Not paid yet'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statusBox, { backgroundColor: statusStyles[selectedEvent.status].bgColor }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Text style={[styles.statusBoxLabel, { color: t.textSecondary }]}>Status</Text>
                    <View style={[styles.miniStatusBadge, { backgroundColor: statusStyles[selectedEvent.status].bgColor }]}>
                      <Text style={[styles.miniStatusBadgeText, { color: statusStyles[selectedEvent.status].color }]}>
                        {statusStyles[selectedEvent.status].label}
                      </Text>
                    </View>
                  </View>
                  {selectedEvent.hasPendingReschedule && (
                    <Text style={styles.pendingWarningText}>
                      A pending reschedule request already exists. Submitting again will update that request.
                    </Text>
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  onPress={() => setSelectedEvent(null)}
                  style={[styles.modalCancelBtn, { borderColor: t.divider }]}
                >
                  <Text style={[styles.modalCancelBtnText, { color: t.textPrimary }]}>Close</Text>
                </TouchableOpacity>

                {selectedEvent.canReschedule && (
                  <TouchableOpacity
                    onPress={() => {
                      setReschedulePayment(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    style={[styles.modalActionBtn, { backgroundColor: t.textPrimary }]}
                  >
                    <RotateCcw size={14} color={isDarkMode ? '#000000' : '#ffffff'} style={{ marginRight: 6 }} />
                    <Text style={[styles.modalActionBtnText, { color: isDarkMode ? '#000000' : '#ffffff' }]}>Reschedule</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            </SwipeDismissModal>
          )}
        </View>
      </Modal>

      {/* --- RESCHEDULE PROPOSAL FORM MODAL --- */}
      <Modal
        visible={reschedulePayment !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReschedulePayment(null)}
      >
        <View style={styles.modalOverlay}>
          {reschedulePayment && (
            <SwipeDismissModal onDismiss={() => setReschedulePayment(null)} disabled={submittingReschedule}>
            <View style={[styles.modalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder, paddingBottom: insets.bottom + 16 }]}>
              <View style={[styles.modalHeader, { borderColor: t.divider }]}>
                <View>
                  <Text style={styles.modalSubHeader}>Request Reschedule</Text>
                  <Text style={[styles.modalTitle, { color: t.textPrimary }]} numberOfLines={1}>
                    {reschedulePayment.itemName}
                  </Text>
                  <Text style={styles.modalHeaderDesc}>
                    Current due date: {formatDate(reschedulePayment.dueDate)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReschedulePayment(null)} style={styles.modalCloseBtn}>
                  <X size={20} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: t.textSecondary }]}>New Due Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                  placeholder="e.g. 2026-07-20"
                  placeholderTextColor={t.textSecondary}
                  value={rescheduleDate}
                  onChangeText={setRescheduleDate}
                />

                <Text style={[styles.inputLabel, { color: t.textSecondary, marginTop: 16 }]}>Reason</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
                  placeholder="Explain why this installment needs a new due date."
                  placeholderTextColor={t.textSecondary}
                  multiline
                  numberOfLines={4}
                  value={rescheduleReason}
                  onChangeText={setRescheduleReason}
                />
              </ScrollView>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  onPress={() => setReschedulePayment(null)}
                  style={[styles.modalCancelBtn, { borderColor: t.divider }]}
                  disabled={submittingReschedule}
                >
                  <Text style={[styles.modalCancelBtnText, { color: t.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmitReschedule}
                  style={[styles.modalActionBtn, { backgroundColor: t.textPrimary }]}
                  disabled={submittingReschedule}
                >
                  {submittingReschedule ? (
                    <ActivityIndicator size="small" color={isDarkMode ? '#000000' : '#ffffff'} />
                  ) : (
                    <Text style={[styles.modalActionBtnText, { color: isDarkMode ? '#000000' : '#ffffff' }]}>
                      Submit Request
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            </SwipeDismissModal>
          )}
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
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginVertical: 2,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  todayBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 4,
  },
  statCard: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
  },
  statIconFrame: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Jakarta-ExtraBold',
  },
  statDesc: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
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
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarMonthName: {
    fontSize: 17,
    fontFamily: 'Outfit-Bold',
  },
  calendarSubtitle: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    marginTop: 1,
  },
  monthNavActions: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekdayLabel: {
    textAlign: 'center',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'center',
  },
  cellButton: {
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    justifyContent: 'space-between',
  },
  selectedCellBorder: {
    borderWidth: 2,
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  dayNumWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayNumWrapper: {
    backgroundColor: '#3b82f6',
  },
  dayNumText: {
    fontSize: 10,
    fontFamily: 'Jakarta-SemiBold',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 8,
    paddingHorizontal: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  plusMoreText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94a3b8',
    bottom: 2,
  },
  cycleDot: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(238, 77, 45, 0.6)',
  },
  calendarLegends: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  selectedDateLabelText: {
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
    marginBottom: 6,
  },
  dueEventItem: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  dueItemName: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  dueItemInstallment: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  statusBadgeText: {
    fontSize: 7.5,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  dueItemAmount: {
    fontSize: 13,
    fontFamily: 'Jakarta-ExtraBold',
  },
  emptyDetailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  emptyDetailsText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginVertical: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSegmentButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  activityName: {
    fontSize: 12.5,
    fontFamily: 'Jakarta-Bold',
  },
  activityDate: {
    fontSize: 9,
    fontFamily: 'Jakarta-Medium',
  },
  activityAmount: {
    fontSize: 12.5,
    fontFamily: 'Jakarta-ExtraBold',
    color: '#10b981',
  },
  emptySectionText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    paddingVertical: 16,
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  trendMonthLabel: {
    fontSize: 11.5,
    fontFamily: 'Jakarta-Bold',
  },
  trendAmountText: {
    fontSize: 11.5,
    fontFamily: 'Jakarta-Bold',
  },
  analyticsStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  analyticsCell: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  analyticsVal: {
    fontSize: 12,
    fontFamily: 'Jakarta-ExtraBold',
  },
  analyticsLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  summaryVal: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  modalSubHeader: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    marginTop: 1,
  },
  modalHeaderDesc: {
    fontSize: 9.5,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    paddingBottom: 16,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  detailCell: {
    width: '48.5%',
    borderRadius: 12,
    padding: 10,
  },
  detailLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 11.5,
    fontFamily: 'Jakarta-ExtraBold',
    marginTop: 2,
  },
  statusBox: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    marginTop: 4,
    gap: 8,
  },
  statusBoxLabel: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-Bold',
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
  pendingWarningText: {
    fontSize: 9,
    color: '#3b82f6',
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  modalActionBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionBtnText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  inputLabel: {
    fontSize: 9.5,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 12.5,
    fontFamily: 'Jakarta-Medium',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
});
