import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../../utils/supabase';

interface UserProfile {
  name: string;
  email: string;
  role: string;
  mobile: string;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Client Rider',
    email: 'rider@spay.com',
    role: 'CLIENT',
    mobile: '+63 912 345 6789',
  });
  const [loading, setLoading] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

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

      const savedEmail = await SecureStore.getItemAsync('biometric_email');
      const savedPassword = await SecureStore.getItemAsync('biometric_password');
      setBiometricsEnabled(!!(savedEmail && savedPassword));
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
      // User is enabling biometrics. We prompt for current password to save it securely
      Alert.prompt(
        'Confirm Password',
        'Enter your S-Pay account password to enable secure biometric login.',
        async (password) => {
          if (!password) {
            setBiometricsEnabled(false);
            return;
          }

          // Test biometrics first
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Verify identity to enable biometrics',
          });

          if (result.success) {
            try {
              await SecureStore.setItemAsync('biometric_email', profile.email);
              await SecureStore.setItemAsync('biometric_password', password);
              setBiometricsEnabled(true);
              Alert.alert('Biometrics Enabled', 'You can now sign in with biometric authentication.');
            } catch (err) {
              Alert.alert('Error', 'Failed to store security credentials.');
              setBiometricsEnabled(false);
            }
          } else {
            setBiometricsEnabled(false);
          }
        },
        'secure-text'
      );
    } else {
      // Disable biometrics by deleting stored credentials
      try {
        await SecureStore.deleteItemAsync('biometric_email');
        await SecureStore.deleteItemAsync('biometric_password');
        setBiometricsEnabled(false);
        Alert.alert('Biometrics Disabled', 'Secure credentials have been cleared.');
      } catch (err) {
        Alert.alert('Error', 'Failed to clear security credentials.');
      }
    }
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <View style={styles.content}>
          {/* User info header card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileRole}>{profile.role}</Text>
          </View>

          {/* Details list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Details</Text>

            <View style={styles.row}>
              <Ionicons name="mail-outline" size={20} color="#64748b" />
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Email Address</Text>
                <Text style={styles.rowValue}>{profile.email}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Ionicons name="call-outline" size={20} color="#64748b" />
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Mobile Number</Text>
                <Text style={styles.rowValue}>{profile.mobile}</Text>
              </View>
            </View>
          </View>

          {/* Security list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security Settings</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchLabelCol}>
                <Ionicons name="finger-print" size={20} color="#3b82f6" />
                <View style={styles.switchLabelInfo}>
                  <Text style={styles.switchTitle}>Biometric Sign-In</Text>
                  <Text style={styles.switchSub}>Use FaceID / TouchID for logins</Text>
                </View>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: '#334155', true: '#3b82f6' }}
                thumbColor={biometricsEnabled ? '#ffffff' : '#64748b'}
              />
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out Account</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#60a5fa',
    marginBottom: 16,
  },
  avatarLargeText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  profileName: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  profileRole: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#94a3b8',
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
    color: '#64748b',
    fontSize: 11,
  },
  rowValue: {
    color: '#f8fafc',
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
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  switchSub: {
    color: '#64748b',
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
});
