import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
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
import { ShieldCheck, Fingerprint, Delete, KeyRound, X } from 'lucide-react-native';
import useBiometrics from '../hooks/useBiometrics';
import useSecurityPin from '../hooks/useSecurityPin';

export interface BiometricReAuthModalProps {
  visible: boolean;
  title?: string;
  description?: string;
  email?: string;
  onDismiss: () => void;
  onSuccess: (token?: string) => void;
}

const { width } = Dimensions.get('window');
const keypadButtonSize = width < 380 ? 60 : 68;
const DOTS_ARRAY = Array(6).fill(0);

const ReAuthKeypadButton: React.FC<{
  val: string;
  onPress: (val: string) => void;
  disabled?: boolean;
}> = React.memo(({ val, onPress, disabled }) => (
  <TouchableOpacity
    onPress={() => onPress(val)}
    activeOpacity={0.7}
    disabled={disabled}
    style={styles.keypadBtn}
  >
    <Text style={styles.keypadBtnText}>{val}</Text>
  </TouchableOpacity>
));

export function BiometricReAuthModal({
  visible,
  title = 'Security Re-Authentication',
  description = 'Please verify your identity to proceed with this sensitive action.',
  onDismiss,
  onSuccess,
}: BiometricReAuthModalProps) {
  const insets = useSafeAreaInsets();
  const { isSupported, isEnrolled, biometricType, authenticate } = useBiometrics();
  const { verifyPin } = useSecurityPin();

  const [showPinPad, setShowPinPad] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

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

  const isPromptingRef = useRef<boolean>(false);

  const triggerBiometrics = useCallback(async () => {
    if (!isSupported || !isEnrolled || isPromptingRef.current) {
      if (!isSupported || !isEnrolled) setShowPinPad(true);
      return;
    }

    isPromptingRef.current = true;
    setIsAuthenticating(true);
    setPinError(null);

    try {
      const res = await authenticate(title);
      if (res.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPin('');
        setPinError(null);
        onSuccess();
        onDismiss();
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setShowPinPad(true);
        if (res.error && !res.error.toLowerCase().includes('cancel')) {
          setPinError(res.error);
        }
      }
    } catch (e: any) {
      console.warn('[BiometricReAuthModal] Biometrics error:', e);
      setShowPinPad(true);
    } finally {
      setIsAuthenticating(false);
      setTimeout(() => {
        isPromptingRef.current = false;
      }, 500);
    }
  }, [isSupported, isEnrolled, authenticate, title, onSuccess, onDismiss]);

  // Auto-trigger biometric scan when modal becomes visible
  useEffect(() => {
    if (visible) {
      setPin('');
      setPinError(null);
      if (isSupported && isEnrolled) {
        setShowPinPad(false);
        const timer = setTimeout(() => {
          void triggerBiometrics();
        }, 200);
        return () => clearTimeout(timer);
      } else {
        setShowPinPad(true);
      }
    }
  }, [visible, isSupported, isEnrolled, triggerBiometrics]);

  const handleKeyPress = useCallback(async (num: string) => {
    if (pin.length >= 6 || isAuthenticating) return;
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}

    const nextPin = pin + num;
    setPin(nextPin);
    setPinError(null);

    if (nextPin.length === 6) {
      setIsAuthenticating(true);
      try {
        const valid = await verifyPin(nextPin);
        if (valid) {
          try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch {}
          setPin('');
          setPinError(null);
          onSuccess();
          onDismiss();
        } else {
          try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch {}
          triggerShake();
          setPinError('Incorrect 6-digit Security PIN');
          setPin('');
        }
      } catch (err: any) {
        setPinError(err?.message || 'PIN verification failed');
        setPin('');
      } finally {
        setIsAuthenticating(false);
      }
    }
  }, [pin, isAuthenticating, verifyPin, onSuccess, onDismiss, triggerShake]);

  const handleBackspace = useCallback(async () => {
    if (pin.length === 0 || isAuthenticating) return;
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}
    setPin((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
    setPinError(null);
  }, [pin.length, isAuthenticating]);

  const handleClose = () => {
    if (isAuthenticating) return;
    setPin('');
    setPinError(null);
    onDismiss();
  };

  const dots = DOTS_ARRAY;



  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <ShieldCheck size={24} color="#ee4d2d" />
            </View>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isAuthenticating}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>
            {pinError
              ? pinError
              : showPinPad
              ? 'Enter your 6-digit security PIN to confirm.'
              : description}
          </Text>

          {/* Biometrics View or PIN Keypad */}
          {!showPinPad && isSupported && isEnrolled ? (
            <View style={styles.biometricContainer}>
              <TouchableOpacity
                onPress={triggerBiometrics}
                activeOpacity={0.8}
                disabled={isAuthenticating}
                style={styles.biometricCircle}
              >
                {isAuthenticating ? (
                  <ActivityIndicator size="large" color="#ee4d2d" />
                ) : (
                  <Fingerprint size={56} color="#ee4d2d" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowPinPad(true)}
                activeOpacity={0.85}
                style={styles.fallbackBtn}
              >
                <KeyRound size={16} color="#f4f4f5" style={{ marginRight: 8 }} />
                <Text style={styles.fallbackBtnText}>Use 6-Digit PIN</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pinContainer}>
              <Animated.View style={[styles.dotsRow, shakeAnimatedStyle]}>
                {dots.map((_, idx) => {
                  const isActive = idx < pin.length;
                  const isError = Boolean(pinError);
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.dot,
                        isActive && styles.dotActive,
                        isError && styles.dotError,
                      ]}
                    />
                  );
                })}
              </Animated.View>

              <View style={styles.keypad}>
                <View style={styles.keypadRow}>
                  <ReAuthKeypadButton val="1" onPress={handleKeyPress} disabled={isAuthenticating} />
                  <ReAuthKeypadButton val="2" onPress={handleKeyPress} disabled={isAuthenticating} />
                  <ReAuthKeypadButton val="3" onPress={handleKeyPress} disabled={isAuthenticating} />
                </View>
                <View style={styles.keypadRow}>
                  <ReAuthKeypadButton val="4" onPress={handleKeyPress} disabled={isAuthenticating} />
                  <ReAuthKeypadButton val="5" onPress={handleKeyPress} disabled={isAuthenticating} />
                  <ReAuthKeypadButton val="6" onPress={handleKeyPress} disabled={isAuthenticating} />
                </View>
                <View style={styles.keypadRow}>
                  <ReAuthKeypadButton val="7" onPress={handleKeyPress} disabled={isAuthenticating} />
                  <ReAuthKeypadButton val="8" onPress={handleKeyPress} disabled={isAuthenticating} />
                  <ReAuthKeypadButton val="9" onPress={handleKeyPress} disabled={isAuthenticating} />
                </View>
                <View style={styles.keypadRow}>
                  {isSupported && isEnrolled ? (
                    <TouchableOpacity
                      onPress={triggerBiometrics}
                      activeOpacity={0.7}
                      disabled={isAuthenticating}
                      style={[styles.keypadBtn, styles.actionBtn]}
                    >
                      <Fingerprint size={24} color="#f4f4f5" />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.keypadBtn, styles.actionBtn]} />
                  )}

                  <ReAuthKeypadButton val="0" onPress={handleKeyPress} disabled={isAuthenticating} />

                  <TouchableOpacity
                    onPress={handleBackspace}
                    activeOpacity={0.7}
                    disabled={isAuthenticating}
                    style={[styles.keypadBtn, styles.actionBtn]}
                  >
                    <Delete size={22} color="#a1a1aa" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Cancel Action */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleClose}
            disabled={isAuthenticating}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure OLED Black (#000000)
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0d0d0d', // Card surface
    borderColor: '#1f1f1f', // Hairline border
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  biometricContainer: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 12,
  },
  biometricCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  fallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  fallbackBtnText: {
    fontSize: 13,
    fontFamily: 'Jakarta-SemiBold',
    color: '#ffffff',
  },
  pinContainer: {
    alignItems: 'center',
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 24,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000000',
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
  keypad: {
    width: '100%',
    maxWidth: 270,
    gap: 14,
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  keypadBtn: {
    width: keypadButtonSize,
    height: keypadButtonSize,
    borderRadius: keypadButtonSize / 2,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadBtnText: {
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
  },
  actionBtn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
});

export default BiometricReAuthModal;
