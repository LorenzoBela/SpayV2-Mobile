import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  type LucideIcon,
} from 'lucide-react-native';
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

const TAB_ICONS: Record<NotificationCategory, LucideIcon> = {
  PAYMENT_UPDATES: Receipt,
  ALERTS: ShieldCheck,
  ADS: Megaphone,
  SYSTEM: Bell,
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

export default function NotificationsScreen() {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<NotificationCategory>('PAYMENT_UPDATES');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic theme colors
  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    cardUnreadBg: isDarkMode ? '#231f25' : '#fff7ed',
    tabBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    iconBtnBg: isDarkMode ? 'rgba(148,163,184,0.06)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(148,163,184,0.1)' : '#e2e8f0',
  };

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

  const counts = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc[item.category] += 1;
          return acc;
        },
        { PAYMENT_UPDATES: 0, ALERTS: 0, ADS: 0, SYSTEM: 0 } as Record<NotificationCategory, number>
      ),
    [items]
  );

  const unreadCount = items.filter((item) => !item.read_at).length;
  const visibleItems = items.filter((item) => item.category === activeTab);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleMarkRead = async (item: AppNotification) => {
    if (item.read_at) return;
    try {
      await markNotificationRead(item.id);
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row))
      );
    } catch (error) {
      console.warn('[NotificationsScreen] mark read failed:', error);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setItems((current) => current.map((row) => ({ ...row, read_at: row.read_at || readAt })));
    } catch (error) {
      console.warn('[NotificationsScreen] mark all failed:', error);
    }
  };

  const handleClear = async (id: string) => {
    try {
      await clearNotification(id);
      setItems((current) => current.filter((row) => row.id !== id));
    } catch (error) {
      console.warn('[NotificationsScreen] clear failed:', error);
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const unread = !item.read_at;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: t.cardBg, borderColor: t.cardBorder },
          unread && { borderColor: 'rgba(238,77,45,0.7)', backgroundColor: t.cardUnreadBg },
        ]}
        activeOpacity={0.8}
        onPress={() => handleMarkRead(item)}
      >
        <View style={styles.cardIcon}>
          {React.createElement(TAB_ICONS[item.category] ?? Bell, { size: 20, color: '#ee4d2d' })}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: t.textPrimary }]} numberOfLines={1}>{item.title}</Text>
            {unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.cardText, { color: t.textSecondary }]}>{item.body}</Text>
          <Text style={[styles.cardTime, { color: t.textMuted }]}>{formatTime(item.created_at)}</Text>
        </View>
        <TouchableOpacity style={styles.clearButton} onPress={() => handleClear(item.id)}>
          <Trash2 size={17} color={t.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Premium Header Bar */}
      <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
        <View style={styles.webHeaderLeft}>
          <Text style={styles.webHeaderSubtitle}>S-Pay Messaging</Text>
          <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Notifications</Text>
          <Text style={[styles.webHeaderDesc, { color: t.textSecondary }]}>
            Stay updated on auto-payment reminders, ledger approvals, and system notifications.
          </Text>
        </View>
        <View style={styles.webHeaderRight}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            onPress={toggleTheme}
          >
            {isDarkMode ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#475569" />}
          </TouchableOpacity>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.readAllButton} onPress={handleMarkAll}>
              <CheckCheck size={18} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, { borderColor: t.tabBorder }, selected && styles.tabSelected]}
              onPress={() => setActiveTab(tab.id)}
            >
              {React.createElement(TAB_ICONS[tab.id], { size: 15, color: selected ? '#ffffff' : t.textSecondary })}
              <Text style={[styles.tabText, { color: t.textSecondary }, selected && styles.tabTextSelected]}>
                {tab.label} {counts[tab.id] > 0 ? counts[tab.id] : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
          contentContainerStyle={[styles.listContent, visibleItems.length === 0 && styles.emptyList]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <BellOff size={36} color={t.textMuted} />
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No notifications here</Text>
              <Text style={[styles.emptyText, { color: t.textMuted }]}>New S-Pay updates will appear in this inbox and in your Android tray.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  webHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webHeaderSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  webHeaderTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  webHeaderDesc: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
    lineHeight: 15,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readAllButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#ee4d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  tabSelected: {
    backgroundColor: '#ee4d2d',
    borderColor: '#ee4d2d',
  },
  tabText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  tabTextSelected: {
    color: '#ffffff',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(238,77,45,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ee4d2d',
  },
  cardText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
});
