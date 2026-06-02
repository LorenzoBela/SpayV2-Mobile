import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Modal,
  Dimensions,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Receipt,
  ShieldCheck,
  Megaphone,
  Bell,
  Trash2,
  CheckCheck,
  BellOff,
  Sun,
  Moon,
  X,
  ExternalLink,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { MotiView, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  AppNotification,
  clearNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationCategory,
  subscribeToRealtimeNotifications,
} from '../../services/notificationService';
import { supabase } from '../../utils/supabase';
import { ThemeContext } from '../../navigation/navigationTypes';

const { width, height } = Dimensions.get('window');

const CATEGORY_THEMES: Record<
  NotificationCategory,
  {
    color: string;
    bgColorLight: string;
    bgColorDark: string;
    label: string;
    icon: LucideIcon;
  }
> = {
  PAYMENT_UPDATES: {
    color: '#ee4d2d',
    bgColorLight: 'rgba(238, 77, 45, 0.06)',
    bgColorDark: 'rgba(238, 77, 45, 0.12)',
    label: 'Payments',
    icon: Receipt,
  },
  ALERTS: {
    color: '#ef4444',
    bgColorLight: 'rgba(239, 68, 68, 0.06)',
    bgColorDark: 'rgba(239, 68, 68, 0.12)',
    label: 'Alerts',
    icon: ShieldCheck,
  },
  ADS: {
    color: '#3b82f6',
    bgColorLight: 'rgba(59, 130, 246, 0.06)',
    bgColorDark: 'rgba(59, 130, 246, 0.12)',
    label: 'Ads',
    icon: Megaphone,
  },
  SYSTEM: {
    color: '#10b981',
    bgColorLight: 'rgba(16, 185, 129, 0.06)',
    bgColorDark: 'rgba(16, 185, 129, 0.12)',
    label: 'System',
    icon: Bell,
  },
};

const TABS: Array<{ id: NotificationCategory; label: string }> = [
  { id: 'PAYMENT_UPDATES', label: 'Payments' },
  { id: 'ALERTS', label: 'Alerts' },
  { id: 'ADS', label: 'Ads' },
  { id: 'SYSTEM', label: 'System' },
];

function formatTime(value: string) {
  const date = new Date(value);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (!Number.isFinite(diffMinutes) || diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatFullDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<NotificationCategory>('PAYMENT_UPDATES');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);

  // Dynamic theme colors
  const t = useMemo(
    () => ({
      bg: isDarkMode ? '#0b0f19' : '#f8fafc',
      headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
      headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
      cardBg: isDarkMode ? '#131926' : '#ffffff',
      cardBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
      cardUnreadBg: isDarkMode ? 'rgba(238, 77, 45, 0.03)' : 'rgba(238, 77, 45, 0.02)',
      cardUnreadBorder: isDarkMode ? 'rgba(238, 77, 45, 0.25)' : 'rgba(238, 77, 45, 0.15)',
      textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
      textSecondary: isDarkMode ? '#94a3b8' : '#475569',
      textMuted: isDarkMode ? '#64748b' : '#94a3b8',
      iconBtnBg: isDarkMode ? '#1e293b' : '#f1f5f9',
      iconBtnBorder: isDarkMode ? '#334155' : '#e2e8f0',
      tabBarBg: isDarkMode ? '#131926' : '#f1f5f9',
      tabInactiveText: isDarkMode ? '#64748b' : '#64748b',
      modalBg: isDarkMode ? '#131926' : '#ffffff',
      modalOverlay: isDarkMode ? 'rgba(3, 7, 18, 0.65)' : 'rgba(15, 23, 42, 0.4)',
      dragHandle: isDarkMode ? '#334155' : '#cbd5e1',
    }),
    [isDarkMode]
  );

  const load = useCallback(async () => {
    try {
      const rows = await fetchNotifications();
      setItems(rows);
    } catch (error) {
      console.warn('[NotificationsScreen] load failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      unsubscribe = subscribeToRealtimeNotifications(userId, (notification) => {
        setItems((current) => [notification, ...current]);
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Compute unread counts per tab
  const counts = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          if (!item.read_at) {
            acc[item.category] += 1;
          }
          return acc;
        },
        { PAYMENT_UPDATES: 0, ALERTS: 0, ADS: 0, SYSTEM: 0 } as Record<NotificationCategory, number>
      ),
    [items]
  );

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  const visibleItems = useMemo(() => items.filter((item) => item.category === activeTab), [items, activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleItemPress = async (item: AppNotification) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedNotification(item);

    if (!item.read_at) {
      try {
        await markNotificationRead(item.id);
        setItems((current) =>
          current.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row))
        );
      } catch (error) {
        console.warn('[NotificationsScreen] mark read failed:', error);
      }
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setItems((current) => current.map((row) => ({ ...row, read_at: row.read_at || readAt })));
    } catch (error) {
      console.warn('[NotificationsScreen] mark all failed:', error);
    }
  };

  const handleClear = async (id: string) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await clearNotification(id);
      setItems((current) => current.filter((row) => row.id !== id));
      if (selectedNotification?.id === id) {
        setSelectedNotification(null);
      }
    } catch (error) {
      console.warn('[NotificationsScreen] clear failed:', error);
    }
  };

  const handleClearAllRead = async () => {
    const readOfTab = visibleItems.filter((item) => item.read_at);
    if (readOfTab.length === 0) return;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      for (const item of readOfTab) {
        await clearNotification(item.id);
      }
      setItems((current) =>
        current.filter((row) => !(row.category === activeTab && row.read_at))
      );
    } catch (error) {
      console.warn('[NotificationsScreen] clear all read failed:', error);
    }
  };

  const handleTakeAction = () => {
    if (
      selectedNotification &&
      selectedNotification.data &&
      typeof selectedNotification.data.screen === 'string'
    ) {
      const screen = selectedNotification.data.screen;
      const params = selectedNotification.data.params as any;
      setSelectedNotification(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate(screen, params);
    }
  };

  const renderItem = ({ item, index }: { item: AppNotification; index: number }) => {
    const unread = !item.read_at;
    const catTheme = CATEGORY_THEMES[item.category];
    const IconComponent = catTheme.icon;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: Math.min(index * 60, 400) }}
        style={styles.cardContainer}
      >
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
            unread && {
              borderColor: t.cardUnreadBorder,
              backgroundColor: t.cardUnreadBg,
            },
          ]}
          activeOpacity={0.7}
          onPress={() => handleItemPress(item)}
        >
          {/* Vertical Color Indicator */}
          <View style={[styles.cardLeftAccent, { backgroundColor: catTheme.color }]} />

          <View style={[styles.cardIcon, { backgroundColor: isDarkMode ? catTheme.bgColorDark : catTheme.bgColorLight }]}>
            <IconComponent size={18} color={catTheme.color} />
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <Text
                style={[
                  styles.cardTitle,
                  { color: t.textPrimary },
                  unread && styles.cardTitleUnread,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {unread && <View style={[styles.unreadBadge, { backgroundColor: catTheme.color }]} />}
            </View>
            <Text style={[styles.cardText, { color: t.textSecondary }]} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={[styles.cardTime, { color: t.textMuted }]}>{formatTime(item.created_at)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}
            onPress={() => handleClear(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={14} color={t.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Premium Header */}
      <View style={[styles.header, { borderColor: t.headerBorder }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtitle}>S-Pay Account</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Inbox</Text>
            {unreadCount > 0 && (
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={styles.unreadCounterBadge}
              >
                <Text style={styles.unreadCounterText}>{unreadCount} new</Text>
              </MotiView>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {isDarkMode ? <Sun size={15} color="#fbbf24" /> : <Moon size={15} color="#475569" />}
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: 'rgba(238, 77, 45, 0.1)', borderColor: 'rgba(238, 77, 45, 0.2)' }]}
              onPress={handleMarkAll}
              activeOpacity={0.7}
            >
              <CheckCheck size={15} color="#ee4d2d" />
            </TouchableOpacity>
          )}

          {visibleItems.some((i) => i.read_at) && (
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
              onPress={handleClearAllRead}
              activeOpacity={0.7}
            >
              <Trash2 size={15} color={t.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills Slider */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          const catTheme = CATEGORY_THEMES[tab.id];
          const unreadForCategory = counts[tab.id];

          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.8}
              style={[
                styles.tab,
                { backgroundColor: t.tabBarBg },
                selected && {
                  backgroundColor: catTheme.color,
                  shadowColor: catTheme.color,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                },
              ]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id);
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: t.textSecondary },
                  selected && styles.tabTextSelected,
                ]}
              >
                {tab.label}
              </Text>
              {unreadForCategory > 0 && (
                <View style={[styles.tabBadge, selected ? styles.tabBadgeSelected : { backgroundColor: catTheme.color }]}>
                  <Text style={[styles.tabBadgeText, selected && { color: catTheme.color }]}>
                    {unreadForCategory}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main List Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#ee4d2d" />
        </View>
      ) : (
        <View style={styles.listContainer}>
          <FlashList
            data={visibleItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#ee4d2d"
                colors={['#ee4d2d']}
              />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', duration: 400 }}
                style={styles.empty}
              >
                <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}>
                  <BellOff size={28} color={t.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>All caught up</Text>
                <Text style={[styles.emptyText, { color: t.textSecondary }]}>
                  No notifications found under {CATEGORY_THEMES[activeTab].label.toLowerCase()}.
                </Text>
              </MotiView>
            }
          />
        </View>
      )}

      {/* Detail Slide-Up Modal */}
      <Modal
        visible={selectedNotification !== null}
        transparent={true}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalContainer}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={35} style={StyleSheet.absoluteFill} tint="dark" />
          ) : (
            <View style={[styles.modalOverlay, { backgroundColor: t.modalOverlay }]} />
          )}

          <Pressable style={styles.modalDismissClickArea} onPress={() => setSelectedNotification(null)} />

          {selectedNotification && (
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: t.modalBg,
                  paddingBottom: Math.max(insets.bottom, 16) + 12,
                  maxHeight: height - insets.top - 40,
                },
              ]}
            >
              {/* Drag Handle Bar */}
              <View style={[styles.modalHandle, { backgroundColor: t.dragHandle }]} />

              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleCol}>
                  <View
                    style={[
                      styles.modalCategoryBadge,
                      {
                        backgroundColor: isDarkMode
                          ? CATEGORY_THEMES[selectedNotification.category].bgColorDark
                          : CATEGORY_THEMES[selectedNotification.category].bgColorLight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.modalDot,
                        { backgroundColor: CATEGORY_THEMES[selectedNotification.category].color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.modalCategoryText,
                        { color: CATEGORY_THEMES[selectedNotification.category].color },
                      ]}
                    >
                      {CATEGORY_THEMES[selectedNotification.category].label.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.modalFullDate, { color: t.textMuted }]}>
                    {formatFullDate(selectedNotification.created_at)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }]}
                  onPress={() => setSelectedNotification(null)}
                  activeOpacity={0.7}
                >
                  <X size={16} color={t.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>{selectedNotification.title}</Text>

              <Text style={[styles.modalBody, { color: t.textSecondary }]}>{selectedNotification.body}</Text>

              <View style={styles.modalFooterActions}>
                {selectedNotification.data && typeof selectedNotification.data.screen === 'string' && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={handleTakeAction}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#ee4d2d', '#ff6647']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalActionGradient}
                    >
                      <Text style={styles.modalActionBtnText}>View details</Text>
                      <ChevronRight size={16} color="#ffffff" style={styles.actionIcon} />
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.modalDeleteBtn,
                    {
                      borderColor: isDarkMode ? '#222d42' : '#e2e8f0',
                      width: selectedNotification.data?.screen ? '32%' : '100%',
                    },
                  ]}
                  onPress={() => handleClear(selectedNotification.id)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={styles.modalDeleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#ee4d2d',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.5,
  },
  unreadCounterBadge: {
    backgroundColor: 'rgba(238, 77, 45, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  unreadCounterText: {
    color: '#ee4d2d',
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  tabText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  tabTextSelected: {
    color: '#ffffff',
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeSelected: {
    backgroundColor: '#ffffff',
  },
  tabBadgeText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    color: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  cardContainer: {
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  cardLeftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
    paddingRight: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    flex: 1,
  },
  cardTitleUnread: {
    fontFamily: 'Jakarta-Bold',
  },
  unreadBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
    lineHeight: 16,
  },
  cardTime: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    marginTop: 6,
  },
  clearButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: height * 0.15,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalDismissClickArea: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitleCol: {
    flex: 1,
  },
  modalCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  modalDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  modalCategoryText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  modalFullDate: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 6,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    lineHeight: 26,
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalActionGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  modalActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  actionIcon: {
    marginTop: 1,
  },
  modalDeleteBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalDeleteBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
});
