import SwipeDismissModal from '../../components/SwipeDismissModal';
import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  Pencil,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import AdminHeader from '../../components/AdminHeader';
import PremiumLoader from '../../components/PremiumLoader';
import { PremiumAlert } from '../../services/PremiumAlertService';
import { fetchAdminClients, callAdminApi } from '../../services/adminService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';


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

  const queryClient = useQueryClient();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending'>('all');

  // Details Modal state
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Action Modals
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Layout and Pagination states
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [orderPage, setOrderPage] = useState(1);
  const ORDER_PAGE_SIZE = 5;
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Monthly breakdown calendar pagination & filtering states
  const [monthlyFilter, setMonthlyFilter] = useState<'all' | 'active' | 'pending' | 'settled'>('all');
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [monthlyYearFilter, setMonthlyYearFilter] = useState<string>('');
  const MONTHLY_PAGE_SIZE = 5;

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const { data: clientsData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['admin-clients', currentPage, searchQuery, activeTab],
    queryFn: () => fetchAdminClients({
      page: currentPage,
      pageSize: PAGE_SIZE,
      searchQuery,
      status: activeTab,
    }),
  });

  const error = queryError ? (queryError as Error).message : (clientsData && !clientsData.success ? clientsData.error : null);

  const onRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  useRealtimeSync(
    ['orders', 'payments', 'account_limits', 'profiles'],
    () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
    }
  );

  const getMonthlyBreakdown = (clientOrders: any[]) => {
    const monthlyBreakdownMap: Record<string, {
      monthKey: string;
      monthName: string;
      activeOngoing: number;
      pending: number;
      settled: number;
    }> = {};

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    clientOrders.forEach(order => {
      if (order.payments && Array.isArray(order.payments)) {
        order.payments.forEach((payment: any) => {
          const d = new Date(payment.due_date);
          if (Number.isNaN(d.getTime())) return;
          
          const year = d.getFullYear();
          const month = d.getMonth();
          
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

          if (!monthlyBreakdownMap[monthKey]) {
            monthlyBreakdownMap[monthKey] = {
              monthKey,
              monthName,
              activeOngoing: 0,
              pending: 0,
              settled: 0,
            };
          }

          const amount = Number(payment.amount_due);
          if (payment.is_paid) {
            monthlyBreakdownMap[monthKey].settled += amount;
          } else if (year < currentYear || (year === currentYear && month <= currentMonth)) {
            monthlyBreakdownMap[monthKey].activeOngoing += amount;
          } else {
            monthlyBreakdownMap[monthKey].pending += amount;
          }
        });
      }
    });

    let result = Object.values(monthlyBreakdownMap);

    // Apply Year filter
    if (monthlyYearFilter.trim()) {
      result = result.filter(item => item.monthKey.startsWith(monthlyYearFilter.trim()));
    }

    // Apply Status filter
    if (monthlyFilter === 'active') {
      result = result.filter(item => item.activeOngoing > 0);
    } else if (monthlyFilter === 'pending') {
      result = result.filter(item => item.pending > 0);
    } else if (monthlyFilter === 'settled') {
      result = result.filter(item => item.settled > 0);
    }

    return result.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  };

  const processedClients = useMemo(() => clientsData?.clients || [], [clientsData]);
  const filteredClients = processedClients;
  const totalPages = Math.max(1, Math.ceil((clientsData?.totalCount || 0) / PAGE_SIZE));
  const paginatedClients = processedClients;

  const topSpenders = useMemo(() => clientsData?.topSpenders || [], [clientsData]);
  const totalRevenue = clientsData?.stats?.totalRevenue || 0;
  const totalOutstanding = clientsData?.stats?.totalOutstanding || 0;

  const handleEditProfileSubmit = async () => {
    if (!editName || !editEmail) {
      PremiumAlert.alert('Invalid Input', 'Name and Email are required.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await callAdminApi('update-client', {
        clientId: selectedClient.id,
        name: editName,
        email: editEmail,
        mobileNumber: editMobile,
      });

      if (response.success) {
        PremiumAlert.alert('Success', `Client profile updated successfully!`);
        setIsEditProfileOpen(false);
        // Update local modal data
        setSelectedClient((prev: any) => ({
          ...prev,
          name: editName,
          email: editEmail,
          mobile_number: editMobile,
        }));
        queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to update client profile.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClientSubmit = () => {
    PremiumAlert.alert(
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
                PremiumAlert.alert('Deleted', 'Client profile successfully deleted.');
                setIsDetailsOpen(false);
                queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
              } else {
                PremiumAlert.alert('Error', response.error || 'Failed to delete client.');
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

  const openClientDetails = (client: any) => {
    setSelectedClient(client);
    setOrderFilter('all');
    setOrderPage(1);
    setOrderSearchQuery('');
    setMonthlyFilter('all');
    setMonthlyPage(1);
    setMonthlyYearFilter('');
    if (client.orders && client.orders.length > 0) {
      setExpandedOrders({ [client.orders[0].id]: true });
    } else {
      setExpandedOrders({});
    }
    setIsDetailsOpen(true);
  };

  const getFilteredOrders = () => {
    if (!selectedClient || !selectedClient.orders) return [];
    return selectedClient.orders.filter((order: any) => {
      const matchesSearch = (order.item_name || '').toLowerCase().includes(orderSearchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (orderFilter === 'active') return !order.is_paid;
      if (orderFilter === 'completed') return order.is_paid;
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();
  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDER_PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE);

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
        onRetry={() => refetch()}
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
            <Text style={[styles.miniStatVal, { color: t.textPrimary }]}>{processedClients.length}</Text>
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
              {topSpenders.map((spender: any, idx: number) => (
                <TouchableOpacity
                  key={spender.id}
                  style={styles.spenderRow}
                  onPress={() => openClientDetails(spender)}
                  activeOpacity={0.8}
                >
                  <View style={styles.spenderRowLeft}>
                    <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? t.accent : 'rgba(255,255,255,0.06)' }]}>
                      <Text style={[styles.rankText, idx === 0 && { color: '#fff' }]}>{idx + 1}</Text>
                    </View>
                    <Image
                      source={{ uri: spender.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(spender.name)}&background=ee4d2d&color=fff&size=100&bold=true` }}
                      style={styles.spenderAvatar}
                    />
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
        {/* Client List Header Row */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>Active Directory ({filteredClients.length})</Text>
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

        <View style={viewMode === 'grid' ? styles.clientGridContainer : styles.clientsListContainer}>
          {paginatedClients.length > 0 ? (
            paginatedClients.map((client: any) => {
              if (viewMode === 'grid') {
                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[styles.clientGridCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                    onPress={() => openClientDetails(client)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: client.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name)}&background=ee4d2d&color=fff&size=100&bold=true` }}
                      style={styles.clientGridAvatar}
                    />
                    <Text style={[styles.clientGridName, { color: t.textPrimary }]} numberOfLines={1}>{client.name}</Text>
                    <Text style={styles.clientGridEmail} numberOfLines={1}>{client.email}</Text>
                    
                    <View style={[styles.clientGridDivider, { backgroundColor: t.border }]} />

                    <View style={styles.clientGridDetails}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailCardLabel}>Outstanding</Text>
                        <Text style={[styles.detailCardVal, { color: t.accent, fontSize: 11 }]} numberOfLines={1}>{formatCurrency(client.totalOutstanding)}</Text>
                      </View>
                      <View style={{ flex: 0.5, alignItems: 'flex-end' }}>
                        <Text style={styles.detailCardLabel}>Plans</Text>
                        <Text style={[styles.detailCardVal, { color: t.textPrimary, fontSize: 11 }]}>{client.activeOrders}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }

              // List View Mode
              return (
                <TouchableOpacity
                  key={client.id}
                  style={[styles.clientCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                  onPress={() => openClientDetails(client)}
                  activeOpacity={0.8}
                >
                  <View style={styles.clientCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <Image
                        source={{ uri: client.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name)}&background=ee4d2d&color=fff&size=100&bold=true` }}
                        style={styles.clientListAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.clientName, { color: t.textPrimary }]} numberOfLines={1}>{client.name}</Text>
                        <Text style={styles.clientEmail} numberOfLines={1}>{client.email}</Text>
                      </View>
                    </View>
                    <ChevronRight size={18} color={t.textSecondary} />
                  </View>

                  <View style={[styles.clientCardDivider, { backgroundColor: t.border }]} />

                  <View style={styles.clientCardDetailsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailCardLabel}>Outstanding</Text>
                      <Text style={[styles.detailCardVal, { color: t.accent }]}>{formatCurrency(client.totalOutstanding)}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.detailCardLabel}>Active Plans</Text>
                      <Text style={[styles.detailCardVal, { color: t.textPrimary }]}>{client.activeOrders}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No clients match filters.</Text>
          )}
        </View>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
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
          </View>
        )}
      </ScrollView>

      {/* Client Detail View Modal */}
      {selectedClient && (
        <Modal visible={isDetailsOpen} animationType="slide" transparent={false}>
          <SafeAreaView style={[styles.modalScrollContainer, { backgroundColor: t.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

            {/* Enhanced Premium Modal Header & Banner */}
            <View
              style={[styles.detailsHeroBanner, { backgroundColor: t.cardBg, borderBottomColor: t.border, borderBottomWidth: 1.5 }]}
            >
              <View style={styles.detailsHeroTopRow}>
                <View style={styles.detailsHeroTitleCluster}>
                  <Users size={18} color={t.accent} />
                  <View>
                    <Text style={[styles.detailsHeroEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>CLIENT OVERVIEW</Text>
                    <Text style={[styles.detailsHeroTitle, { color: t.textPrimary }]}>Account Profile</Text>
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
                  <Image
                    source={{ uri: selectedClient.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedClient.name)}&background=ee4d2d&color=fff&size=150&bold=true` }}
                    style={styles.detailsHeroAvatar}
                  />
                  <View style={[styles.detailsHeroStatusDot, { borderColor: t.cardBg }]} />
                </View>

                <View style={styles.detailsHeroMeta}>
                  <Text style={[styles.detailsHeroName, { color: t.textPrimary }]} numberOfLines={1}>{selectedClient.name}</Text>
                  <View style={styles.detailsHeroSubRow}>
                    <View style={[styles.modalRoleBadge, { backgroundColor: t.accentLight, marginTop: 0 }]}>
                      <Text style={[styles.modalRoleBadgeText, { color: t.accent }]}>
                        {selectedClient.role || 'CLIENT'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {/* Contact Details Container */}
              <View style={[styles.contactCardContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary, marginBottom: 8 }]}>Contact & Registry</Text>
                
                <View style={styles.contactDetailsGrid}>
                  <View style={[styles.contactCard, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.border }]}>
                    <Mail size={13} color={t.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactLabel}>Email Address</Text>
                      <Text style={[styles.contactVal, { color: t.textPrimary }]} numberOfLines={1}>{selectedClient.email}</Text>
                    </View>
                  </View>

                  {(selectedClient.mobile_number || selectedClient.mobileNumber) ? (
                    <View style={[styles.contactCard, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.border }]}>
                      <Phone size={13} color={t.accent} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactLabel}>Mobile Number</Text>
                        <Text style={[styles.contactVal, { color: t.textPrimary }]}>{selectedClient.mobile_number || selectedClient.mobileNumber}</Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={[styles.contactCard, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.border }]}>
                    <Calendar size={13} color={t.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactLabel}>Date Registered</Text>
                      <Text style={[styles.contactVal, { color: t.textPrimary }]}>{formatDate(selectedClient.created_at || selectedClient.createdAt)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Financial summary */}
              <View style={[styles.modalProfileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Amortization & Bounds</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Ledger Outstanding</Text>
                    <Text style={[styles.detailBoxValue, { color: t.accent }]}>{formatCurrency(selectedClient.totalOutstanding)}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailBoxLabel}>Total Purchase Volume</Text>
                    <Text style={[styles.detailBoxValue, { color: t.textPrimary }]}>{formatCurrency(selectedClient.totalSpent)}</Text>
                  </View>
                </View>
              </View>

              {/* Monthly Repayment Breakdown */}
              <View style={[styles.monthlyBreakdownCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Calendar size={16} color={t.accent} />
                  <Text style={[styles.sectionTitle, { color: t.textPrimary, marginBottom: 0 }]}>Amortization Calendar</Text>
                </View>

                {/* Filter Toolbar */}
                <View style={styles.monthlyFilterRow}>
                  {/* Status Tabs */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthlyTabsScroll}>
                    {(['all', 'active', 'pending', 'settled'] as const).map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.monthlyTabBtn,
                          monthlyFilter === filter && { backgroundColor: t.accentLight, borderColor: t.accent }
                        ]}
                        onPress={() => {
                          setMonthlyFilter(filter);
                          setMonthlyPage(1);
                        }}
                      >
                        <Text style={[styles.monthlyTabBtnText, { color: monthlyFilter === filter ? t.accent : t.textSecondary }]}>
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Year Input Filter */}
                  <View style={[styles.monthlyYearInputBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: t.border }]}>
                    <Search size={12} color={t.textSecondary} />
                    <TextInput
                      style={[styles.monthlyYearInput, { color: t.textPrimary }]}
                      placeholder="Year"
                      placeholderTextColor={t.textSecondary}
                      keyboardType="numeric"
                      value={monthlyYearFilter}
                      onChangeText={(text) => {
                        setMonthlyYearFilter(text);
                        setMonthlyPage(1);
                      }}
                    />
                    {monthlyYearFilter ? (
                      <TouchableOpacity onPress={() => {
                        setMonthlyYearFilter('');
                        setMonthlyPage(1);
                      }}>
                        <X size={12} color={t.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {(() => {
                  const monthlyBreakdown = getMonthlyBreakdown(selectedClient.orders || []);
                  const totalMonthlyItems = monthlyBreakdown.length;
                  const monthlyTotalPages = Math.max(1, Math.ceil(totalMonthlyItems / MONTHLY_PAGE_SIZE));
                  // Ensure page doesn't go out of bounds
                  const safeMonthlyPage = Math.min(monthlyPage, monthlyTotalPages);
                  const paginatedMonthly = monthlyBreakdown.slice((safeMonthlyPage - 1) * MONTHLY_PAGE_SIZE, safeMonthlyPage * MONTHLY_PAGE_SIZE);

                  return (
                    <>
                      {paginatedMonthly.length > 0 ? (
                        <View style={styles.monthlyBreakdownList}>
                          {paginatedMonthly.map((row, idx) => {
                            const total = row.activeOngoing + row.pending + row.settled;
                            return (
                              <View key={row.monthKey} style={[styles.monthlyBreakdownItem, idx > 0 && { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10 }]}>
                                <View style={styles.monthlyBreakdownHeader}>
                                  <Text style={[styles.monthlyMonthText, { color: t.textPrimary }]}>{row.monthName}</Text>
                                  <Text style={[styles.monthlyTotalText, { color: t.textPrimary }]}>{formatCurrency(total)}</Text>
                                </View>
                                
                                <View style={styles.monthlyStatusesContainer}>
                                  {row.activeOngoing > 0 && (
                                    <View style={[styles.monthlyStatusPill, { borderColor: t.border, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }]}>
                                      <View style={[styles.statusMiniDot, { backgroundColor: '#f59e0b' }]} />
                                      <Text style={styles.monthlyStatusLabel}>Active: </Text>
                                      <Text style={[styles.monthlyStatusVal, { color: t.textPrimary }]}>{formatCurrency(row.activeOngoing)}</Text>
                                    </View>
                                  )}
                                  {row.pending > 0 && (
                                    <View style={[styles.monthlyStatusPill, { borderColor: t.border, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }]}>
                                      <View style={[styles.statusMiniDot, { backgroundColor: '#3b82f6' }]} />
                                      <Text style={styles.monthlyStatusLabel}>Pending: </Text>
                                      <Text style={[styles.monthlyStatusVal, { color: t.textPrimary }]}>{formatCurrency(row.pending)}</Text>
                                    </View>
                                  )}
                                  {row.settled > 0 && (
                                    <View style={[styles.monthlyStatusPill, { borderColor: t.border, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }]}>
                                      <View style={[styles.statusMiniDot, { backgroundColor: '#10b981' }]} />
                                      <Text style={styles.monthlyStatusLabel}>Settled: </Text>
                                      <Text style={[styles.monthlyStatusVal, { color: t.textPrimary }]}>{formatCurrency(row.settled)}</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={[styles.emptyText, { paddingVertical: 10 }]}>No monthly repayments match filters.</Text>
                      )}

                      {/* Monthly Pagination Controls */}
                      {monthlyTotalPages > 1 && (
                        <View style={styles.monthlyPaginationContainer}>
                          <TouchableOpacity
                            disabled={safeMonthlyPage === 1}
                            onPress={() => setMonthlyPage(prev => Math.max(1, prev - 1))}
                            style={[
                              styles.monthlyPaginationBtn, 
                              { borderColor: t.cardBorder, backgroundColor: t.cardBg }, 
                              safeMonthlyPage === 1 && { opacity: 0.4 }
                            ]}
                          >
                            <Text style={[styles.monthlyPaginationBtnText, { color: t.textPrimary }]}>Prev</Text>
                          </TouchableOpacity>
                          
                          <Text style={[styles.monthlyPaginationInfo, { color: t.textSecondary }]}>
                            Page {safeMonthlyPage} of {monthlyTotalPages}
                          </Text>
                          
                          <TouchableOpacity
                            disabled={safeMonthlyPage === monthlyTotalPages}
                            onPress={() => setMonthlyPage(prev => Math.min(monthlyTotalPages, prev + 1))}
                            style={[
                              styles.monthlyPaginationBtn, 
                              { borderColor: t.cardBorder, backgroundColor: t.cardBg }, 
                              safeMonthlyPage === monthlyTotalPages && { opacity: 0.4 }
                            ]}
                          >
                            <Text style={[styles.monthlyPaginationBtnText, { color: t.textPrimary }]}>Next</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>

              {/* Action Controls */}
              <View style={styles.actionButtonsCol}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: t.accentLight, borderColor: t.accent }]}
                  onPress={() => {
                    setEditName(selectedClient.name);
                    setEditEmail(selectedClient.email);
                    setEditMobile(selectedClient.mobile_number || selectedClient.mobileNumber || '');
                    setIsEditProfileOpen(true);
                  }}
                >
                  <Pencil size={16} color={t.accent} />
                  <Text style={[styles.modalActionText, { color: t.accent }]}>Edit Client Profile</Text>
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={styles.listHeaderTitle}>Installment Orders ({filteredOrders.length})</Text>
              </View>

              {/* Order Search Bar */}
              <View style={[styles.orderSearchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Search size={16} color={t.textSecondary} />
                <TextInput
                  style={[styles.orderSearchInput, { color: t.textPrimary }]}
                  placeholder="Search orders by item name..."
                  placeholderTextColor={t.textSecondary}
                  value={orderSearchQuery}
                  onChangeText={(text) => {
                    setOrderSearchQuery(text);
                    setOrderPage(1);
                  }}
                />
                {orderSearchQuery ? (
                  <TouchableOpacity onPress={() => {
                    setOrderSearchQuery('');
                    setOrderPage(1);
                  }}>
                    <X size={14} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Order Filter Tabs */}
              <View style={styles.orderFilterTabsContainer}>
                {(['all', 'active', 'completed'] as const).map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.orderTabBtn,
                      orderFilter === filter && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => {
                      setOrderFilter(filter);
                      setOrderPage(1);
                    }}
                  >
                    <Text style={[styles.orderTabBtnText, { color: orderFilter === filter ? t.accent : t.textSecondary }]}>
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.ordersListCol}>
                {paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order: any) => {
                    const isExpanded = expandedOrders[order.id];
                    return (
                      <View key={order.id} style={[styles.orderSubCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                        <TouchableOpacity
                          style={styles.orderSubCardHeader}
                          onPress={() => toggleOrderExpand(order.id)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.orderSubCardItem, { color: t.textPrimary }]}>{order.item_name}</Text>
                            <Text style={styles.orderSubCardDate}>Assigned: {formatDate(order.order_date)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[styles.statusBadge, { backgroundColor: order.is_paid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(238, 77, 45, 0.12)' }]}>
                              <Text style={[styles.statusBadgeText, { color: order.is_paid ? '#10b981' : '#ee4d2d' }]}>
                                {order.is_paid ? 'Paid' : 'Active'}
                              </Text>
                            </View>
                            {isExpanded ? (
                              <ChevronUp size={16} color={t.textSecondary} />
                            ) : (
                              <ChevronDown size={16} color={t.textSecondary} />
                            )}
                          </View>
                        </TouchableOpacity>

                        {isExpanded && (
                          <>
                            <View style={[styles.clientCardDivider, { backgroundColor: t.border }]} />

                            {/* Payment Schedule listing */}
                            <Text style={styles.scheduleTitleText}>Payments Breakdown ({order.installment_months} Terms)</Text>
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
                          </>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No orders match the selected filter.</Text>
                )}
              </View>

              {/* Order Pagination */}
              {orderTotalPages > 1 && (
                <View style={styles.orderPaginationContainer}>
                  <TouchableOpacity
                    disabled={orderPage === 1}
                    onPress={() => setOrderPage(prev => Math.max(1, prev - 1))}
                    style={[
                      styles.orderPaginationBtn, 
                      { borderColor: t.cardBorder, backgroundColor: t.cardBg }, 
                      orderPage === 1 && { opacity: 0.4 }
                    ]}
                  >
                    <Text style={[styles.orderPaginationBtnText, { color: t.textPrimary }]}>Prev</Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.orderPaginationInfo, { color: t.textSecondary }]}>
                    Page {orderPage} of {orderTotalPages}
                  </Text>
                  
                  <TouchableOpacity
                    disabled={orderPage === orderTotalPages}
                    onPress={() => setOrderPage(prev => Math.min(orderTotalPages, prev + 1))}
                    style={[
                      styles.orderPaginationBtn, 
                      { borderColor: t.cardBorder, backgroundColor: t.cardBg }, 
                      orderPage === orderTotalPages && { opacity: 0.4 }
                    ]}
                  >
                    <Text style={[styles.orderPaginationBtnText, { color: t.textPrimary }]}>Next</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Edit client profile nested modal - Redesigned to match Add New Order/Global Limit Modals */}
      <Modal visible={isEditProfileOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SwipeDismissModal onDismiss={() => setIsEditProfileOpen(false)} disabled={actionLoading}>
            <View style={[styles.editProfileSheet, { backgroundColor: isDarkMode ? '#101827' : '#fbfcff', borderColor: t.cardBorder }]}>
              <LinearGradient
                colors={isDarkMode ? ['#1f2937', '#111827'] : ['#fff7ed', '#ffffff']}
                style={styles.sheetHero}
              >
                <View style={styles.sheetHeroTop}>
                  <View style={styles.sheetTitleCluster}>
                    <View style={styles.sheetIconBadge}>
                      <Pencil size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetEyebrow, { color: isDarkMode ? '#fda4af' : '#ee4d2d' }]}>CLIENT PROFILE</Text>
                      <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Edit Credentials</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsEditProfileOpen(false)} disabled={actionLoading}>
                    <Text style={[styles.sheetCloseText, { color: t.textSecondary }]}>Close</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.editProfileHeroText, { color: t.textSecondary }]}>
                  Update profile credentials and contacts for {selectedClient?.name}.
                </Text>
              </LinearGradient>

              <ScrollView contentContainerStyle={styles.premiumFormContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.formSectionHeader}>
                  <Text style={[styles.formSectionTitle, { color: t.textPrimary }]}>Profile Details</Text>
                </View>

                <View style={styles.inputGrid}>
                  {/* Full Name Input */}
                  <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                    <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>FULL NAME</Text>
                    <TextInput
                      style={[styles.premiumInput, { color: t.textPrimary }]}
                      placeholder="Full Name"
                      placeholderTextColor={t.textSecondary}
                      value={editName}
                      onChangeText={setEditName}
                    />
                  </View>

                  {/* Email Input */}
                  <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                    <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>EMAIL ADDRESS</Text>
                    <TextInput
                      style={[styles.premiumInput, { color: t.textPrimary }]}
                      placeholder="Email Address"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={t.textSecondary}
                      value={editEmail}
                      onChangeText={setEditEmail}
                    />
                  </View>

                  {/* Mobile Number Input */}
                  <View style={[styles.premiumInputCard, { backgroundColor: isDarkMode ? '#111827' : '#ffffff', borderColor: t.cardBorder }]}>
                    <Text style={[styles.premiumLabel, { color: t.textSecondary }]}>MOBILE NUMBER</Text>
                    <TextInput
                      style={[styles.premiumInput, { color: t.textPrimary }]}
                      placeholder="Mobile Number"
                      keyboardType="phone-pad"
                      placeholderTextColor={t.textSecondary}
                      value={editMobile}
                      onChangeText={setEditMobile}
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={[styles.sheetActions, { borderTopColor: t.cardBorder }]}>
                <TouchableOpacity style={[styles.secondaryAction, { borderColor: t.cardBorder }]} onPress={() => setIsEditProfileOpen(false)} disabled={actionLoading}>
                  <Text style={[styles.secondaryActionText, { color: t.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryAction, { backgroundColor: t.accent, opacity: actionLoading ? 0.7 : 1 }]} onPress={handleEditProfileSubmit} disabled={actionLoading}>
                  <CheckCircle2 size={16} color="#ffffff" />
                  <Text style={styles.primaryActionText}>{actionLoading ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SwipeDismissModal>
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
  clientListAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  modalAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spenderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
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
  clientGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  clientGridCard: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  clientGridAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 4,
  },
  clientGridName: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  clientGridEmail: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 4,
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
  premiumProfileCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
  },
  modalAvatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
  },
  modalRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  modalRoleBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  premiumDivider: {
    width: '100%',
    height: 1,
    marginVertical: 16,
  },
  contactDetailsGrid: {
    alignSelf: 'stretch',
    gap: 8,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  contactLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  contactVal: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  // Redesigned Detail & Edit Modal Styles
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
  detailsHeroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  detailsHeroStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2.5,
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
  contactCardContainer: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    gap: 12,
  },
  editProfileSheet: {
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
  editProfileHeroText: {
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
  orderFilterTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  orderTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  orderTabBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderPaginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  orderPaginationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  orderPaginationBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderPaginationInfo: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  orderSearchInput: {
    flex: 1,
    fontSize: 12,
    height: '100%',
    paddingVertical: 0,
  },
  monthlyBreakdownCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    gap: 8,
  },
  monthlyBreakdownList: {
    gap: 12,
  },
  monthlyBreakdownItem: {
    gap: 8,
  },
  monthlyBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthlyMonthText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  monthlyTotalText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  monthlyStatusesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthlyStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  monthlyStatusLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  monthlyStatusVal: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  monthlyFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginVertical: 10,
  },
  monthlyTabsScroll: {
    gap: 6,
    alignItems: 'center',
  },
  monthlyTabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  monthlyTabBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  monthlyYearInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    height: 32,
    paddingHorizontal: 8,
    gap: 6,
    width: 100,
  },
  monthlyYearInput: {
    flex: 1,
    fontSize: 10,
    height: '100%',
    paddingVertical: 0,
  },
  monthlyPaginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  monthlyPaginationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  monthlyPaginationBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  monthlyPaginationInfo: {
    fontSize: 10,
    fontWeight: '600',
  },
});
