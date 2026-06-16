import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Bell,
  RefreshCw,
  Check,
  Trash2,
  Megaphone,
  X,
  Package,
  CheckCircle2,
  CreditCard,
  Clock,
  Calendar,
  ShieldAlert,
  Volume2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  User,
  ExternalLink,
  Database,
  Key,
  FileText,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../utils/supabase';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import { getNotifications, markNotificationsRead, clearNotifications, sendAdminAnnouncement } from '../../services/adminService';
import { useNotifications } from '../../hooks/useNotifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseUtcDate } from '../../utils/date';

type NotificationCategory = 'ALL' | 'PAYMENT_UPDATES' | 'ALERTS' | 'ADS' | 'SYSTEM';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  category: NotificationCategory;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  read: boolean;
  createdAt: string;
  data?: any;
}

const CATEGORIES: Array<{ id: NotificationCategory; label: string }> = [
  { id: 'ALL', label: 'All Logs' },
  { id: 'PAYMENT_UPDATES', label: 'Payments' },
  { id: 'ALERTS', label: 'Alerts' },
  { id: 'ADS', label: 'Ads' },
  { id: 'SYSTEM', label: 'System' },
];

function iconFor(type: string, category: NotificationCategory) {
  switch (type) {
    case 'ORDER_ASSIGNED':
    case 'ORDER_UPDATED':
      return Package;
    case 'ORDER_COMPLETED':
      return CheckCircle2;
    case 'PAYMENT_CONFIRMED':
    case 'BULK_PAYMENTS_CONFIRMED':
      return CreditCard;
    case 'PAYMENT_REMINDER':
      return Clock;
    case 'RESCHEDULE_APPROVED':
    case 'RESCHEDULE_REJECTED':
      return Calendar;
    case 'BUDGET_ALERT':
      return ShieldAlert;
    case 'AD_ANNOUNCEMENT':
      return Megaphone;
    default:
      if (category === 'PAYMENT_UPDATES') return CreditCard;
      if (category === 'ALERTS') return ShieldAlert;
      if (category === 'ADS') return Megaphone;
      return Bell;
  }
}

const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

function formatRelativeDate(value: string) {
  const date = parseUtcDate(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

export default function AdminNotificationsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useContext(ThemeContext);
  const { refreshUnreadCount } = useNotifications();
  const layout = useResponsiveLayout();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('ALL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Announcement compose states
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annTarget, setAnnTarget] = useState('all_clients');
  const [annCategory, setAnnCategory] = useState<'ADS' | 'SYSTEM'>('ADS');
  const [sendingAnn, setSendingAnn] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Detail Modal states
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);

  const handleCopyValue = async (key: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopiedFieldKey(key);
      setTimeout(() => {
        setCopiedFieldKey(null);
      }, 2000);
    } catch (err) {
      console.warn('Failed to copy text:', err);
    }
  };

  const handleCopyAllPayload = async (data: any) => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      await Clipboard.setStringAsync(jsonStr);
      PremiumAlert.alert('Copied', 'Entire payload JSON copied to clipboard.');
    } catch (err) {
      console.warn('Failed to copy JSON payload:', err);
    }
  };

  const formatPayloadDate = (value: string) => {
    const date = parseUtcDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  };

  const partitionedPayload = useMemo(() => {
    if (!selectedItem || !selectedItem.data) return null;
    
    const financialKeys: string[] = [];
    const contextKeys: string[] = [];
    const technicalKeys: string[] = [];
    
    Object.keys(selectedItem.data).forEach(key => {
      const value = selectedItem.data[key];
      if (typeof value === 'object' && value !== null) return;
      
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('amount') || lowerKey === 'duedate') {
        financialKeys.push(key);
      } else if (
        lowerKey.endsWith('id') || 
        lowerKey.includes('channel') || 
        lowerKey.includes('token') || 
        lowerKey.includes('uuid')
      ) {
        technicalKeys.push(key);
      } else {
        contextKeys.push(key);
      }
    });
    
    return { financialKeys, contextKeys, technicalKeys };
  }, [selectedItem]);

  const { data: notificationsData, isLoading: loading, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => getNotifications(100),
    staleTime: 30000,
  });

  const items = useMemo(() => (notificationsData as any)?.notifications || [], [notificationsData]);
  const unreadCount = useMemo(() => (notificationsData as any)?.unreadCount || 0, [notificationsData]);

  const handleMarkAllRead = async () => {
    try {
      const res = await markNotificationsRead(undefined, true);
      if (res.success !== false) {
        PremiumAlert.alert('Success', 'All alerts marked as read.');
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
        void refreshUnreadCount();
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      PremiumAlert.alert('Error', e.message || 'Action failed.');
    }
  };

  const handleMarkOneRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      const res = await markNotificationsRead(item.id, false);
      if (res.success !== false) {
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
        void refreshUnreadCount();
      }
    } catch (e) {
      console.warn('Failed to mark read:', e);
    }
  };

  const handleClearAll = () => {
    PremiumAlert.alert('Clear History', 'Are you sure you want to delete all audit logs in this database partition?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await clearNotifications(undefined, true);
            if (res.success !== false) {
              PremiumAlert.alert('Cleared', 'All system log history cleared.');
              queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
              void refreshUnreadCount();
            } else {
              throw new Error(res.error);
            }
          } catch (e: any) {
            PremiumAlert.alert('Error', e.message || 'Action failed.');
          }
        },
      },
    ]);
  };

  const handleClearOne = async (id: string) => {
    try {
      const res = await clearNotifications(id, false);
      if (res.success !== false) {
        PremiumAlert.alert('Deleted', 'System log item removed.');
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
        void refreshUnreadCount();
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      PremiumAlert.alert('Error', e.message || 'Failed to remove log.');
    }
  };

  const handleBroadcast = async () => {
    if (!annTitle.trim() || !annBody.trim()) {
      PremiumAlert.alert('Validation Error', 'Title and message body are required.');
      return;
    }

    setSendingAnn(true);
    try {
      const res = await sendAdminAnnouncement(
        annTitle.trim(),
        annBody.trim(),
        annTarget,
        annCategory
      );

      if (res.success !== false) {
        const created = Number(res.processed?.created || 0);
        const pushed = Number(res.processed?.pushed || 0);
        const skipped = Number(res.processed?.skipped || 0);
        PremiumAlert.alert(
          created > 0 ? 'Broadcast Completed' : 'Broadcast Queued',
          created > 0
            ? `${created} inbox notification${created === 1 ? '' : 's'} created. ${pushed} push attempt${pushed === 1 ? '' : 's'} sent.`
            : `No inbox rows were created. ${skipped > 0 ? `${skipped} recipient${skipped === 1 ? '' : 's'} skipped by preferences.` : 'Check the selected audience.'}`
        );
        setAnnTitle('');
        setAnnBody('');
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      } else {
        throw new Error(res.error || 'Failed to dispatch broadcast.');
      }
    } catch (e: any) {
      PremiumAlert.alert('Broadcast Error', e.message || 'Action failed.');
    } finally {
      setSendingAnn(false);
    }
  };

  // Filter logs based on category
  const filteredItems = useMemo(() => {
    if (activeCategory === 'ALL') return items;
    return items.filter((x: NotificationItem) => x.category === activeCategory);
  }, [items, activeCategory]);

  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    accent: '#ee4d2d',
    divider: isDarkMode ? '#222d42' : '#e2e8f0',
    inputBg: isDarkMode ? '#0f172a' : '#f8fafc',
    inputBorder: isDarkMode ? '#222d42' : '#cbd5e1',
    tabBgActive: isDarkMode ? 'rgba(238, 77, 45, 0.15)' : 'rgba(238, 77, 45, 0.08)',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <View style={styles.headerLeftContainer}>
          {navigation.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <ArrowLeft size={20} color={t.textPrimary} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerSubtitle}>S-Pay Messaging</Text>
            <Text style={[styles.headerTitle, { color: t.textPrimary }]}>System Logs & Alerting</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.headerActionBtn, { borderColor: t.headerBorder }]}
          onPress={() => refetch()}
          activeOpacity={0.7}
        >
          <RefreshCw size={16} color={t.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]} showsVerticalScrollIndicator={false}>
        
        {/* Quick Batch Actions */}
        <View style={styles.batchActionsRow}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.actionBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}
              onPress={handleMarkAllRead}
              activeOpacity={0.7}
            >
              <Check size={12} color="#3b82f6" />
              <Text style={[styles.actionBadgeText, { color: '#3b82f6' }]}>Mark all read ({unreadCount})</Text>
            </TouchableOpacity>
          )}
          {items.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
              onPress={handleClearAll}
              activeOpacity={0.7}
            >
              <Trash2 size={12} color="#ef4444" />
              <Text style={[styles.actionBadgeText, { color: '#ef4444' }]}>Clear all history</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Announcement Dispatcher Section */}
        <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => setBroadcastOpen(open => !open)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeaderLeft}>
              <Volume2 size={18} color={t.accent} />
              <View>
                <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Broadcast Notification</Text>
                <Text style={[styles.cardDesc, { color: t.textSecondary }]}>
                  {broadcastOpen ? 'Send inbox and push alerts to selected recipients.' : 'Collapsed - tap to compose a message.'}
                </Text>
              </View>
            </View>
            {broadcastOpen ? (
              <ChevronUp size={18} color={t.textSecondary} />
            ) : (
              <ChevronDown size={18} color={t.textSecondary} />
            )}
          </TouchableOpacity>

          {broadcastOpen && (
            <View style={styles.form}>
            <TextInput
              value={annTitle}
              onChangeText={setAnnTitle}
              placeholder="Announcement Title"
              placeholderTextColor={t.textMuted}
              style={[styles.input, { color: t.textPrimary, backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
            />

            {/* Target Selectors */}
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={[styles.pickerLabel, { color: t.textSecondary }]}>Audience</Text>
                <View style={styles.segmentContainer}>
                  {([
                    { id: 'all_clients', label: 'Clients' },
                    { id: 'all_users', label: 'All' },
                    { id: 'admins', label: 'Admins' },
                  ]).map(aud => {
                    const isSel = annTarget === aud.id;
                    return (
                      <TouchableOpacity
                        key={aud.id}
                        onPress={() => setAnnTarget(aud.id)}
                        style={[styles.segmentBtn, isSel && { backgroundColor: t.tabBgActive }]}
                      >
                        <Text style={[styles.segmentBtnText, { color: isSel ? t.accent : t.textSecondary }]}>
                          {aud.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.pickerCol}>
                <Text style={[styles.pickerLabel, { color: t.textSecondary }]}>Type</Text>
                <View style={styles.segmentContainer}>
                  {([
                    { id: 'ADS' as const, label: 'Promo' },
                    { id: 'SYSTEM' as const, label: 'System' },
                  ]).map(cat => {
                    const isSel = annCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setAnnCategory(cat.id)}
                        style={[styles.segmentBtn, isSel && { backgroundColor: t.tabBgActive }]}
                      >
                        <Text style={[styles.segmentBtnText, { color: isSel ? t.accent : t.textSecondary }]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <TextInput
              value={annBody}
              onChangeText={setAnnBody}
              placeholder="Message description details..."
              placeholderTextColor={t.textMuted}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.textArea,
                { color: t.textPrimary, backgroundColor: t.inputBg, borderColor: t.inputBorder },
              ]}
            />

            <TouchableOpacity
              onPress={handleBroadcast}
              disabled={sendingAnn}
              style={[styles.dispatchBtn, { backgroundColor: t.accent }]}
              activeOpacity={0.8}
            >
              {sendingAnn ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Megaphone size={14} color="#ffffff" />
                  <Text style={styles.dispatchBtnText}>Broadcast Message</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          )}
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {CATEGORIES.map(category => {
            const isActive = activeCategory === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                onPress={() => setActiveCategory(category.id)}
                style={[
                  styles.categoryTab,
                  isActive && { borderColor: t.accent, backgroundColor: t.tabBgActive },
                  !isActive && { borderColor: t.cardBorder, backgroundColor: t.cardBg },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    { color: isActive ? t.accent : t.textSecondary },
                    isActive && styles.categoryTabTextActive,
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Notification Logs List */}
        <View style={[styles.listCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          {loading ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="large" color={t.accent} />
              <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading system audit logs...</Text>
            </View>
          ) : paginatedItems.length === 0 ? (
            <View style={styles.emptyWrapper}>
              <Bell size={32} color={t.textMuted} />
              <Text style={[styles.emptyText, { color: t.textSecondary }]}>No audit log notifications found.</Text>
            </View>
          ) : (
            <View>
              {paginatedItems.map((item: NotificationItem, idx: number) => {
                const Icon = iconFor(item.type, item.category);
                return (
                  <View key={item.id}>
                    {idx > 0 && <View style={[styles.divider, { backgroundColor: t.divider }]} />}
                    <TouchableOpacity
                      style={[styles.logRow, !item.read && { backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.04)' : 'rgba(238, 77, 45, 0.02)' }]}
                      onPress={async () => {
                        setSelectedItem(item);
                        await handleMarkOneRead(item);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconContainer, { backgroundColor: t.tabBgActive }]}>
                        <Icon size={18} color={t.accent} />
                      </View>
                      
                      <View style={styles.logDetails}>
                        <View style={styles.logHeader}>
                          <Text style={[styles.logTitle, { color: t.textPrimary }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {!item.read && (
                            <View style={styles.newBadge}>
                              <Text style={styles.newBadgeText}>New</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.logBody, { color: t.textSecondary }]} numberOfLines={2}>
                          {item.body}
                        </Text>
                        <Text style={[styles.logTime, { color: t.textMuted }]}>
                          {formatRelativeDate(item.createdAt)}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.deleteRowBtn}
                        onPress={() => handleClearOne(item.id)}
                        activeOpacity={0.7}
                      >
                        <X size={15} color={t.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Pagination Row */}
              {totalPages > 1 && (
                <View style={[styles.paginationRow, { borderTopColor: t.divider }]}>
                  <Text style={[styles.paginationMeta, { color: t.textSecondary }]}>
                    {currentPage} of {totalPages}
                  </Text>
                  <View style={styles.paginationButtons}>
                    <TouchableOpacity
                      disabled={currentPage === 1}
                      onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={[styles.pageBtn, currentPage === 1 && styles.disabledBtn, { borderColor: t.divider }]}
                    >
                      <ChevronLeft size={16} color={currentPage === 1 ? t.textMuted : t.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={currentPage === totalPages}
                      onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      style={[styles.pageBtn, currentPage === totalPages && styles.disabledBtn, { borderColor: t.divider }]}
                    >
                      <ChevronRight size={16} color={currentPage === totalPages ? t.textMuted : t.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      {selectedItem && (
        <Modal
          visible={!!selectedItem}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedItem(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: t.divider }]}>
                <View style={styles.modalHeaderLeft}>
                  <View style={[styles.modalIconBox, { backgroundColor: t.tabBgActive }]}>
                    {React.createElement(iconFor(selectedItem.type, selectedItem.category), { size: 18, color: t.accent })}
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalCategory}>{selectedItem.category}</Text>
                    <Text style={[styles.modalTitle, { color: t.textPrimary }]}>{selectedItem.title}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                  <X size={16} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Message */}
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={[styles.modalMessageCard, { backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.04)' : '#f8fafc', borderLeftColor: t.accent }]}>
                  <Text style={[styles.modalMessageText, { color: t.textPrimary }]}>{selectedItem.body}</Text>
                </View>

                {/* Metadata Details (Receipt Visual style) */}
                {selectedItem.data && (
                  <View style={styles.payloadDocketContainer}>
                    {/* 1. Financial Highlights Block */}
                    {partitionedPayload && partitionedPayload.financialKeys.length > 0 && (
                      <View style={[styles.payloadSectionCard, styles.financialCard, { backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.06)' : 'rgba(238, 77, 45, 0.03)', borderColor: 'rgba(238, 77, 45, 0.15)' }]}>
                        {partitionedPayload.financialKeys.map(key => {
                          const val = selectedItem.data[key];
                          const isAmount = key.toLowerCase().includes('amount');
                          return (
                            <View key={key} style={styles.financialRow}>
                              {isAmount ? (
                                <View style={styles.financialAmountContainer}>
                                  <CreditCard size={14} color={t.accent} style={{ marginRight: 6 }} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.payloadLabelMini, { color: t.textSecondary }]}>
                                      {key}
                                    </Text>
                                    <Text style={[styles.financialAmountText, { color: t.accent }]}>
                                      {formatCurrency(val)}
                                    </Text>
                                  </View>
                                </View>
                              ) : (
                                <View style={styles.financialDateContainer}>
                                  <Clock size={12} color={t.textSecondary} style={{ marginRight: 6 }} />
                                  <Text style={[styles.payloadLabelMini, { color: t.textSecondary }]}>
                                    {key}:{' '}
                                  </Text>
                                  <Text style={[styles.financialDateText, { color: t.textPrimary }]}>
                                    {formatPayloadDate(String(val))}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* 2. Context & Details Grid */}
                    {partitionedPayload && partitionedPayload.contextKeys.length > 0 && (
                      <View style={[styles.payloadSectionCard, { borderColor: t.divider }]}>
                        <Text style={[styles.payloadSectionHeader, { color: t.textPrimary }]}>Context & Details</Text>
                        <View style={styles.gridContainer}>
                          {partitionedPayload.contextKeys.map((key, idx) => {
                            const val = selectedItem.data[key];
                            const isName = key.toLowerCase() === 'name';
                            const isScreen = key.toLowerCase() === 'screen';
                            
                            let IconComp = FileText;
                            if (isName) IconComp = User;
                            else if (isScreen) IconComp = ExternalLink;
                            
                            return (
                              <View key={key} style={[styles.gridItem, { borderTopWidth: idx > 1 ? 1 : 0, borderTopColor: t.divider }]}>
                                <View style={styles.gridItemHeader}>
                                  <IconComp size={10} color={t.textMuted} style={{ marginRight: 4 }} />
                                  <Text style={[styles.payloadLabelMini, { color: t.textSecondary }]}>{key}</Text>
                                </View>
                                <Text style={[styles.gridValueText, { color: t.textPrimary }]} numberOfLines={1}>
                                  {String(val)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* 3. Technical Context (Monospace & Copy Actions) */}
                    {partitionedPayload && partitionedPayload.technicalKeys.length > 0 && (
                      <View style={[styles.payloadSectionCard, styles.technicalCard, { backgroundColor: isDarkMode ? '#0f1422' : '#f8fafc', borderColor: t.divider }]}>
                        <View style={styles.technicalCardHeader}>
                          <Database size={11} color={t.textMuted} style={{ marginRight: 6 }} />
                          <Text style={[styles.payloadSectionHeader, { color: t.textPrimary, marginBottom: 0 }]}>System Metadata</Text>
                        </View>
                        <View style={styles.techList}>
                          {partitionedPayload.technicalKeys.map((key) => {
                            const val = String(selectedItem.data[key]);
                            const isCopied = copiedFieldKey === key;
                            return (
                              <View key={key} style={styles.techRow}>
                                <View style={styles.techRowLeft}>
                                  <Key size={10} color={t.textMuted} style={{ marginRight: 6, marginTop: 2 }} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.payloadLabelMini, { color: t.textSecondary }]}>{key}</Text>
                                    <Text style={[styles.techValueText, { color: t.textPrimary }]} numberOfLines={1} ellipsizeMode="middle">
                                      {val}
                                    </Text>
                                  </View>
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleCopyValue(key, val)}
                                  style={[styles.techCopyBtn, { backgroundColor: isCopied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)' }]}
                                  activeOpacity={0.7}
                                >
                                  {isCopied ? (
                                    <Check size={10} color="#22c55e" />
                                  ) : (
                                    <Copy size={10} color={t.textSecondary} />
                                  )}
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Bottom Actions inside the modal */}
                <View style={styles.modalActionsRow}>
                  {selectedItem.data && (
                    <TouchableOpacity
                      onPress={() => handleCopyAllPayload(selectedItem.data)}
                      style={[styles.modalActionBtn, styles.modalActionSecondary, { borderColor: t.divider }]}
                      activeOpacity={0.8}
                    >
                      <Database size={13} color={t.textPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.modalActionText, { color: t.textPrimary }]}>Copy JSON</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setSelectedItem(null)}
                    style={[styles.modalActionBtn, styles.modalActionPrimary, { backgroundColor: t.accent }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modalActionText, { color: '#ffffff' }]}>Dismiss</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalFooterSpacer} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
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
    marginTop: 2,
    letterSpacing: -0.3,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  batchActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  form: {
    marginTop: 14,
    gap: 10,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  textArea: {
    height: 70,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerCol: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 2,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  dispatchBtn: {
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dispatchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryContent: {
    gap: 8,
    paddingRight: 16,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryTabTextActive: {
    fontWeight: 'bold',
  },
  listCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 30,
  },
  loadingWrapper: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    marginTop: 12,
  },
  emptyWrapper: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    marginTop: 10,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logDetails: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  newBadge: {
    backgroundColor: '#ee4d2d',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  logBody: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  logTime: {
    fontSize: 9,
    marginTop: 4,
  },
  deleteRowBtn: {
    padding: 6,
  },
  divider: {
    height: 1,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  paginationMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1.5,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  modalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  modalCategory: {
    color: '#ee4d2d',
    fontSize: 9,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalMessageCard: {
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 16,
  },
  modalMessageText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 18,
  },
  payloadDocketContainer: {
    gap: 12,
    marginBottom: 20,
  },
  payloadSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  payloadSectionHeader: {
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  financialCard: {
    borderWidth: 1,
  },
  financialRow: {
    gap: 6,
  },
  financialAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  financialAmountText: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
  },
  financialDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  financialDateText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    paddingVertical: 8,
    paddingRight: 8,
  },
  gridItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  gridValueText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  technicalCard: {
    borderWidth: 1,
  },
  technicalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  techList: {
    gap: 8,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  techRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 10,
  },
  techValueText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Regular',
    marginTop: 2,
  },
  techCopyBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalActionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  modalActionPrimary: {
    elevation: 2,
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  modalActionSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  modalActionText: {
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
  },
  payloadLabelMini: {
    fontSize: 9,
    fontFamily: 'Outfit-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalFooterSpacer: {
    height: 32,
  },
});
