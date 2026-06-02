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
  Users,
  Search,
  ChevronRight,
  TrendingUp,
  Sliders,
  Trash2,
  Calendar,
  CreditCard,
  Mail,
  Phone,
  FileText,
  X,
  Plus,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import AdminHeader from '../../components/AdminHeader';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAllAdminData, callAdminApi } from '../../services/adminService';

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

export default function AdminClientsScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [profiles, setProfiles] = useState<any[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending'>('all');

  // Details Modal state
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Action Modals
  const [isAdjustLimitOpen, setIsAdjustLimitOpen] = useState(false);
  const [newLimitValue, setNewLimitValue] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const result = await fetchAllAdminData();
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync ledger records.');
      }
      setProfiles(result.profiles || []);
      setLimits(result.accountLimits || []);
      setOrders(result.orders || []);
      setPayments(result.payments || []);
    } catch (err: any) {
      console.warn('[AdminClientsScreen] Load error:', err);
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

  // Helper selectors for a client
  const getClientLimit = (clientId: string) => {
    const lim = limits.find(l => l.user_id === clientId);
    return lim ? Number(lim.credit_limit) : 50000.00;
  };

  const getClientStats = (clientId: string) => {
    const clientOrders = orders.filter(o => o.user_id === clientId);
    const clientPayments = payments.filter(p => clientOrders.some(o => o.id === p.order_id));
    const totalSpent = clientOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const unpaidPayments = clientPayments.filter(p => !p.is_paid);
    const totalOutstanding = unpaidPayments.reduce((sum, p) => sum + Number(p.amount_due), 0);
    const activeOrders = clientOrders.filter(o => !o.is_paid).length;

    return {
      totalSpent,
      totalOutstanding,
      activeOrders,
      orderCount: clientOrders.length,
      orders: clientOrders.map(order => {
        const orderPayments = payments.filter(p => p.order_id === order.id);
        return {
          ...order,
          payments: orderPayments,
        };
      }),
    };
  };

  // Process data for rendering lists
  const processedClients = profiles.map(profile => {
    const stats = getClientStats(profile.id);
    const limit = getClientLimit(profile.id);
    return {
      ...profile,
      ...stats,
      limit,
    };
  });

  const filteredClients = processedClients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'active') {
      return client.activeOrders > 0;
    } else if (activeTab === 'pending') {
      return client.activeOrders === 0;
    }
    return true;
  });

  // Calculate top spending clients
  const topSpenders = [...processedClients]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  const totalRevenue = processedClients.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOutstanding = processedClients.reduce((sum, c) => sum + c.totalOutstanding, 0);

  const handleAdjustLimitSubmit = async () => {
    const limitNum = parseFloat(newLimitValue);
    if (isNaN(limitNum) || limitNum < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid credit limit.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await callAdminApi('adjust-limit', {
        id: selectedClient.id,
        limit: limitNum,
      });

      if (response.success) {
        Alert.alert('Success', `Credit limit for ${selectedClient.name} adjusted!`);
        setIsAdjustLimitOpen(false);
        setNewLimitValue('');
        // Update local modal data
        setSelectedClient((prev: any) => ({ ...prev, limit: limitNum }));
        loadData(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to adjust credit limit.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClientSubmit = () => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to permanently delete client profile ${selectedClient.name}? This will remove all their orders, limits, and records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Client',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await callAdminApi('delete-client', { id: selectedClient.id });
              if (response.success) {
                Alert.alert('Deleted', 'Client profile successfully deleted.');
                setIsDetailsOpen(false);
                loadData(false);
              } else {
                Alert.alert('Error', response.error || 'Failed to delete client.');
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
        subtitle="Loading client profiles and database structures..."
        error={error}
        onRetry={() => loadData()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <AdminHeader title="Clients Directory" subtitle="Operations Center" />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Search size={18} color={t.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: t.textPrimary }]}
            placeholder="Search by client name or email..."
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

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        {['all', 'active', 'pending'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabBtn,
              activeTab === tab && { backgroundColor: t.accentLight, borderColor: t.accent }
            ]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === tab ? t.accent : t.textSecondary }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)} Dues
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {/* KPI stats */}
        <View style={styles.statsRow}>
          <View style={[styles.miniStatCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={styles.miniStatLabel}>Total Clients</Text>
            <Text style={[styles.miniStatVal, { color: t.textPrimary }]}>{profiles.length}</Text>
          </View>
          <View style={[styles.miniStatCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={styles.miniStatLabel}>Outstanding Balance</Text>
            <Text style={[styles.miniStatVal, { color: t.textPrimary }]}>{formatCurrency(totalOutstanding)}</Text>
          </View>
        </View>

        {/* Top Spenders list */}
        {searchQuery === '' && activeTab === 'all' && (
          <View style={[styles.topSpendersCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>🏆 Top Spenders Ranking</Text>
            <View style={styles.spendersList}>
              {topSpenders.map((spender, idx) => (
                <TouchableOpacity
                  key={spender.id}
                  style={styles.spenderRow}
                  onPress={() => {
                    setSelectedClient(spender);
                    setIsDetailsOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.spenderRowLeft}>
                    <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? t.accent : 'rgba(255,255,255,0.06)' }]}>
                      <Text style={[styles.rankText, idx === 0 && { color: '#fff' }]}>{idx + 1}</Text>
                    </View>
                    <View>
                      <Text style={[styles.spenderName, { color: t.textPrimary }]}>{spender.name}</Text>
                      <Text style={styles.spenderOrders}>{spender.orderCount} orders scheduled</Text>
                    </View>
                  </View>
                  <Text style={[styles.spenderSpent, { color: t.textPrimary }]}>{formatCurrency(spender.totalSpent)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Client List */}
        <Text style={styles.listHeaderTitle}>Active Directory List ({filteredClients.length})</Text>
        <View style={styles.clientsListContainer}>
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={[styles.clientCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                onPress={() => {
                  setSelectedClient(client);
                  setIsDetailsOpen(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.clientCardHeader}>
                  <View>
                    <Text style={[styles.clientName, { color: t.textPrimary }]}>{client.name}</Text>
                    <Text style={styles.clientEmail} numberOfLines={1}>{client.email}</Text>
                  </View>
                  <ChevronRight size={18} color={t.textSecondary} />
                </View>

                <View style={[styles.clientCardDivider, { backgroundColor: t.border }]} />

                <View style={styles.clientCardDetailsRow}>
                  <View>
                    <Text style={styles.detailCardLabel}>Limit Limit</Text>
                    <Text style={[styles.detailCardVal, { color: t.textPrimary }]}>{formatCurrency(client.limit)}</Text>
                  </View>
                  <View>
                    <Text style={styles.detailCardLabel}>Outstanding</Text>
                    <Text style={[styles.detailCardVal, { color: t.accent }]}>{formatCurrency(client.totalOutstanding)}</Text>
                  </View>
                  <View>
                    <Text style={styles.detailCardLabel}>Active Plans</Text>
                    <Text style={[styles.detailCardVal, { color: t.textPrimary }]}>{client.activeOrders}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No clients match filters.</Text>
          )}
        </View>
      </ScrollView>

      {/* Client Detail View Modal */}
      {selectedClient && (
        <Modal visible={isDetailsOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            {/* Modal header */}
            <View style={[styles.modalHeaderBar, { borderBottomColor: t.border }]}>
              <Text style={[styles.modalHeaderTitle, { color: t.textPrimary }]}>Client Overview</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsDetailsOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Profile card summary */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.modalAvatarCircle}>
                  <Text style={styles.modalAvatarText}>{selectedClient.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.modalName, { color: t.textPrimary }]}>{selectedClient.name}</Text>
                <View style={styles.contactDetailsCol}>
                  <View style={styles.contactRow}>
                    <Mail size={14} color={t.textSecondary} />
                    <Text style={[styles.contactText, { color: t.textSecondary }]}>{selectedClient.email}</Text>
                  </View>
                  {selectedClient.mobile_number && (
                    <View style={styles.contactRow}>
                      <Phone size={14} color={t.textSecondary} />
                      <Text style={[styles.contactText, { color: t.textSecondary }]}>{selectedClient.mobile_number}</Text>
                    </View>
                  )}
                  <View style={styles.contactRow}>
                    <Calendar size={14} color={t.textSecondary} />
                    <Text style={[styles.contactText, { color: t.textSecondary }]}>Registered: {formatDate(selectedClient.created_at)}</Text>
                  </View>
                </View>
              </View>

              {/* Financial summary */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Amortization & Bounds</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Total Credit Limit</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatCurrency(selectedClient.limit)}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Ledger Outstanding</Text>
                    <Text style={[styles.detailBoxValue, { color: t.accent }]}>{formatCurrency(selectedClient.totalOutstanding)}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Total Purchase Volume</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatCurrency(selectedClient.totalSpent)}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Credit Remaining</Text>
                    <Text style={[styles.detailBoxValue, { color: '#10b981' }]}>
                      {formatCurrency(Math.max(0, selectedClient.limit - selectedClient.totalOutstanding))}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Controls */}
              <View style={styles.actionButtonsCol}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: t.accentLight, borderColor: t.accent }]}
                  onPress={() => {
                    setNewLimitValue(selectedClient.limit.toString());
                    setIsAdjustLimitOpen(true);
                  }}
                >
                  <Sliders size={16} color={t.accent} />
                  <Text style={[styles.modalActionText, { color: t.accent }]}>Adjust Credit Limit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: '#ef4444' }]}
                  onPress={handleDeleteClientSubmit}
                >
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={[styles.modalActionText, { color: '#ef4444' }]}>Delete Client Profile</Text>
                </TouchableOpacity>
              </View>

              {/* Active Orders Section */}
              <Text style={styles.listHeaderTitle}>Installment Orders ({selectedClient.orders.length})</Text>
              <View style={styles.ordersListCol}>
                {selectedClient.orders.length > 0 ? (
                  selectedClient.orders.map((order: any) => (
                    <View key={order.id} style={[styles.orderSubCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                      <View style={styles.orderSubCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.orderSubCardItem, { color: t.textPrimary }]}>{order.itemName}</Text>
                          <Text style={styles.orderSubCardDate}>Assigned: {formatDate(order.orderDate)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: order.isPaid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(238, 77, 45, 0.12)' }]}>
                          <Text style={[styles.statusBadgeText, { color: order.isPaid ? '#10b981' : '#ee4d2d' }]}>
                            {order.isPaid ? 'Paid' : 'Active'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.clientCardDivider, { backgroundColor: t.border }]} />

                      {/* Payment Schedule listing */}
                      <Text style={styles.scheduleTitleText}>Payments Breakdown ({order.installmentMonths} Terms)</Text>
                      <View style={styles.paymentsDetailList}>
                        {order.payments.map((payment: any, index: number) => {
                          const isOverdue = !payment.is_paid && new Date(payment.due_date) < new Date();
                          return (
                            <View key={payment.id} style={styles.paymentDetailItem}>
                              <View style={styles.paymentLeft}>
                                <View style={[styles.paymentNumCircle, payment.is_paid ? { backgroundColor: '#10b981' } : (isOverdue ? { backgroundColor: '#ef4444' } : { backgroundColor: t.border })]}>
                                  <Text style={styles.paymentNumText}>{payment.month_number}</Text>
                                </View>
                                <View>
                                  <Text style={[styles.paymentDueText, { color: t.textPrimary }]}>Term {payment.month_number} Due Date</Text>
                                  <Text style={styles.paymentDateText}>{formatDate(payment.due_date)}</Text>
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
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No orders assigned to client.</Text>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Adjust limit nested modal */}
      <Modal visible={isAdjustLimitOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Adjust Credit Limit</Text>
            <Text style={[styles.modalDesc, { color: t.textSecondary }]}>
              Set custom credit limit bounds for {selectedClient?.name}. Baseline allocation is typically ₱50,000.00.
            </Text>

            <TextInput
              style={[styles.input, { color: t.textPrimary, borderColor: t.border, marginTop: 16 }]}
              placeholder="e.g. 75000"
              keyboardType="numeric"
              placeholderTextColor={t.textSecondary}
              value={newLimitValue}
              onChangeText={setNewLimitValue}
            />

            <View style={[styles.modalButtons, { marginTop: 24 }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAdjustLimitOpen(false)} disabled={actionLoading}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: t.accent }]} onPress={handleAdjustLimitSubmit} disabled={actionLoading}>
                <Text style={styles.confirmBtnText}>{actionLoading ? 'Updating...' : 'Save Limit'}</Text>
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
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniStatCard: {
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  miniStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  miniStatVal: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  topSpendersCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  spendersList: {
    gap: 10,
  },
  spenderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  spenderRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
  },
  spenderName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  spenderOrders: {
    fontSize: 10,
    color: '#64748b',
  },
  spenderSpent: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 8,
  },
  clientsListContainer: {
    gap: 12,
  },
  clientCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  clientCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  clientEmail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  clientCardDivider: {
    height: 1,
  },
  clientCardDetailsRow: {
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
    gap: 14,
  },
  modalAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactDetailsCol: {
    alignSelf: 'stretch',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactText: {
    fontSize: 12,
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
  ordersListCol: {
    gap: 12,
  },
  orderSubCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  orderSubCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderSubCardItem: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  orderSubCardDate: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
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
  scheduleTitleText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentsDetailList: {
    gap: 10,
  },
  paymentDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentNumCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentNumText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentDueText: {
    fontSize: 11,
    fontWeight: '600',
  },
  paymentDateText: {
    fontSize: 9,
    color: '#64748b',
  },
  paymentAmtText: {
    fontSize: 11,
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
