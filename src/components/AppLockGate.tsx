import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as Device from 'expo-device';
import { BlurView } from 'expo-blur';
import { Fingerprint, Lock, ShieldAlert, X } from 'lucide-react-native';

const BIOMETRIC_EMAIL_KEY = 'biometric_email';
const BIOMETRIC_PIN_KEY = 'biometric_pin';
const GRACE_PERIOD_MS = 30000; // 30 seconds

interface AppLockGateProps {
  children: React.ReactNode;
  sessionExists: boolean;
}

const { width } = Dimensions.get('window');
const keypadButtonSize = width < 380 ? 64 : 72;

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

export default function AppLockGate({ children, sessionExists }: AppLockGateProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isRootedWarning, setIsRootedWarning] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [checkingBiometrics, setCheckingBiometrics] = useState(false);
  const [hasBiometricSetup, setHasBiometricSetup] = useState(false);

  useEffect(() => {
    async function checkRootStatus() {
      try {
        if ('isRootedAsync' in Device && typeof (Device as any).isRootedAsync === 'function') {
          const isRooted = await (Device as any).isRootedAsync();
          if (isRooted) {
            setIsRootedWarning(true);
          }
        }
      } catch {
        // Ignore check failure
      }
    }
    void checkRootStatus();
  }, []);

  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);
  const isPromptingRef = useRef<boolean>(false);
  const ignoreNextActiveRef = useRef<boolean>(false);

  const triggerBiometricUnlock = useCallback(async () => {
    if (isPromptingRef.current) return;
    isPromptingRef.current = true;
    setCheckingBiometrics(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock S-Pay',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsLocked(false);
        setPin('');
        setPinError(false);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      console.warn('[AppLockGate] Biometric unlock error:', error);
    } finally {
      setCheckingBiometrics(false);
      setTimeout(() => {
        isPromptingRef.current = false;
      }, 1000);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const checkBiometricStatus = async () => {
      if (!sessionExists) {
        if (active) {
          setIsLocked(false);
          setHasBiometricSetup(false);
        }
        return;
      }

      try {
        const savedEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const setup = !!(savedEmail && hasHardware && isEnrolled);
        
        if (active) {
          setHasBiometricSetup(setup);
          if (setup) {
            setIsLocked(true);
            setTimeout(() => {
              void triggerBiometricUnlock();
            }, 400);
          } else {
            setIsLocked(false);
          }
        }
      } catch (err) {
        console.warn('[AppLockGate] Failed to check biometric setup status:', err);
      }
    };

    void checkBiometricStatus();
    return () => {
      active = false;
    };
  }, [sessionExists, triggerBiometricUnlock]);

  useEffect(() => {
    if (!sessionExists || !hasBiometricSetup) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
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
          nextAppState === 'active'
        ) {
          if (lastBackgroundTime.current) {
            const elapsed = Date.now() - lastBackgroundTime.current;
            if (elapsed > GRACE_PERIOD_MS) {
              setIsLocked(true);
              setPin('');
              setPinError(false);
              setTimeout(() => {
                void triggerBiometricUnlock();
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
  }, [sessionExists, hasBiometricSetup, triggerBiometricUnlock]);

  const handleKeyPress = useCallback(async (num: string) => {
    setPin((prevPin) => {
      if (prevPin.length >= 6) return prevPin;
      const nextPin = prevPin + num;
      setPinError(false);

      if (nextPin.length === 6) {
        SecureStore.getItemAsync(BIOMETRIC_PIN_KEY).then((savedPin) => {
          if (nextPin === savedPin) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsLocked(false);
            setPin('');
          } else {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
  }, []);

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
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />
      )}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Lock size={32} color="#ee4d2d" strokeWidth={1.8} />
            </View>
            <Text style={styles.title}>S-PAY SECURE</Text>
            <Text style={styles.subtitle}>
              {pinError ? 'Incorrect Passcode. Try Again.' : 'Enter your 6-digit passcode to unlock.'}
            </Text>
          </View>

          <View style={styles.dotsRow}>
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
          </View>

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
                onPress={triggerBiometricUnlock}
                disabled={checkingBiometrics}
                activeOpacity={0.7}
                style={[styles.keypadBtn, styles.actionBtn]}
              >
                {checkingBiometrics ? (
                  <ActivityIndicator size="small" color="#ee4d2d" />
                ) : (
                  <Fingerprint size={24} color="#f8fafc" />
                )}
              </TouchableOpacity>

              <KeypadButton val="0" onPress={handleKeyPress} />

              <TouchableOpacity
                onPress={handleBackspace}
                activeOpacity={0.7}
                style={[styles.keypadBtn, styles.actionBtn]}
              >
                <X size={24} color="#f8fafc" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 24 },
  header: { alignItems: 'center', marginTop: 12 },
  logoContainer: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(238, 77, 45, 0.12)', borderWidth: 1, borderColor: 'rgba(238, 77, 45, 0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#f8fafc', letterSpacing: 2 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 16, marginVertical: 24 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: '#475569', backgroundColor: 'transparent' },
  dotActive: { backgroundColor: '#ee4d2d', borderColor: '#ee4d2d' },
  dotError: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  keypad: { width: '100%', paddingHorizontal: 32, gap: 16 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  keypadBtn: {
    width: keypadButtonSize, height: keypadButtonSize, borderRadius: keypadButtonSize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.07)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  keypadBtnText: { fontSize: 26, fontWeight: '700', color: '#f8fafc' },
  actionBtn: { backgroundColor: 'transparent', borderColor: 'transparent' },
});
