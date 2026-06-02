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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Search,
  ChevronRight,
  Sliders,
  Calendar,
  User,
  X,
  Send,
  AlertCircle,
  Clock,
  History,
  CheckCircle,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAllAdminData, callAdminApi } from '../../services/adminService';
import dayjs from 'dayjs';

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

export default function AdminRemindersScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [profiles, setProfiles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [reminderLogs, setReminderLogs] = useState<any[]>([]);

  // Search & Tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Modals state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Bulk Broadcast Form state
  const [broadcastType, setBroadcastType] = useState<'overdue' | 'selected'>('overdue');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [targetMonth, setTargetMonth] = useState(() => (new Date().getMonth() + 1).toString());
  const [targetYear, setTargetYear] = useState(() => new Date().getFullYear().toString());

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const result = await fetchAllAdminData();
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync reminders ledger logs.');
      }
      setProfiles(result.profiles || []);
      setOrders(result.orders || []);
      setPayments(result.payments || []);
      setReminderLogs(result.reminderLogs || []);
    } catch (err: any) {
      console.warn('[AdminRemindersScreen] Load error:', err);
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

  // Helper selectors
  const getUrgency = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const dueDate = new Date(dueDateStr);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (dueDate < today) {
      return { label: 'Overdue', color: '#ef4444', urgency: 'overdue' };
    } else if (diffDays <= 3) {
      return { label: 'Due Soon', color: '#eab308', urgency: 'urgent' };
    }
    return { label: 'Normal', color: '#64748b', urgency: 'normal' };
  };

  // Process data for rendering lists
  const pendingPayments = payments
    .filter((p: any) => !p.is_paid)
    .map(p => {
      const order = orders.find(o => o.id === p.order_id);
      const client = profiles.find(pr => pr.id === order?.user_id);
      const urgencyInfo = getUrgency(p.due_date);

      return {
        ...p,
        itemName: order?.item_name || 'Purchase Order',
        totalMonths: order?.installment_months || 0,
        clientName: client?.name || 'Unknown Client',
        clientEmail: client?.email || '',
        clientId: client?.id || '',
        ...urgencyInfo,
      };
    })
    .filter(p => {
      return p.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const formattedLogs = reminderLogs.map((log: any) => {
    const payment = payments.find(p => p.id === log.payment_id);
    const order = payment ? orders.find(o => o.id === payment.order_id) : null;
    const client = order ? profiles.find(pr => pr.id === order.user_id) : null;
    const sender = profiles.find(p => p.id === log.sent_by_id);

    return {
      ...log,
      clientName: client?.name || 'Unknown Client',
      itemName: order?.item_name || 'Item Ledger',
      senderName: sender?.name || (log.automated ? 'System Automator' : 'Admin'),
      monthNumber: payment?.month_number || 0,
    };
  });

  const handleSendReminder = async (paymentId: string, itemName: string, clientName: string) => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('send-reminder', { id: paymentId });
      if (response.success) {
        Alert.alert('Success', `Manual reminder email sent to ${clientName} for ${itemName}!`);
        loadData(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to dispatch email.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClientToggle = (clientId: string) => {
    if (selectedClientIds.includes(clientId)) {
      setSelectedClientIds(prev => prev.filter(id => id !== clientId));
    } else {
      setSelectedClientIds(prev => [...prev, clientId]);
    }
  };

  const handleBulkBroadcast = async () => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('send-bulk-reminders', {
        type: broadcastType,
        clientIds: broadcastType === 'selected' ? selectedClientIds : undefined,
        month: targetMonth,
        year: targetYear,
      });

      if (response.success) {
        Alert.alert('Success', `Broadcast alerts sent. Count: ${response.count || 0}`);
        setIsBulkOpen(false);
        setSelectedClientIds([]);
        loadData(false);
      } else {
        Alert.alert('Error', response.error || 'Failed bulk broadcast.');
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

  const overduePayments = pendingPayments.filter(p => p.urgency === 'overdue');
  const totalDuesOutstanding = pendingPayments.reduce((sum, p) => sum + Number(p.amount_due), 0);

  if (loading) {
    return (
      <PremiumLoader
        title="Admin Control Center"
        subtitle="Loading active reminders and scheduled triggers..."
        error={error}
        onRetry={() => loadData()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSubtitle}>Operations Center</Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Dues Reminders</Text>
        </View>
        <TouchableOpacity style={[styles.broadcastBtn, { backgroundColor: t.accent }]} onPress={() => setIsBulkOpen(true)}>
          <Send size={16} color="#fff" />
          <Text style={styles.broadcastBtnText}>Broadcast</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      {activeTab === 'pending' && (
        <View style={styles.searchSection}>
          <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Search size={18} color={t.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: t.textPrimary }]}
              placeholder="Search by client or item name..."
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
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'pending' && { backgroundColor: t.accentLight, borderColor: t.accent }]}
          onPress={() => setActiveTab('pending')}
        >
          <Clock size={16} color={activeTab === 'pending' ? t.accent : t.textSecondary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'pending' ? t.accent : t.textSecondary }]}>Pending Dues</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && { backgroundColor: t.accentLight, borderColor: t.accent }]}
          onPress={() => setActiveTab('history')}
        >
          <History size={16} color={activeTab === 'history' ? t.accent : t.textSecondary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'history' ? t.accent : t.textSecondary }]}>Trigger Log</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {activeTab === 'pending' ? (
          <>
            {/* Quick stats banner */}
            <View style={styles.statsBanner}>
              <View style={[styles.miniCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={styles.miniLabel}>Overdue Items</Text>
                <Text style={[styles.miniValue, { color: '#ef4444' }]}>{overduePayments.length}</Text>
              </View>
              <View style={[styles.miniCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={styles.miniLabel}>Total Outstanding Dues</Text>
                <Text style={[styles.miniValue, { color: t.textPrimary }]}>{formatCurrency(totalDuesOutstanding)}</Text>
              </View>
            </View>

            {/* List */}
            <Text style={styles.sectionHeaderTitle}>Dues Outstanding ({pendingPayments.length})</Text>
            <View style={styles.pendingList}>
              {pendingPayments.length > 0 ? (
                pendingPayments.map((p) => (
                  <View key={p.id} style={[styles.pendingItemCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={styles.pendingItemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pendingItemName, { color: t.textPrimary }]} numberOfLines={1}>{p.itemName}</Text>
                        <Text style={styles.clientSubtitle}>{p.clientName} • Term {p.month_number} of {p.totalMonths}</Text>
                      </View>
                      <View style={[styles.urgencyBadge, { backgroundColor: p.color + '1a' }]}>
                        <Text style={[styles.urgencyText, { color: p.color }]}>{p.label}</Text>
                      </View>
                    </View>

                    <View style={[styles.dividerLine, { backgroundColor: t.border }]} />

                    <View style={styles.pendingItemFooter}>
                      <View>
                        <Text style={styles.footerLabel}>Amount Due</Text>
                        <Text style={[styles.footerValue, { color: t.textPrimary }]}>{formatCurrency(p.amount_due)}</Text>
                      </View>
                      <View>
                        <Text style={styles.footerLabel}>Due Date</Text>
                        <Text style={[styles.footerValue, { color: t.textPrimary }]}>{formatDate(p.due_date)}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.sendSingleBtn, { backgroundColor: t.accentLight }]}
                        onPress={() => handleSendReminder(p.id, p.itemName, p.clientName)}
                        disabled={actionLoading}
                      >
                        <Send size={14} color={t.accent} />
                        <Text style={styles.sendSingleText}>Remind</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No pending dues require reminders.</Text>
              )}
            </View>
          </>
        ) : (
          <>
            {/* History logs */}
            <Text style={styles.sectionHeaderTitle}>Broadcast & Alert Audits</Text>
            <View style={[styles.logsContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {formattedLogs.length > 0 ? (
                formattedLogs.map((log, idx) => (
                  <View key={log.id} style={[styles.logItemRow, idx < formattedLogs.length - 1 && { borderBottomColor: t.border }]}>
                    <View style={styles.logItemLeft}>
                      <View style={styles.logStatusIndicator}>
                        <CheckCircle size={14} color="#10b981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.logDescription, { color: t.textPrimary }]} numberOfLines={1}>
                          Reminder Sent for {log.itemName} (Term {log.monthNumber})
                        </Text>
                        <Text style={styles.logMetadata}>
                          Client: {log.clientName} • Triggered by: {log.senderName}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.logTimeText}>{dayjs(log.sent_at).format('MMM D, h:mm A')}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No reminder triggers recorded.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bulk Broadcast Modal */}
      <Modal visible={isBulkOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Broadcast Dues reminders</Text>

            <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Broadcast Target Filter</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[styles.radioBtn, broadcastType === 'overdue' && { backgroundColor: t.accentLight }]}
                  onPress={() => setBroadcastType('overdue')}
                >
                  <Text style={[styles.radioBtnText, { color: broadcastType === 'overdue' ? t.accent : t.textSecondary }]}>
                    All Overdue Dues
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioBtn, broadcastType === 'selected' && { backgroundColor: t.accentLight }]}
                  onPress={() => setBroadcastType('selected')}
                >
                  <Text style={[styles.radioBtnText, { color: broadcastType === 'selected' ? t.accent : t.textSecondary }]}>
                    Selected Clients
                  </Text>
                </TouchableOpacity>
              </View>

              {broadcastType === 'selected' && (
                <>
                  <Text style={styles.label}>Select Clients</Text>
                  <View style={[styles.selectBox, { borderColor: t.border }]}>
                    <ScrollView style={{ maxHeight: 120 }}>
                      {profiles.map((client) => {
                        const isSelected = selectedClientIds.includes(client.id);
                        return (
                          <TouchableOpacity
                            key={client.id}
                            style={[styles.selectItem, isSelected && { backgroundColor: t.accentLight }]}
                            onPress={() => handleClientToggle(client.id)}
                          >
                            <Text style={[styles.selectItemText, { color: t.textPrimary }]}>{client.name} ({client.email})</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </>
              )}

              <Text style={styles.label}>Amortization Period Month</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="Month (e.g. 6)"
                keyboardType="numeric"
                placeholderTextColor={t.textSecondary}
                value={targetMonth}
                onChangeText={setTargetMonth}
              />

              <Text style={styles.label}>Amortization Period Year</Text>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="Year (e.g. 2026)"
                keyboardType="numeric"
                placeholderTextColor={t.textSecondary}
                value={targetYear}
                onChangeText={setTargetYear}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsBulkOpen(false)} disabled={actionLoading}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: t.accent }]} onPress={handleBulkBroadcast} disabled={actionLoading}>
                <Text style={styles.confirmBtnText}>{actionLoading ? 'Broadcasting...' : 'Send Broadcast'}</Text>
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
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  broadcastBtnText: {
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
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
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
    gap: 16,
  },
  statsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  miniCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  miniLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  miniValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 8,
  },
  pendingList: {
    gap: 12,
  },
  pendingItemCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  pendingItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingItemName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  clientSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  dividerLine: {
    height: 1,
  },
  pendingItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  footerValue: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  sendSingleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sendSingleText: {
    color: '#ee4d2d',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logsContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
  },
  logItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  logItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  logStatusIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logDescription: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logMetadata: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  logTimeText: {
    fontSize: 10,
    color: '#64748b',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    paddingVertical: 20,
  },
  // Modal layout
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
  radioGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  radioBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
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
