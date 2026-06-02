import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Sun,
  Moon,
  Shield,
  User,
  Mail,
  Smartphone,
  Save,
  CheckCircle,
  Sliders,
  LogOut,
  LayoutDashboard,
} from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { SettingsSkeleton } from '../../components/SkeletonLoader';
import { useResponsiveLayout } from '../../utils/responsive';
import { callAdminApi } from '../../services/adminService';

export default function AdminSettingsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { userRole, setActiveRole } = useContext(RoleContext);
  const systemColorScheme = useColorScheme();
  const layout = useResponsiveLayout();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile');

  // Form states
  const [profile, setProfile] = useState({
    name: 'Administrator',
    email: '',
    mobileNumber: '',
    avatarUrl: null as string | null,
    role: 'ADMIN',
  });
  const [displayName, setDisplayName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // Settings states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [dbTheme, setDbTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, email, mobile_number, role')
        .eq('id', user.id)
        .single();

      let loadedProfile = {
        name: user.user_metadata?.full_name || 'Administrator',
        email: user.email || '',
        mobileNumber: user.user_metadata?.phone_number || '',
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        role: 'ADMIN',
      };

      if (profileData) {
        loadedProfile = {
          name: profileData.name || loadedProfile.name,
          email: profileData.email || loadedProfile.email,
          mobileNumber: profileData.mobile_number || loadedProfile.mobileNumber,
          avatarUrl: loadedProfile.avatarUrl,
          role: profileData.role || 'ADMIN',
        };
      }

      setProfile(loadedProfile);
      setDisplayName(loadedProfile.name);
      setMobileNumber(loadedProfile.mobileNumber);

      // 2. Fetch User Settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('setting_name, setting_value')
        .eq('user_id', user.id);

      if (settingsData && settingsData.length > 0) {
        const settingsMap: Record<string, string> = {};
        settingsData.forEach(item => {
          settingsMap[item.setting_name] = item.setting_value;
        });

        setEmailNotifications(settingsMap['email_notifications'] !== 'false');
        setSystemAlerts(settingsMap['system_alerts'] !== 'false');

        const themePref = (settingsMap['theme'] as 'light' | 'dark' | 'auto') || undefined;
        if (themePref) {
          setDbTheme(themePref);
        } else {
          setDbTheme(isDarkMode ? 'dark' : 'light');
        }
      } else {
        setDbTheme(isDarkMode ? 'dark' : 'light');
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Validation Error', 'Display Name is required.');
      return;
    }

    setSaving(true);
    try {
      const response = await callAdminApi('update-profile', {
        name: displayName.trim(),
        mobileNumber: mobileNumber.trim() || null,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update profile details.');
      }

      setProfile(prev => ({
        ...prev,
        name: displayName.trim(),
        mobileNumber: mobileNumber.trim(),
      }));

      Alert.alert('Success', 'Admin profile details updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSetting = async (key: 'emailNotifications' | 'systemAlerts', dbKey: string, currentValue: boolean) => {
    const nextVal = !currentValue;
    if (key === 'emailNotifications') {
      setEmailNotifications(nextVal);
    } else {
      setSystemAlerts(nextVal);
    }

    try {
      const response = await callAdminApi('update-setting', {
        settingName: dbKey,
        settingValue: nextVal ? 'true' : 'false',
      });

      if (!response.success) {
        throw new Error(response.error);
      }
    } catch (e) {
      // Revert state if failed
      if (key === 'emailNotifications') {
        setEmailNotifications(currentValue);
      } else {
        setSystemAlerts(currentValue);
      }
      Alert.alert('Error', 'Failed to update settings preference.');
    }
  };

  const handleThemeChange = async (nextTheme: 'light' | 'dark' | 'auto') => {
    setDbTheme(nextTheme);

    try {
      await callAdminApi('update-setting', {
        settingName: 'theme',
        settingValue: nextTheme,
      });

      if (nextTheme === 'dark') {
        if (!isDarkMode) toggleTheme();
      } else if (nextTheme === 'light') {
        if (isDarkMode) toggleTheme();
      } else if (nextTheme === 'auto') {
        const isSystemDark = systemColorScheme === 'dark';
        if (isSystemDark !== isDarkMode) {
          toggleTheme();
        }
      }
    } catch (e) {
      console.warn('Failed to sync theme settings:', e);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Confirm Sign Out', 'Are you sure you want to end your current session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          await supabase.auth.signOut();
        },
      },
    ]);
  };

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
    switchTrackFalse: isDarkMode ? '#334155' : '#cbd5e1',
    switchThumbFalse: isDarkMode ? '#64748b' : '#94a3b8',
    inputBg: isDarkMode ? '#0f172a' : '#f8fafc',
    inputBorder: isDarkMode ? '#222d42' : '#cbd5e1',
    tabBgActive: isDarkMode ? 'rgba(238, 77, 45, 0.15)' : 'rgba(238, 77, 45, 0.08)',
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />
        <View style={[styles.headerBar, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
          <View style={styles.headerLeftContainer}>
            <Text style={styles.headerSubtitle}>S-Pay Admin</Text>
            <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Settings</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SettingsSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const renderProfileTab = () => (
    <View style={[styles.tabContentCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
      <View style={styles.tabHeaderRow}>
        <User size={18} color={t.accent} />
        <Text style={[styles.tabHeaderTitle, { color: t.textPrimary }]}>Profile Details</Text>
      </View>

      {/* Avatar Preview */}
      <View style={styles.avatarEditContainer}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatarEditPreview} />
        ) : (
          <View style={[styles.avatarEditPreview, { backgroundColor: '#0f172a' }]}>
            <Text style={styles.avatarLargeText}>{profile.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.avatarEditLabels}>
          <Text style={[styles.avatarLabelTitle, { color: t.textPrimary }]}>Admin Profile Image</Text>
          <Text style={[styles.avatarLabelSub, { color: t.textSecondary }]}>Linked directly from your Google SSO account.</Text>
        </View>
      </View>

      {/* Display Name */}
      <View style={styles.formGroup}>
        <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Display Name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display Name"
          placeholderTextColor={t.textMuted}
          style={[styles.textInput, { color: t.textPrimary, backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
        />
      </View>

      {/* Mobile Number */}
      <View style={styles.formGroup}>
        <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Mobile Number</Text>
        <View style={styles.phoneInputContainer}>
          <TextInput
            value={mobileNumber}
            onChangeText={setMobileNumber}
            placeholder="e.g. 09123456789"
            placeholderTextColor={t.textMuted}
            keyboardType="phone-pad"
            style={[styles.textInput, styles.phoneInput, { color: t.textPrimary, backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
          />
          <Smartphone size={16} color={t.textSecondary} style={styles.phoneInputIcon} />
        </View>
      </View>

      {/* Registered Email (read-only) */}
      <View style={styles.formGroup}>
        <Text style={[styles.inputLabel, { color: t.textSecondary }]}>Registered Email</Text>
        <TextInput
          value={profile.email}
          editable={false}
          style={[
            styles.textInput,
            {
              color: t.textMuted,
              backgroundColor: isDarkMode ? 'rgba(30,41,59,0.5)' : '#e2e8f0',
              borderColor: t.inputBorder,
            },
          ]}
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity
        onPress={handleSaveProfile}
        disabled={saving}
        style={[styles.saveBtn, { backgroundColor: t.accent }]}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Save size={14} color="#ffffff" />
            <Text style={styles.saveBtnText}>Save Profile Details</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={[styles.formDivider, { backgroundColor: t.divider }]} />

      {/* Theme Settings */}
      <View style={styles.themeSection}>
        <View style={styles.themeHeader}>
          <Sun size={18} color={t.accent} />
          <Text style={[styles.themeTitle, { color: t.textPrimary }]}>Display Theme</Text>
        </View>
        <Text style={[styles.themeDesc, { color: t.textSecondary }]}>
          Choose a default visual layout for your admin panel.
        </Text>
        <View style={styles.themeButtonGroup}>
          {([
            { value: 'light' as const, label: 'Light', icon: Sun },
            { value: 'dark' as const, label: 'Dark', icon: Moon },
            { value: 'auto' as const, label: 'System', icon: Sliders },
          ]).map(item => {
            const Icon = item.icon;
            const isSelected = dbTheme === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => handleThemeChange(item.value)}
                style={[
                  styles.themeOptionBtn,
                  isSelected
                    ? { borderColor: t.accent, backgroundColor: t.tabBgActive }
                    : { borderColor: t.inputBorder, backgroundColor: t.inputBg },
                ]}
                activeOpacity={0.8}
              >
                <Icon size={14} color={isSelected ? t.accent : t.textSecondary} />
                <Text style={[styles.themeOptionLabel, { color: isSelected ? t.accent : t.textSecondary }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );

  const renderNotificationsTab = () => (
    <View style={[styles.tabContentCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
      <View style={styles.tabHeaderRow}>
        <Sliders size={18} color={t.accent} />
        <Text style={[styles.tabHeaderTitle, { color: t.textPrimary }]}>Notification Defaults</Text>
      </View>

      {/* Email Notifications */}
      <View style={styles.toggleRowContainer}>
        <View style={styles.toggleRowLeft}>
          <View style={[styles.toggleIconBox, { backgroundColor: isDarkMode ? 'rgba(238,77,45,0.1)' : 'rgba(238,77,45,0.05)' }]}>
            <Mail size={16} color={t.accent} />
          </View>
          <View style={styles.toggleTextCol}>
            <Text style={[styles.toggleTitleText, { color: t.textPrimary }]}>Email Notifications</Text>
            <Text style={[styles.toggleDescText, { color: t.textSecondary }]}>
              Receive admin reminders, queue item warnings, and sync updates.
            </Text>
          </View>
        </View>
        <Switch
          value={emailNotifications}
          onValueChange={() => handleToggleSetting('emailNotifications', 'email_notifications', emailNotifications)}
          trackColor={{ false: t.switchTrackFalse, true: '#3b82f6' }}
          thumbColor={emailNotifications ? '#ffffff' : t.switchThumbFalse}
        />
      </View>

      <View style={[styles.formDivider, { backgroundColor: t.divider }]} />

      {/* System Alerts */}
      <View style={styles.toggleRowContainer}>
        <View style={styles.toggleRowLeft}>
          <View style={[styles.toggleIconBox, { backgroundColor: isDarkMode ? 'rgba(238,77,45,0.1)' : 'rgba(238,77,45,0.05)' }]}>
            <Shield size={16} color={t.accent} />
          </View>
          <View style={styles.toggleTextCol}>
            <Text style={[styles.toggleTitleText, { color: t.textPrimary }]}>System Alerts</Text>
            <Text style={[styles.toggleDescText, { color: t.textSecondary }]}>
              Show operational warnings for overdue ledgers, rescheduling approvals, and system logs.
            </Text>
          </View>
        </View>
        <Switch
          value={systemAlerts}
          onValueChange={() => handleToggleSetting('systemAlerts', 'system_alerts', systemAlerts)}
          trackColor={{ false: t.switchTrackFalse, true: '#3b82f6' }}
          thumbColor={systemAlerts ? '#ffffff' : t.switchThumbFalse}
        />
      </View>
    </View>
  );

  const renderSecurityTab = () => (
    <View style={[styles.tabContentCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
      <View style={styles.tabHeaderRow}>
        <Shield size={18} color={t.accent} />
        <Text style={[styles.tabHeaderTitle, { color: t.textPrimary }]}>Security & Sessions</Text>
      </View>

      <View style={styles.securityTextContainer}>
        <Text style={[styles.securityIntroText, { color: t.textSecondary }]}>
          Your administrator account is linked and secured via Google OAuth Single Sign-On (SSO). There is no active password associated with this profile.
        </Text>

        <View
          style={[
            styles.noticeBox,
            {
              backgroundColor: isDarkMode ? 'rgba(249,115,22,0.1)' : '#fff7ed',
              borderColor: isDarkMode ? 'rgba(249,115,22,0.2)' : '#ffedd5',
            },
          ]}
        >
          <Text style={[styles.noticeText, { color: isDarkMode ? '#fdba74' : '#c2410c' }]}>
            To configure multi-factor authentication, password requirements, or manage connected apps, use your Google Account security settings.
          </Text>
        </View>

        <View style={[styles.formDivider, { backgroundColor: t.divider }]} />

        {/* Switch Workspace */}
        {userRole === 'ADMIN' && (
          <TouchableOpacity
            onPress={() => setActiveRole(null)}
            style={[styles.switchWorkspaceBtn, { borderColor: t.accent }]}
            activeOpacity={0.8}
          >
            <LayoutDashboard size={16} color={t.accent} />
            <Text style={[styles.switchWorkspaceBtnText, { color: t.accent }]}>Switch Workspace</Text>
          </TouchableOpacity>
        )}

        {/* Log Out */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={[styles.logoutBtn, { borderColor: '#f87171' }]}
          activeOpacity={0.8}
        >
          <LogOut size={16} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Log Out Console Panel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
            <Text style={styles.headerSubtitle}>S-Pay Admin</Text>
            <Text style={[styles.headerTitle, { color: t.textPrimary }]}>System Settings</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {/* Sub Nav Tab Bar */}
          <View style={[styles.tabBar, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            {([
              { id: 'profile' as const, label: 'Profile' },
              { id: 'notifications' as const, label: 'Alerts' },
              { id: 'security' as const, label: 'Security' },
            ]).map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.tabItem,
                    isActive && { backgroundColor: t.tabBgActive },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      { color: isActive ? t.accent : t.textSecondary },
                      isActive && styles.tabItemTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Active Tab Panel */}
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'security' && renderSecurityTab()}
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabItemTextActive: {
    fontWeight: 'bold',
  },
  tabContentCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 24,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  avatarEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatarEditPreview: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLargeText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  avatarEditLabels: {
    flex: 1,
    marginLeft: 16,
  },
  avatarLabelTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  avatarLabelSub: {
    fontSize: 11,
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  phoneInputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  phoneInput: {
    paddingLeft: 38,
  },
  phoneInputIcon: {
    position: 'absolute',
    left: 12,
  },
  saveBtn: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  formDivider: {
    height: 1.5,
    marginVertical: 20,
  },
  themeSection: {
    marginTop: 4,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  themeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  themeDesc: {
    fontSize: 11,
    marginBottom: 12,
  },
  themeButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOptionBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  themeOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  toggleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  toggleTitleText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  toggleDescText: {
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  securityTextContainer: {
    marginTop: 4,
  },
  securityIntroText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  noticeBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 11,
    lineHeight: 16,
  },
  switchWorkspaceBtn: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  switchWorkspaceBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  logoutBtn: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
