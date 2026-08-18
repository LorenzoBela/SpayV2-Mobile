import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useContext, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  ShoppingBag,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../../utils/authProfile';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';
import { useNotifications } from '../../hooks/useNotifications';
import AdminImpersonationModal from '../../components/AdminImpersonationModal';

interface MenuItem {
  name: string;
  icon: any;
  desc: string;
  action: () => void;
  badge?: number;
  isDestructive?: boolean;
}

export default function AdminMoreScreen() {
  const navigation = useNavigation<any>();
  const { userRole, setActiveRole } = useContext(RoleContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { unreadCount } = useNotifications();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
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
    cardBg: isDarkMode ? '#121826' : '#ffffff',
    cardBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    accent: '#ee4d2d',
    accentLight: isDarkMode ? 'rgba(238, 77, 45, 0.14)' : 'rgba(238, 77, 45, 0.08)',
  };

  // Section 1: Financial & Cash Operations
  const financeItems: MenuItem[] = [
    {
      name: 'Buy Requests',
      icon: ShoppingBag,
      desc: 'Shopee queue, quote & order conversion',
      action: () => navigation.navigate('AdminRequests'),
    },
    {
      name: 'Expenses Tracker',
      icon: Wallet,
      desc: 'SPay/Atome bills, liquid balances & tracking',
      action: () => navigation.navigate('AdminExpenses'),
    },
    {
      name: 'Salary & Cashflow',
      icon: Banknote,
      desc: 'Payday countdown timer, income & trajectory',
      action: () => navigation.navigate('AdminSalary'),
    },
    {
      name: 'Ipon / Savings',
      icon: PiggyBank,
      desc: 'Visual savings goals & target tracking',
      action: () => navigation.navigate('AdminIpon'),
    },
    {
      name: 'Payments Ledger',
      icon: CreditCard,
      desc: 'Proof review, mark paid & settlements',
      action: () => navigation.navigate('AdminPayments'),
    },
    {
      name: 'Orders & Limits',
      icon: Receipt,
      desc: 'Create, schedule & edit installment plans',
      action: () => navigation.navigate('AdminOrders'),
    },
  ];

  // Section 2: Intelligence & Insights
  const intelligenceItems: MenuItem[] = [
    {
      name: 'Overview Dashboard',
      icon: LayoutDashboard,
      desc: 'Real-time metrics, collection rate & KPIs',
      action: () => navigation.navigate('AdminDashboard'),
    },
    {
      name: 'NootAI Copilot',
      icon: Sparkles,
      desc: 'Financial AI assistant & portfolio insights',
      action: () => navigation.navigate('NootAi'),
    },
    {
      name: 'Reports & Analytics',
      icon: TrendingUp,
      desc: 'Collection rates, summaries & data export',
      action: () => navigation.navigate('AdminReports'),
    },
    {
      name: 'System Achievements',
      icon: Trophy,
      desc: 'Milestones & portfolio progress achievements',
      action: () => navigation.navigate('AdminMilestones'),
    },
  ];

  // Section 3: Operations & Management
  const operationItems: MenuItem[] = [
    {
      name: 'Clients Directory',
      icon: Users,
      desc: 'Manage client accounts & credit limits',
      action: () => navigation.navigate('AdminClients'),
    },
    {
      name: 'Payment Reminders',
      icon: Bell,
      desc: 'Automated & manual SMS/Push alerts',
      action: () => navigation.navigate('AdminReminders'),
    },
    {
      name: 'Notifications Inbox',
      icon: BellRing,
      desc: unreadCount > 0 ? `${unreadCount > 99 ? '99+' : unreadCount} unread system notices` : 'System notices & event logs',
      badge: unreadCount,
      action: () => navigation.navigate('AdminNotifications'),
    },
  ];

  // Section 4: System & Configuration
  const systemItems: MenuItem[] = [
    {
      name: 'System Health & Telemetry',
      icon: Activity,
      desc: 'Live latency, database status & diagnostics',
      action: () => navigation.navigate('AdminSystemHealth'),
    },
    {
      name: 'App Updates & Changelog',
      icon: Sparkles,
      desc: 'Release timeline, what\'s new & build history',
      action: () => navigation.navigate('Changelog'),
    },
    {
      name: 'System Settings',
      icon: Settings,
      desc: 'Global credit limits & system configuration',
      action: () => navigation.navigate('AdminSettings'),
    },
    {
      name: 'Impersonate Client',
      icon: UserCheck,
      desc: 'Preview application portal from client view',
      action: () => setIsImpersonationModalOpen(true),
    },
  ];

  const renderGroupedSection = (title: string, subtitle: string, items: MenuItem[]) => (
    <View style={styles.sectionWrapper}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionSubtitle, { color: t.accent }]}>{subtitle}</Text>
        <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>{title}</Text>
      </View>
      <View style={[styles.groupedCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={item.name}>
              <TouchableOpacity
                style={styles.groupedRow}
                onPress={item.action}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.desc}`}
              >
                <View style={[styles.iconWrapper, { backgroundColor: t.accentLight }]}>
                  <Icon size={18} color={t.accent} />
                </View>
                <View style={styles.rowTextCol}>
                  <Text style={[styles.rowTitle, { color: t.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.rowDesc, { color: t.textSecondary }]} numberOfLines={1}>
                    {item.desc}
                  </Text>
                </View>
                {Number(item.badge || 0) > 0 && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>
                      {Number(item.badge || 0) > 99 ? '99+' : item.badge}
                    </Text>
                  </View>
                )}
                <ChevronRight size={16} color={t.textMuted} style={styles.chevron} />
              </TouchableOpacity>
              {!isLast && <View style={[styles.rowDivider, { backgroundColor: t.divider }]} />}
            </React.Fragment>
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
          <Text style={styles.headerSubtitle}>S-PAY ADMIN</Text>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Control Hub</Text>
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
          accessibilityRole="button"
          accessibilityLabel={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#475569" />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          layout.scrollContentStyle,
          { paddingBottom: insets.bottom + 110 },
        ]}
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
            <Text style={[styles.profileGreeting, { color: t.textSecondary }]}>Logged In Administrator</Text>
            <Text style={[styles.profileName, { color: t.textPrimary }]} numberOfLines={1}>
              {adminName}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: t.accentLight }]}>
                <Text style={[styles.roleBadgeText, { color: t.accent }]}>
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

        {/* 1. FINANCIAL & CASH OPERATIONS */}
        {renderGroupedSection('Finance & Cash Operations', 'CORE LEDGER & BALANCES', financeItems)}

        {/* 2. INTELLIGENCE & INSIGHTS */}
        {renderGroupedSection('Intelligence & Analytics', 'INSIGHTS & PORTFOLIO METRICS', intelligenceItems)}

        {/* 3. OPERATIONS & DIRECTORY */}
        {renderGroupedSection('Operations & Directory', 'MANAGEMENT & COMMS', operationItems)}

        {/* 4. SYSTEM & SECURITY */}
        {renderGroupedSection('System & Observability', 'CONFIG & TELEMETRY', systemItems)}

        {/* 5. SESSION & WORKSPACE */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionSubtitle, { color: t.accent }]}>SESSION MANAGEMENT</Text>
            <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Workspace & Security</Text>
          </View>
          <View style={[styles.groupedCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            {/* Switch Workspace */}
            <TouchableOpacity
              style={styles.groupedRow}
              onPress={() => setActiveRole(null)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Switch Workspace, Change active role or dashboard perspective"
            >
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}>
                <Shield size={18} color={t.textPrimary} />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: t.textPrimary }]}>Switch Workspace</Text>
                <Text style={[styles.rowDesc, { color: t.textSecondary }]}>Change active role / dashboard perspective</Text>
              </View>
              <ChevronRight size={16} color={t.textMuted} style={styles.chevron} />
            </TouchableOpacity>

            <View style={[styles.rowDivider, { backgroundColor: t.divider }]} />

            {/* Sign Out */}
            <TouchableOpacity
              style={styles.groupedRow}
              onPress={handleSignOut}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Sign Out Control Panel, Safely end your current session"
            >
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <LogOut size={18} color="#ef4444" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: '#ef4444' }]}>Sign Out Control Panel</Text>
                <Text style={[styles.rowDesc, { color: t.textSecondary }]}>Safely end your current session</Text>
              </View>
              <ChevronRight size={16} color="#ef4444" style={styles.chevron} />
            </TouchableOpacity>
          </View>
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
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerSubtitle: {
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
    paddingTop: 14,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    marginLeft: 14,
    marginRight: 8,
  },
  profileGreeting: {
    fontSize: 11,
    fontWeight: '500',
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 1,
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
    letterSpacing: 0.5,
  },
  profileEmail: {
    fontSize: 11,
    flex: 1,
  },
  sectionWrapper: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionSubtitle: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 1,
  },
  groupedCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTextCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  badgePill: {
    backgroundColor: '#ee4d2d',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  badgePillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chevron: {
    marginLeft: 4,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
});
