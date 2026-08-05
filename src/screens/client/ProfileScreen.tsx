import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useContext, useEffect, useState } from 'react';
import { formatAmount } from '../../utils/money';
import { generatePaymentRef } from '../../utils/id';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Phone, Fingerprint, LogOut, LayoutDashboard, Sun, Moon, Edit3, KeyRound, ShieldCheck } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../../utils/authProfile';
import { RoleContext, ThemeContext } from '../../navigation/navigationTypes';
import { useImpersonation } from '../../context/ImpersonationContext';
import { ProfileSkeleton } from '../../components/SkeletonLoader';
import SwipeDismissModal from '../../components/SwipeDismissModal';
import BiometricReAuthModal from '../../components/BiometricReAuthModal';

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
  const { isImpersonating } = useImpersonation();
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Client User',
    email: 'client@spay.com',
    role: 'CLIENT',
    mobile: '+63 912 345 6789',
  });
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [savingBiometrics, setSavingBiometrics] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Edit Profile modal state
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');

  // Sensitive Action Re-Auth Modal state
  const [reAuthModalVisible, setReAuthModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'UPDATE_PROFILE' | 'UPDATE_PASSWORD' | null>(null);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Dynamic theme colors
  const t = {
    bg: isDarkMode ? '#000000' : '#f1f5f9',
    headerBg: isDarkMode ? '#000000' : '#ffffff',
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
    inputBg: isDarkMode ? '#000000' : '#f8fafc',
  };

  const fetchProfileAndSettings = async () => {
    try {
      const { user, profile: data, profileId: pId } = await getLinkedProfileForCurrentUser();
      if (!user) return;
      if (pId) setProfileId(pId);

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

  const openEditProfile = () => {
    setEditName(profile.name);
    setEditMobile(profile.mobile === 'Not Configured' ? '' : profile.mobile);
    setEditProfileModalVisible(true);
  };

  // Trigger ReAuthModal before saving sensitive profile updates
  const handleInitiateSaveProfile = () => {
    if (!editName.trim()) {
      PremiumAlert.alert('Validation Error', 'Display name cannot be empty.');
      return;
    }
    setPendingAction('UPDATE_PROFILE');
    setReAuthModalVisible(true);
  };

  // Called on valid re-authentication token
  const handleReAuthSuccess = async (_token?: string) => {
    setReAuthModalVisible(false);
    setSavingUpdate(true);

    try {
      if (pendingAction === 'UPDATE_PROFILE') {
        if (profileId) {
          await supabase
            .from('profiles')
            .update({
              name: editName.trim(),
              mobile_number: editMobile.trim() || null,
            })
            .eq('id', profileId);
        }

        await supabase.auth.updateUser({
          data: {
            full_name: editName.trim(),
            phone_number: editMobile.trim() || null,
          },
        });

        setProfile((prev) => ({
          ...prev,
          name: editName.trim(),
          mobile: editMobile.trim() || 'Not Configured',
        }));
        setEditProfileModalVisible(false);
        PremiumAlert.alert('Profile Updated', 'Your profile details have been saved successfully.');
      } else if (pendingAction === 'UPDATE_PASSWORD') {
        if (newPassword) {
          await supabase.auth.updateUser({ password: newPassword });
          setNewPassword('');
          setConfirmPassword('');
          setPasswordModalVisible(false);
          PremiumAlert.alert('Password Updated', 'Your password has been updated successfully.');
        }
      }
    } catch (err: any) {
      PremiumAlert.alert('Update Failed', err?.message || 'Could not apply profile updates.');
    } finally {
      setSavingUpdate(false);
      setPendingAction(null);
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    if (!isBiometricSupported) {
      PremiumAlert.alert('Unsupported', 'Biometric hardware is not available or enrolled on this device.');
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
        PremiumAlert.alert('Biometrics Disabled', 'Secure credentials have been cleared.');
      } catch (err) {
        PremiumAlert.alert('Error', 'Failed to clear security credentials.');
      }
    }
  };

  const handleEnableBiometrics = async () => {
    if (!/^\d{6}$/.test(pin)) {
      PremiumAlert.alert('PIN Required', 'Enter a 6-digit fallback PIN.');
      return;
    }

    if (pin !== confirmPin) {
      PremiumAlert.alert('PIN Mismatch', 'Enter the same 6-digit PIN in both fields.');
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
      PremiumAlert.alert('Biometrics Enabled', 'You can now unlock Google sign-in with biometrics or your fallback PIN.');
    } catch (err: any) {
      setBiometricsEnabled(false);
      PremiumAlert.alert('Biometrics Not Enabled', err?.message || 'Failed to enable biometric sign-in.');
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
    PremiumAlert.alert('Confirm Sign Out', 'Are you sure you want to end your current session?', [
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

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 24 }}>
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
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: t.textSecondary, marginBottom: 0 }]}>Account Details</Text>
                <TouchableOpacity style={styles.editBtn} onPress={openEditProfile}>
                  <Edit3 size={14} color="#ee4d2d" />
                  <Text style={styles.editBtnText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>

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
                    <Text style={[styles.switchTitle, { color: t.textPrimary }]}>Biometrics & Hardware Lock</Text>
                    <Text style={[styles.switchSub, { color: t.textMuted }]}>FaceID / TouchID & 6-digit PIN mandatory</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                  <Text style={{ color: '#22c55e', fontSize: 12, fontFamily: 'Outfit-Bold' }}>Enforced</Text>
                </View>
              </View>

              <View style={[styles.ssoBadgeRow, { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)', borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)' }]}>
                <ShieldCheck size={18} color="#3b82f6" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ssoBadgeTitle, { color: t.textPrimary }]}>Google OAuth Secured</Text>
                  <Text style={[styles.ssoBadgeSub, { color: t.textMuted }]}>Account authenticated via Google SSO. No password required.</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            {profile.role === 'ADMIN' && !isImpersonating && (
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
          </ScrollView>

          {/* Fallback PIN Modal */}
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
                        backgroundColor: t.inputBg,
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
                        backgroundColor: t.inputBg,
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

          {/* Edit Profile Modal */}
          <Modal
            visible={editProfileModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => !savingUpdate && setEditProfileModalVisible(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={[styles.editModal, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Edit Profile Details</Text>
                <Text style={[styles.modalBody, { color: t.textSecondary }]}>
                  Update your display name and mobile number.
                </Text>

                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full Name"
                  placeholderTextColor={t.textMuted}
                  editable={!savingUpdate}
                  style={[
                    styles.formInput,
                    { color: t.textPrimary, borderColor: t.cardBorder, backgroundColor: t.inputBg },
                  ]}
                />

                <TextInput
                  value={editMobile}
                  onChangeText={setEditMobile}
                  placeholder="Mobile Number"
                  placeholderTextColor={t.textMuted}
                  keyboardType="phone-pad"
                  editable={!savingUpdate}
                  style={[
                    styles.formInput,
                    { color: t.textPrimary, borderColor: t.cardBorder, backgroundColor: t.inputBg },
                  ]}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setEditProfileModalVisible(false)}
                    disabled={savingUpdate}
                  >
                    <Text style={[styles.modalCancelText, { color: t.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirmButton]}
                    onPress={handleInitiateSaveProfile}
                    disabled={savingUpdate}
                  >
                    {savingUpdate ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.modalConfirmText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>



          {/* Re-Authentication Modal for Sensitive Operations */}
          <BiometricReAuthModal
            visible={reAuthModalVisible}
            onDismiss={() => setReAuthModalVisible(false)}
            onSuccess={handleReAuthSuccess}
            title="Profile Security Check"
            description="Please verify your identity with biometrics or password to save profile changes."
          />
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
  profileCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    color: '#ee4d2d',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  passwordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  passwordBtnText: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
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
    marginTop: 12,
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
  editModal: {
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
  formInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Jakarta-Medium',
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
  ssoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  ssoBadgeTitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
  ssoBadgeSub: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
    lineHeight: 15,
  },
});
