import React, { useContext, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Phone, Fingerprint, LogOut, LayoutDashboard, Sun, Moon } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../../utils/supabase';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { ProfileSkeleton } from '../../components/SkeletonLoader';
import SwipeDismissModal from '../../components/SwipeDismissModal';

const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'biometric_password';
const BIOMETRIC_PROVIDER_KEY = 'biometric_provider';
const BIOMETRIC_PIN_KEY = 'biometric_pin';

interface UserProfile {
  name: string;
  email: string;
  role: string;
  mobile: string;
}

export default function ProfileScreen() {
  const { setActiveRole } = useContext(RoleContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Client User',
    email: 'client@spay.com',
    role: 'CLIENT',
    mobile: '+63 912 345 6789',
  });
  const [loading, setLoading] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [savingBiometrics, setSavingBiometrics] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Dynamic theme colors
  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    iconBtnBg: isDarkMode ? 'rgba(148,163,184,0.06)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(148,163,184,0.1)' : '#e2e8f0',
    switchTrackFalse: isDarkMode ? '#334155' : '#cbd5e1',
    switchThumbFalse: isDarkMode ? '#64748b' : '#94a3b8',
  };

  const fetchProfileAndSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile({
          name: data.name || 'User',
          email: data.email || user.email || '',
          role: data.role || 'CLIENT',
          mobile: data.mobile_number || 'Not Configured',
        });
      }

      // Check biometrics compatibility & preference
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(hasHardware && isEnrolled);

      const savedEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      setBiometricsEnabled(!!savedEmail);
    } catch (error) {
      console.warn('Error loading profile settings, using fallback placeholders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndSettings();
  }, []);

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
      // Disable biometrics by deleting stored credentials
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

  const handleSignOut = async () => {
    Alert.alert('Confirm Sign Out', 'Are you sure you want to end your current session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        onPress: async () => {
          setLoading(true);
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {loading ? (
        <ProfileSkeleton />
      ) : (
        <>
          {/* Premium Header Bar */}
          <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
            <View style={styles.webHeaderLeft}>
              <Text style={styles.webHeaderSubtitle}>S-Pay Profile</Text>
              <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Customer Settings</Text>
              <Text style={[styles.webHeaderDesc, { color: t.textSecondary }]}>
                Manage your personal account credentials, mobile numbers, and biometrics secure login.
              </Text>
            </View>
            <View style={styles.webHeaderRight}>
              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
                onPress={toggleTheme}
              >
                {isDarkMode ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#475569" />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.content}>
          {/* User info header card */}
          <View style={[styles.profileCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.profileName, { color: t.textPrimary }]}>{profile.name}</Text>
            <Text style={[styles.profileRole, { color: t.textMuted }]}>{profile.role}</Text>
          </View>

          {/* Details list */}
          <View style={[styles.section, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>Account Details</Text>

            <View style={styles.row}>
              <Mail size={20} color={t.textMuted} />
              <View style={styles.rowInfo}>
                <Text style={[styles.rowLabel, { color: t.textMuted }]}>Email Address</Text>
                <Text style={[styles.rowValue, { color: t.textPrimary }]}>{profile.email}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Phone size={20} color={t.textMuted} />
              <View style={styles.rowInfo}>
                <Text style={[styles.rowLabel, { color: t.textMuted }]}>Mobile Number</Text>
                <Text style={[styles.rowValue, { color: t.textPrimary }]}>{profile.mobile}</Text>
              </View>
            </View>
          </View>

          {/* Security list */}
          <View style={[styles.section, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>Security Settings</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchLabelCol}>
                <Fingerprint size={20} color="#ee4d2d" />
                <View style={styles.switchLabelInfo}>
                  <Text style={[styles.switchTitle, { color: t.textPrimary }]}>Biometric Sign-In</Text>
                  <Text style={[styles.switchSub, { color: t.textMuted }]}>Use FaceID / TouchID for logins</Text>
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
          </View>

          {/* Actions */}
          {profile.role === 'ADMIN' && (
            <TouchableOpacity
              style={[styles.switchWorkspaceBtn, !isDarkMode && { backgroundColor: 'rgba(238,77,45,0.04)' }]}
              onPress={() => setActiveRole(null)}
            >
              <LayoutDashboard size={20} color="#ee4d2d" />
              <Text style={styles.switchWorkspaceText}>Switch Workspace</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.signOutBtn,
              !isDarkMode && { borderColor: '#fca5a5' },
              profile.role === 'ADMIN' && { marginTop: 0 }
            ]}
            onPress={handleSignOut}
          >
            <LogOut size={20} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out Account</Text>
          </TouchableOpacity>
        </View>

          <Modal
            visible={pinModalVisible}
            transparent
            animationType="fade"
            onRequestClose={closePinModal}
          >
            <View style={styles.modalBackdrop}>
              <SwipeDismissModal onDismiss={closePinModal} disabled={savingBiometrics}>
              <View style={[styles.pinModal, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Create Fallback PIN</Text>
                <Text style={[styles.modalBody, { color: t.textSecondary }]}>
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
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={closePinModal}
                    disabled={savingBiometrics}
                  >
                    <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirmButton]}
                    onPress={handleEnableBiometrics}
                    disabled={savingBiometrics}
                  >
                    {savingBiometrics ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.modalConfirmText}>Enable</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              </SwipeDismissModal>
            </View>
          </Modal>
        </>
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
  content: {
    flex: 1,
    padding: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(238, 77, 45, 0.3)',
    marginBottom: 16,
  },
  avatarLargeText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
  },
  profileRole: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 11,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  switchLabelInfo: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    height: 50,
    marginTop: 'auto',
    marginBottom: 16,
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
  switchWorkspaceBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#ee4d2d',
    borderRadius: 12,
    height: 50,
    marginTop: 'auto',
    marginBottom: 12,
    backgroundColor: 'rgba(238, 77, 45, 0.05)',
  },
  switchWorkspaceText: {
    color: '#ee4d2d',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  pinModal: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  pinInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalButton: {
    minWidth: 92,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
  },
  modalConfirmButton: {
    backgroundColor: '#ee4d2d',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
