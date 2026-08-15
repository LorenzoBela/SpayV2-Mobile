import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useContext, useEffect, useState } from 'react';
import { formatAmount } from '../../utils/money';
import { generatePaymentRef } from '../../utils/id';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarScroll } from '../../navigation/TabBarContext';
import { useNavigation } from '@react-navigation/native';
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  CreditCard,
  Settings,
  Bell,
  BellRing,
  User,
  Shield,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Users,
  Trophy,
  UserCheck,
  Banknote,
  Wallet,
  PiggyBank,
  Activity,
  Sparkles,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../../utils/authProfile';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import { useNotifications } from '../../hooks/useNotifications';
import AdminImpersonationModal from '../../components/AdminImpersonationModal';


export default function AdminMoreScreen() {
  const navigation = useNavigation<any>();
  const { userRole, setActiveRole } = useContext(RoleContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { unreadCount } = useNotifications();
  const layout = useResponsiveLayout();
  const scrollHandler = useTabBarScroll();

  const [adminName, setAdminName] = useState('Administrator');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhoto, setAdminPhoto] = useState<string | null>(null);
  const [isImpersonationModalOpen, setIsImpersonationModalOpen] = useState(false);

  useEffect(() => {
    getLinkedProfileForCurrentUser().then(({ user, profile }) => {
      if (user || profile) {
        setAdminName(profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin');
        setAdminEmail(profile?.email || user?.email || '');
        setAdminPhoto((profile as any)?.avatar_url || (profile as any)?.avatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null);
      }
    });
  }, []);

  const handleSignOut = async () => {
    PremiumAlert.alert('End Session', 'Are you sure you want to end your current session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const t = {
    bg: isDarkMode ? '#000000' : '#f8fafc',
    headerBg: isDarkMode ? '#000000' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    divider: isDarkMode ? '#1e293b' : '#f1f5f9',
    accent: '#ee4d2d',
    accentLight: 'rgba(238, 77, 45, 0.08)',
    iconBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
  };

  const overviewItems = [
    {
      name: 'Overview',
      icon: LayoutDashboard,
      desc: 'System metrics & stats',
      color: '#3b82f6',
      action: () => navigation.navigate('AdminDashboard'),
    },
    {
      name: 'NootAI Copilot',
      icon: Sparkles,
      desc: 'AI credit, limit & analyst',
      color: '#8b5cf6',
      action: () => navigation.navigate('NootAi'),
    },
    {
      name: 'Reports & Analytics',
      icon: TrendingUp,
      desc: 'Collection rates & stats',
      color: '#10b981',
      action: () => navigation.navigate('AdminReports'),
    },
    {
      name: 'Achievements',
      icon: Trophy,
      desc: 'System-wide milestones',
      color: '#f59e0b',
      action: () => navigation.navigate('AdminMilestones'),
    },
  ];

  const operationItems = [
    {
      name: 'Expenses Tracker',
      icon: Wallet,
      desc: 'SPay/Atome bills & tracking',
      color: '#ee4d2d',
      action: () => navigation.navigate('AdminExpenses'),
    },
    {
      name: 'Salary & Cashflow',
      icon: Banknote,
      desc: 'Payday timer & forecast',
      color: '#6366f1',
      action: () => navigation.navigate('AdminSalary'),
    },
    {
      name: 'Ipon / Savings',
      icon: PiggyBank,
      desc: '7 visual goal themes',
      color: '#059669',
      action: () => navigation.navigate('AdminIpon'),
    },
    {
      name: 'Clients Directory',
      icon: Users,
      desc: 'Manage users & limits',
      color: '#0284c7',
      action: () => navigation.navigate('AdminClients'),
    },
    {
      name: 'Orders & Limits',
      icon: Receipt,
      desc: 'Create & schedule plans',
      color: '#ea580c',
      action: () => navigation.navigate('AdminOrders'),
    },
    {
      name: 'Payments Ledger',
      icon: CreditCard,
      desc: 'Approve payments & proof',
      color: '#16a34a',
      action: () => navigation.navigate('AdminPayments'),
    },
    {
      name: 'Payment Reminders',
      icon: Bell,
      desc: 'Manual & bulk alerts',
      color: '#d97706',
      action: () => navigation.navigate('AdminReminders'),
    },
    {
      name: 'Notifications',
      icon: BellRing,
      desc: unreadCount > 0 ? `${unreadCount > 99 ? '99+' : unreadCount} unread alerts` : 'System alerts & inbox',
      badge: unreadCount,
      color: '#ef4444',
      action: () => navigation.navigate('AdminNotifications'),
    },
  ];

  const systemItems = [
    {
      name: 'System Health',
      icon: Activity,
      desc: 'Live latency & telemetry',
      color: '#06b6d4',
      action: () => navigation.navigate('AdminSystemHealth'),
    },
    {
      name: 'System Settings',
      icon: Settings,
      desc: 'Global limits & app config',
      color: '#64748b',
      action: () => navigation.navigate('AdminSettings'),
    },
    {
      name: 'Impersonate Client',
      icon: UserCheck,
      desc: 'View portal as client user',
      color: '#8b5cf6',
      action: () => setIsImpersonationModalOpen(true),
    },
  ];

  const gridColumns = layout.isTablet ? 3 : 2;
  const gridCardWidth = layout.getGridItemWidth(gridColumns, 12);

  const renderGridSection = (title: string, subtitle: string, items: typeof operationItems) => (
    <View style={styles.sectionWrapper}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionSubtitle, { color: '#ee4d2d' }]}>{subtitle}</Text>
        <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>{title}</Text>
      </View>
      <View style={styles.gridLayout}>
        {items.map((item, idx) => {
          const Icon = item.icon;
          const iconBg = item.color ? `${item.color}15` : t.accentLight;
          const iconColor = item.color || t.accent;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.gridCard, { width: gridCardWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
              onPress={item.action}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
                <Icon size={20} color={iconColor} />
              </View>
              {Number((item as any).badge || 0) > 0 && (
                <View style={styles.gridBadge}>
                  <Text style={styles.gridBadgeText}>{Number((item as any).badge || 0) > 99 ? '99+' : (item as any).badge}</Text>
                </View>
              )}
              <Text style={[styles.gridCardName, { color: t.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.gridCardDesc, { color: t.textSecondary }]} numberOfLines={1}>
                {item.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSubtitle}>S-Pay Admin</Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Control Submenu</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.themeToggleBtn,
            {
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              borderColor: t.headerBorder,
            },
          ]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          {isDarkMode ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#475569" />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          {adminPhoto ? (
            <Image source={{ uri: adminPhoto }} style={styles.avatarCircle} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: t.accent }]}>
              <Text style={styles.avatarText}>{adminName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.profileDetails}>
            <Text style={[styles.profileGreeting, { color: t.textSecondary }]}>Console Operator,</Text>
            <Text style={[styles.profileName, { color: t.textPrimary }]} numberOfLines={1}>
              {adminName}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Text style={[styles.roleBadgeText, { color: '#3b82f6' }]}>
                  {userRole || 'ADMIN'}
                </Text>
              </View>
              {adminEmail ? (
                <Text style={[styles.profileEmail, { color: t.textMuted }]} numberOfLines={1}>
                  {adminEmail}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* 1. OPERATIONS (Web 1:1 Parity) */}
        {renderGridSection('Operations', 'FINANCIAL & LEDGER MODULES', operationItems)}

        {/* 2. OVERVIEW */}
        {renderGridSection('Overview', 'INSIGHTS & ANALYTICS', overviewItems)}

        {/* 3. SYSTEM */}
        {renderGridSection('System & Security', 'OBSERVABILITY & CONFIG', systemItems)}

        {/* Workspace Actions */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionSubtitle, { color: t.textSecondary }]}>WORKSPACE ACTIONS</Text>
          <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Security & Session</Text>
        </View>

        <View style={[styles.listContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }, styles.marginBottom]}>
          {/* Switch Workspace */}
          <TouchableOpacity
            style={styles.listItemRow}
            onPress={() => setActiveRole(null)}
            activeOpacity={0.7}
          >
            <View style={[styles.listIconWrapper, { backgroundColor: t.iconBg }]}>
              <Shield size={18} color={t.textSecondary} />
            </View>
            <View style={styles.listItemTextContainer}>
              <Text style={[styles.listItemName, { color: t.textPrimary }]}>Switch Workspace</Text>
              <Text style={[styles.listItemDesc, { color: t.textSecondary }]}>Change active system dashboard view</Text>
            </View>
            <ChevronRight size={16} color={t.textSecondary} />
          </TouchableOpacity>

          {/* Sign Out */}
          <View style={[styles.rowDivider, { backgroundColor: t.divider }]} />
          <TouchableOpacity style={styles.listItemRow} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={[styles.listIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
              <LogOut size={18} color="#ef4444" />
            </View>
            <View style={styles.listItemTextContainer}>
              <Text style={[styles.listItemName, { color: '#ef4444' }]}>Sign Out Control Panel</Text>
              <Text style={[styles.listItemDesc, { color: t.textSecondary }]}>Safely sign out of your current session</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <AdminImpersonationModal
        visible={isImpersonationModalOpen}
        onClose={() => setIsImpersonationModalOpen(false)}
      />
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
  headerLeft: {
    flex: 1,
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
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileDetails: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  profileGreeting: {
    fontSize: 12,
  },
  profileName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  profileEmail: {
    fontSize: 11,
    flex: 1,
  },
  sectionWrapper: {
    marginBottom: 8,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionSubtitle: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 1,
  },
  gridLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 20,
  },
  gridCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    justifyContent: 'space-between',
    height: 120,
    position: 'relative',
  },
  gridBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#ee4d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridCardName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  gridCardDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  listContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 24,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  listIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  listItemName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  listItemDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
  },
  marginBottom: {
    marginBottom: 32,
  },
});
