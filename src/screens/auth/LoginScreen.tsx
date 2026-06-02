import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Animated,
  Pressable,
  Image,
} from 'react-native';
import { Wallet, ShieldCheck, ChevronRight } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { GoogleAuth } from 'react-native-google-auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Persistent storage key for the last logged-in user
const LAST_ACCOUNT_KEY = 'spay-ledger:last-logged-account';
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

  // Load last logged-in account details on mount
  useEffect(() => {
    AsyncStorage.getItem(LAST_ACCOUNT_KEY)
      .then((raw) => {
        if (raw) {
          setLastAccount(JSON.parse(raw));
        }
      })
      .catch((err) => console.warn('Failed to load last account:', err));
  }, []);

  useEffect(() => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      console.warn('[Auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured.');
      return;
    }

    GoogleAuth.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
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
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;

    await saveGoogleAccount(user);
  };

  const handleGoogleSignIn = async (options?: { silent?: boolean }) => {
    try {
      setLoading(true);

      if (!GOOGLE_WEB_CLIENT_ID) {
        throw new Error('Google Sign-In is missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
      }

      if (options?.silent) {
        try {
          const user = await GoogleAuth.getCurrentUser();
          const tokens = user ? await GoogleAuth.getTokens() : null;
          if (user && tokens?.idToken) {
            await completeSupabaseSignIn(tokens.idToken, user);
            return;
          }
        } catch (silentError) {
          console.log('[Auth] Cached Google credential unavailable, opening One Tap.', silentError);
        }
      }

      const response = await GoogleAuth.signIn();
      
      if (response.type === 'success') {
        const idToken = response.data.idToken;
        if (!idToken) {
          throw new Error('Google Sign-In failed: No ID token received.');
        }

        await completeSupabaseSignIn(idToken, response.data.user);
      } else if (response.type === 'cancelled') {
        console.log('[Auth] Google Sign-In cancelled by user');
      } else if (response.type === 'noSavedCredentialFound') {
        Alert.alert('Sign In Failed', 'No saved Google credential was found on this device.');
      }
    } catch (error: any) {
      if (error?.code === 'SIGN_IN_CANCELLED' || error?.message?.toLowerCase?.().includes('cancel')) {
        console.log('[Auth] Google Sign-In cancelled by user');
      } else {
        Alert.alert('Sign In Failed', error.message || 'An error occurred during Google Sign In.');
      }
    } finally {
      setLoading(false);
    }
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
              ? 'Tap below to resume your secure session.'
              : 'Initialize a secure session to manage installments.'}
          </Text>
        </Animated.View>

        {/* Tappable Account Persistence Card or General Welcome Card */}
        {lastAccount ? (
          <Pressable
            onPress={() => handleGoogleSignIn({ silent: true })}
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
            Secure Sign-In via Google
          </Text>
        </View>
      </View>
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
});
