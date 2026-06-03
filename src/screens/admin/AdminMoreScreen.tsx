import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useContext, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  CreditCard,
  Settings,
  Bell,
  User,
  Shield,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Users,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { useResponsiveLayout } from '../../utils/responsive';


export default function AdminMoreScreen() {
  const navigation = useNavigation<any>();
  const { userRole, setActiveRole } = useContext(RoleContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const layout = useResponsiveLayout();

  const [adminName, setAdminName] = useState('Administrator');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhoto, setAdminPhoto] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAdminName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin');
        setAdminEmail(user.email || '');
        setAdminPhoto(user.user_metadata?.avatar_url || user.user_metadata?.picture || null);
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
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
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

  const gridItems = [
    {
      name: 'Overview',
      icon: LayoutDashboard,
      desc: 'System metrics & stats',
      action: () => navigation.navigate('AdminDashboard'),
    },
    {
      name: 'Reports & Analytics',
      icon: TrendingUp,
      desc: 'Collection rates & category data',
      action: () => navigation.navigate('AdminReports'),
    },
    {
      name: 'Clients Directory',
      icon: Users,
      desc: 'Manage users & limits',
      action: () => navigation.navigate('AdminClients'),
    },
    {
      name: 'Installments Ledger',
      icon: CreditCard,
      desc: 'Approve payments & proof',
      action: () => navigation.navigate('AdminPayments'),
    },
    {
      name: 'Payment Reminders',
      icon: Bell,
      desc: 'Manual & bulk notifications',
      action: () => navigation.navigate('AdminReminders'),
    },
    {
      name: 'Client Orders',
      icon: Receipt,
      desc: 'Create & schedule plans',
      action: () => navigation.navigate('AdminOrders'),
    },
  ];

  const systemItems = [
    {
      name: 'System Settings',
      icon: Settings,
      desc: 'Global credit limits & notifications config',
      action: () => navigation.navigate('AdminSettings'),
    },
    {
      name: 'System Logs',
      icon: Shield,
      desc: 'Database audit events & alerts history',
      action: () => navigation.navigate('AdminNotifications'),
    },
  ];

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

      <ScrollView contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]} showsVerticalScrollIndicator={false}>
        
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

        {/* Explore Features Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionSubtitle, { color: t.textSecondary }]}>Services</Text>
          <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>Administrative Actions</Text>
        </View>

        {/* Grid Layout */}
        <View style={styles.gridLayout}>
          {gridItems.map((item, idx) => {
            const Icon = item.icon;
            const gridColumns = layout.isTablet ? 3 : 2;
            const gridCardWidth = layout.getGridItemWidth(gridColumns, 12);
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.gridCard, { width: gridCardWidth, backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
                onPress={item.action}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrapper, { backgroundColor: t.accentLight }]}>
                  <Icon size={20} color={t.accent} />
                </View>
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

        {/* App Preferences */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionSubtitle, { color: t.textSecondary }]}>Configuration</Text>
          <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>System & Preferences</Text>
        </View>

        <View style={[styles.listContainer, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          {systemItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <View key={idx}>
                {idx > 0 && <View style={[styles.rowDivider, { backgroundColor: t.divider }]} />}
                <TouchableOpacity style={styles.listItemRow} onPress={item.action} activeOpacity={0.7}>
                  <View style={[styles.listIconWrapper, { backgroundColor: t.iconBg }]}>
                    <Icon size={18} color={t.textSecondary} />
                  </View>
                  <View style={styles.listItemTextContainer}>
                    <Text style={[styles.listItemName, { color: t.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.listItemDesc, { color: t.textSecondary }]} numberOfLines={1}>
                      {item.desc}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={t.textSecondary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Account Security & Session */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionSubtitle, { color: t.textSecondary }]}>Workspace Actions</Text>
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
    marginBottom: 24,
  },
  gridCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    justifyContent: 'space-between',
    height: 120,
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
