import React, { useState, useEffect, useRef } from 'react';
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

export default function AppLockGate({ children, sessionExists }: AppLockGateProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [checkingBiometrics, setCheckingBiometrics] = useState(false);
  const [hasBiometricSetup, setHasBiometricSetup] = useState(false);

  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);

  // Trigger biometrics authentication
  const triggerBiometricUnlock = async () => {
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
    }
  };

  // Check setup status on load or session state change
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
            // Trigger biometrics immediately after status check
            setTimeout(() => {
              void triggerBiometricUnlock();
            }, 300);
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
  }, [sessionExists]);

  // Monitor AppState changes for grace period lock trigger
  useEffect(() => {
    if (!sessionExists || !hasBiometricSetup) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
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
            }, 300);
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        lastBackgroundTime.current = Date.now();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [sessionExists, hasBiometricSetup]);

  const handleKeyPress = async (num: string) => {
    if (pin.length >= 6) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const nextPin = pin + num;
    setPin(nextPin);
    setPinError(false);

    if (nextPin.length === 6) {
      try {
        const savedPin = await SecureStore.getItemAsync(BIOMETRIC_PIN_KEY);
        if (nextPin === savedPin) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsLocked(false);
          setPin('');
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPinError(true);
          setPin(''); // Clear input on error
        }
      } catch (err) {
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

  // Visual dot renders for passcode feedback
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
    <View style={styles.container}>
      {/* Background Mask View with Fallback for iOS Blur */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0b0f19' }]} />
      )}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header Status */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Lock size={32} color="#ee4d2d" strokeWidth={1.8} />
            </View>
            <Text style={styles.title}>S-PAY SECURE</Text>
            <Text style={styles.subtitle}>
              {pinError ? 'Incorrect Passcode. Try Again.' : 'Enter your 6-digit passcode to unlock.'}
            </Text>
          </View>

          {/* Code Indicators */}
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

          {/* Premium Circular Keypad */}
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
              {/* Left action: Trigger biometrics again */}
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

              <KeypadButton val="0" />

              {/* Right action: Delete digit */}
              <TouchableOpacity
                onPress={handleBackspace}
                activeOpacity={0.7}
                style={[styles.keypadBtn, styles.actionBtn]}
              >
                <X size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <ShieldAlert size={14} color="#64748b" style={styles.footerIcon} />
            <Text style={styles.footerText}>Biometric security activated</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070c',
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
    marginTop: 20,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(238, 77, 45, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    color: '#f8fafc',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
    color: '#94a3b8',
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 40,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  dotActive: {
    backgroundColor: '#ee4d2d',
    borderColor: '#ff7a59',
  },
  dotError: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
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
    backgroundColor: '#161c2a',
    borderColor: '#2d3748',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadBtnText: {
    fontSize: 26,
    fontFamily: 'Outfit-Bold',
    color: '#f8fafc',
  },
  actionBtn: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  footerIcon: {
    marginRight: 6,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    color: '#64748b',
  },
});
