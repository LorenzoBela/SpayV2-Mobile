import { PremiumAlert } from '../../services/PremiumAlertService';
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
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Search,
  ChevronRight,
  ChevronLeft,
  Calendar,
  X,
  Send,
  AlertCircle,
  Clock,
  History,
  CheckCircle,
  Users,
  UserCheck,
  AlertTriangle,
  Info,
  Mail,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import PremiumLoader from '../../components/PremiumLoader';
import { fetchAdminReminders, fetchAdminClients, callAdminApi } from '../../services/adminService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { WebView } from 'react-native-webview';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { FlashList } from '@shopify/flash-list';

const AnyFlashList = FlashList as any;

const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLogTime(value: string | null) {
  if (!value) return 'N/A';
  try {
    const d = dayjs(value);
    if (!d.isValid()) return 'N/A';
    return d.format('MMM D, h:mm A');
  } catch (e) {
    return 'N/A';
  }
}


export default function AdminRemindersScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [activeSubFilter, setActiveSubFilter] = useState<'all' | 'overdue' | 'due-soon' | 'scheduled'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLogsPage, setCurrentLogsPage] = useState(1);
  const PAGE_SIZE = 10;

  // Bulk Reminders Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState<'all' | 'month' | 'selected' | 'overdue'>('overdue');
  const [modalStep, setModalStep] = useState<'select' | 'preview'>('select');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedBulkMonth, setSelectedBulkMonth] = useState<string>('');
  const [selectedBulkYear, setSelectedBulkYear] = useState<string>(new Date().getFullYear().toString());
  const [previewData, setPreviewData] = useState<any>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<number>(0);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const queryClient = useQueryClient();

  const { data: remindersData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['admin-reminders'],
    queryFn: () => fetchAdminReminders(),
    staleTime: 30000,
  });

  const { data: clientsSelectionData } = useQuery({
    queryKey: ['admin-clients-selection'],
    queryFn: () => fetchAdminClients({ page: 1, pageSize: 1000 }),
    staleTime: 30000,
  });

  const error = queryError ? (queryError as Error).message : null;

  const loadData = async (showLoader?: boolean) => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['admin-clients-selection'] })
    ]);
  };

  useRealtimeSync(
    ['orders', 'payments', 'profiles'],
    undefined,
    [['admin-reminders']]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const payload = remindersData?.success ? remindersData : null;
  const reminderTargets = payload?.reminderTargets || [];
  const reminderLogs = payload?.reminderLogs || [];
  const serverStats = payload?.stats || { total: 0, overdue: 0, dueSoon: 0, clientsCount: 0 };

  const clientsList = clientsSelectionData?.clients || [];

  // Determine available years statically
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear.toString(), (currentYear - 1).toString(), (currentYear - 2).toString()];
  }, []);

  // Filter targets for list display
  const filteredTargets = useMemo(() => {
    const text = searchQuery.trim().toLowerCase();
    return reminderTargets.filter((target: any) => {
      const matchesText = !text ||
        target.clientName.toLowerCase().includes(text) ||
        target.clientEmail.toLowerCase().includes(text) ||
        target.itemName.toLowerCase().includes(text);
      const matchesFilter = activeSubFilter === 'all' || target.status === activeSubFilter;
      return matchesText && matchesFilter;
    });
  }, [searchQuery, activeSubFilter, reminderTargets]);

  const formattedLogs = reminderLogs;

  // Pagination Math
  const totalPages = Math.max(1, Math.ceil(filteredTargets.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedTargets = filteredTargets.slice(pageStart, pageStart + PAGE_SIZE);

  // Logs Pagination Math
  const logsTotalPages = Math.max(1, Math.ceil(formattedLogs.length / PAGE_SIZE));
  const safeLogsPage = Math.min(currentLogsPage, logsTotalPages);
  const logsPageStart = (safeLogsPage - 1) * PAGE_SIZE;
  const paginatedLogs = formattedLogs.slice(logsPageStart, logsPageStart + PAGE_SIZE);

  // Compute delinquent clients
  const delinquentClients = useMemo(() => {
    const overdueCounts: Record<string, number> = {};
    reminderTargets.forEach((t: any) => {
      if (t.status === 'overdue') {
        overdueCounts[t.clientEmail] = (overdueCounts[t.clientEmail] || 0) + 1;
      }
    });
    const overdueEmails = new Set(
      Object.keys(overdueCounts).filter(email => overdueCounts[email] >= 2)
    );
    return clientsList.filter((c: any) => overdueEmails.has(c.email));
  }, [reminderTargets, clientsList]);

  // Search filter for clients checklist
  const filteredClientsForSelection = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    return clientsList.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [clientsList, clientSearch]);

  const stats = useMemo(() => {
    return {
      total: serverStats.total,
      overdue: serverStats.overdue,
      dueSoon: serverStats.dueSoon,
      clientsCount: serverStats.clientsCount,
    };
  }, [serverStats]);

  // Actions
  const handleSendReminder = async (paymentId: string, itemName: string, clientName: string) => {
    setActionLoading(true);
    try {
      const response = await callAdminApi('send-reminder', { id: paymentId });
      if (response.success) {
        PremiumAlert.alert('Success', `Manual reminder email sent to ${clientName} for ${itemName}!`);
        loadData(false);
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to dispatch email.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSelectClient = (id: string) => {
    setSelectedClientIds(prev =>
      prev.includes(id) ? prev.filter((c: any) => c !== id) : [...prev, id]
    );
  };

  const handleSelectAllClients = () => {
    const allFilteredIds = filteredClientsForSelection.map((c: any) => c.id);
    const allSelected = allFilteredIds.every((id: any) => selectedClientIds.includes(id));
    if (allSelected) {
      setSelectedClientIds(prev => prev.filter((id: any) => !allFilteredIds.includes(id)));
    } else {
      setSelectedClientIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handlePreviewBulkReminders = async () => {
    if (bulkType === 'month' && (!selectedBulkMonth || !selectedBulkYear)) {
      PremiumAlert.alert('Fields Required', 'Please select both target month and year.');
      return;
    }
    if (bulkType === 'selected' && selectedClientIds.length === 0) {
      PremiumAlert.alert('Recipients Required', 'Please select at least one client.');
      return;
    }

    setIsPreviewLoading(true);
    setModalStep('preview');
    setPreviewData(null);
    setActivePreviewTab(0);

    try {
      const response = await callAdminApi('preview-bulk-reminders', {
        type: bulkType,
        month: selectedBulkMonth || undefined,
        year: selectedBulkYear || undefined,
        clientIds: bulkType === 'selected' ? selectedClientIds : (bulkType === 'overdue' ? delinquentClients.map((c: any) => c.id) : undefined)
      });

      if (response.status === 'success' || response.status === 'info') {
        setPreviewData(response);
      } else {
        PremiumAlert.alert('Error', response.message || 'Failed to generate bulk preview.');
        setModalStep('select');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
      setModalStep('select');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSendBulkReminders = async () => {
    if (bulkType === 'month' && (!selectedBulkMonth || !selectedBulkYear)) {
      PremiumAlert.alert('Fields Required', 'Please select both target month and year.');
      return;
    }
    if (bulkType === 'selected' && selectedClientIds.length === 0) {
      PremiumAlert.alert('Recipients Required', 'Please select at least one client.');
      return;
    }

    setIsSendingBulk(true);
    try {
      const response = await callAdminApi('send-bulk-reminders', {
        type: bulkType,
        month: selectedBulkMonth || undefined,
        year: selectedBulkYear || undefined,
        clientIds: bulkType === 'selected' ? selectedClientIds : (bulkType === 'overdue' ? delinquentClients.map((c: any) => c.id) : undefined)
      });

      if (response.success) {
        PremiumAlert.alert('Success', response.message || 'Bulk reminders processed successfully!');
        setIsBulkModalOpen(false);
        setModalStep('select');
        loadData(false);
      } else {
        PremiumAlert.alert('Error', response.error || 'Failed to dispatch bulk reminders.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Network Error', e?.message || 'Server connection failed.');
    } finally {
      setIsSendingBulk(false);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSubtitle}>S-Pay Admin</Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Payment Reminders</Text>
        </View>
        <TouchableOpacity
          style={[styles.broadcastBtn, { backgroundColor: t.accent }]}
          onPress={() => {
            setSelectedClientIds([]);
            setSelectedBulkMonth('');
            setBulkType('overdue');
            setModalStep('select');
            setIsBulkModalOpen(true);
          }}
        >
          <Mail size={15} color="#fff" />
          <Text style={styles.broadcastBtnText}>Bulk Reminders</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'pending' && { backgroundColor: t.accentLight, borderColor: t.accent }]}
          onPress={() => {
            setActiveTab('pending');
            setCurrentPage(1);
          }}
        >
          <Clock size={16} color={activeTab === 'pending' ? t.accent : t.textSecondary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'pending' ? t.accent : t.textSecondary }]}>Active Targets</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && { backgroundColor: t.accentLight, borderColor: t.accent }]}
          onPress={() => {
            setActiveTab('history');
            setCurrentLogsPage(1);
          }}
        >
          <History size={16} color={activeTab === 'history' ? t.accent : t.textSecondary} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'history' ? t.accent : t.textSecondary }]}>Trigger Logs</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }]}>
          <AlertCircle size={16} color="#ef4444" />
          <Text style={[styles.errorText, { color: '#ef4444', flex: 1 }]}>{error}</Text>
          <TouchableOpacity onPress={() => loadData()}>
            <Text style={{ color: isDarkMode ? '#f87171' : '#ef4444', fontWeight: 'bold', fontSize: 12 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {activeTab === 'pending' ? (
          <>
            {/* Stat Cards Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Unpaid Items</Text>
                  <Clock size={14} color={t.accent} />
                </View>
                <Text style={[styles.statCardValue, { color: t.textPrimary }]}>{stats.total}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Overdue Bills</Text>
                  <AlertCircle size={14} color="#ef4444" />
                </View>
                <Text style={[styles.statCardValue, { color: '#ef4444' }]}>{stats.overdue}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Due Soon (7d)</Text>
                  <Bell size={14} color="#eab308" />
                </View>
                <Text style={[styles.statCardValue, { color: '#eab308' }]}>{stats.dueSoon}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>Active Clients</Text>
                  <ShieldCheck size={14} color="#3b82f6" />
                </View>
                <Text style={[styles.statCardValue, { color: t.textPrimary }]}>{stats.clientsCount}</Text>
              </View>
            </View>

            {/* Filter Panel Card */}
            <View style={[styles.filterBarCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {/* Search Bar */}
              <View style={[styles.searchBox, { backgroundColor: t.bg, borderColor: t.border }]}>
                <Search size={16} color={t.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: t.textPrimary }]}
                  placeholder="Search client, email, or item..."
                  placeholderTextColor={t.textSecondary}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setCurrentPage(1);
                  }}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={t.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Status capsules horizontal scroll */}
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.capsulesScroll}>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'due-soon', label: 'Due Soon' },
                  { value: 'scheduled', label: 'Scheduled' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.capsuleBtn,
                      activeSubFilter === item.value && { backgroundColor: t.accentLight, borderColor: t.accent }
                    ]}
                    onPress={() => {
                      setActiveSubFilter(item.value as any);
                      setCurrentPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.capsuleText,
                        { color: activeSubFilter === item.value ? t.accent : t.textSecondary }
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Targets list */}
            <Text style={styles.sectionHeaderTitle}>Dues Outstanding ({filteredTargets.length})</Text>
            <View style={styles.pendingList}>
              {paginatedTargets.length > 0 ? (
                paginatedTargets.map((target: any) => (
                  <View key={target.id} style={[styles.pendingItemCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={styles.pendingItemHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[styles.pendingItemName, { color: t.textPrimary }]} numberOfLines={1}>{target.clientName}</Text>
                          <View style={[
                            styles.urgencyBadge,
                            {
                              backgroundColor: target.status === 'overdue'
                                ? 'rgba(239, 68, 68, 0.1)'
                                : target.status === 'due-soon'
                                ? 'rgba(238, 77, 45, 0.1)'
                                : 'rgba(148, 163, 184, 0.1)'
                            }
                          ]}>
                            <Text style={[
                              styles.urgencyText,
                              {
                                color: target.status === 'overdue'
                                  ? '#ef4444'
                                  : target.status === 'due-soon'
                                  ? t.accent
                                  : t.textSecondary
                              }
                            ]}>
                              {target.status.replace('-', ' ')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.clientSubtitle}>
                          {target.itemName} • <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>{formatCurrency(target.amountDue)}</Text>
                        </Text>
                        <Text style={[styles.dueDateText, { color: t.textSecondary }]}>Due: {formatDate(target.dueDate)}</Text>
                        <Text style={[styles.lastSentText, { color: t.textSecondary }]}>Last reminder: {formatDate(target.lastSentAt)}</Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.sendSingleBtn, { backgroundColor: t.accentLight, borderColor: t.accent }]}
                        onPress={() => handleSendReminder(target.id, target.itemName, target.clientName)}
                        disabled={actionLoading}
                      >
                        <Send size={12} color={t.accent} />
                        <Text style={styles.sendSingleText}>Remind</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={[styles.emptyCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                  <Info size={24} color={t.textSecondary} />
                  <Text style={[styles.emptyText, { color: t.textSecondary }]}>No reminder targets match filter constraints.</Text>
                </View>
              )}
            </View>

            {/* Pagination Controls */}
            {filteredTargets.length > PAGE_SIZE && (
              <View style={[styles.paginationRow, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.paginationCount, { color: t.textSecondary }]}>
                  Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredTargets.length)} of {filteredTargets.length}
                </Text>
                <View style={styles.paginationButtons}>
                  <TouchableOpacity
                    style={[styles.pageArrowBtn, { borderColor: t.cardBorder }]}
                    onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={safePage === 1}
                  >
                    <ChevronLeft size={16} color={safePage === 1 ? t.border : t.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[styles.pageNumberText, { color: t.textPrimary }]}>{safePage} / {totalPages}</Text>
                  <TouchableOpacity
                    style={[styles.pageArrowBtn, { borderColor: t.cardBorder }]}
                    onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={safePage === totalPages}
                  >
                    <ChevronRight size={16} color={safePage === totalPages ? t.border : t.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Logs List */}
            <Text style={styles.sectionHeaderTitle}>Broadcast & Alert Audits</Text>
            {paginatedLogs.length > 0 ? (
              <>
                <View style={[styles.logsContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                  <AnyFlashList
                    data={paginatedLogs}
                    estimatedItemSize={70}
                    scrollEnabled={false}
                    renderItem={({ item, index }: { item: any, index: number }) => {
                      const log = item;
                      if (!log) return null;
                      return (
                        <View key={log.id} style={[styles.logItemRow, index < paginatedLogs.length - 1 ? { borderBottomColor: t.border } : null]}>
                          <View style={styles.logItemLeft}>
                            <View style={styles.logStatusIndicator}>
                              <Check size={12} color="#10b981" />
                            </View>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={[styles.logDescription, { color: t.textPrimary }]} numberOfLines={1}>
                                Reminder Sent for {log.itemName} ({formatCurrency(log.amountDue)})
                              </Text>
                              <Text style={styles.logMetadata}>
                                Client: {log.clientName} • By: {log.sentBy}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.logTimeText, { color: t.textSecondary }]}>{formatLogTime(log.sentAt)}</Text>
                        </View>
                      );
                    }}
                  />
                </View>

                {/* Pagination Controls for Logs */}
                {formattedLogs.length > PAGE_SIZE && (
                  <View style={[styles.paginationRow, { backgroundColor: t.cardBg, borderColor: t.cardBorder, marginTop: 4, marginBottom: 16 }]}>
                    <Text style={[styles.paginationCount, { color: t.textSecondary }]}>
                      Showing {logsPageStart + 1}-{Math.min(logsPageStart + PAGE_SIZE, formattedLogs.length)} of {formattedLogs.length}
                    </Text>
                    <View style={styles.paginationButtons}>
                      <TouchableOpacity
                        style={[styles.pageArrowBtn, { borderColor: t.cardBorder }]}
                        onPress={() => setCurrentLogsPage(prev => Math.max(1, prev - 1))}
                        disabled={safeLogsPage === 1}
                      >
                        <ChevronLeft size={16} color={safeLogsPage === 1 ? t.border : t.textPrimary} />
                      </TouchableOpacity>
                      <Text style={[styles.pageNumberText, { color: t.textPrimary }]}>{safeLogsPage} / {logsTotalPages}</Text>
                      <TouchableOpacity
                        style={[styles.pageArrowBtn, { borderColor: t.cardBorder }]}
                        onPress={() => setCurrentLogsPage(prev => Math.min(logsTotalPages, prev + 1))}
                        disabled={safeLogsPage === logsTotalPages}
                      >
                        <ChevronRight size={16} color={safeLogsPage === logsTotalPages ? t.border : t.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Info size={24} color={t.textSecondary} />
                <Text style={[styles.emptyText, { color: t.textSecondary }]}>No reminder logs recorded.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* --- MAIN BULK REMINDERS MODAL --- */}
      <Modal
        visible={isBulkModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!isSendingBulk) {
            setIsBulkModalOpen(false);
            setModalStep('select');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayDismiss}
            activeOpacity={1}
            onPress={() => {
              if (!isSendingBulk) {
                setIsBulkModalOpen(false);
                setModalStep('select');
              }
            }}
          />

          <SwipeDismissModal
            onDismiss={() => {
              if (!isSendingBulk) {
                setIsBulkModalOpen(false);
                setModalStep('select');
              }
            }}
            disabled={isSendingBulk}
          >
            <View style={[
              styles.modalContent,
              { backgroundColor: t.cardBg, borderColor: t.cardBorder, height: '90%' }
            ]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: t.cardBg, borderBottomWidth: 1.5, borderBottomColor: t.border }]}>
              <View style={styles.modalHeaderLeft}>
                <Mail size={18} color={t.textPrimary} />
                <View>
                  <Text style={[styles.modalHeaderTitle, { color: t.textPrimary }]}>
                    {modalStep === 'preview' ? 'Reminders Preview Queue' : 'Bulk Reminders'}
                  </Text>
                  <Text style={[styles.modalHeaderDesc, { color: t.textSecondary }]}>
                    {modalStep === 'preview' ? 'Review compiled email queue' : 'Select dispatch targets'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  if (!isSendingBulk) {
                    setIsBulkModalOpen(false);
                    setModalStep('select');
                  }
                }}
                disabled={isSendingBulk}
              >
                <X size={20} color={t.textPrimary} />
              </TouchableOpacity>
            </View>

            {modalStep === 'select' && (
              <ScrollView style={styles.bulkModalForm} contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom, gap: 16 }}>
                <Text style={styles.bulkOptionHeader}>Select Scope</Text>

                <View style={styles.bulkOptionsGrid}>
                  {/* Row 1 */}
                  <View style={styles.optionsRow}>
                    {/* Option 1: All Clients */}
                    <TouchableOpacity
                      style={[
                        styles.bulkOptionCard,
                        { backgroundColor: t.border, borderColor: t.cardBorder },
                        bulkType === 'all' && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setBulkType('all')}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={[
                          styles.optionIconContainer,
                          { backgroundColor: bulkType === 'all' ? t.accentLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                        ]}>
                          <Users size={16} color={bulkType === 'all' ? t.accent : t.textSecondary} />
                        </View>
                        {bulkType === 'all' && (
                          <View style={[styles.optionCheckedDot, { backgroundColor: t.accent }]}>
                            <Check size={8} color="#ffffff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.optionCardBody}>
                        <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>All Clients</Text>
                        <Text style={styles.bulkOptionDescText}>Targets all active pending ledger accounts.</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Option 2: Specific Month */}
                    <TouchableOpacity
                      style={[
                        styles.bulkOptionCard,
                        { backgroundColor: t.border, borderColor: t.cardBorder },
                        bulkType === 'month' && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setBulkType('month')}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={[
                          styles.optionIconContainer,
                          { backgroundColor: bulkType === 'month' ? t.accentLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                        ]}>
                          <Calendar size={16} color={bulkType === 'month' ? t.accent : t.textSecondary} />
                        </View>
                        {bulkType === 'month' && (
                          <View style={[styles.optionCheckedDot, { backgroundColor: t.accent }]}>
                            <Check size={8} color="#ffffff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.optionCardBody}>
                        <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Specific Month</Text>
                        <Text style={styles.bulkOptionDescText}>Targets payments due in selected billing month.</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Row 2 */}
                  <View style={styles.optionsRow}>
                    {/* Option 3: Selected Clients */}
                    <TouchableOpacity
                      style={[
                        styles.bulkOptionCard,
                        { backgroundColor: t.border, borderColor: t.cardBorder },
                        bulkType === 'selected' && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setBulkType('selected')}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={[
                          styles.optionIconContainer,
                          { backgroundColor: bulkType === 'selected' ? t.accentLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                        ]}>
                          <UserCheck size={16} color={bulkType === 'selected' ? t.accent : t.textSecondary} />
                        </View>
                        {bulkType === 'selected' && (
                          <View style={[styles.optionCheckedDot, { backgroundColor: t.accent }]}>
                            <Check size={8} color="#ffffff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.optionCardBody}>
                        <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Selected Clients</Text>
                        <Text style={styles.bulkOptionDescText}>Allows manually choosing recipients list.</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Option 4: Overdue Only */}
                    <TouchableOpacity
                      style={[
                        styles.bulkOptionCard,
                        { backgroundColor: t.border, borderColor: t.cardBorder },
                        bulkType === 'overdue' && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                      ]}
                      onPress={() => setBulkType('overdue')}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={[
                          styles.optionIconContainer,
                          { backgroundColor: bulkType === 'overdue' ? t.accentLight : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }
                        ]}>
                          <AlertTriangle size={16} color={bulkType === 'overdue' ? t.accent : t.textSecondary} />
                        </View>
                        {bulkType === 'overdue' && (
                          <View style={[styles.optionCheckedDot, { backgroundColor: t.accent }]}>
                            <Check size={8} color="#ffffff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.optionCardBody}>
                        <Text style={[styles.bulkOptionTitle, { color: t.textPrimary }]}>Overdue Only</Text>
                        <Text style={styles.bulkOptionDescText}>Targets the {delinquentClients.length} accounts with 2+ late bills.</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sub Options conditional parameters */}
                {bulkType === 'month' && (
                  <View style={[styles.subFieldsCard, { backgroundColor: t.border }]}>
                    <Text style={styles.subFieldsHeader}>Target Billing period</Text>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.subFieldLabel}>Month</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        {monthNames.map((m, idx) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.badgeBtn, selectedBulkMonth === String(idx + 1) && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkMonth(String(idx + 1))}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === String(idx + 1) ? '#ffffff' : t.textSecondary }]}>
                              {m.substring(0, 3)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={{ gap: 4, marginTop: 10 }}>
                      <Text style={styles.subFieldLabel}>Year</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        {availableYears.map(y => (
                          <TouchableOpacity
                            key={y}
                            style={[styles.badgeBtn, selectedBulkYear === y && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkYear(y)}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkYear === y ? '#ffffff' : t.textSecondary }]}>
                              {y}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                {bulkType === 'selected' && (
                  <View style={[styles.subFieldsCard, { backgroundColor: t.border }]}>
                    <Text style={styles.subFieldsHeader}>Target Recipients</Text>
                    <TouchableOpacity
                      style={[styles.clientSelectTrigger, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                      onPress={() => setIsClientModalOpen(true)}
                    >
                      <Users size={14} color={t.accent} />
                      <Text style={[styles.clientSelectTriggerText, { color: t.textPrimary }]}>
                        {selectedClientIds.length > 0 ? `${selectedClientIds.length} Recipients Selected` : 'Select Client Recipients...'}
                      </Text>
                      <ChevronRight size={14} color={t.textSecondary} />
                    </TouchableOpacity>

                    {/* Optional period filters */}
                    <Text style={[styles.subFieldsHeader, { marginTop: 12 }]}>Billing month constraint (optional)</Text>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.subFieldLabel}>Month</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        <TouchableOpacity
                          style={[styles.badgeBtn, selectedBulkMonth === '' && { backgroundColor: t.accent, borderColor: t.accent }]}
                          onPress={() => setSelectedBulkMonth('')}
                        >
                          <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === '' ? '#ffffff' : t.textSecondary }]}>
                            All Months
                          </Text>
                        </TouchableOpacity>
                        {monthNames.map((m, idx) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.badgeBtn, selectedBulkMonth === String(idx + 1) && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkMonth(String(idx + 1))}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkMonth === String(idx + 1) ? '#ffffff' : t.textSecondary }]}>
                              {m.substring(0, 3)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={{ gap: 4, marginTop: 10 }}>
                      <Text style={styles.subFieldLabel}>Year</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
                        {availableYears.map(y => (
                          <TouchableOpacity
                            key={y}
                            style={[styles.badgeBtn, selectedBulkYear === y && { backgroundColor: t.accent, borderColor: t.accent }]}
                            onPress={() => setSelectedBulkYear(y)}
                          >
                            <Text style={[styles.badgeBtnText, { color: selectedBulkYear === y ? '#ffffff' : t.textSecondary }]}>
                              {y}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                <View style={[styles.bulkModalNotice, { backgroundColor: t.border }]}>
                  <Info size={14} color={t.textSecondary} />
                  <Text style={[styles.bulkModalNoticeText, { color: t.textSecondary }]}>
                    Emails will be delivered in the background via S-Pay Relay Server SMTP configurations.
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.bulkModalFooter}>
                  <TouchableOpacity
                    style={[styles.previewModeBtn, { borderColor: t.border, backgroundColor: t.border }]}
                    onPress={handlePreviewBulkReminders}
                    disabled={isSendingBulk}
                  >
                    <Text style={[styles.previewModeBtnText, { color: t.textPrimary }]}>Preview Queue</Text>
                  </TouchableOpacity>

                  <View style={styles.bulkActionsRight}>
                    <TouchableOpacity
                      style={[styles.bulkCancelBtn, { borderColor: t.border }]}
                      onPress={() => setIsBulkModalOpen(false)}
                      disabled={isSendingBulk}
                    >
                      <Text style={[styles.bulkCancelBtnText, { color: t.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.bulkSendBtn, { backgroundColor: t.accent }]}
                      onPress={handleSendBulkReminders}
                      disabled={isSendingBulk}
                    >
                      <Text style={styles.bulkSendBtnText}>Dispatch</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {modalStep === 'preview' && (
              <View style={styles.previewStepBody}>
                {isPreviewLoading ? (
                  <View style={styles.previewStepLoading}>
                    <ActivityIndicator size="large" color={t.accent} />
                    <Text style={[styles.previewStepLoadingText, { color: t.textPrimary }]}>Compiling Queue templates...</Text>
                  </View>
                ) : !previewData?.clients || previewData.clients.length === 0 ? (
                  <View style={styles.previewStepEmpty}>
                    <Info size={32} color={t.textSecondary} />
                    <Text style={[styles.previewStepEmptyText, { color: t.textPrimary }]}>
                      {previewData?.message || 'No reminders matched queue constraints.'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.bulkCancelBtn, { borderColor: t.border, marginTop: 10 }]}
                      onPress={() => setModalStep('select')}
                    >
                      <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>Back</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.previewMainContent}>
                    {/* Horizontal scroll tabs at the top for preview recipients selection */}
                    <View style={[styles.previewTabsContainer, { borderBottomColor: t.border }]}>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewTabsScroll}>
                        {previewData.clients.map((client: any, idx: number) => {
                          const isActive = activePreviewTab === idx;
                          return (
                            <TouchableOpacity
                              key={client.user_id}
                              style={[
                                styles.previewTabBtn,
                                { backgroundColor: t.border, borderColor: t.border },
                                isActive && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accentLight }
                              ]}
                              onPress={() => setActivePreviewTab(idx)}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Image
                                  source={{ uri: client.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || client.email || '?')}&background=ee4d2d&color=fff&size=100&bold=true` }}
                                  style={styles.previewTabAvatarImage}
                                />
                                <View style={{ maxWidth: 100 }}>
                                  <Text style={[styles.previewTabBtnName, { color: t.textPrimary }]} numberOfLines={1}>
                                    {client.name}
                                  </Text>
                                  <Text style={[styles.previewTabBtnSub, { color: t.textSecondary }]} numberOfLines={1}>
                                    {client.email}
                                  </Text>
                                  <Text style={[styles.previewTabBtnCount, { color: t.accent }]} numberOfLines={1}>
                                    {client.payment_count} bill(s)
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Preview details of active client */}
                    {(() => {
                      const activeClient = previewData.clients[activePreviewTab];
                      if (!activeClient) return null;

                      return (
                        <ScrollView contentContainerStyle={styles.previewDetailsScroll} showsVerticalScrollIndicator={false}>
                          <View style={[styles.previewClientCard, { backgroundColor: t.border }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.previewClientName, { color: t.textPrimary }]}>{activeClient.name}</Text>
                              <Text style={[styles.previewClientEmail, { color: t.textSecondary }]}>{activeClient.email}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[styles.previewClientLabel, { color: t.textSecondary }]}>Total Owed</Text>
                              <Text style={[styles.previewClientAmt, { color: t.textPrimary }]}>{formatCurrency(activeClient.total_due)}</Text>
                            </View>
                          </View>

                          {/* Native Webview wrapper for exact email template parity */}
                          <View style={[styles.webviewContainer, { borderColor: t.border }]}>
                            <View style={[styles.webviewHeader, { backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc', borderBottomColor: t.border }]}>
                              <Text style={[styles.webviewHeaderText, { color: t.textSecondary }]} numberOfLines={1}>
                                <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>To: </Text>
                                {activeClient.name} &lt;{activeClient.email}&gt;
                              </Text>
                              <Text style={[styles.webviewHeaderText, { color: t.textSecondary }]} numberOfLines={1}>
                                <Text style={{ fontWeight: 'bold', color: t.textPrimary }}>Subject: </Text>
                                {activeClient.subject}
                              </Text>
                            </View>
                            <WebView
                              originWhitelist={['*']}
                              source={{ html: activeClient.email_content }}
                              style={styles.webview}
                              scrollEnabled={true}
                            />
                          </View>

                          {/* Bills Breakdown List */}
                          <Text style={styles.subFieldsHeader}>Payment Breakdown</Text>
                          <View style={styles.invoiceBreakdownList}>
                            {activeClient.payments?.map((p: any, pIdx: number) => (
                              <View key={pIdx} style={[styles.invoiceItemRow, { backgroundColor: t.border, borderColor: t.cardBorder }]}>
                                <View style={styles.invoiceRowTop}>
                                  <Text style={[styles.invoiceItemName, { color: t.textPrimary }]} numberOfLines={1}>
                                    {p.item_name}
                                  </Text>
                                  <Text style={[styles.invoiceItemVal, { color: t.textPrimary }]}>
                                    {formatCurrency(p.amount_due)}
                                  </Text>
                                </View>
                                <View style={styles.invoiceRowBottom}>
                                  <Text style={[styles.invoiceItemSub, { color: t.textSecondary }]}>
                                    Due: {formatDate(p.due_date)}
                                  </Text>
                                  <Text style={[styles.invoiceItemTerm, { color: t.textSecondary }]}>
                                    Installment {p.month_number}/{p.installment_months}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        </ScrollView>
                      );
                    })()}
                  </View>
                )}

                {/* Footer dispatch summary controls */}
                {previewData?.clients && previewData.clients.length > 0 && (
                  <View style={[styles.previewFooterRow, { borderTopColor: t.border, paddingBottom: 12 + insets.bottom }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.previewFooterSummary, { color: t.textSecondary }]} numberOfLines={1}>
                        Scope: <Text style={{ color: t.textPrimary, fontWeight: 'bold' }}>{previewData.total_clients} Clients</Text>
                      </Text>
                      <Text style={[styles.previewFooterSummary, { color: t.textSecondary }]} numberOfLines={1}>
                        Total: <Text style={{ color: t.accent, fontWeight: 'bold' }}>{formatCurrency(previewData.total_amount)}</Text>
                      </Text>
                    </View>

                    <View style={styles.bulkActionsRight}>
                      <TouchableOpacity
                        style={[styles.bulkCancelBtn, { borderColor: t.border }]}
                        onPress={() => setModalStep('select')}
                        disabled={isSendingBulk}
                      >
                        <Text style={[styles.bulkCancelBtnText, { color: t.textSecondary }]}>Options</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.bulkSendBtn, { backgroundColor: t.accent }]}
                        onPress={handleSendBulkReminders}
                        disabled={isSendingBulk}
                      >
                        <Text style={styles.bulkSendBtnText}>
                          {isSendingBulk ? 'Sending...' : 'Send All'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
            </View>
          </SwipeDismissModal>
        </View>
      </Modal>

      {/* --- CLIENTS CHECKLIST SUB-MODAL --- */}
      <Modal
        visible={isClientModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsClientModalOpen(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.clientModalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.pickerModalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Users size={16} color={t.accent} />
                <Text style={[styles.pickerModalTitle, { color: t.textPrimary }]}>Recipients Select</Text>
              </View>
              <TouchableOpacity onPress={() => setIsClientModalOpen(false)}>
                <X size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchBox, { borderColor: t.border, backgroundColor: t.border }]}>
              <Search size={14} color={t.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: t.textPrimary }]}
                placeholder="Search clients name/email..."
                placeholderTextColor={t.textSecondary}
                value={clientSearch}
                onChangeText={setClientSearch}
                autoCorrect={false}
              />
            </View>

            <View style={styles.selectionActions}>
              <Text style={[styles.selectionCount, { color: t.textSecondary }]}>
                {filteredClientsForSelection.length} client(s) found
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.quickSelectBtn} onPress={handleSelectAllClients}>
                  <Text style={[styles.quickSelectBtnText, { color: t.accent }]}>Toggle All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickSelectBtn} onPress={() => setSelectedClientIds([])}>
                  <Text style={[styles.quickSelectBtnText, { color: t.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scroll checklist */}
            <ScrollView style={styles.clientModalScroll}>
              {filteredClientsForSelection.length > 0 ? (
                filteredClientsForSelection.map((c: any) => {
                  const isSelected = selectedClientIds.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.clientCheckRow,
                        { borderBottomColor: t.border },
                        isSelected && { backgroundColor: t.accentLight }
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleToggleSelectClient(c.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[
                          styles.checkbox,
                          { borderColor: t.accent, backgroundColor: isSelected ? t.accent : 'transparent' }
                        ]}>
                          {isSelected && <Check size={12} color="#ffffff" />}
                        </View>
                        
                        {/* Client Avatar */}
                        <Image
                          source={{ uri: c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || c.email || '?')}&background=ee4d2d&color=fff&size=100&bold=true` }}
                          style={styles.clientAvatar}
                        />

                        <View style={styles.clientCheckDetails}>
                          <Text style={[styles.clientCheckName, { color: t.textPrimary }]}>{c.name}</Text>
                          <Text style={[styles.clientCheckEmail, { color: t.textSecondary }]}>{c.email}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={[styles.emptyListText, { color: t.textSecondary }]}>No matching clients found.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.applyFilterBtn, { backgroundColor: t.accent, marginTop: 15 }]}
              onPress={() => setIsClientModalOpen(false)}
            >
              <Text style={styles.applyFilterBtnText}>Confirm Selection ({selectedClientIds.length})</Text>
            </TouchableOpacity>
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
    flex: 1,
  },
  headerSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.3,
    fontFamily: 'Outfit-Bold',
  },
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  broadcastBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
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
    fontFamily: 'Outfit-Bold',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    gap: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  statCard: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
    minHeight: 80,
    justifyContent: 'space-between',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: 'Outfit-Medium',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  filterBarCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    height: '100%',
    fontFamily: 'Outfit-Regular',
    padding: 0,
  },
  capsulesScroll: {
    paddingVertical: 2,
    gap: 6,
  },
  capsuleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  capsuleText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ee4d2d',
    marginTop: 6,
    fontFamily: 'Outfit-Bold',
  },
  pendingList: {
    gap: 10,
  },
  pendingItemCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
  },
  pendingItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingItemName: {
    fontSize: 13.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    fontFamily: 'Outfit-Medium',
  },
  dueDateText: {
    fontSize: 9.5,
    marginTop: 2.5,
    fontFamily: 'Outfit-Regular',
  },
  lastSentText: {
    fontSize: 9.5,
    marginTop: 1.5,
    fontFamily: 'Outfit-Regular',
  },
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  urgencyText: {
    fontSize: 8.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
  },
  sendSingleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sendSingleText: {
    color: '#ee4d2d',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 11.5,
    fontFamily: 'Outfit-Regular',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 4,
  },
  paginationCount: {
    fontSize: 11,
    fontFamily: 'Outfit-Regular',
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    minWidth: 40,
    textAlign: 'center',
  },
  logsContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 2,
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
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  logMetadata: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'Outfit-Regular',
  },
  logTimeText: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalOverlayDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalHeaderTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
  modalHeaderDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  bulkModalForm: {
    flex: 1,
  },
  bulkOptionHeader: {
    fontSize: 9,
    color: '#ee4d2d',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bulkOptionsGrid: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  bulkOptionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  optionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  optionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardBody: {
    marginTop: 4,
    gap: 2,
  },
  bulkOptionTitle: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  bulkOptionDescText: {
    fontSize: 8.5,
    color: '#64748b',
    lineHeight: 11,
    fontFamily: 'Outfit-Regular',
  },
  subFieldsCard: {
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  subFieldsHeader: {
    fontSize: 9.5,
    color: '#ee4d2d',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
  subFieldLabel: {
    fontSize: 8.5,
    color: '#64748b',
    fontFamily: 'Outfit-Medium',
  },
  badgeRow: {
    gap: 6,
    paddingVertical: 2,
  },
  badgeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badgeBtnText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  clientSelectTriggerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
  },
  bulkModalNotice: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  bulkModalNoticeText: {
    flex: 1,
    fontSize: 9.5,
    fontFamily: 'Outfit-Regular',
    lineHeight: 12,
  },
  bulkModalFooter: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  previewModeBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModeBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  bulkActionsRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  bulkCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkCancelBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  bulkSendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkSendBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewStepBody: {
    flex: 1,
    flexDirection: 'column',
  },
  previewStepLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  previewStepLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit-Medium',
  },
  previewStepEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  previewStepEmptyText: {
    fontSize: 11.5,
    fontFamily: 'Outfit-Regular',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  previewMainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  previewTabsContainer: {
    borderBottomWidth: 1.5,
    padding: 8,
  },
  previewTabsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  previewTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 120,
  },
  previewTabAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTabAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  previewTabAvatarText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewTabBtnName: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewTabBtnSub: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  previewTabBtnCount: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
  },
  previewDetailsScroll: {
    padding: 12,
    gap: 10,
  },
  previewClientCard: {
    padding: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewClientName: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  previewClientEmail: {
    fontSize: 9,
    fontFamily: 'Outfit-Regular',
    marginTop: 1,
  },
  previewClientLabel: {
    fontSize: 8,
    fontFamily: 'Outfit-Medium',
    textTransform: 'uppercase',
  },
  previewClientAmt: {
    fontSize: 13.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  subjectCard: {
    padding: 10,
    borderRadius: 10,
  },
  subjectText: {
    fontSize: 9.5,
    lineHeight: 13.5,
    fontFamily: 'Outfit-Regular',
  },
  webviewContainer: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  webviewHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 2,
  },
  webviewHeaderText: {
    fontSize: 9,
    fontFamily: 'Outfit-Regular',
  },
  invoiceBreakdownList: {
    gap: 6,
  },
  invoiceItemRow: {
    padding: 10,
    borderRadius: 12,
    flexDirection: 'column',
    borderWidth: 1,
  },
  invoiceRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  invoiceRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  invoiceItemName: {
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
    flex: 1,
    marginRight: 8,
  },
  invoiceItemSub: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Regular',
  },
  invoiceItemVal: {
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  invoiceItemTerm: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  previewFooterSummary: {
    fontSize: 10,
    fontFamily: 'Outfit-Medium',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  clientModalContent: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    gap: 12,
    maxHeight: '75%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerModalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  selectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 8.5,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
  },
  quickSelectBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  quickSelectBtnText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientModalScroll: {
    maxHeight: 280,
  },
  clientCheckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  clientCheckDetails: {
    flex: 1,
    gap: 2,
  },
  clientCheckName: {
    fontSize: 11.5,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  clientCheckEmail: {
    fontSize: 9.5,
    fontFamily: 'Outfit-Regular',
  },
  clientAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Outfit-Bold',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFilterBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFilterBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
  emptyListText: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 12,
    fontFamily: 'Outfit-Regular',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 11.5,
    fontFamily: 'Outfit-Medium',
  },
});
