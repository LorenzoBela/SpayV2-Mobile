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
  Modal,
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
  Languages,
  Save,
  CheckCircle,
  Sliders,
  ChevronRight,
  Fingerprint,
  LogOut,
  LayoutDashboard,
  RefreshCw,
  Download,
} from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../utils/supabase';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { SettingsSkeleton } from '../../components/SkeletonLoader';
import { useResponsiveLayout } from '../../utils/responsive';
import {
  checkForUpdatesAndPromptAsync,
  downloadAndInstallConfiguredApkAsync,
  getAppUpdateRuntimeInfo,
  type AppUpdateRuntimeInfo,
} from '../../services/appUpdateService';

const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'biometric_password';
const BIOMETRIC_PROVIDER_KEY = 'biometric_provider';
const BIOMETRIC_PIN_KEY = 'biometric_pin';

export default function SettingsScreen() {
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
    name: 'Client User',
    email: 'client@spay.com',
    mobileNumber: '',
    avatarUrl: null as string | null,
    role: 'CLIENT',
  });
  const [displayName, setDisplayName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // Settings states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [dbTheme, setDbTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [language, setLanguage] = useState<'en' | 'fil'>('en');

  // Language modal state
  const [langModalVisible, setLangModalVisible] = useState(false);

  // Biometrics states (merged from ProfileScreen)
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [savingBiometrics, setSavingBiometrics] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [installingApk, setInstallingApk] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateRuntimeInfo>(() => getAppUpdateRuntimeInfo());

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
        name: user.user_metadata?.full_name || 'Client User',
        email: user.email || '',
        mobileNumber: user.user_metadata?.phone_number || '',
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        role: 'CLIENT',
      };

      if (profileData) {
        loadedProfile = {
          name: profileData.name || loadedProfile.name,
          email: profileData.email || loadedProfile.email,
          mobileNumber: profileData.mobile_number || loadedProfile.mobileNumber,
          avatarUrl: loadedProfile.avatarUrl,
          role: profileData.role || 'CLIENT',
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
        setPushAlerts(settingsMap['push_alerts'] !== 'false');
        setLanguage((settingsMap['language'] as 'en' | 'fil') || 'en');

        const themePref = (settingsMap['theme'] as 'light' | 'dark' | 'auto') || undefined;
        if (themePref) {
          setDbTheme(themePref);
        } else {
          setDbTheme(isDarkMode ? 'dark' : 'light');
        }
      } else {
        setDbTheme(isDarkMode ? 'dark' : 'light');
      }

      // 3. Check biometrics compatibility & stored preference
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(hasHardware && isEnrolled);

      const savedEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      setBiometricsEnabled(!!savedEmail);
    } catch (e) {
      console.warn('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // ── Database helpers ──

  const saveSetting = async (key: string, value: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_name: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,setting_name'
        });

      if (error) throw error;
    } catch (e) {
      console.error(`Failed to save setting ${key}:`, e);
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Validation Error', 'Display Name is required.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: displayName.trim(),
          mobile_number: mobileNumber.trim() || null,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: displayName.trim(),
          phone_number: mobileNumber.trim() || null,
        }
      });

      if (authError) throw authError;

      setProfile(prev => ({
        ...prev,
        name: displayName.trim(),
        mobileNumber: mobileNumber.trim(),
      }));

      Alert.alert('Success', 'Profile details updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle handlers ──

  const handleToggleEmail = () => {
    const nextVal = !emailNotifications;
    setEmailNotifications(nextVal);
    saveSetting('email_notifications', nextVal ? 'true' : 'false');
  };

  const handleTogglePush = () => {
    const nextVal = !pushAlerts;
    setPushAlerts(nextVal);
    saveSetting('push_alerts', nextVal ? 'true' : 'false');
  };

  const handleLanguageChange = (nextLang: 'en' | 'fil') => {
    setLanguage(nextLang);
    setLangModalVisible(false);
    saveSetting('language', nextLang);
  };

  const handleThemeChange = (nextTheme: 'light' | 'dark' | 'auto') => {
    setDbTheme(nextTheme);
    saveSetting('theme', nextTheme);

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
  };

  // ── Biometrics handlers (merged from ProfileScreen) ──

  const handleToggleBiometrics = async (value: boolean) => {
    if (!isBiometricSupported) {
      Alert.alert('Unsupported', 'Biometric hardware is not available or enrolled on this device.');
      return;
    }

    if (value) {
      setPin('');
      setConfirmPin('');
      setPinModalVisible(true);
    } else {
      try {
        await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PROVIDER_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
        setBiometricsEnabled(false);
        Alert.alert('Biometrics Disabled', 'Secure credentials have been cleared.');
      } catch (err) {
        Alert.alert('Error', 'Failed to clear security credentials.');
      }
    }
  };

  const handleEnableBiometrics = async () => {
    if (!/^\d{6}$/.test(pin)) {
      Alert.alert('PIN Required', 'Enter a 6-digit fallback PIN.');
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'Enter the same 6-digit PIN in both fields.');
      return;
    }

    try {
      setSavingBiometrics(true);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify identity to enable biometrics',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        setBiometricsEnabled(false);
        return;
      }

      await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, profile.email);
      await SecureStore.setItemAsync(BIOMETRIC_PROVIDER_KEY, 'google');
      await SecureStore.setItemAsync(BIOMETRIC_PIN_KEY, pin);
      await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
      setBiometricsEnabled(true);
      setPinModalVisible(false);
      setPin('');
      setConfirmPin('');
      Alert.alert('Biometrics Enabled', 'You can now unlock Google sign-in with biometrics or your fallback PIN.');
    } catch (err: any) {
      setBiometricsEnabled(false);
      Alert.alert('Biometrics Not Enabled', err?.message || 'Failed to enable biometric sign-in.');
    } finally {
      setSavingBiometrics(false);
    }
  };

  const closePinModal = () => {
    if (savingBiometrics) return;
    setPinModalVisible(false);
    setPin('');
    setConfirmPin('');
    setBiometricsEnabled(false);
  };

  // ── Session handlers ──

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

  const handleCheckForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      await checkForUpdatesAndPromptAsync(true);
      setUpdateInfo(getAppUpdateRuntimeInfo());
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleDownloadApk = async () => {
    setInstallingApk(true);
    try {
      await downloadAndInstallConfiguredApkAsync();
    } catch (error: any) {
      Alert.alert('APK installer opened', error?.message || 'Use the browser download if Android blocks direct install.');
    } finally {
      setInstallingApk(false);
    }
  };

  // ── Theme tokens ──

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

  // ── TAB PANELS ──

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
          <Text style={[styles.avatarLabelTitle, { color: t.textPrimary }]}>Client Profile Image</Text>
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
          Choose a default visual layout for your client console navigation.
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
              Receive due-date reminders, payment confirmations, and account notices.
            </Text>
          </View>
        </View>
        <Switch
          value={emailNotifications}
          onValueChange={handleToggleEmail}
          trackColor={{ false: t.switchTrackFalse, true: '#3b82f6' }}
          thumbColor={emailNotifications ? '#ffffff' : t.switchThumbFalse}
        />
      </View>

      <View style={[styles.formDivider, { backgroundColor: t.divider }]} />

      {/* Push Alerts */}
      <View style={styles.toggleRowContainer}>
        <View style={styles.toggleRowLeft}>
          <View style={[styles.toggleIconBox, { backgroundColor: isDarkMode ? 'rgba(238,77,45,0.1)' : 'rgba(238,77,45,0.05)' }]}>
            <Smartphone size={16} color={t.accent} />
          </View>
          <View style={styles.toggleTextCol}>
            <Text style={[styles.toggleTitleText, { color: t.textPrimary }]}>Push Alerts</Text>
            <Text style={[styles.toggleDescText, { color: t.textSecondary }]}>
              Receive mobile warnings for due dates, overdue installments, and budget thresholds.
            </Text>
          </View>
        </View>
        <Switch
          value={pushAlerts}
          onValueChange={handleTogglePush}
          trackColor={{ false: t.switchTrackFalse, true: '#3b82f6' }}
          thumbColor={pushAlerts ? '#ffffff' : t.switchThumbFalse}
        />
      </View>

      <View style={[styles.formDivider, { backgroundColor: t.divider }]} />

      {/* Language Selection */}
      <View style={styles.langSelectorSection}>
        <Text style={[styles.inputLabel, { color: t.textSecondary, marginBottom: 8 }]}>
          Language Preference
        </Text>
        <TouchableOpacity
          onPress={() => setLangModalVisible(true)}
          style={[styles.langSelectBtn, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
          activeOpacity={0.8}
        >
          <View style={styles.langSelectBtnLeft}>
            <Languages size={16} color={t.textSecondary} />
            <Text style={[styles.langSelectBtnText, { color: t.textPrimary }]}>
              {language === 'en' ? 'English' : 'Filipino'}
            </Text>
          </View>
          <ChevronRight size={16} color={t.textSecondary} />
        </TouchableOpacity>
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
          Your client account is linked and secured via Google OAuth Single Sign-On. There is no active password associated with this profile.
        </Text>

        {/* Biometric Sign-In Toggle */}
        <View style={styles.toggleRowContainer}>
          <View style={styles.toggleRowLeft}>
            <View style={[styles.toggleIconBox, { backgroundColor: isDarkMode ? 'rgba(238,77,45,0.1)' : 'rgba(238,77,45,0.05)' }]}>
              <Fingerprint size={16} color={t.accent} />
            </View>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleTitleText, { color: t.textPrimary }]}>Biometric Sign-In</Text>
              <Text style={[styles.toggleDescText, { color: t.textSecondary }]}>
                Use FaceID / TouchID for quick sign-in with a 6-digit fallback PIN.
              </Text>
            </View>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={handleToggleBiometrics}
            disabled={savingBiometrics}
            trackColor={{ false: t.switchTrackFalse, true: '#3b82f6' }}
            thumbColor={biometricsEnabled ? '#ffffff' : t.switchThumbFalse}
          />
        </View>

        <View style={[styles.formDivider, { backgroundColor: t.divider }]} />

        {/* Info Notices */}
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
            To configure multi-factor authentication, password requirements, or connected apps, use your Google Account security settings.
          </Text>
        </View>

        <View
          style={[
            styles.successBox,
            {
              backgroundColor: isDarkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
              borderColor: isDarkMode ? 'rgba(16,185,129,0.2)' : '#d1fae5',
            },
          ]}
        >
          <CheckCircle size={16} color={isDarkMode ? '#34d399' : '#047857'} />
          <Text style={[styles.successText, { color: isDarkMode ? '#a7f3d0' : '#065f46' }]}>
            Session data and repayment settings are synchronized with your S-Pay profile.
          </Text>
        </View>

        <View style={[styles.updatePanel, { backgroundColor: t.inputBg, borderColor: t.cardBorder }]}>
          <View style={styles.updateHeader}>
            <View style={[styles.toggleIconBox, { backgroundColor: isDarkMode ? 'rgba(238,77,45,0.1)' : 'rgba(238,77,45,0.05)' }]}>
              <Download size={16} color={t.accent} />
            </View>
            <View style={styles.updateHeaderText}>
              <Text style={[styles.toggleTitleText, { color: t.textPrimary }]}>App Updates</Text>
              <Text style={[styles.toggleDescText, { color: t.textSecondary }]}>
                OTA channel {updateInfo.channel} · runtime {updateInfo.runtimeVersion}
              </Text>
            </View>
          </View>

          <View style={[styles.updateMetaGrid, { borderColor: t.divider }]}>
            <View style={styles.updateMetaItem}>
              <Text style={[styles.updateMetaLabel, { color: t.textMuted }]}>Version</Text>
              <Text style={[styles.updateMetaValue, { color: t.textPrimary }]}>{updateInfo.appVersion}</Text>
            </View>
            <View style={styles.updateMetaItem}>
              <Text style={[styles.updateMetaLabel, { color: t.textMuted }]}>Update ID</Text>
              <Text style={[styles.updateMetaValue, { color: t.textPrimary }]} numberOfLines={1}>
                {updateInfo.updateId}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleCheckForUpdates}
            disabled={checkingUpdates || installingApk}
            style={[styles.updatePrimaryBtn, { backgroundColor: t.accent }]}
            activeOpacity={0.8}
          >
            {checkingUpdates ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <RefreshCw size={15} color="#ffffff" />
                <Text style={styles.updatePrimaryBtnText}>Check for Updates</Text>
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === 'android' && updateInfo.apkUrl ? (
            <TouchableOpacity
              onPress={handleDownloadApk}
              disabled={checkingUpdates || installingApk}
              style={[styles.updateSecondaryBtn, { borderColor: t.inputBorder }]}
              activeOpacity={0.8}
            >
              {installingApk ? (
                <ActivityIndicator size="small" color={t.accent} />
              ) : (
                <>
                  <Download size={15} color={t.accent} />
                  <Text style={[styles.updateSecondaryBtnText, { color: t.accent }]}>Download Latest APK</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Switch Workspace (admin only) */}
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
          <Text style={styles.logoutBtnText}>Log Out from All Devices</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── MODALS ──

  const renderLanguageModal = () => (
    <Modal
      visible={langModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setLangModalVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setLangModalVisible(false)}
      >
        <View
          style={[
            styles.modalContent,
            { backgroundColor: t.cardBg, borderColor: t.cardBorder },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitleText, { color: t.textPrimary }]}>Select Language</Text>
            <View style={[styles.modalTitleDivider, { backgroundColor: t.divider }]} />
          </View>

          <TouchableOpacity
            onPress={() => handleLanguageChange('en')}
            style={[styles.modalOptionRow, language === 'en' && { backgroundColor: t.tabBgActive }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalOptionText, { color: language === 'en' ? t.accent : t.textPrimary }]}>
              English
            </Text>
            {language === 'en' && <CheckCircle size={16} color={t.accent} />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleLanguageChange('fil')}
            style={[styles.modalOptionRow, language === 'fil' && { backgroundColor: t.tabBgActive }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalOptionText, { color: language === 'fil' ? t.accent : t.textPrimary }]}>
              Filipino
            </Text>
            {language === 'fil' && <CheckCircle size={16} color={t.accent} />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setLangModalVisible(false)}
            style={[styles.modalCloseBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.modalCloseBtnText, { color: t.textPrimary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderPinModal = () => (
    <Modal
      visible={pinModalVisible}
      transparent
      animationType="fade"
      onRequestClose={closePinModal}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.pinModalContent, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
          <Text style={[styles.pinModalTitle, { color: t.textPrimary }]}>Create Fallback PIN</Text>
          <Text style={[styles.pinModalBody, { color: t.textSecondary }]}>
            Set a 6-digit PIN for this device in case biometric unlock fails.
          </Text>
          <TextInput
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit PIN"
            placeholderTextColor={t.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            editable={!savingBiometrics}
            style={[
              styles.pinInput,
              {
                color: t.textPrimary,
                borderColor: t.cardBorder,
                backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc',
              },
            ]}
          />
          <TextInput
            value={confirmPin}
            onChangeText={(value) => setConfirmPin(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Confirm PIN"
            placeholderTextColor={t.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            editable={!savingBiometrics}
            style={[
              styles.pinInput,
              {
                color: t.textPrimary,
                borderColor: t.cardBorder,
                backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc',
              },
            ]}
          />
          <View style={styles.pinModalActions}>
            <TouchableOpacity
              style={styles.pinCancelBtn}
              onPress={closePinModal}
              disabled={savingBiometrics}
            >
              <Text style={[styles.pinCancelText, { color: t.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pinConfirmBtn}
              onPress={handleEnableBiometrics}
              disabled={savingBiometrics}
            >
              {savingBiometrics ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.pinConfirmText}>Enable</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ── MAIN RENDER ──

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]} keyboardShouldPersistTaps="handled">
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.subtitleText}>S-PAY CLIENT</Text>
              <Text style={[styles.mainTitleText, { color: t.textPrimary }]}>Settings</Text>
              <Text style={[styles.descText, { color: t.textSecondary }]}>
                Configure profile details, payment notifications, display preferences, and session state.
              </Text>
            </View>

            {/* User Quick Info Card */}
            <View style={[styles.profileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <View style={styles.avatarRow}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatarCircle} />
                ) : (
                  <View style={[styles.avatarCircle, { backgroundColor: t.accent }]}>
                    <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.avatarDetailsCol}>
                  <Text style={[styles.profileNameText, { color: t.textPrimary }]} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  <Text style={[styles.profileEmailText, { color: t.textSecondary }]} numberOfLines={1}>
                    {profile.email}
                  </Text>
                </View>
              </View>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabBar}>
              {([
                { id: 'profile' as const, label: 'Profile', icon: User },
                { id: 'notifications' as const, label: 'Alerts', icon: Sliders },
                { id: 'security' as const, label: 'Security', icon: Shield },
              ]).map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setActiveTab(item.id)}
                    style={[
                      styles.tabButton,
                      isActive
                        ? { backgroundColor: t.tabBgActive, borderColor: t.accent }
                        : { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Icon size={16} color={isActive ? t.accent : t.textSecondary} />
                    <Text style={[styles.tabButtonText, { color: isActive ? t.accent : t.textSecondary }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Active Panel */}
            <View style={{ minHeight: 300 }}>
              {activeTab === 'profile' && renderProfileTab()}
              {activeTab === 'notifications' && renderNotificationsTab()}
              {activeTab === 'security' && renderSecurityTab()}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {renderLanguageModal()}
      {renderPinModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  titleSection: {
    marginBottom: 8,
  },
  subtitleText: {
    color: '#ee4d2d',
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  mainTitleText: {
    fontSize: 26,
    fontFamily: 'Outfit-Bold',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  descText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    marginTop: 6,
    lineHeight: 17,
  },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(238, 77, 45, 0.3)',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
  },
  avatarDetailsCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profileNameText: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
  },
  profileEmailText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  tabButtonText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  tabContentCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    paddingBottom: 12,
  },
  tabHeaderTitle: {
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
  },
  avatarEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    paddingBottom: 16,
  },
  avatarEditPreview: {
    width: 60,
    height: 60,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(238, 77, 45, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLargeText: {
    color: '#ffffff',
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
  },
  avatarEditLabels: {
    flex: 1,
    gap: 2,
  },
  avatarLabelTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  avatarLabelSub: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 14,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  textInput: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
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
    left: 14,
  },
  saveBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  formDivider: {
    height: 1,
    marginVertical: 4,
  },
  themeSection: {
    gap: 10,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeTitle: {
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
  themeDesc: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  themeButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  themeOptionLabel: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  toggleRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    paddingRight: 12,
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
    gap: 2,
  },
  toggleTitleText: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  toggleDescText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 15,
  },
  langSelectorSection: {
    gap: 6,
  },
  langSelectBtn: {
    flexDirection: 'row',
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  langSelectBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langSelectBtnText: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  securityTextContainer: {
    gap: 14,
  },
  securityIntroText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 17,
  },
  noticeBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  noticeText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 15,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  successText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    lineHeight: 15,
  },
  updatePanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  updateHeaderText: {
    flex: 1,
    gap: 2,
  },
  updateMetaGrid: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 10,
    gap: 8,
  },
  updateMetaItem: {
    gap: 2,
  },
  updateMetaLabel: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    textTransform: 'uppercase',
  },
  updateMetaValue: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  updatePrimaryBtn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updatePrimaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  updateSecondaryBtn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updateSecondaryBtnText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  switchWorkspaceBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(238, 77, 45, 0.04)',
  },
  switchWorkspaceBtnText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  logoutBtn: {
    flexDirection: 'row',
    borderWidth: 1.5,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    padding: 24,
    gap: 16,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  modalHeader: {
    alignItems: 'center',
    gap: 12,
  },
  modalTitleText: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
  },
  modalTitleDivider: {
    height: 1,
    width: '100%',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  modalOptionText: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
  },
  modalCloseBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  pinModalContent: {
    marginHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  pinModalTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    marginBottom: 8,
  },
  pinModalBody: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 19,
    marginBottom: 16,
  },
  pinInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 18,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 3,
    marginBottom: 12,
  },
  pinModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  pinCancelBtn: {
    minWidth: 92,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pinCancelText: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  pinConfirmBtn: {
    minWidth: 92,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pinConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
});
