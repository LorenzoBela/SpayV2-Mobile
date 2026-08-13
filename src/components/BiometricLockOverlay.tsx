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

// KeypadButton component extracted OUT of parent to prevent re-declaration crash
const KeypadButton: React.FC<{ val: string; onPress: (val: string) => void }> = React.memo(({ val, onPress }) => (
  <TouchableOpacity
    onPress={() => onPress(val)}
    activeOpacity={0.7}
    style={styles.keypadBtn}
  >
    <Text style={styles.keypadBtnText}>{val}</Text>
  </TouchableOpacity>
));

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
  const isPromptingRef = useRef<boolean>(false);
  const ignoreNextActiveRef = useRef<boolean>(false);
  const hasCheckedInitialLock = useRef<boolean>(false);
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
    if (!isSupported || !isEnrolled || isPromptingRef.current) {
      if (!isSupported || !isEnrolled) setShowPinPad(true);
      return;
    }

    isPromptingRef.current = true;
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
      setTimeout(() => {
        isPromptingRef.current = false;
      }, 1000);
    }
  }, [isSupported, isEnrolled, authenticate]);

  useEffect(() => {
    if (!sessionExists) {
      setIsLocked(false);
      hasCheckedInitialLock.current = false;
      return;
    }

    if (hasCheckedInitialLock.current) return;

    const shouldLock = (isSupported && isEnrolled) || hasPin;
    if (shouldLock) {
      hasCheckedInitialLock.current = true;
      setIsLocked(true);
      setTimeout(() => {
        void triggerBiometrics();
      }, 400);
    } else {
      setIsLocked(false);
    }
  }, [sessionExists, isSupported, isEnrolled, hasPin, triggerBiometrics]);

  useEffect(() => {
    if (!sessionExists) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        if (isPromptingRef.current) {
          ignoreNextActiveRef.current = true;
        }
      } else if (nextAppState === 'active') {
        if (ignoreNextActiveRef.current || isPromptingRef.current) {
          ignoreNextActiveRef.current = false;
          appState.current = nextAppState;
          return;
        }

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
            }, 400);
          }
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [sessionExists, isSupported, isEnrolled, hasPin, triggerBiometrics]);

  const handleKeyPress = useCallback(async (num: string) => {
    setPin((prevPin) => {
      if (prevPin.length >= 6) return prevPin;
      const nextPin = prevPin + num;
      setPinError(false);

      if (nextPin.length === 6) {
        verifyPin(nextPin).then((valid) => {
          if (valid) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsLocked(false);
            setPin('');
          } else {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            triggerShake();
            setPinError(true);
            setPin('');
          }
        }).catch(() => {
          setPinError(true);
          setPin('');
        });
      }
      return nextPin;
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [verifyPin]);

  const handleBackspace = useCallback(async () => {
    setPin((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
    setPinError(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  if (!isLocked) {
    return <>{children}</>;
  }

  const dots = Array(6).fill(0);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Lock size={28} color="#ee4d2d" strokeWidth={2} />
        </View>
        <Text style={styles.title}>S-PAY VAULT</Text>
        <Text style={styles.subtitle}>
          {showPinPad
            ? pinError
              ? 'Incorrect Security PIN'
              : 'Enter your 6-digit PIN to access'
            : isAuthenticating
            ? `Authenticating with ${biometricType}...`
            : 'Biometric verification required'}
        </Text>
      </View>

      <Animated.View style={[styles.passcodeContainer, shakeAnimatedStyle]}>
        <View style={styles.dotsRow}>
          {dots.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx < pin.length && styles.dotFilled,
                pinError && styles.dotError,
              ]}
            />
          ))}
        </View>
      </Animated.View>

      <View style={styles.keypad}>
        <View style={styles.keypadRow}>
          <KeypadButton val="1" onPress={handleKeyPress} />
          <KeypadButton val="2" onPress={handleKeyPress} />
          <KeypadButton val="3" onPress={handleKeyPress} />
        </View>
        <View style={styles.keypadRow}>
          <KeypadButton val="4" onPress={handleKeyPress} />
          <KeypadButton val="5" onPress={handleKeyPress} />
          <KeypadButton val="6" onPress={handleKeyPress} />
        </View>
        <View style={styles.keypadRow}>
          <KeypadButton val="7" onPress={handleKeyPress} />
          <KeypadButton val="8" onPress={handleKeyPress} />
          <KeypadButton val="9" onPress={handleKeyPress} />
        </View>
        <View style={styles.keypadRow}>
          {isSupported && isEnrolled ? (
            <TouchableOpacity
              onPress={triggerBiometrics}
              disabled={isAuthenticating}
              activeOpacity={0.7}
              style={[styles.keypadBtn, styles.biometricsCircle]}
            >
              {isAuthenticating ? (
                <ActivityIndicator color="#ee4d2d" size="small" />
              ) : (
                <Fingerprint size={26} color="#ee4d2d" />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.keypadBtnPlaceholder} />
          )}

          <KeypadButton val="0" onPress={handleKeyPress} />

          <TouchableOpacity
            onPress={handleBackspace}
            activeOpacity={0.7}
            style={styles.keypadBtn}
          >
            <Delete size={22} color="#f8fafc" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090A0F', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginTop: 24 },
  logoContainer: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(238, 77, 45, 0.12)', borderWidth: 1, borderColor: 'rgba(238, 77, 45, 0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#f8fafc', letterSpacing: 2 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
  passcodeContainer: { marginVertical: 20 },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: '#475569', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#ee4d2d', borderColor: '#ee4d2d' },
  dotError: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  keypad: { width: '100%', gap: 16, marginBottom: 32 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  keypadBtn: {
    width: keypadButtonSize, height: keypadButtonSize, borderRadius: keypadButtonSize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.07)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  keypadBtnText: { fontSize: 26, fontWeight: '700', color: '#f8fafc' },
  keypadBtnPlaceholder: { width: keypadButtonSize, height: keypadButtonSize },
  biometricsCircle: { backgroundColor: 'rgba(238, 77, 45, 0.15)', borderColor: 'rgba(238, 77, 45, 0.4)' },
});
