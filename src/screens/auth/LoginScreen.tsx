import { PremiumAlert } from '../../services/PremiumAlertService';
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Pressable,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { Wallet, ShieldCheck, ChevronRight, Fingerprint } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { GoogleAuth } from 'react-native-google-auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../../utils/supabase';


// Persistent storage key for the last logged-in user
const LAST_ACCOUNT_KEY = 'spay-ledger:last-logged-account';
const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PASSWORD_KEY = 'biometric_password';
const BIOMETRIC_PROVIDER_KEY = 'biometric_provider';
const BIOMETRIC_PIN_KEY = 'biometric_pin';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

interface LastAccount {
  name: string;
  email: string;
  photo?: string;
}

// Official Multi-path Google G logo SVG for high-end look
const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </Svg>
);

// Lightweight entry animation helper (fade + slide-up)
function useEntryAnimation(delay = 0, duration = 320) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return {
    style: { opacity, transform: [{ translateY }] },
  };
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [lastAccount, setLastAccount] = useState<LastAccount | null>(null);
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [fallbackPin, setFallbackPin] = useState('');

  // Load last logged-in account details on mount
  useEffect(() => {
    let active = true;

    const loadSavedSignInOptions = async () => {
      try {
        const raw = await AsyncStorage.getItem(LAST_ACCOUNT_KEY);
        if (raw) {
          setLastAccount(JSON.parse(raw));
        }

        const [hasHardware, isEnrolled, savedEmail, savedPassword, savedProvider, savedPin] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY),
          SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY),
          SecureStore.getItemAsync(BIOMETRIC_PROVIDER_KEY),
          SecureStore.getItemAsync(BIOMETRIC_PIN_KEY),
        ]);

        if (!active) return;
        setBiometricEmail(savedEmail);
        setBiometricAvailable(!!(hasHardware && isEnrolled && savedEmail && (savedPin || savedPassword || savedProvider === 'google')));
      } catch (err) {
        console.warn('Failed to load saved sign-in options:', err);
      }
    };

    void loadSavedSignInOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      console.warn('[Auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured.');
      return;
    }

    console.log('[Auth] Configuring Google Auth with Web Client ID:', GOOGLE_WEB_CLIENT_ID);
    GoogleAuth.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    }).then(() => {
      console.log('[Auth] Google Auth configured successfully');
    }).catch((error) => {
      console.warn('[Auth] Failed to configure Google Auth:', error);
    });
  }, []);

  // Entry Animations with precise stagger delays
  const brandingAnim = useEntryAnimation(0);
  const welcomeAnim = useEntryAnimation(150);
  const cardAnim = useEntryAnimation(250);
  const bottomAnim = useEntryAnimation(lastAccount ? 400 : 320);

  const saveGoogleAccount = async (user?: {
    name?: string | null;
    email?: string | null;
    photo?: string | null;
  }) => {
    const name = user?.name || '';
    const email = user?.email || '';
    const photo = user?.photo || '';

    if (name || email) {
      const account = { name, email, photo };
      await AsyncStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify(account));
      setLastAccount(account);
    }
  };

  const completeSupabaseSignIn = async (idToken: string, user?: {
    name?: string | null;
    email?: string | null;
    photo?: string | null;
  }) => {
    console.log('[Auth] completeSupabaseSignIn called with user email:', user?.email);
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        console.error('[Auth] Supabase signInWithIdToken error:', error);
        throw error;
      }

      console.log('[Auth] Supabase authentication successful');
      await saveGoogleAccount(user);
    } catch (err) {
      console.error('[Auth] completeSupabaseSignIn catch block error:', err);
      throw err;
    }
  };

  const handleGoogleSignIn = async (options?: { silent?: boolean }) => {
    try {
      setLoading(true);
      console.log('[Auth] handleGoogleSignIn called, options:', options);

      if (!GOOGLE_WEB_CLIENT_ID) {
        throw new Error('Google Sign-In is missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
      }

      if (options?.silent) {
        try {
          console.log('[Auth] Attempting silent Google Sign-In...');
          const user = await GoogleAuth.getCurrentUser();
          console.log('[Auth] getCurrentUser response:', user);
          const tokens = user ? await GoogleAuth.getTokens() : null;
          console.log('[Auth] getTokens response:', tokens ? { hasIdToken: !!tokens.idToken } : null);
          if (user && tokens?.idToken) {
            console.log('[Auth] Silent Google Sign-In succeeded, logging into Supabase...');
            await completeSupabaseSignIn(tokens.idToken, user);
            return;
          }
        } catch (silentError) {
          console.log('[Auth] Cached Google credential unavailable, opening One Tap.', silentError);
        }
      }

      console.log('[Auth] Calling GoogleAuth.signIn()...');
      const response = await GoogleAuth.signIn();
      console.log('[Auth] GoogleAuth.signIn() full response:', JSON.stringify(response, null, 2));
      
      if (response.type === 'success') {
        const idToken = response.data.idToken;
        if (!idToken) {
          throw new Error('Google Sign-In failed: No ID token received.');
        }

        console.log('[Auth] Google Sign-In success, logging into Supabase with ID token...');
        await completeSupabaseSignIn(idToken, response.data.user);
        console.log('[Auth] Supabase login complete');
      } else if (response.type === 'cancelled') {
        console.log('[Auth] Google Sign-In response says: cancelled');
      } else if (response.type === 'noSavedCredentialFound') {
        console.log('[Auth] Google Sign-In response says: noSavedCredentialFound');
        PremiumAlert.alert('Sign In Failed', 'No saved Google credential was found on this device.');
      } else {
        console.log('[Auth] Google Sign-In response has unknown type:', (response as any).type);
      }
    } catch (error: any) {
      console.error('[Auth] Google Sign-In catch block error:', error);
      if (error && typeof error === 'object') {
        console.error('[Auth] Google Sign-In error properties:', Object.keys(error));
        console.error('[Auth] Google Sign-In error details:', JSON.stringify(error, null, 2));
      }
      if (error?.code === 'SIGN_IN_CANCELLED' || error?.message?.toLowerCase?.().includes('cancel')) {
        console.log('[Auth] Google Sign-In cancelled by user (error code/message)');
      } else {
        PremiumAlert.alert('Sign In Failed', error.message || 'An error occurred during Google Sign In.');
      }
    } finally {
      setLoading(false);
    }
  };

  const completeLocalUnlockSignIn = async () => {
    const [email, password] = await Promise.all([
      SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY),
      SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY),
    ]);

    if (!email) {
      setBiometricAvailable(false);
      setBiometricEmail(null);
      PremiumAlert.alert('Sign-In Unavailable', 'Enable biometric sign-in again from your client settings.');
      return;
    }

    if (!password) {
      if (!GOOGLE_WEB_CLIENT_ID) {
        throw new Error('Google Sign-In is missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
      }

      await handleGoogleSignIn({ silent: true });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    await saveGoogleAccount({ email, name: email.split('@')[0] });
  };

  const handleBiometricSignIn = async () => {
    try {
      setLoading(true);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to S-Pay',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        setLoading(false);
        setFallbackPin('');
        setPinModalVisible(true);
        return;
      }

      await completeLocalUnlockSignIn();
    } catch (error: any) {
      if (error?.message?.toLowerCase?.().includes('invalid login credentials')) {
        await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PROVIDER_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
        setBiometricAvailable(false);
        setBiometricEmail(null);
        PremiumAlert.alert('Biometric Sign-In Reset', 'Your saved password no longer works. Sign in with Google and enable biometrics again.');
        return;
      }

      PremiumAlert.alert('Biometric Sign-In Failed', error?.message || 'Unable to sign in with biometrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleFallbackPinSignIn = async () => {
    try {
      if (!/^\d{6}$/.test(fallbackPin)) {
        PremiumAlert.alert('PIN Required', 'Enter your 6-digit fallback PIN.');
        return;
      }

      setLoading(true);
      const savedPin = await SecureStore.getItemAsync(BIOMETRIC_PIN_KEY);
      if (!savedPin) {
        setPinModalVisible(false);
        setFallbackPin('');
        PremiumAlert.alert('PIN Unavailable', 'Set up biometric sign-in again from your client settings.');
        return;
      }

      if (fallbackPin !== savedPin) {
        PremiumAlert.alert('Incorrect PIN', 'The fallback PIN you entered is incorrect.');
        return;
      }

      setPinModalVisible(false);
      setFallbackPin('');
      await completeLocalUnlockSignIn();
    } catch (error: any) {
      PremiumAlert.alert('PIN Sign-In Failed', error?.message || 'Unable to sign in with your fallback PIN.');
    } finally {
      setLoading(false);
    }
  };

  const closePinModal = () => {
    if (loading) return;
    setPinModalVisible(false);
    setFallbackPin('');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.contentContainer}>
        {/* Branding Header */}
        <Animated.View style={[styles.header, brandingAnim.style]}>
          <Text style={styles.tagline}>INSTALLMENTS MADE CLEAR</Text>
          <View style={styles.logoBadge}>
            <Wallet size={36} color="#ee4d2d" strokeWidth={1.8} />
          </View>
          <Text style={styles.title}>S-PAY</Text>
          <Text style={styles.subtitle}>Unified Expense & Installment Ledger</Text>
        </Animated.View>

        {/* Welcome Text Section */}
        <Animated.View style={[styles.welcomeSection, welcomeAnim.style]}>
          <Text style={styles.welcomeTitle}>
            {lastAccount ? 'Welcome Back' : 'Authentication'}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {lastAccount
              ? biometricAvailable
                ? 'Unlock your saved session with device biometrics.'
                : 'Tap below to resume your secure session.'
              : 'Initialize a secure session to manage installments.'}
          </Text>
        </Animated.View>

        {/* Tappable Account Persistence Card or General Welcome Card */}
        {lastAccount ? (
          <Pressable
            onPress={() => biometricAvailable ? handleBiometricSignIn() : handleGoogleSignIn({ silent: true })}
            disabled={loading}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, width: '100%' })}
          >
            <Animated.View style={[styles.lastAccountCard, cardAnim.style]}>
              <LastAccountAvatar name={lastAccount.name} photo={lastAccount.photo} />
              <View style={styles.lastAccountInfo}>
                <Text style={styles.lastAccountName} numberOfLines={1}>
                  {lastAccount.name}
                </Text>
                <Text style={styles.lastAccountEmail} numberOfLines={1}>
                  {lastAccount.email}
                </Text>
              </View>
              <View style={styles.lastAccountBadge}>
                {loading ? (
                  <ActivityIndicator size="small" color="#ee4d2d" />
                ) : (
                  <ChevronRight size={18} color="#94a3b8" />
                )}
              </View>
            </Animated.View>
          </Pressable>
        ) : (
          <Animated.View style={[styles.card, cardAnim.style]}>
            <Text style={styles.cardHeader}>Log In Securely</Text>
            <Text style={styles.cardBody}>
              Access your personal budget limits, payment plans, due alerts, and detailed reports.
            </Text>
          </Animated.View>
        )}

        {/* Bottom Actions Section with Premium Spring button */}
        <Animated.View style={[styles.bottomSection, bottomAnim.style]}>
          {biometricAvailable && (
            <BiometricSignInButton
              email={biometricEmail}
              onPress={handleBiometricSignIn}
              loading={loading}
              disabled={loading}
            />
          )}
          <GoogleSignInButton
            onPress={() => handleGoogleSignIn()}
            loading={loading && !lastAccount}
            disabled={loading}
          />
        </Animated.View>

        {/* Footer info */}
        <View style={styles.footer}>
          <ShieldCheck size={14} color="#64748b" style={styles.footerIcon} />
          <Text style={styles.footerText}>
            Secure Sign-In via Google{biometricAvailable ? ', Biometrics, or PIN' : ''}
          </Text>
        </View>
      </View>

      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePinModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pinModal}>
            <Text style={styles.pinModalTitle}>Use Fallback PIN</Text>
            <Text style={styles.pinModalBody}>
              Enter your 6-digit device PIN to unlock your saved Google sign-in.
            </Text>
            <TextInput
              value={fallbackPin}
              onChangeText={(value) => setFallbackPin(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit PIN"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              editable={!loading}
              style={styles.pinInput}
            />
            <View style={styles.pinModalActions}>
              <Pressable
                onPress={closePinModal}
                disabled={loading}
                style={({ pressed }) => [styles.pinCancelButton, { opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={styles.pinCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleFallbackPinSignIn}
                disabled={loading}
                style={({ pressed }) => [styles.pinConfirmButton, { opacity: loading ? 0.75 : pressed ? 0.86 : 1 }]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.pinConfirmText}>Unlock</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Interactive Google Sign-In Button with Spring animation
interface GoogleSignInButtonProps {
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}

const GoogleSignInButton = ({ onPress, loading, disabled }: GoogleSignInButtonProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 40,
      bounciness: 3,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 3,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={{ width: '100%', alignItems: 'center' }}
    >
      <Animated.View
        style={[
          styles.googleButton,
          {
            transform: [{ scale: scaleAnim }],
            opacity: disabled ? 0.8 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#f8fafc" />
        ) : (
          <View style={styles.buttonContent}>
            <GoogleIcon size={20} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

interface BiometricSignInButtonProps {
  email: string | null;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}

const BiometricSignInButton = ({ email, onPress, loading, disabled }: BiometricSignInButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.biometricButton,
        {
          opacity: disabled ? 0.75 : pressed ? 0.86 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <>
          <View style={styles.biometricIconBadge}>
            <Fingerprint size={20} color="#ffffff" />
          </View>
          <View style={styles.biometricTextWrap}>
            <Text style={styles.biometricTitle}>Sign in with Biometrics</Text>
            {!!email && (
              <Text style={styles.biometricEmail} numberOfLines={1}>
                {email}
              </Text>
            )}
          </View>
          <ChevronRight size={18} color="#fed7aa" />
        </>
      )}
    </Pressable>
  );
};

// PERSISTED AVATAR COMPONENT WITH FALLBACK MONOGRAM INITIALS
interface LastAccountAvatarProps {
  name: string;
  photo?: string;
}

const LastAccountAvatar = ({ name, photo }: LastAccountAvatarProps) => {
  const [imageError, setImageError] = useState(false);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  if (photo && !imageError) {
    return (
      <Image
        source={{ uri: photo }}
        style={styles.lastAccountAvatar}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View style={[styles.lastAccountAvatar, styles.lastAccountAvatarFallback]}>
      <Text style={styles.lastAccountInitials}>{initials || '?'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
    padding: 24,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  tagline: {
    color: '#ee4d2d',
    fontSize: 10,
    fontFamily: 'Jakarta-ExtraBold',
    letterSpacing: 4.5,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  logoBadge: {
    backgroundColor: 'rgba(238, 77, 45, 0.04)',
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(238, 77, 45, 0.2)',
  },
  title: {
    color: '#f8fafc',
    fontSize: 36,
    fontFamily: 'Outfit-ExtraBold',
    letterSpacing: 4,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  welcomeTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#161c2a',
    borderColor: '#2d3748',
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 24,
  },
  cardHeader: {
    color: '#f8fafc',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  cardBody: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    lineHeight: 20,
  },
  lastAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161c2a',
    borderColor: '#2d3748',
    borderWidth: 1.5,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
  },
  lastAccountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#ee4d2d',
  },
  lastAccountAvatarFallback: {
    backgroundColor: '#ee4d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastAccountInitials: {
    color: '#f8fafc',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  lastAccountInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  lastAccountName: {
    color: '#f8fafc',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  lastAccountEmail: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  lastAccountBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(238, 77, 45, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 16,
  },
  biometricButton: {
    backgroundColor: '#ee4d2d',
    borderColor: '#fb8a6f',
    borderWidth: 1.5,
    borderRadius: 16,
    minHeight: 60,
    width: '100%',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  biometricIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  biometricTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  biometricTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.2,
  },
  biometricEmail: {
    color: '#fed7aa',
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 2,
  },
  googleButton: {
    backgroundColor: '#161c2a',
    borderColor: '#2d3748',
    borderWidth: 1.5,
    borderRadius: 16,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButtonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    opacity: 0.7,
  },
  footerIcon: {
    marginRight: 6,
  },
  footerText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Jakarta-SemiBold',
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  pinModal: {
    backgroundColor: '#161c2a',
    borderColor: '#2d3748',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 20,
  },
  pinModalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    marginBottom: 8,
  },
  pinModalBody: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 19,
    marginBottom: 16,
  },
  pinInput: {
    color: '#f8fafc',
    backgroundColor: '#0b0f19',
    borderColor: '#2d3748',
    borderWidth: 1.5,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 18,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 3,
    marginBottom: 18,
  },
  pinModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  pinCancelButton: {
    minWidth: 92,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinConfirmButton: {
    minWidth: 92,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinCancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  pinConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
});
