import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Fingerprint, Lock, ShieldAlert, X } from 'lucide-react-native';
import { useSecurityPin } from '../hooks/useSecurityPin';
import { getKeypadBottomPadding } from '../utils/safeArea';

const GRACE_PERIOD_MS = 30000; // 30 seconds

interface BiometricLockOverlayProps {
  children: React.ReactNode;
  sessionExists: boolean;
}

const { width } = Dimensions.get('window');
const keypadButtonSize = width < 380 ? 64 : 72;

const KeypadButton: React.FC<{ val: string; onPress: (val: string) => void }> = React.memo(({ val, onPress }) => (
  <TouchableOpacity
    onPress={() => onPress(val)}
    activeOpacity={0.7}
    style={styles.keypadBtn}
  >
    <Text style={styles.keypadBtnText}>{val}</Text>
  </TouchableOpacity>
));

export default function BiometricLockOverlay({ children, sessionExists }: BiometricLockOverlayProps) {
  const insets = useSafeAreaInsets();
  const [isLocked, setIsLocked] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [checkingBiometrics, setCheckingBiometrics] = useState(false);

  const { hasPin, verifyPin } = useSecurityPin();

  const shakeOffset = useSharedValue(0);
  const animatedShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  const triggerShake = () => {
    shakeOffset.value = withSequence(
      withTiming(-12, { duration: 50 }),
      withTiming(12, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withSpring(0)
    );
  };

  useEffect(() => {
    async function checkHardware() {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        setIsSupported(compatible);
        if (compatible) {
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          setIsEnrolled(enrolled);
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('Face ID');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('Fingerprint');
          }
        }
      } catch {
        setIsSupported(false);
      }
    }
    void checkHardware();
  }, []);

  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);
  const isPromptingRef = useRef<boolean>(false);
  const ignoreNextActiveRef = useRef<boolean>(false);

  const triggerBiometrics = useCallback(async () => {
    if (isPromptingRef.current) return;
    if (!isSupported || !isEnrolled) return;

    isPromptingRef.current = true;
    setCheckingBiometrics(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock S-Pay Security',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch {}
        setIsLocked(false);
        setPin('');
        setPinError(false);
      } else {
        try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); } catch {}
      }
    } catch (err) {
      console.warn('[BiometricLockOverlay] Auth error:', err);
    } finally {
      setCheckingBiometrics(false);
      setTimeout(() => {
        isPromptingRef.current = false;
      }, 1000);
    }
  }, [isSupported, isEnrolled]);

  const pinLengthRef = useRef(pin.length);
  pinLengthRef.current = pin.length;

  useEffect(() => {
    if (!sessionExists) {
      setIsLocked(false);
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    const shouldLock = (isSupported && isEnrolled) || hasPin;
    if (shouldLock) {
      setIsLocked(true);
      timeoutId = setTimeout(() => {
        void triggerBiometrics();
      }, 400);
    } else {
      setIsLocked(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sessionExists, isSupported, isEnrolled, hasPin, triggerBiometrics]);

  useEffect(() => {
    if (!sessionExists) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        if (isPromptingRef.current) {
          ignoreNextActiveRef.current = true;
        } else {
          lastBackgroundTime.current = Date.now();
        }
      } else if (nextAppState === 'active') {
        if (ignoreNextActiveRef.current || isPromptingRef.current) {
          ignoreNextActiveRef.current = false;
          appState.current = nextAppState;
          return;
        }

        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active' &&
          lastBackgroundTime.current
        ) {
          const elapsed = Date.now() - lastBackgroundTime.current;
          if (elapsed > GRACE_PERIOD_MS) {
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
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [sessionExists, isSupported, isEnrolled, hasPin, triggerBiometrics]);

  const handleKeyPress = useCallback((num: string) => {
    if (pinLengthRef.current >= 6) return;
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}
    setPin((prev) => (prev.length < 6 ? prev + num : prev));
    setPinError(false);
  }, []);

  const handleBackspace = useCallback(() => {
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}
    setPin((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
    setPinError(false);
  }, []);

  // Separate PIN verification async effect when 6 digits are typed
  useEffect(() => {
    if (pin.length !== 6 || !isLocked) return;
    let active = true;

    verifyPin(pin).then((valid) => {
      if (!active) return;
      if (valid) {
        try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch {}
        setIsLocked(false);
        setPin('');
      } else {
        try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch {}
        triggerShake();
        setPinError(true);
        setPin('');
      }
    }).catch(() => {
      if (active) {
        setPinError(true);
        setPin('');
      }
    });

    return () => {
      active = false;
    };
  }, [pin, isLocked, verifyPin]);

  if (!isLocked) {
    return <>{children}</>;
  }

  const dots = Array(6).fill(0);

  return (
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />
      )}

      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: getKeypadBottomPadding(insets.bottom),
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Lock size={32} color="#ee4d2d" strokeWidth={1.8} />
          </View>
          <Text style={styles.title}>S-PAY BIOMETRICS</Text>
          <Text style={styles.subtitle}>
            {pinError ? 'Incorrect PIN. Try Again.' : `Enter 6-digit PIN or use ${biometricType}`}
          </Text>
        </View>

        <Animated.View style={[styles.dotsRow, animatedShakeStyle]}>
          {dots.map((_, index) => {
            const isActive = index < pin.length;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isActive && styles.dotActive,
                  pinError && styles.dotError,
                ]}
              />
            );
          })}
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
            <TouchableOpacity
              onPress={triggerBiometrics}
              disabled={checkingBiometrics || (!isSupported && !isEnrolled)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.keypadBtn, styles.actionBtn]}
            >
              {checkingBiometrics ? (
                <ActivityIndicator size="small" color="#ee4d2d" />
              ) : (
                <Fingerprint size={24} color={isSupported && isEnrolled ? '#f8fafc' : '#475569'} />
              )}
            </TouchableOpacity>

            <KeypadButton val="0" onPress={handleKeyPress} />

            <TouchableOpacity
              onPress={handleBackspace}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.keypadBtn, styles.actionBtn]}
            >
              <X size={24} color="#f8fafc" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginTop: 12 },
  logoContainer: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(238, 77, 45, 0.12)', borderWidth: 1, borderColor: 'rgba(238, 77, 45, 0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontFamily: 'Outfit-Bold', color: '#f8fafc', letterSpacing: 2 },
  subtitle: { fontSize: 13, fontFamily: 'Jakarta-Medium', color: '#94a3b8', marginTop: 6, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 16, marginVertical: 24 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: '#475569', backgroundColor: 'transparent' },
  dotActive: { backgroundColor: '#ee4d2d', borderColor: '#ee4d2d' },
  dotError: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  keypad: { width: '100%', maxWidth: 320, paddingHorizontal: 16, gap: 16, alignSelf: 'center' },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  keypadBtn: {
    width: keypadButtonSize, height: keypadButtonSize, borderRadius: keypadButtonSize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.07)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  keypadBtnText: { fontSize: 26, fontFamily: 'Outfit-Bold', color: '#f8fafc' },
  actionBtn: { backgroundColor: 'transparent', borderColor: 'transparent' },
});
