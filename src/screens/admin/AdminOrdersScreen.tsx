import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useState, useEffect, useContext } from 'react';
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
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingBag,
  Search,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sliders,
  Trash2,
  Calendar,
  CreditCard,
  User,
  Users,
  FileText,
  X,
  Plus,
  Edit2,
  CheckCircle,
  Clock,
  MessageSquare,
  List,
  LayoutGrid,
  Check,
  CheckCircle2,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAllAdminData, callAdminApi } from '../../services/adminService';
import dayjs from 'dayjs';
import AdminHeader from '../../components/AdminHeader';
import DatePicker from '../../components/DatePicker';


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

export default function AdminOrdersScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [profiles, setProfiles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paid'>('all');
  const [filterMonthKey, setFilterMonthKey] = useState<string | null>(null);
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(false);

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states - Assign Order
  const [selectedClientId, setSelectedClientId] = useState('');
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState('');
  const [installmentMonths, setInstallmentMonths] = useState('6');
  const [purchaseDate, setPurchaseDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [firstPaymentDate, setFirstPaymentDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Form states - Edit Order
  const [editItemName, setEditItemName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMonths, setEditMonths] = useState('6');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editFirstPaymentDate, setEditFirstPaymentDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editClientId, setEditClientId] = useState('');

  // Layout and Pagination states
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const result = await fetchAllAdminData();
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync ledger records.');
      }
      setProfiles(result.profiles || []);
      setOrders(result.orders || []);
      setPayments(result.payments || []);
      setLimits(result.accountLimits || []);
    } catch (err: any) {
      console.warn('[AdminOrdersScreen] Load error:', err);
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
    setCurrentPage(1);
  }, [searchQuery, activeTab, filterMonthKey]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // Process orders data for display
  const processedOrders = orders.map(order => {
    const client = profiles.find(p => p.id === order.user_id);
    const orderPayments = payments.filter(p => p.order_id === order.id);
    const paidCount = orderPayments.filter(p => p.is_paid).length;
    const progressPercent = orderPayments.length > 0
      ? Math.round((paidCount / orderPayments.length) * 100)
      : 0;

    let status = 'Pending';
    if (order.is_paid) {
      status = 'Fully Paid';
    } else if (progressPercent > 0) {
      status = 'Partially Paid';
    }

    return {
      ...order,
      clientName: client?.name || 'Unknown Client',
      clientEmail: client?.email || '',
      payments: orderPayments,
      paidCount,
      progressPercent,
      status,
    };
  });

  const filteredOrders = processedOrders.filter(order => {
    const matchesSearch = (order.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'active') {
      if (order.is_paid) return false;
    } else if (activeTab === 'paid') {
      if (!order.is_paid) return false;
    }

    if (filterMonthKey) {
      if (!order.order_date) return false;
      const orderDateObj = new Date(order.order_date);
      const year = orderDateObj.getFullYear();
      const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
      const orderMonth = `${year}-${month}`;
      if (orderMonth !== filterMonthKey) return false;
    }

    return true;
  });

  // Group orders by month
  const getMonthlyOrdersBreakdown = () => {
    const breakdownMap = new Map<string, {
      monthKey: string;
      monthName: string;
      totalAmount: number;
      paidAmount: number;
      pendingAmount: number;
      count: number;
      paidCount: number;
      partialCount: number;
      pendingCount: number;
    }>();

    for (const order of processedOrders) {
      if (!order.order_date) continue;
      const orderDateObj = new Date(order.order_date);
      if (Number.isNaN(orderDateObj.getTime())) continue;

      const year = orderDateObj.getFullYear();
      const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;
      
      const monthName = orderDateObj.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      if (!breakdownMap.has(monthKey)) {
        breakdownMap.set(monthKey, {
          monthKey,
          monthName,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          count: 0,
          paidCount: 0,
          partialCount: 0,
          pendingCount: 0,
        });
      }

      const monthData = breakdownMap.get(monthKey)!;
      monthData.count++;
      monthData.totalAmount += Number(order.amount);

      if (order.is_paid) {
        monthData.paidCount++;
        monthData.paidAmount += Number(order.amount);
      } else {
        if (order.paidCount > 0) {
          monthData.partialCount++;
          const installmentAmount = Number(order.amount) / Number(order.installment_months || 1);
          const paidAmount = installmentAmount * order.paidCount;
          monthData.paidAmount += paidAmount;
          monthData.pendingAmount += (Number(order.amount) - paidAmount);
        } else {
          monthData.pendingCount++;
          monthData.pendingAmount += Number(order.amount);
        }
      }
    }

    return Array.from(breakdownMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  };

  const monthlyOrdersBreakdown = getMonthlyOrdersBreakdown();

  // Exposure stats for Assign Modal
  const outstandingBalance = payments.filter(p => !p.is_paid).reduce((sum, p) => sum + Number(p.amount_due), 0);
  const activeLimitExposure = limits.reduce((sum, l) => sum + Number(l.credit_limit), 0);
  
  const parsedOrderAmount = Number(amount) || 0;
  const parsedMonths = Number(installmentMonths) || 1;
  const estimatedMonthlyDue = parsedOrderAmount / parsedMonths;
  
  const projectedOutstanding = outstandingBalance + parsedOrderAmount;
  const projectedExposurePercent = activeLimitExposure > 0
    ? Math.min(100, Math.round((projectedOutstanding / activeLimitExposure) * 100))
    : 0;

  // Selected client for Assign Modal
  const selectedClient = profiles.find(p => p.id === selectedClientId);

  // Filter client rail
  const filteredClients = profiles.filter(client => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return `${client.name} ${client.email}`.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAssignSubmit = async () => {
    if (!selectedClientId || !itemName || !amount) {
      PremiumAlert.alert('Incomplete Form', 'Please provide a client, item name, and purchase amount.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await callAdminApi('schedule-order', {
        clientId: selectedClientId,
        itemName,
        amount: parseFloat(amount),
        months: parseInt(installmentMonths, 10),
        purchaseDate,
        firstPaymentDate: firstPaymentDate || undefined,
        remarks: remarks || undefined,
      });

      if (response.success) {
        PremiumAlert.alert('Success', `Installment scheduled for ${itemName}!`);
        setIsAssignOpen(false);
        // Clear fields
        setSelectedClientId('');
        setItemName('');
        setAmount('');
        setInstallmentMonths('6');
        setRemarks('');
        loadData(false);
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to schedule installment plan.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditOpen = (order: any) => {
    setSelectedOrder(order);
    setEditItemName(order.item_name || '');
    setEditAmount(order.amount.toString());
    setEditMonths((order.installment_months || 6).toString());
    setEditPurchaseDate(dayjs(order.order_date).format('YYYY-MM-DD'));
    
    const firstPayment = order.payments.find((p: any) => p.month_number === 1);
    setEditFirstPaymentDate(firstPayment ? dayjs(firstPayment.due_date).format('YYYY-MM-DD') : '');
    setEditRemarks(order.remarks || '');
    setEditClientId(order.user_id);
    
    setIsEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editItemName || !editAmount) {
      PremiumAlert.alert('Incomplete Form', 'Please provide item name and purchase amount.');
      return;
    }

    const hasPaidPayments = selectedOrder.payments.some((p: any) => p.is_paid);
    const amountChanged = parseFloat(editAmount) !== Number(selectedOrder.amount);
    const termsChanged = parseInt(editMonths, 10) !== selectedOrder.installment_months;
    const clientChanged = editClientId !== selectedOrder.user_id;

    if (hasPaidPayments && (amountChanged || termsChanged || clientChanged)) {
      PremiumAlert.alert(
        'Locked Fields',
        'Cannot modify client, terms, or purchase amount because payment collections have already started for this order.'
      );
      return;
    }

    setActionLoading(true);
    try {
      const response = await callAdminApi('edit-order', {
        orderId: selectedOrder.id,
        itemName: editItemName,
        amount: parseFloat(editAmount),
        months: parseInt(editMonths, 10),
        purchaseDate: editPurchaseDate,
        firstPaymentDate: editFirstPaymentDate || undefined,
        remarks: editRemarks || undefined,
        clientId: editClientId,
      });

      if (response.success) {
        PremiumAlert.alert('Success', `Order details updated!`);
        setIsEditOpen(false);
        setIsDetailsOpen(false);
        loadData(false);
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to update order details.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubmit = (orderId: string, itemName: string) => {
    PremiumAlert.alert(
      'Delete Order Ledger',
      `Are you sure you want to permanently delete order "${itemName}" and all associated payments? This will restore client credit capacity.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Order',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await callAdminApi('delete-order', { id: orderId });
              if (response.success) {
                PremiumAlert.alert('Deleted', 'Order successfully removed.');
                setIsDetailsOpen(false);
                loadData(false);
              } else {
                PremiumAlert.alert('Error', response.error || 'Failed to delete order.');
              }
            } catch (e: any) {
              PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
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

  if (loading) {
    return (
      <PremiumLoader
        title="Admin Control Center"
        subtitle="Loading order directories and transaction logs..."
        error={error}
        onRetry={() => loadData()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <AdminHeader title="Client Orders" subtitle="Operations Center" />

      {/* Search Box */}
      <View style={[styles.searchSection, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
        <View style={[styles.searchBox, { flex: 1, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Search size={18} color={t.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: t.textPrimary }]}
            placeholder="Search by product name or client..."
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
          style={[styles.assignBtn, { backgroundColor: t.accent, marginTop: 0 }]}
          onPress={() => {
            setClientSearchQuery('');
            setSelectedClientId('');
            setItemName('');
            setAmount('');
            setInstallmentMonths('6');
            setRemarks('');
            setFirstPaymentDate('');
            setIsAssignOpen(true);
          }}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.assignBtnText}>Assign</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {['all', 'active', 'paid'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabBtn,
              activeTab === tab && { backgroundColor: t.accentLight, borderColor: t.accent }
            ]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === tab ? t.accent : t.textSecondary }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)} Plans
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* Collapsible Monthly Orders Breakdown */}
        {monthlyOrdersBreakdown.length > 0 && (
          <View style={[styles.breakdownCollapsibleCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, marginBottom: 12 }]}>
            <TouchableOpacity
              style={styles.breakdownHeaderToggle}
              onPress={() => setShowMonthlyBreakdown(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Calendar size={16} color={t.accent} />
                <Text style={[styles.breakdownTitle, { color: t.textPrimary }]}>Monthly Orders Breakdown</Text>
              </View>
              {showMonthlyBreakdown ? (
                <ChevronUp size={14} color={t.textSecondary} />
              ) : (
                <ChevronDown size={14} color={t.textSecondary} />
              )}
            </TouchableOpacity>

            {showMonthlyBreakdown && (
              <View style={styles.breakdownContent}>
                {/* Active Month filter badge */}
                {filterMonthKey && (
                  <View style={[styles.monthFilterBadge, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: t.border }]}>
                    <Text style={[styles.monthFilterBadgeText, { color: t.textPrimary }]}>
                      Filtered: {monthlyOrdersBreakdown.find(m => m.monthKey === filterMonthKey)?.monthName}
                    </Text>
                    <TouchableOpacity onPress={() => setFilterMonthKey(null)}>
                      <X size={12} color={t.accent} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>
                )}

                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                  {monthlyOrdersBreakdown.map((month) => {
                    const rate = month.count > 0 ? Math.round((month.paidCount / month.count) * 100) : 0;
                    const isSelected = filterMonthKey === month.monthKey;
                    return (
                      <TouchableOpacity
                        key={month.monthKey}
                        style={[
                          styles.monthBreakdownItemCard,
                          { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: isSelected ? t.accent : t.border }
                        ]}
                        onPress={() => {
                          if (filterMonthKey === month.monthKey) {
                            setFilterMonthKey(null);
                          } else {
                            setFilterMonthKey(month.monthKey);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={[styles.monthItemName, { color: t.textPrimary }]}>{month.monthName}</Text>
                          <View style={[styles.monthRateBadge, { backgroundColor: t.accentLight }]}>
                            <Text style={[styles.monthRateText, { color: t.accent }]}>{rate}% Cleared</Text>
                          </View>
                        </View>
                        <Text style={[styles.monthItemCount, { color: t.textSecondary }]}>{month.count} orders</Text>

                        <View style={[styles.monthDivider, { backgroundColor: t.border }]} />

                        <View style={styles.monthStatsGrid}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.monthStatLabel}>Total Volume</Text>
                            <Text style={[styles.monthStatVal, { color: t.textPrimary }]}>{formatCurrency(month.totalAmount)}</Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={styles.monthStatLabel}>Collected</Text>
                            <Text style={[styles.monthStatVal, { color: '#10b981' }]}>{formatCurrency(month.paidAmount)}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* List Header and View Mode controls */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>Active Directory ({filteredOrders.length})</Text>
          <View style={[styles.viewModeContainer, { backgroundColor: isDarkMode ? '#161c2a' : '#f1f5f9', borderColor: t.cardBorder }]}>
            <TouchableOpacity 
              onPress={() => setViewMode('list')} 
              style={[styles.viewModeBtn, viewMode === 'list' && { backgroundColor: isDarkMode ? '#223049' : '#ffffff' }]}
            >
              <List size={14} color={viewMode === 'list' ? t.accent : t.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setViewMode('grid')} 
              style={[styles.viewModeBtn, viewMode === 'grid' && { backgroundColor: isDarkMode ? '#223049' : '#ffffff' }]}
            >
              <LayoutGrid size={14} color={viewMode === 'grid' ? t.accent : t.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Orders list */}
        <View style={viewMode === 'grid' ? styles.orderGridContainer : styles.ordersList}>
          {paginatedOrders.length > 0 ? (
            paginatedOrders.map((order) => {
              if (viewMode === 'grid') {
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={[styles.orderGridCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                    onPress={() => {
                      setSelectedOrder(order);
                      setIsDetailsOpen(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.orderGridAvatarCircle}>
                      <ShoppingBag size={20} color="#fff" />
                    </View>
                    <Text style={[styles.orderGridItemName, { color: t.textPrimary }]} numberOfLines={1}>{order.item_name}</Text>
                    <View style={[styles.clientRow, { justifyContent: 'center' }]}>
                      <User size={10} color={t.textSecondary} />
                      <Text style={[styles.clientText, { textAlign: 'center' }]} numberOfLines={1}>{order.clientName}</Text>
                    </View>

                    <View style={[styles.statusBadge, { marginTop: 4, backgroundColor: order.is_paid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(238, 77, 45, 0.12)' }]}>
                      <Text style={[styles.statusBadgeText, { color: order.is_paid ? '#10b981' : '#ee4d2d', fontSize: 8 }]}>
                        {order.status}
                      </Text>
                    </View>
                    
                    <View style={[styles.clientGridDivider, { backgroundColor: t.border, marginVertical: 8 }]} />

                    <View style={styles.clientGridDetails}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailCardLabel}>Value</Text>
                        <Text style={[styles.detailCardVal, { color: t.textPrimary, fontSize: 11 }]} numberOfLines={1}>{formatCurrency(order.amount)}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.detailCardLabel}>Progress</Text>
                        <Text style={[styles.detailCardVal, { color: '#10b981', fontSize: 11 }]}>{order.paidCount}/{order.installment_months} ({order.progressPercent}%)</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }

              // List Mode View
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                  onPress={() => {
                    setSelectedOrder(order);
                    setIsDetailsOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.orderCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.orderItemName, { color: t.textPrimary }]}>{order.item_name}</Text>
                      <View style={styles.clientRow}>
                        <User size={12} color={t.textSecondary} />
                        <Text style={styles.clientText} numberOfLines={1}>{order.clientName}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: order.is_paid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(238, 77, 45, 0.12)' }]}>
                      <Text style={[styles.statusBadgeText, { color: order.is_paid ? '#10b981' : '#ee4d2d' }]}>
                        {order.status}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.orderCardDivider, { backgroundColor: t.border }]} />

                  <View style={styles.orderCardBottom}>
                    <View>
                      <Text style={styles.bottomLabel}>Principal Value</Text>
                      <Text style={[styles.bottomValue, { color: t.textPrimary }]}>{formatCurrency(order.amount)}</Text>
                    </View>
                    <View>
                      <Text style={styles.bottomLabel}>Amortization Terms</Text>
                      <Text style={[styles.bottomValue, { color: t.textPrimary }]}>{order.installment_months} Months</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.bottomLabel}>Settle Progress</Text>
                      <Text style={[styles.bottomValue, { color: '#10b981' }]}>{order.paidCount}/{order.installment_months} ({order.progressPercent}%)</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No orders match filters.</Text>
          )}
        </View>

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
      </ScrollView>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal visible={isDetailsOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            {/* Redesigned Premium Header Section */}
            <View style={[styles.detailsHeroBanner, { backgroundColor: t.cardBg, borderBottomColor: t.border, borderBottomWidth: 1.5 }]}>
              <View style={styles.detailsHeroTopRow}>
                <View style={styles.detailsHeroTitleCluster}>
                  <ShoppingBag size={18} color={t.accent} />
                  <View>
                    <Text style={[styles.detailsHeroEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>ORDER DETAILS</Text>
                    <Text style={[styles.detailsHeroTitle, { color: t.textPrimary }]}>Order Overview</Text>
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
                    <ShoppingBag size={24} color={t.accent} />
                  </View>
                </View>

                <View style={styles.detailsHeroMeta}>
                  <Text style={[styles.detailsHeroName, { color: t.textPrimary }]} numberOfLines={1}>{selectedOrder.item_name}</Text>
                  <View style={styles.detailsHeroSubRow}>
                    <View style={[styles.statusBadge, { backgroundColor: selectedOrder.is_paid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(238, 77, 45, 0.12)', marginTop: 0 }]}>
                      <Text style={[styles.statusBadgeText, { color: selectedOrder.is_paid ? '#10b981' : '#ee4d2d' }]}>
                        {selectedOrder.status}
                      </Text>
                    </View>
                    <Text style={[styles.detailsHeroId, { color: t.textSecondary }]} numberOfLines={1}>{selectedOrder.clientName}</Text>
                  </View>
                </View>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Order Info Grid */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder, alignItems: 'stretch' }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Details & Limits</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Total Principal</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatCurrency(selectedOrder.amount)}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Installment Terms</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{selectedOrder.installment_months} Months</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Monthly Amortization</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>
                      {formatCurrency(Number(selectedOrder.amount) / (selectedOrder.installment_months || 1))}
                    </Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Scheduled Purchase Date</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatDate(selectedOrder.order_date)}</Text>
                  </View>
                </View>

                {selectedOrder.remarks ? (
                  <View style={[styles.remarksBox, { backgroundColor: t.border }]}>
                    <MessageSquare size={14} color={t.textSecondary} />
                    <Text style={[styles.remarksText, { color: t.textPrimary }]}>{selectedOrder.remarks}</Text>
                  </View>
                ) : null}
              </View>

              {/* Action columns */}
              <View style={styles.actionButtonsCol}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: t.accentLight, borderColor: t.accent }]}
                  onPress={() => handleEditOpen(selectedOrder)}
                >
                  <Edit2 size={16} color={t.accent} />
                  <Text style={[styles.modalActionText, { color: t.accent }]}>Edit Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: '#ef4444' }]}
                  onPress={() => handleDeleteSubmit(selectedOrder.id, selectedOrder.itemName)}
                >
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={[styles.modalActionText, { color: '#ef4444' }]}>Delete Order</Text>
                </TouchableOpacity>
              </View>

              {/* Payments breakdown schedule */}
              <Text style={styles.listHeaderTitle}>Payments Amortization Breakdown</Text>
              <View style={styles.paymentsListCol}>
                {selectedOrder.payments.map((payment: any) => {
                  const isOverdue = !payment.is_paid && new Date(payment.due_date) < new Date();
                  return (
                    <View key={payment.id} style={[styles.paymentRowItem, { borderBottomColor: t.border }]}>
                      <View style={styles.paymentRowItemLeft}>
                        <View style={[styles.numDot, payment.is_paid ? { backgroundColor: '#10b981' } : (isOverdue ? { backgroundColor: '#ef4444' } : { backgroundColor: t.border })]}>
                          <Text style={styles.numDotText}>{payment.month_number}</Text>
                        </View>
                        <View>
                          <Text style={[styles.paymentLabelText, { color: t.textPrimary }]}>Term {payment.month_number}</Text>
                          <Text style={styles.paymentDateText}>Due Date: {formatDate(payment.due_date)}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.paymentAmtText, { color: t.textPrimary }]}>{formatCurrency(payment.amount_due)}</Text>
                        <Text style={[styles.paymentStatusText, payment.is_paid ? { color: '#10b981' } : (isOverdue ? { color: '#ef4444' } : { color: t.textSecondary })]}>
                          {payment.is_paid ? 'Cleared' : (isOverdue ? 'Overdue' : 'Unpaid')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Assign Order Modal */}
      <Modal visible={isAssignOpen} animationType="slide" transparent={true}>
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
                    <Plus size={18} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>LEDGER OPERATIONS</Text>
                    <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Schedule Order</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsAssignOpen(false)} disabled={actionLoading}>
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
                <Text style={[styles.formSectionMeta, { color: t.textSecondary }]}>{profiles.length} accounts</Text>
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
                      value={amount}
                      onChangeText={setAmount}
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

              <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>REMARKS / SPECIFICATIONS</Text>
                <TextInput
                  style={[styles.premiumInput, { color: t.textPrimary, minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="Write details or serial numbers..."
                  placeholderTextColor={t.textSecondary}
                  multiline={true}
                  value={remarks}
                  onChangeText={setRemarks}
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
              <TouchableOpacity style={[styles.secondaryAction, { borderColor: t.cardBorder }]} onPress={() => setIsAssignOpen(false)} disabled={actionLoading}>
                <Text style={[styles.secondaryActionText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryAction, { backgroundColor: t.accent, opacity: actionLoading ? 0.7 : 1 }]} onPress={handleAssignSubmit} disabled={actionLoading}>
                <CheckCircle2 size={16} color="#ffffff" />
                <Text style={styles.primaryActionText}>{actionLoading ? 'Assigning...' : 'Assign Order'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Order Modal */}
      <Modal visible={isEditOpen} animationType="slide" transparent={true}>
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
                    <Edit2 size={18} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>LEDGER OPERATIONS</Text>
                    <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Edit Order Details</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsEditOpen(false)} disabled={actionLoading}>
                  <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sheetHeroText, { color: t.textSecondary }]}>
                Modify ledger record credentials. Note that terms and amounts lock once collections begin.
              </Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.premiumFormContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.formSectionHeader}>
                <Text style={[styles.formSectionTitle, { color: t.textPrimary }]}>Order Allocation</Text>
              </View>

              {/* Client Selection card - Display current or edit client if not locked */}
              {selectedOrder && (
                <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder, opacity: selectedOrder.payments.some((p: any) => p.is_paid) ? 0.65 : 1 }]}>
                  <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>ASSIGNED CLIENT {selectedOrder.payments.some((p: any) => p.is_paid) && '(LOCKED)'}</Text>
                  
                  {selectedOrder.payments.some((p: any) => p.is_paid) ? (
                    <View style={{ paddingVertical: 4 }}>
                      <Text style={[styles.premiumInput, { color: t.textPrimary }]}>{selectedOrder.clientName}</Text>
                      <Text style={[styles.clientSelectEmailText, { marginTop: 2 }]}>{selectedOrder.clientEmail}</Text>
                    </View>
                  ) : (
                    <View style={[styles.clientSelectContainer, { borderColor: t.border, marginTop: 4 }]}>
                      <ScrollView style={{ maxHeight: 100 }} nestedScrollEnabled={true}>
                        {profiles.map((client) => (
                          <TouchableOpacity
                            key={client.id}
                            style={[
                              styles.clientSelectItem,
                              editClientId === client.id && { backgroundColor: t.accentLight }
                            ]}
                            onPress={() => setEditClientId(client.id)}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <Text style={[styles.clientSelectItemText, { color: t.textPrimary, fontWeight: editClientId === client.id ? 'bold' : 'normal' }]}>
                                {client.name}
                              </Text>
                              {editClientId === client.id && <Check size={14} color={t.accent} />}
                            </View>
                            <Text style={styles.clientSelectEmailText}>{client.email}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.formSectionHeader}>
                <Text style={[styles.formSectionTitle, { color: t.textPrimary }]}>Purchase Specs</Text>
              </View>

              <View style={styles.inputGrid}>
                {/* Product Name Input */}
                <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                  <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>ITEM / PRODUCT NAME</Text>
                  <TextInput
                    style={[styles.premiumInput, { color: t.textPrimary }]}
                    placeholder="Product Name"
                    placeholderTextColor={t.textSecondary}
                    value={editItemName}
                    onChangeText={setEditItemName}
                  />
                </View>

                {/* Amount Input */}
                {selectedOrder && (
                  <View style={[
                    styles.premiumInputCard, 
                    { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder },
                    selectedOrder.payments.some((p: any) => p.is_paid) && { opacity: 0.65 }
                  ]}>
                    <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>
                      PURCHASE VALUE (PHP) {selectedOrder.payments.some((p: any) => p.is_paid) && '(LOCKED)'}
                    </Text>
                    <TextInput
                      style={[styles.premiumInput, { color: t.textPrimary }]}
                      placeholder="Purchase Value"
                      keyboardType="numeric"
                      placeholderTextColor={t.textSecondary}
                      value={editAmount}
                      onChangeText={setEditAmount}
                      editable={!selectedOrder.payments.some((p: any) => p.is_paid)}
                    />
                  </View>
                )}

                {/* Installment terms */}
                {selectedOrder && (
                  <View style={[
                    styles.premiumInputCard, 
                    { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder },
                    selectedOrder.payments.some((p: any) => p.is_paid) && { opacity: 0.65 }
                  ]}>
                    <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>
                      INSTALLMENT TERM {selectedOrder.payments.some((p: any) => p.is_paid) && '(LOCKED)'}
                    </Text>
                    <View style={styles.monthsRow}>
                      {['3', '6', '12', '24'].map((m) => {
                        const editable = !selectedOrder.payments.some((p: any) => p.is_paid);
                        return (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.premiumMonthSelector,
                              editMonths === m && { backgroundColor: t.accent },
                              !editable && { opacity: 0.5 }
                            ]}
                            onPress={() => {
                              if (editable) setEditMonths(m);
                            }}
                            disabled={!editable}
                          >
                            <Text style={[styles.premiumMonthSelectorText, editMonths === m && { color: '#fff' }]}>{m}M</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Purchase Date */}
                {selectedOrder && (
                  <DatePicker
                    label={`Purchase Date ${selectedOrder.payments.some((p: any) => p.is_paid) ? '(LOCKED)' : ''}`}
                    value={editPurchaseDate}
                    onChange={setEditPurchaseDate}
                    disabled={selectedOrder.payments.some((p: any) => p.is_paid)}
                  />
                )}

                {/* First Payment Date */}
                {selectedOrder && (
                  <DatePicker
                    label={`First Payment Due Date ${selectedOrder.payments.some((p: any) => p.is_paid) ? '(LOCKED)' : ''}`}
                    value={editFirstPaymentDate}
                    onChange={setEditFirstPaymentDate}
                    disabled={selectedOrder.payments.some((p: any) => p.is_paid)}
                  />
                )}

                {/* Remarks */}
                <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                  <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>REMARKS</Text>
                  <TextInput
                    style={[styles.premiumInput, { color: t.textPrimary, minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="Add notes..."
                    placeholderTextColor={t.textSecondary}
                    multiline={true}
                    value={editRemarks}
                    onChangeText={setEditRemarks}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={[styles.sheetActions, { borderTopColor: t.cardBorder }]}>
              <TouchableOpacity style={[styles.secondaryAction, { borderColor: t.cardBorder }]} onPress={() => setIsEditOpen(false)} disabled={actionLoading}>
                <Text style={[styles.secondaryActionText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryAction, { backgroundColor: t.accent, opacity: actionLoading ? 0.7 : 1 }]} onPress={handleEditSubmit} disabled={actionLoading}>
                <CheckCircle2 size={16} color="#ffffff" />
                <Text style={styles.primaryActionText}>{actionLoading ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingBottom: 12,
  },
  headerLeft: {
    gap: 2,
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
    letterSpacing: -0.3,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  assignBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
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
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  ordersList: {
    gap: 12,
  },
  orderCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 6,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  clientText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
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
  orderCardDivider: {
    height: 1,
  },
  orderCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  bottomValue: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    paddingVertical: 20,
  },
  // Modal layout
  modalScrollContainer: {
    flex: 1,
  },
  modalHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 6,
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
  modalAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  clientEmail: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  remarksBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  remarksText: {
    fontSize: 11,
    flex: 1,
  },
  actionButtonsCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalActionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  modalActionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 8,
  },
  paymentsListCol: {
    gap: 10,
  },
  paymentRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  paymentRowItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  numDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numDotText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentDateText: {
    fontSize: 9,
    color: '#64748b',
  },
  paymentAmtText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  paymentStatusText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
  },
  // Nest modals
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
  // Layout views & view mode controls
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  viewModeContainer: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
  },
  viewModeBtn: {
    padding: 5,
    borderRadius: 8,
  },
  orderGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderGridCard: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  orderGridAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderGridItemName: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  clientGridDivider: {
    height: 1,
    alignSelf: 'stretch',
  },
  clientGridDetails: {
    alignSelf: 'stretch',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailCardLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  detailCardVal: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  paginationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  paginationBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  paginationInfo: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Details Modal styles
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
  // Bottom Sheet layout & Form styles
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
  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
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
  clientSelectContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 8,
    marginTop: 4,
  },
  clientSelectItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  clientSelectItemText: {
    fontSize: 12,
  },
  clientSelectEmailText: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  premiumMonthSelector: {
    width: '22%',
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumMonthSelectorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  breakdownCollapsibleCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  breakdownHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  breakdownContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  monthFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  monthFilterBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  monthBreakdownItemCard: {
    width: 190,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  monthItemName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  monthRateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  monthRateText: {
    fontSize: 8,
    fontWeight: '800',
  },
  monthItemCount: {
    fontSize: 10,
  },
  monthDivider: {
    height: 1,
    marginVertical: 4,
  },
  monthStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthStatLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '600',
  },
  monthStatVal: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 1,
  },
  sheetMetricRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
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
    fontWeight: 'bold',
    marginTop: 4,
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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
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
});
