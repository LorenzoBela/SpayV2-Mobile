import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../../utils/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [hasBiometricSettings, setHasBiometricSettings] = useState(false);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricSupported(hasHardware && isEnrolled);

    // Check if biometric login credentials are saved
    const savedEmail = await SecureStore.getItemAsync('biometric_email');
    const savedPassword = await SecureStore.getItemAsync('biometric_password');
    if (savedEmail && savedPassword) {
      setHasBiometricSettings(true);
      // Auto-trigger biometric authentication if supported and set up
      if (hasHardware && isEnrolled) {
        handleBiometricLogin(savedEmail, savedPassword);
      }
    }
  };

  const handleBiometricLogin = async (savedEmail: string, savedPassword: string) => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to S-Pay with Biometrics',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
          email: savedEmail,
          password: savedPassword,
        });

        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert('Biometric Login Failed', error.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Input Error', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Ask user to save biometrics if supported but not yet enabled
      if (isBiometricSupported && !hasBiometricSettings) {
        Alert.alert(
          'Enable Biometrics',
          'Would you like to enable biometric login for faster access next time?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Enable',
              onPress: async () => {
                await SecureStore.setItemAsync('biometric_email', email);
                await SecureStore.setItemAsync('biometric_password', password);
                setHasBiometricSettings(true);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    Alert.alert('Google Sign-In', 'Google Sign-In is triggered. Session token will sync via Supabase.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.cardContainer}>
        {/* Logo/Branding Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="wallet-sharp" size={36} color="#3b82f6" />
          </View>
          <Text style={styles.title}>S-PAY</Text>
          <Text style={styles.subtitle}>Unified Expense & Installment Ledger</Text>
        </View>

        {/* Input Fields */}
        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#475569"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Security Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor="#475569"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signInText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social / Alternative Sign-in */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
              <Ionicons name="logo-google" size={20} color="#f8fafc" />
              <Text style={styles.googleButtonText}>Google</Text>
            </TouchableOpacity>

            {isBiometricSupported && hasBiometricSettings && (
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={async () => {
                  const savedEmail = await SecureStore.getItemAsync('biometric_email');
                  const savedPassword = await SecureStore.getItemAsync('biometric_password');
                  if (savedEmail && savedPassword) {
                    handleBiometricLogin(savedEmail, savedPassword);
                  }
                }}
              >
                <Ionicons name="finger-print" size={22} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Footer info */}
        <Text style={styles.footerText}>
          Migrating to secure PostgreSQL database.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate-900
    justifyContent: 'center',
    padding: 24,
  },
  cardContainer: {
    backgroundColor: '#1e293b', // Slate-800
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#334155', // Slate-700
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    backgroundColor: '#1e293b',
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 50,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
  },
  signInButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  signInText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#475569',
    fontSize: 12,
    paddingHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 24,
    justifyContent: 'center',
    flex: 1,
  },
  googleButtonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  biometricButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 32,
  },
});
