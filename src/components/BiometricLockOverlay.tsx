import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Fingerprint, Lock, ShieldAlert, KeyRound, Delete } from 'lucide-react-native';
import useBiometrics from '../hooks/useBiometrics';
import useSecurityPin from '../hooks/useSecurityPin';

interface BiometricLockOverlayProps {
  children: React.ReactNode;
  sessionExists: boolean;
}

const { width } = Dimensions.get('window');
const keypadButtonSize = width < 380 ? 60 : 68;

export function BiometricLockOverlay({ children, sessionExists }: BiometricLockOverlayProps) {
  const insets = useSafeAreaInsets();
  const { isSupported, isEnrolled, biometricType, authenticate } = useBiometrics();
  const { hasPin, verifyPin } = useSecurityPin();

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [showPinPad, setShowPinPad] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const shakeOffset = useSharedValue(0);

  const shakeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  const triggerShake = () => {
    shakeOffset.value = withSequence(
      withTiming(-14, { duration: 50 }),
      withTiming(14, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-5, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const triggerBiometrics = useCallback(async () => {
    if (!isSupported || !isEnrolled) {
      setShowPinPad(true);
      return;
    }

    setIsAuthenticating(true);
    try {
      const res = await authenticate('Unlock S-Pay Vault');
      if (res.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsLocked(false);
        setPin('');
        setPinError(false);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setShowPinPad(true);
      }
    } catch (e) {
      console.warn('[BiometricLockOverlay] Biometrics error:', e);
      setShowPinPad(true);
    } finally {
      setIsAuthenticating(false);
    }
  }, [isSupported, isEnrolled, authenticate]);

  // Initial Lock Check
  useEffect(() => {
    if (!sessionExists) {
      setIsLocked(false);
      return;
    }

    const checkLockStatus = () => {
      const shouldLock = (isSupported && isEnrolled) || hasPin;
      if (shouldLock) {
        setIsLocked(true);
        setTimeout(() => {
          void triggerBiometrics();
        }, 300);
      } else {
        setIsLocked(false);
      }
    };

    checkLockStatus();
  }, [sessionExists, isSupported, isEnrolled, hasPin, triggerBiometrics]);

  // AppState Backgrounding Listener
  useEffect(() => {
    if (!sessionExists) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        const shouldLock = (isSupported && isEnrolled) || hasPin;
        if (shouldLock) {
          setIsLocked(true);
          setPin('');
          setPinError(false);
          setTimeout(() => {
            void triggerBiometrics();
          }, 300);
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [sessionExists, isSupported, isEnrolled, hasPin, triggerBiometrics]);

  const handleKeyPress = async (num: string) => {
    if (pin.length >= 6) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const nextPin = pin + num;
    setPin(nextPin);
    setPinError(false);

    if (nextPin.length === 6) {
      const valid = await verifyPin(nextPin);
      if (valid) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsLocked(false);
        setPin('');
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        triggerShake();
        setPinError(true);
        setPin('');
      }
    }
  };

  const handleBackspace = async () => {
    if (pin.length === 0) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin(pin.slice(0, -1));
    setPinError(false);
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  const dots = Array(6).fill(0);

  const KeypadButton = ({ val }: { val: string }) => (
    <TouchableOpacity
      onPress={() => handleKeyPress(val)}
      activeOpacity={0.7}
      style={styles.keypadBtn}
    >
      <Text style={styles.keypadBtnText}>{val}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <View style={styles.content}>
        {/* Lock Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Lock size={32} color="#ee4d2d" />
          </View>
          <Text style={styles.title}>S-PAY HARDWARE VAULT</Text>
          <Text style={styles.subtitle}>
            {pinError
              ? 'Incorrect PIN. Please try again.'
              : showPinPad
              ? 'Enter your 6-digit security PIN to unlock.'
              : `Authenticating with ${biometricType}...`}
          </Text>
        </View>

        {/* PIN Dots or Biometric Scanning View */}
        {showPinPad || !isSupported ? (
          <Animated.View style={[styles.dotsRow, shakeAnimatedStyle]}>
            {dots.map((_, idx) => {
              const isActive = idx < pin.length;
              return (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    isActive && styles.dotActive,
                    pinError && styles.dotError,
                  ]}
                />
              );
            })}
          </Animated.View>
        ) : (
          <TouchableOpacity
            onPress={triggerBiometrics}
            activeOpacity={0.8}
            style={styles.biometricsCircle}
          >
            {isAuthenticating ? (
              <ActivityIndicator size="large" color="#ee4d2d" />
            ) : (
              <Fingerprint size={56} color="#ee4d2d" />
            )}
          </TouchableOpacity>
        )}

        {/* Keypad or Fallback Buttons */}
        {showPinPad || !isSupported ? (
          <View style={styles.keypad}>
            <View style={styles.keypadRow}>
              <KeypadButton val="1" />
              <KeypadButton val="2" />
              <KeypadButton val="3" />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton val="4" />
              <KeypadButton val="5" />
              <KeypadButton val="6" />
            </View>
            <View style={styles.keypadRow}>
              <KeypadButton val="7" />
              <KeypadButton val="8" />
              <KeypadButton val="9" />
            </View>
            <View style={styles.keypadRow}>
              {isSupported && isEnrolled ? (
                <TouchableOpacity
                  onPress={triggerBiometrics}
                  activeOpacity={0.7}
                  style={[styles.keypadBtn, styles.actionBtn]}
                >
                  <Fingerprint size={24} color="#f4f4f5" />
                </TouchableOpacity>
              ) : (
                <View style={[styles.keypadBtn, styles.actionBtn]} />
              )}

              <KeypadButton val="0" />

              <TouchableOpacity
                onPress={handleBackspace}
                activeOpacity={0.7}
                style={[styles.keypadBtn, styles.actionBtn]}
              >
                <Delete size={22} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowPinPad(true)}
            activeOpacity={0.85}
            style={styles.fallbackButton}
          >
            <KeyRound size={18} color="#f4f4f5" style={{ marginRight: 8 }} />
            <Text style={styles.fallbackButtonText}>
              Unlock with Security PIN
            </Text>
          </TouchableOpacity>
        )}

        {/* Footer Security Badge */}
        <View style={styles.footer}>
          <ShieldAlert size={14} color="#71717a" style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>Hardware vault protection active</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure OLED Black (#000000)
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 16,
  },
  logoBox: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
    color: '#a1a1aa',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  biometricsCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 36,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0d0d0d',
    borderWidth: 1.5,
    borderColor: '#1f1f1f',
  },
  dotActive: {
    backgroundColor: '#ee4d2d',
    borderColor: '#ff7a59',
  },
  dotError: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
  },
  fallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
  },
  fallbackButtonText: {
    fontSize: 14,
    fontFamily: 'Jakarta-SemiBold',
    color: '#ffffff',
  },
  keypad: {
    width: '100%',
    maxWidth: 280,
    gap: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  keypadBtn: {
    width: keypadButtonSize,
    height: keypadButtonSize,
    borderRadius: keypadButtonSize / 2,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadBtnText: {
    fontSize: 26,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
  },
  actionBtn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    color: '#71717a',
  },
});

export default BiometricLockOverlay;
