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
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'proof'>('all');

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  // Modals state
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // Process data for rendering lists
  const processedPayments = payments.map(p => {
    const order = orders.find(o => o.id === p.order_id);
    const client = profiles.find(pr => pr.id === order?.user_id);
    const isOverdue = !p.is_paid && new Date(p.due_date) < new Date();

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

  const filteredPayments = processedPayments.filter(p => {
    const matchesSearch = p.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'paid') {
      return p.is_paid;
    } else if (activeTab === 'pending') {
      return !p.is_paid;
    } else if (activeTab === 'overdue') {
      return p.isOverdue;
    } else if (activeTab === 'proof') {
      return !p.is_paid && p.proof_of_payment !== null && p.proof_of_payment !== '';
    }
    return true;
  });

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

  const handleResendReceipt = async () => {
    setActionLoading(true);
    try {
      const date = new Date(selectedPayment.due_date);
      const response = await callAdminApi('resend-receipt', {
        clientId: selectedPayment.clientId,
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

      {/* Search Section */}
      <View style={[styles.searchSection, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
        <View style={[styles.searchBox, { flex: 1, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Search size={18} color={t.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: t.textPrimary }]}
            placeholder="Search by client name, item, or status..."
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
          style={[styles.bulkToggleBtn, bulkMode && { backgroundColor: t.accentLight }, { marginTop: 0 }]}
          onPress={() => {
            setBulkMode(!bulkMode);
            setSelectedIds([]);
          }}
        >
          <CheckSquare size={16} color={bulkMode ? t.accent : t.textSecondary} />
          <Text style={[styles.bulkToggleText, { color: bulkMode ? t.accent : t.textSecondary }]}>Bulk</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
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
                activeTab === tab.key && { backgroundColor: t.accentLight, borderColor: t.accent }
              ]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Text style={[styles.tabBtnText, { color: activeTab === tab.key ? t.accent : t.textSecondary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Ledger list */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        <View style={styles.ledgerList}>
          {filteredPayments.length > 0 ? (
            filteredPayments.map((payment) => {
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
      </ScrollView>

      {/* Floating Bulk Actions Bar */}
      {bulkMode && selectedIds.length > 0 && (
        <View style={[styles.floatingBulkBar, { backgroundColor: t.cardBg, borderTopColor: t.border }]}>
          <Text style={[styles.bulkLabel, { color: t.textPrimary }]}>{selectedIds.length} Selected</Text>
          <View style={styles.bulkBtnRow}>
            <TouchableOpacity style={styles.bulkCancelBtn} onPress={() => setSelectedIds([])}>
              <Text style={styles.bulkCancelBtnText}>Deselect</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkConfirmBtn, { backgroundColor: t.accent }]} onPress={handleBulkClear} disabled={actionLoading}>
              <Text style={styles.bulkConfirmBtnText}>{actionLoading ? 'Clearing...' : 'Bulk Clear'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && (
        <Modal visible={isDetailsOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            {/* Modal header */}
            <View style={[styles.modalHeaderBar, { borderBottomColor: t.border }]}>
              <Text style={[styles.modalHeaderTitle, { color: t.textPrimary }]}>Transaction Details</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsDetailsOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Profile Card */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.modalAvatarCircle}>
                  <Receipt size={28} color="#fff" />
                </View>
                <Text style={[styles.modalName, { color: t.textPrimary }]}>{selectedPayment.itemName}</Text>
                <Text style={styles.clientEmail}>Term {selectedPayment.month_number} of {selectedPayment.totalMonths}</Text>

                <View style={[
                  styles.statusBadge,
                  { paddingHorizontal: 12, paddingVertical: 4 },
                  selectedPayment.is_paid ? { backgroundColor: 'rgba(16, 185, 129, 0.12)' } : (selectedPayment.isOverdue ? { backgroundColor: 'rgba(239, 68, 68, 0.12)' } : { backgroundColor: t.border })
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    { fontSize: 11 },
                    selectedPayment.is_paid ? { color: '#10b981' } : (selectedPayment.isOverdue ? { color: '#ef4444' } : { color: t.textSecondary })
                  ]}>
                    {selectedPayment.is_paid ? 'Cleared' : (selectedPayment.isOverdue ? 'Overdue' : 'Pending')}
                  </Text>
                </View>
              </View>

              {/* Info Grid */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
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

              {/* Proof of payment viewer */}
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

              {/* Standard manual check buttons */}
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
                    onPress={handleResendReceipt}
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Reject Payment Proof</Text>
            <Text style={[styles.modalDesc, { color: t.textSecondary }]}>
              Provide a clear feedback reason to the client explaining why their uploaded payment receipt was rejected.
            </Text>

            <TextInput
              style={[styles.input, { color: t.textPrimary, borderColor: t.border, height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              placeholder="e.g. Receipt image is blurry, wrong amount, duplicate receipt..."
              placeholderTextColor={t.textSecondary}
              multiline={true}
              value={rejectReason}
              onChangeText={setRejectReason}
            />

            <View style={[styles.modalButtons, { marginTop: 24 }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsRejectOpen(false)} disabled={actionLoading}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#ef4444' }]} onPress={handleRejectProofSubmit} disabled={actionLoading}>
                <Text style={styles.confirmBtnText}>{actionLoading ? 'Rejecting...' : 'Reject Proof'}</Text>
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
  tabsWrapper: {
    marginBottom: 16,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 10,
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
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 13,
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
