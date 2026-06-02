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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShoppingBag,
  Search,
  ChevronRight,
  Sliders,
  Trash2,
  Calendar,
  CreditCard,
  User,
  FileText,
  X,
  Plus,
  Edit2,
  CheckCircle,
  Clock,
  MessageSquare,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAllAdminData, callAdminApi } from '../../services/adminService';
import dayjs from 'dayjs';
import AdminHeader from '../../components/AdminHeader';

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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paid'>('all');

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

  // Form states - Edit Order
  const [editItemName, setEditItemName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMonths, setEditMonths] = useState('6');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editFirstPaymentDate, setEditFirstPaymentDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editClientId, setEditClientId] = useState('');

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
    const matchesSearch = order.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'active') {
      return !order.is_paid;
    } else if (activeTab === 'paid') {
      return order.is_paid;
    }
    return true;
  });

  const handleAssignSubmit = async () => {
    if (!selectedClientId || !itemName || !amount) {
      Alert.alert('Incomplete Form', 'Please provide a client, item name, and purchase amount.');
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
        Alert.alert('Success', `Installment scheduled for ${itemName}!`);
        setIsAssignOpen(false);
        // Clear fields
        setSelectedClientId('');
        setItemName('');
        setAmount('');
        setInstallmentMonths('6');
        setRemarks('');
        loadData(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to schedule installment plan.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditOpen = (order: any) => {
    setSelectedOrder(order);
    setEditItemName(order.itemName);
    setEditAmount(order.amount.toString());
    setEditMonths(order.installmentMonths.toString());
    setEditPurchaseDate(dayjs(order.orderDate).format('YYYY-MM-DD'));
    
    const firstPayment = order.payments.find((p: any) => p.month_number === 1);
    setEditFirstPaymentDate(firstPayment ? dayjs(firstPayment.due_date).format('YYYY-MM-DD') : '');
    setEditRemarks(order.remarks || '');
    setEditClientId(order.user_id);
    
    setIsEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editItemName || !editAmount) {
      Alert.alert('Incomplete Form', 'Please provide item name and purchase amount.');
      return;
    }

    const hasPaidPayments = selectedOrder.payments.some((p: any) => p.is_paid);
    const amountChanged = parseFloat(editAmount) !== Number(selectedOrder.amount);
    const termsChanged = parseInt(editMonths, 10) !== selectedOrder.installmentMonths;
    const clientChanged = editClientId !== selectedOrder.user_id;

    if (hasPaidPayments && (amountChanged || termsChanged || clientChanged)) {
      Alert.alert(
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
        Alert.alert('Success', `Order details updated!`);
        setIsEditOpen(false);
        setIsDetailsOpen(false);
        loadData(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to update order details.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubmit = (orderId: string, itemName: string) => {
    Alert.alert(
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
                Alert.alert('Deleted', 'Order successfully removed.');
                setIsDetailsOpen(false);
                loadData(false);
              } else {
                Alert.alert('Error', response.error || 'Failed to delete order.');
              }
            } catch (e: any) {
              Alert.alert('Network Error', e?.message || 'Server connection failed.');
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
        <TouchableOpacity style={[styles.assignBtn, { backgroundColor: t.accent, marginTop: 0 }]} onPress={() => setIsAssignOpen(true)}>
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
        {/* Orders list */}
        <View style={styles.ordersList}>
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
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
                    <Text style={[styles.orderItemName, { color: t.textPrimary }]}>{order.itemName}</Text>
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
                    <Text style={[styles.bottomValue, { color: t.textPrimary }]}>{order.installmentMonths} Months</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bottomLabel}>Settle Progress</Text>
                    <Text style={[styles.bottomValue, { color: '#10b981' }]}>{order.progressPercent}%</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No orders match filters.</Text>
          )}
        </View>
      </ScrollView>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal visible={isDetailsOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            {/* Modal header */}
            <View style={[styles.modalHeaderBar, { borderBottomColor: t.border }]}>
              <Text style={[styles.modalHeaderTitle, { color: t.textPrimary }]}>Order Overview</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsDetailsOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Product and Status */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.modalAvatarCircle}>
                  <ShoppingBag size={28} color="#fff" />
                </View>
                <Text style={[styles.modalName, { color: t.textPrimary }]}>{selectedOrder.itemName}</Text>
                <Text style={styles.clientEmail}>{selectedOrder.clientName} ({selectedOrder.clientEmail})</Text>

                <View style={[styles.statusBadge, { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: selectedOrder.is_paid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(238, 77, 45, 0.12)' }]}>
                  <Text style={[styles.statusBadgeText, { fontSize: 11, color: selectedOrder.is_paid ? '#10b981' : '#ee4d2d' }]}>
                    {selectedOrder.status}
                  </Text>
                </View>
              </View>

              {/* Order Info Grid */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Details & Limits</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Total Principal</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatCurrency(selectedOrder.amount)}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Installment Terms</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{selectedOrder.installmentMonths} Months</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Monthly Amortization</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>
                      {formatCurrency(Number(selectedOrder.amount) / selectedOrder.installmentMonths)}
                    </Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Scheduled Purchase Date</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatDate(selectedOrder.orderDate)}</Text>
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Schedule New Order</Text>

            <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Select Client</Text>
              <View style={[styles.selectBox, { borderColor: t.border }]}>
                <ScrollView style={{ maxHeight: 120 }}>
                  {profiles.map((client) => (
                    <TouchableOpacity
                      key={client.id}
                      style={[
                        styles.selectItem,
                        selectedClientId === client.id && { backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setSelectedClientId(client.id)}
                    >
                      <Text style={[styles.selectItemText, { color: t.textPrimary }]}>{client.name} ({client.email})</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.label}>Item / Product Name</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="e.g. iPhone 15 Pro Max"
                placeholderTextColor={t.textSecondary}
                value={itemName}
                onChangeText={setItemName}
              />

              <Text style={styles.label}>Purchase Amount (PHP)</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="e.g. 72000"
                keyboardType="numeric"
                placeholderTextColor={t.textSecondary}
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.label}>Installment Terms (Months)</Text>
              <View style={styles.monthsRow}>
                {['3', '6', '12', '24'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthSelector, installmentMonths === m && { backgroundColor: t.accent }]}
                    onPress={() => setInstallmentMonths(m)}
                  >
                    <Text style={[styles.monthSelectorText, installmentMonths === m && { color: '#fff' }]}>{m}M</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Purchase Date</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.textSecondary}
                value={purchaseDate}
                onChangeText={setPurchaseDate}
              />

              <Text style={styles.label}>First Payment Date (Optional)</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.textSecondary}
                value={firstPaymentDate}
                onChangeText={setFirstPaymentDate}
              />

              <Text style={styles.label}>Remarks / Descriptions</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border, height: 70, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder="Write order details..."
                placeholderTextColor={t.textSecondary}
                multiline={true}
                value={remarks}
                onChangeText={setRemarks}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAssignOpen(false)} disabled={actionLoading}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: t.accent }]} onPress={handleAssignSubmit} disabled={actionLoading}>
                <Text style={styles.confirmBtnText}>{actionLoading ? 'Assigning...' : 'Assign Order'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Order Modal */}
      <Modal visible={isEditOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Edit Order Details</Text>

            <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Item / Product Name</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="Product Name"
                placeholderTextColor={t.textSecondary}
                value={editItemName}
                onChangeText={setEditItemName}
              />

              {/* Block limit edits if payments exist */}
              <Text style={styles.label}>Purchase Amount (PHP)</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="Purchase Value"
                keyboardType="numeric"
                placeholderTextColor={t.textSecondary}
                value={editAmount}
                onChangeText={setEditAmount}
                editable={selectedOrder && !selectedOrder.payments.some((p: any) => p.is_paid)}
              />

              <Text style={styles.label}>Installment Terms (Months)</Text>
              <View style={styles.monthsRow}>
                {['3', '6', '12', '24'].map((m) => {
                  const editable = selectedOrder && !selectedOrder.payments.some((p: any) => p.is_paid);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.monthSelector,
                        editMonths === m && { backgroundColor: t.accent },
                        !editable && { opacity: 0.5 }
                      ]}
                      onPress={() => {
                        if (editable) setEditMonths(m);
                      }}
                      disabled={!editable}
                    >
                      <Text style={[styles.monthSelectorText, editMonths === m && { color: '#fff' }]}>{m}M</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Purchase Date</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.textSecondary}
                value={editPurchaseDate}
                onChangeText={setEditPurchaseDate}
                editable={selectedOrder && !selectedOrder.payments.some((p: any) => p.is_paid)}
              />

              <Text style={styles.label}>First Payment Due Date</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.textSecondary}
                value={editFirstPaymentDate}
                onChangeText={setEditFirstPaymentDate}
                editable={selectedOrder && !selectedOrder.payments.some((p: any) => p.is_paid)}
              />

              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border, height: 70, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder="Add notes..."
                placeholderTextColor={t.textSecondary}
                multiline={true}
                value={editRemarks}
                onChangeText={setEditRemarks}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditOpen(false)} disabled={actionLoading}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: t.accent }]} onPress={handleEditSubmit} disabled={actionLoading}>
                <Text style={styles.confirmBtnText}>{actionLoading ? 'Saving...' : 'Save Changes'}</Text>
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
});
