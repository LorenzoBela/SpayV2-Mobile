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
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import {
  getNotifications,
  markNotificationsRead,
  clearNotifications,
  sendAdminAnnouncement,
} from '../../services/adminService';
import { useNotifications } from '../../hooks/useNotifications';

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminNotificationsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useContext(ThemeContext);
  const { refreshUnreadCount } = useNotifications();
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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

  const loadNotifications = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await getNotifications(100);
      if (data.notifications) {
        setItems(data.notifications);
        setUnreadCount(Number(data.unreadCount || 0));
        void refreshUnreadCount();
      } else {
        setItems([]);
      }
    } catch (e) {
      console.warn('Failed to load system log notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      setRefreshing(true);
      const res = await markNotificationsRead(undefined, true);
      if (res.success !== false) {
        PremiumAlert.alert('Success', 'All alerts marked as read.');
        await loadNotifications(false);
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      PremiumAlert.alert('Error', e.message || 'Action failed.');
      setRefreshing(false);
    }
  };

  const handleMarkOneRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      const res = await markNotificationsRead(item.id, false);
      if (res.success !== false) {
        setItems(prev => prev.map(x => x.id === item.id ? { ...x, read: true } : x));
        setUnreadCount(prev => Math.max(0, prev - 1));
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
            setRefreshing(true);
            const res = await clearNotifications(undefined, true);
            if (res.success !== false) {
              PremiumAlert.alert('Cleared', 'All system log history cleared.');
              await loadNotifications(false);
            } else {
              throw new Error(res.error);
            }
          } catch (e: any) {
            PremiumAlert.alert('Error', e.message || 'Action failed.');
            setRefreshing(false);
          }
        },
      },
    ]);
  };

  const handleClearOne = async (id: string) => {
    try {
      const res = await clearNotifications(id, false);
      if (res.success !== false) {
        setItems(prev => prev.filter(x => x.id !== id));
        PremiumAlert.alert('Deleted', 'System log item removed.');
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
        await loadNotifications(false);
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
    return items.filter(x => x.category === activeCategory);
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
          onPress={() => loadNotifications(true)}
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
              {paginatedItems.map((item, idx) => {
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
                <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.modalCloseBtn}>
                  <X size={18} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Message */}
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={[styles.modalMessageCard, { backgroundColor: t.inputBg }]}>
                  <Text style={[styles.modalMessageText, { color: t.textPrimary }]}>{selectedItem.body}</Text>
                </View>

                {/* Metadata details if applicable */}
                {selectedItem.data && (
                  <View style={[styles.payloadCard, { borderColor: t.divider }]}>
                    <Text style={[styles.payloadTitle, { color: t.textPrimary }]}>Associated Payloads</Text>
                    {Object.keys(selectedItem.data).map(key => {
                      const value = selectedItem.data[key];
                      if (typeof value === 'object' && value !== null) return null;
                      return (
                        <View key={key} style={styles.payloadRow}>
                          <Text style={[styles.payloadKey, { color: t.textSecondary }]}>{key}</Text>
                          <Text style={[styles.payloadValue, { color: t.textPrimary }]}>
                            {key.toLowerCase().includes('amount') ? formatCurrency(value) : String(value)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

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
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1.5,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  modalCategory: {
    color: '#ee4d2d',
    fontSize: 9,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalMessageCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalMessageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  payloadCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  payloadTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  payloadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payloadKey: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  payloadValue: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalFooterSpacer: {
    height: 24,
  },
});
