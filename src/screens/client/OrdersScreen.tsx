import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ShoppingBag,
  Receipt,
  TrendingUp,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Search,
  FileText,
  Banknote,
  UserCheck,
  Info,
  X,
  ChevronDown,
  Sun,
  Moon,
  LayoutGrid,
  List,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../../utils/authProfile';
import { ThemeContext } from '../../navigation/navigationTypes';
import { OrdersSkeleton } from '../../components/SkeletonLoader';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import { useResponsiveLayout } from '../../utils/responsive';
import { parseUtcDate } from '../../utils/date';

interface PaymentItem {
  id: string;
  monthNumber: number;
  amountDue: number;
  dueDate: string;
  isPaid: boolean;
  paymentDate: string | null;
}

interface OrderItem {
  id: string;
  itemName: string;
  amount: number;
  installmentMonths: number;
  orderDate: string;
  remarks: string | null;
  isPaid: boolean;
  paidInstallments: number;
  progressPercent: number;
  payments: PaymentItem[];
}

export default function OrdersScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = React.useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const analyticsCardMinWidth = layout.getGridItemWidth(layout.isTablet ? 4 : 2, 10);
  
  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [analytics, setAnalytics] = useState({
    totalOrders: 0,
    totalSpent: 0,
    paymentStreak: 0,
    onTimeRate: 100,
  });

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paid'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  // Reset pagination page on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const fetchOrdersAndAnalytics = async () => {
    try {
      const { user, profileId } = await getLinkedProfileForCurrentUser();
      if (!user) return;

      // 1. Fetch Orders
      const { data: dbOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, item_name, amount, installment_months, order_date, remarks, is_paid')
        .eq('user_id', profileId)
        .order('order_date', { ascending: false });

      if (ordersErr) throw ordersErr;

      if (!dbOrders || dbOrders.length === 0) {
        setOrders([]);
        setAnalytics({ totalOrders: 0, totalSpent: 0, paymentStreak: 0, onTimeRate: 100 });
        return;
      }

      // 2. Fetch payments for those orders
      const orderIds = dbOrders.map(o => o.id);
      let paymentsData: any[] = [];
      const { data } = await supabase
        .from('payments')
        .select('id, order_id, month_number, amount_due, due_date, is_paid, payment_date')
        .in('order_id', orderIds)
        .order('month_number', { ascending: true });
      if (data) paymentsData = data;

      // Map payments to orders
      const orderPaymentsMap = new Map<string, any[]>();
      paymentsData.forEach(p => {
        const list = orderPaymentsMap.get(p.order_id) || [];
        list.push(p);
        orderPaymentsMap.set(p.order_id, list);
      });

      // Calculate Streak & On-Time Rate
      const allPaidPayments = paymentsData
        .filter(p => p.is_paid)
        .sort((a, b) => parseUtcDate(b.payment_date || b.due_date).getTime() - parseUtcDate(a.payment_date || a.due_date).getTime());

      let paymentStreak = 0;
      for (const p of allPaidPayments) {
        if (p.payment_date && parseUtcDate(p.payment_date) <= parseUtcDate(p.due_date)) {
          paymentStreak++;
        } else {
          break;
        }
      }

      const completedCount = allPaidPayments.length;
      const onTimeCount = allPaidPayments.filter(
        p => p.payment_date && parseUtcDate(p.payment_date) <= parseUtcDate(p.due_date)
      ).length;
      const onTimeRate = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 100;

      const totalSpent = dbOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0);

      const formattedOrders: OrderItem[] = dbOrders.map(o => {
        const orderPayments = orderPaymentsMap.get(o.id) || [];
        const paidCount = orderPayments.filter(p => p.is_paid).length;
        const progressPercent = o.installment_months > 0 ? (paidCount / o.installment_months) * 100 : 0;

        return {
          id: o.id,
          itemName: o.item_name,
          amount: parseFloat(o.amount),
          installmentMonths: parseInt(o.installment_months, 10),
          orderDate: o.order_date,
          remarks: o.remarks,
          isPaid: o.is_paid,
          paidInstallments: paidCount,
          progressPercent,
          payments: orderPayments.map(p => ({
            id: p.id,
            monthNumber: p.month_number,
            amountDue: parseFloat(p.amount_due),
            dueDate: p.due_date,
            isPaid: p.is_paid,
            paymentDate: p.payment_date,
          })),
        };
      });

      setOrders(formattedOrders);
      setAnalytics({
        totalOrders: dbOrders.length,
        totalSpent,
        paymentStreak,
        onTimeRate,
      });

      // Default expand the first order if any
      if (formattedOrders.length > 0 && !expandedOrderId) {
        setExpandedOrderId(formattedOrders[0].id);
      }
    } catch (e) {
      console.warn('Failed to load orders schedule:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndAnalytics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrdersAndAnalytics();
  };

  const handleOpenPayModal = (orderId: string) => {
    setPayingOrderId(orderId);
    setIsPaymentModalOpen(true);
  };

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
    modalOverlay: isDarkMode ? 'rgba(11, 15, 25, 0.85)' : 'rgba(15, 23, 42, 0.65)',
    successText: '#10b981',
  };

  const formatCurrency = (val: number) => {
    return '₱' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.id.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'active') return !o.isPaid;
    if (statusFilter === 'paid') return o.isPaid;
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const orderToPay = orders.find(o => o.id === payingOrderId);
  const unpaidInstallments = orderToPay?.payments.filter(p => !p.isPaid) || [];
  const totalUnpaidAmount = unpaidInstallments.reduce((sum, p) => sum + p.amountDue, 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      {/* Header bar matches dashboard */}
      <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
        <View style={styles.webHeaderLeft}>
          <Text style={styles.webHeaderSubtitle}>S-Pay Client</Text>
          <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Active Purchases</Text>
          <Text style={[styles.webHeaderDesc, { color: t.textSecondary }]}>
            Review your installment orders, track amortization schedules, and submit payments.
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
        <OrdersSkeleton />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ee4d2d" />
          }
        >
          {/* Overview Analytics Widgets */}
          <View style={styles.analyticsGrid}>
            <View style={[styles.statCard, { minWidth: analyticsCardMinWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>Total Orders</Text>
                <Receipt size={14} color={t.textSecondary} />
              </View>
              <Text style={[styles.statValue, { color: t.textPrimary }]}>{analytics.totalOrders}</Text>
            </View>

            <View style={[styles.statCard, { minWidth: analyticsCardMinWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>Total Spent</Text>
                <TrendingUp size={14} color={t.textSecondary} />
              </View>
              <Text style={[styles.statValue, { color: t.textPrimary }]}>{formatCurrency(analytics.totalSpent)}</Text>
            </View>

            <View style={[styles.statCard, { minWidth: analyticsCardMinWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>Streak</Text>
                <Flame size={14} color={t.accent} />
              </View>
              <Text style={[styles.statValue, { color: t.textPrimary }]}>{analytics.paymentStreak}</Text>
            </View>

            <View style={[styles.statCard, { minWidth: analyticsCardMinWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>On-Time Rate</Text>
                <CheckCircle2 size={14} color={t.textSecondary} />
              </View>
              <Text style={[styles.statValue, { color: t.textPrimary }]}>{analytics.onTimeRate}%</Text>
            </View>
          </View>

          {/* Controls bar: Search & Filter Tabs + View Mode Toggle */}
          <View style={styles.controlsBar}>
            <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <Search size={16} color={t.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search purchases..."
                placeholderTextColor={t.textSecondary}
                style={[styles.searchInput, { color: t.textPrimary }]}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <X size={16} color={t.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterViewRow}>
              <View style={[styles.tabsContainer, { backgroundColor: t.divider, flex: 1 }]}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'paid', label: 'Settled' },
                ].map(tab => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setStatusFilter(tab.id as any)}
                    style={[
                      styles.tabButton,
                      statusFilter === tab.id && { backgroundColor: t.tabActiveBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabButtonText,
                        { color: statusFilter === tab.id ? t.textPrimary : t.textSecondary },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.viewToggleContainer, { backgroundColor: t.divider }]}>
                <TouchableOpacity
                  onPress={() => setViewMode('card')}
                  style={[
                    styles.viewToggleButton,
                    viewMode === 'card' && { backgroundColor: t.tabActiveBg },
                  ]}
                >
                  <LayoutGrid size={16} color={viewMode === 'card' ? t.textPrimary : t.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setViewMode('list')}
                  style={[
                    styles.viewToggleButton,
                    viewMode === 'list' && { backgroundColor: t.tabActiveBg },
                  ]}
                >
                  <List size={16} color={viewMode === 'list' ? t.textPrimary : t.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Orders list */}
          <View style={styles.ordersListContainer}>
            {paginatedOrders.length > 0 ? (
              paginatedOrders.map(order => {
                const isExpanded = expandedOrderId === order.id;
                const progress = order.progressPercent;
                const hasOverdue = order.payments.some(
                  p => !p.isPaid && parseUtcDate(p.dueDate).getTime() < Date.now()
                );

                if (viewMode === 'card') {
                  return (
                    <View
                      key={order.id}
                      style={[
                        styles.orderCard,
                        { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                        isExpanded && { borderColor: t.accent },
                      ]}
                    >
                      {/* Collapsible toggle head */}
                      <TouchableOpacity
                        onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        style={styles.orderCardHeader}
                      >
                        <View style={styles.headerLeft}>
                          <Text style={[styles.orderItemName, { color: t.textPrimary }]}>{order.itemName}</Text>
                          <Text style={[styles.orderItemDate, { color: t.textSecondary }]}>
                            Ordered {parseUtcDate(order.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
                          </Text>
                        </View>
                        <View style={styles.headerRight}>
                          <View style={styles.badgesCol}>
                            <View
                              style={[
                                styles.statusLabelBadge,
                                { backgroundColor: order.isPaid ? 'rgba(16, 185, 129, 0.1)' : t.divider },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusLabelBadgeText,
                                  { color: order.isPaid ? t.successText : t.textSecondary },
                                ]}
                              >
                                {order.isPaid ? 'Paid' : 'Active'}
                              </Text>
                            </View>
                            {hasOverdue && (
                              <View style={styles.alertBadge}>
                                <AlertTriangle size={10} color="#ffffff" style={{ marginRight: 2 }} />
                                <Text style={styles.alertBadgeText}>Due</Text>
                              </View>
                            )}
                          </View>
                          <ChevronDown
                            size={16}
                            color={t.textSecondary}
                            style={{
                              marginLeft: 8,
                              transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                            }}
                          />
                        </View>
                      </TouchableOpacity>

                      {/* Progress indicator */}
                      <View style={styles.cardProgressBox}>
                        <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${progress}%`, backgroundColor: order.isPaid ? t.successText : '#3b82f6' },
                            ]}
                          />
                        </View>
                        <View style={styles.progressFooter}>
                          <Text style={[styles.progressFooterText, { color: t.textSecondary }]}>
                            {Math.round(progress)}% Settled ({order.paidInstallments}/{order.installmentMonths} Mo)
                          </Text>
                          <Text style={[styles.orderAmountValue, { color: t.textPrimary }]}>
                            {formatCurrency(order.amount)}
                          </Text>
                        </View>
                      </View>

                      {/* Collapsed breakdown schedule */}
                      {isExpanded && (
                        <View style={styles.scheduleExpansion}>
                          <View style={[styles.divider, { backgroundColor: t.divider }]} />
                          
                          <Text style={[styles.scheduleHeading, { color: t.textSecondary }]}>
                            AMORTIZATION SCHEDULE
                          </Text>

                          <View style={styles.scheduleList}>
                            {order.payments.map(p => {
                              const isPaymentOverdue = !p.isPaid && parseUtcDate(p.dueDate).getTime() < Date.now();
                              let labelColor = t.textSecondary;
                              let statusText = 'Pending';
                              let statusBg = t.divider;

                              if (p.isPaid) {
                                labelColor = t.successText;
                                statusText = 'Settled';
                                statusBg = 'rgba(16, 185, 129, 0.1)';
                              } else if (isPaymentOverdue) {
                                labelColor = '#ef4444';
                                statusText = 'Overdue';
                                statusBg = 'rgba(239, 68, 68, 0.1)';
                              }

                              return (
                                <View key={p.id} style={[styles.scheduleRow, { borderColor: t.divider }]}>
                                  <View>
                                    <Text style={[styles.scheduleMonth, { color: t.textPrimary }]}>Month {p.monthNumber}</Text>
                                    <Text style={[styles.scheduleDate, { color: t.textSecondary }]}>
                                      Due {parseUtcDate(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
                                    </Text>
                                  </View>
                                  <View style={styles.scheduleRight}>
                                    <Text style={[styles.scheduleAmount, { color: t.textPrimary }]}>
                                      {formatCurrency(p.amountDue)}
                                    </Text>
                                    <View style={[styles.rowStatusBadge, { backgroundColor: statusBg }]}>
                                      <Text style={[styles.rowStatusBadgeText, { color: labelColor }]}>
                                        {statusText}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                          </View>

                          {order.remarks && (
                            <View style={[styles.remarksBox, { backgroundColor: t.divider }]}>
                              <Text style={[styles.remarksTitle, { color: t.textSecondary }]}>REMARKS</Text>
                              <Text style={[styles.remarksBody, { color: t.textPrimary }]}>{order.remarks}</Text>
                            </View>
                          )}

                          {!order.isPaid && (
                            <TouchableOpacity
                              onPress={() => handleOpenPayModal(order.id)}
                              style={styles.payNowBtn}
                            >
                              <Banknote size={16} color="#ffffff" style={{ marginRight: 6 }} />
                              <Text style={styles.payNowBtnText}>Pay Installment</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                } else {
                  // List / Row View
                  return (
                    <View
                      key={order.id}
                      style={[
                        styles.orderListRow,
                        { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                        isExpanded && { borderColor: t.accent },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        style={styles.orderListRowHeader}
                      >
                        <View style={styles.listRowLeft}>
                          <View style={[styles.listIconFrame, { backgroundColor: t.divider }]}>
                            <ShoppingBag size={15} color={order.isPaid ? t.successText : '#3b82f6'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.orderListRowName, { color: t.textPrimary }]} numberOfLines={1}>
                              {order.itemName}
                            </Text>
                            <Text style={[styles.orderListRowDate, { color: t.textSecondary }]}>
                              {parseUtcDate(order.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.listRowRight}>
                          <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                            <Text style={[styles.orderListRowAmount, { color: t.textPrimary }]}>
                              {formatCurrency(order.amount)}
                            </Text>
                            <Text style={[styles.orderListRowProgressText, { color: t.textSecondary }]}>
                              {Math.round(progress)}% ({order.paidInstallments}/{order.installmentMonths})
                            </Text>
                          </View>

                          <View style={styles.badgesCol}>
                            <View
                              style={[
                                styles.statusLabelBadge,
                                { backgroundColor: order.isPaid ? 'rgba(16, 185, 129, 0.1)' : t.divider },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusLabelBadgeText,
                                  { color: order.isPaid ? t.successText : t.textSecondary },
                                ]}
                              >
                                {order.isPaid ? 'Paid' : 'Active'}
                              </Text>
                            </View>
                            {hasOverdue && (
                              <View style={styles.alertBadge}>
                                <AlertTriangle size={8} color="#ffffff" style={{ marginRight: 2 }} />
                                <Text style={[styles.alertBadgeText, { fontSize: 7 }]}>Due</Text>
                              </View>
                            )}
                          </View>

                          <ChevronDown
                            size={14}
                            color={t.textSecondary}
                            style={{
                              marginLeft: 6,
                              transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                            }}
                          />
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.listScheduleExpansion}>
                          <View style={[styles.divider, { backgroundColor: t.divider }]} />
                          
                          <Text style={[styles.scheduleHeading, { color: t.textSecondary }]}>
                            AMORTIZATION SCHEDULE
                          </Text>

                          <View style={styles.scheduleList}>
                            {order.payments.map(p => {
                              const isPaymentOverdue = !p.isPaid && parseUtcDate(p.dueDate).getTime() < Date.now();
                              let labelColor = t.textSecondary;
                              let statusText = 'Pending';
                              let statusBg = t.divider;

                              if (p.isPaid) {
                                labelColor = t.successText;
                                statusText = 'Settled';
                                statusBg = 'rgba(16, 185, 129, 0.1)';
                              } else if (isPaymentOverdue) {
                                labelColor = '#ef4444';
                                statusText = 'Overdue';
                                statusBg = 'rgba(239, 68, 68, 0.1)';
                              }

                              return (
                                <View key={p.id} style={[styles.scheduleRow, { borderColor: t.divider }]}>
                                  <View>
                                    <Text style={[styles.scheduleMonth, { color: t.textPrimary }]}>Month {p.monthNumber}</Text>
                                    <Text style={[styles.scheduleDate, { color: t.textSecondary }]}>
                                      Due {parseUtcDate(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
                                    </Text>
                                  </View>
                                  <View style={styles.scheduleRight}>
                                    <Text style={[styles.scheduleAmount, { color: t.textPrimary }]}>
                                      {formatCurrency(p.amountDue)}
                                    </Text>
                                    <View style={[styles.rowStatusBadge, { backgroundColor: statusBg }]}>
                                      <Text style={[styles.rowStatusBadgeText, { color: labelColor }]}>
                                        {statusText}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                          </View>

                          {order.remarks && (
                            <View style={[styles.remarksBox, { backgroundColor: t.divider }]}>
                              <Text style={[styles.remarksTitle, { color: t.textSecondary }]}>REMARKS</Text>
                              <Text style={[styles.remarksBody, { color: t.textPrimary }]}>{order.remarks}</Text>
                            </View>
                          )}

                          {!order.isPaid && (
                            <TouchableOpacity
                              onPress={() => handleOpenPayModal(order.id)}
                              style={styles.payNowBtn}
                            >
                              <Banknote size={16} color="#ffffff" style={{ marginRight: 6 }} />
                              <Text style={styles.payNowBtnText}>Pay Installment</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                }
              })
            ) : (
              <View style={styles.emptyContainer}>
                <ShoppingBag size={44} color={t.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No Purchases Found</Text>
                <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>
                  Installment orders will appear here once registered.
                </Text>
              </View>
            )}
          </View>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <View style={styles.paginationContainer}>
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
            </View>
          )}
        </ScrollView>
      )}

      {/* --- CASH PAYMENT REMINDER MODAL --- */}
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
                  Order: #{orderToPay?.id.slice(0, 8)} • {orderToPay?.itemName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsPaymentModalOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBodyScroll} style={{ maxHeight: 380 }}>
              {/* Cash-Only Notice */}
              <View style={[styles.warningBox, { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                <Banknote size={20} color="#f59e0b" style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningBoxTitle}>Cash Payment Only</Text>
                  <Text style={styles.warningBoxDesc}>
                    We no longer accept GCash or online payments. Please pay your installment dues in cash directly to the admin in person.
                  </Text>
                </View>
              </View>

              {/* Outstanding Dues list */}
              <Text style={[styles.modalListLabel, { color: t.textSecondary }]}>OUTSTANDING DUES</Text>
              <View style={styles.duesContainer}>
                {unpaidInstallments.map((p, idx) => {
                  const isPaymentOverdue = parseUtcDate(p.dueDate).getTime() < Date.now();
                  return (
                    <View key={p.id || idx} style={[styles.dueRow, { borderColor: t.divider }]}>
                      <View>
                        <Text style={[styles.dueRowMonth, { color: t.textPrimary }]}>Month {p.monthNumber}</Text>
                        <Text style={[styles.dueRowDate, { color: t.textSecondary }]}>
                          Due {parseUtcDate(p.dueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.dueRowAmount, { color: t.textPrimary }]}>{formatCurrency(p.amountDue)}</Text>
                        {isPaymentOverdue && (
                          <View style={styles.overdueBadge}>
                            <Text style={styles.overdueBadgeText}>Overdue</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Dues summary */}
              <View style={[styles.duesSummaryBlock, { backgroundColor: t.divider }]}>
                <Text style={[styles.summaryLabel, { color: t.textSecondary }]}>Total Outstanding</Text>
                <Text style={[styles.summaryValue, { color: t.textPrimary }]}>{formatCurrency(totalUnpaidAmount)}</Text>
              </View>

              {/* Instructions */}
              <View style={[styles.instructionBox, { backgroundColor: t.divider }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <UserCheck size={16} color={t.textSecondary} />
                  <Text style={[styles.instructionHeader, { color: t.textPrimary }]}>How to pay</Text>
                </View>
                <Text style={[styles.instructionItem, { color: t.textSecondary }]}>1. Prepare exact cash amount for due installment(s).</Text>
                <Text style={[styles.instructionItem, { color: t.textSecondary }]}>2. Hand the payment to the administrator in person.</Text>
                <Text style={[styles.instructionItem, { color: t.textSecondary }]}>3. The admin will record your payment as settled.</Text>
                <Text style={[styles.instructionItem, { color: t.textSecondary }]}>4. You will receive email verification shortly after.</Text>
              </View>

              {/* Footnote info */}
              <View style={styles.footnoteContainer}>
                <Info size={14} color={t.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[styles.footnoteText, { color: t.textSecondary }]}>
                  Ledger status updates are reflected as soon as the administrator processes receipt.
                </Text>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={[styles.modalActions, { borderColor: t.divider }]}>
              <TouchableOpacity
                onPress={() => setIsPaymentModalOpen(false)}
                style={styles.understoodBtn}
              >
                <Text style={styles.understoodBtnText}>Understood</Text>
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
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
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
    marginTop: 8,
  },
  controlsBar: {
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 34,
    borderRadius: 8,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ordersListContainer: {
    gap: 12,
  },
  orderCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    overflow: 'hidden',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  orderItemName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  orderItemDate: {
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusLabelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusLabelBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  alertBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardProgressBox: {
    marginTop: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressFooterText: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderAmountValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  scheduleExpansion: {
    marginTop: 2,
  },
  scheduleHeading: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  scheduleList: {
    gap: 8,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  scheduleMonth: {
    fontSize: 12,
    fontWeight: '700',
  },
  scheduleDate: {
    fontSize: 10,
    marginTop: 2,
  },
  scheduleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scheduleAmount: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  rowStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 56,
    alignItems: 'center',
  },
  rowStatusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  remarksBox: {
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  remarksTitle: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  remarksBody: {
    fontSize: 11,
    lineHeight: 15,
  },
  payNowBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ee4d2d',
    borderRadius: 10,
    height: 38,
    marginTop: 16,
  },
  payNowBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
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
    fontWeight: '500',
  },
  modalBodyScroll: {
    paddingVertical: 12,
  },
  warningBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  dueRowMonth: {
    fontSize: 12,
    fontWeight: '700',
  },
  dueRowDate: {
    fontSize: 10,
    marginTop: 2,
  },
  dueRowAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  overdueBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
  },
  overdueBadgeText: {
    color: '#ef4444',
    fontSize: 7,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  duesSummaryBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  instructionBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  footnoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  footnoteText: {
    fontSize: 9,
    flex: 1,
    lineHeight: 12,
  },
  modalActions: {
    borderTopWidth: 1,
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  understoodBtn: {
    backgroundColor: '#ee4d2d',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  understoodBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  viewToggleButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  orderListRow: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    overflow: 'hidden',
  },
  orderListRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  listIconFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderListRowName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Jakarta-Bold',
  },
  orderListRowDate: {
    fontSize: 10,
    marginTop: 1,
  },
  listRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderListRowAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  orderListRowProgressText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  listScheduleExpansion: {
    marginTop: 2,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 12,
  },
  pageBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  pageBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pageNumbersContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  pageNumberBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
