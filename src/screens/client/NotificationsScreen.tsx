import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const TABS: Array<{ id: NotificationCategory; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'PAYMENT_UPDATES', label: 'Payments', icon: 'receipt-outline' },
  { id: 'ALERTS', label: 'Alerts', icon: 'shield-checkmark-outline' },
  { id: 'ADS', label: 'Ads', icon: 'megaphone-outline' },
  { id: 'SYSTEM', label: 'System', icon: 'notifications-outline' },
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
  const [items, setItems] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<NotificationCategory>('PAYMENT_UPDATES');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    const tab = TABS.find((entry) => entry.id === item.category) || TABS[3];
    const unread = !item.read_at;

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        activeOpacity={0.8}
        onPress={() => handleMarkRead(item)}
      >
        <View style={styles.cardIcon}>
          <Ionicons name={tab.icon} size={20} color="#ee4d2d" />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.cardText}>{item.body}</Text>
          <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
        </View>
        <TouchableOpacity style={styles.clearButton} onPress={() => handleClear(item.id)}>
          <Ionicons name="trash-outline" size={17} color="#94a3b8" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>S-Pay Messaging</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unreadCount} unread updates</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.readAllButton} onPress={handleMarkAll}>
            <Ionicons name="checkmark-done-outline" size={18} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, selected && styles.tabSelected]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons name={tab.icon} size={15} color={selected ? '#ffffff' : '#94a3b8'} />
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
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
              <Ionicons name="notifications-off-outline" size={36} color="#475569" />
              <Text style={styles.emptyTitle}>No notifications here</Text>
              <Text style={styles.emptyText}>New S-Pay updates will appear in this inbox and in your Android tray.</Text>
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
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  eyebrow: {
    color: '#ee4d2d',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
    borderColor: '#334155',
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
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
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
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: 'rgba(238,77,45,0.7)',
    backgroundColor: '#231f25',
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
    color: '#f8fafc',
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
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  cardTime: {
    color: '#64748b',
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
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
});
