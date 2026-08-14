import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
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
import { Lock, ShieldCheck, X, Delete } from 'lucide-react-native';
import { getKeypadBottomPadding } from '../utils/safeArea';

interface PinSetupModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
}

const { width } = Dimensions.get('window');
const keypadButtonSize = width < 380 ? 60 : 68;

const SetupKeypadButton: React.FC<{
  val: string;
  onPress: (val: string) => void;
}> = React.memo(({ val, onPress }) => (
  <TouchableOpacity
    onPress={() => onPress(val)}
    activeOpacity={0.7}
    style={styles.keypadBtn}
  >
    <Text style={styles.keypadBtnText}>{val}</Text>
  </TouchableOpacity>
));

export function PinSetupModal({ isVisible, onClose, onSuccess }: PinSetupModalProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const shakeOffset = useSharedValue(0);

  const stepTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearStepTimeout = () => {
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
      stepTimeoutRef.current = null;
    }
  };

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

  useEffect(() => {
    if (isVisible) {
      clearStepTimeout();
      setStep(1);
      setPin('');
      setConfirmPin('');
      setErrorMsg(null);
    }
    return () => clearStepTimeout();
  }, [isVisible]);

  const handleKeyPress = useCallback(async (num: string) => {
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}
    setErrorMsg(null);

    if (step === 1) {
      if (pin.length >= 6) return;
      const nextPin = pin + num;
      setPin(nextPin);

      if (nextPin.length === 6) {
        clearStepTimeout();
        stepTimeoutRef.current = setTimeout(() => {
          setStep(2);
        }, 150);
      }
    } else {
      if (confirmPin.length >= 6) return;
      const nextConfirm = confirmPin + num;
      setConfirmPin(nextConfirm);

      if (nextConfirm.length === 6) {
        if (nextConfirm === pin) {
          try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch {}
          onSuccess(nextConfirm);
          setPin('');
          setConfirmPin('');
        } else {
          try { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); } catch {}
          triggerShake();
          setErrorMsg('PINs do not match. Please try again.');
          setConfirmPin('');
          setPin('');
          clearStepTimeout();
          stepTimeoutRef.current = setTimeout(() => {
            setStep(1);
          }, 600);
        }
      }
    }
  }, [step, pin, confirmPin, onSuccess]);

  const handleBackspace = useCallback(async () => {
    try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}
    clearStepTimeout();
    setErrorMsg(null);
    if (step === 1) {
      if (pin.length > 0) {
        setPin((prev) => prev.slice(0, -1));
      }
    } else {
      if (confirmPin.length > 0) {
        setConfirmPin((prev) => prev.slice(0, -1));
      } else {
        setStep(1);
      }
    }
  }, [step, pin.length, confirmPin.length]);

  const currentPin = step === 1 ? pin : confirmPin;
  const dots = Array(6).fill(0);



  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16), paddingBottom: getKeypadBottomPadding(insets.bottom) }]}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <X size={22} color="#a1a1aa" />
          </TouchableOpacity>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step {step} of 2</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Title & Info */}
          <View style={styles.titleSection}>
            <View style={styles.iconBox}>
              {step === 1 ? (
                <Lock size={28} color="#f43f5e" />
              ) : (
                <ShieldCheck size={28} color="#22c55e" />
              )}
            </View>

            <Text style={styles.title}>
              {step === 1 ? 'Create 6-Digit PIN' : 'Confirm Security PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? 'Choose a 6-digit PIN to secure your hardware vault and transactions.'
                : 'Re-enter your 6-digit PIN to confirm setup.'}
            </Text>
          </View>

          {/* Passcode Dots with Shake */}
          <Animated.View style={[styles.dotsRow, shakeAnimatedStyle]}>
            {dots.map((_, index) => {
              const isActive = index < currentPin.length;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    isActive && (step === 1 ? styles.dotActive : styles.dotConfirmActive),
                    errorMsg ? styles.dotError : null,
                  ]}
                />
              );
            })}
          </Animated.View>

          {/* Error Feedback */}
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Keypad Grid */}
          <View style={styles.keypad}>
            <View style={styles.keypadRow}>
              <SetupKeypadButton val="1" onPress={handleKeyPress} />
              <SetupKeypadButton val="2" onPress={handleKeyPress} />
              <SetupKeypadButton val="3" onPress={handleKeyPress} />
            </View>
            <View style={styles.keypadRow}>
              <SetupKeypadButton val="4" onPress={handleKeyPress} />
              <SetupKeypadButton val="5" onPress={handleKeyPress} />
              <SetupKeypadButton val="6" onPress={handleKeyPress} />
            </View>
            <View style={styles.keypadRow}>
              <SetupKeypadButton val="7" onPress={handleKeyPress} />
              <SetupKeypadButton val="8" onPress={handleKeyPress} />
              <SetupKeypadButton val="9" onPress={handleKeyPress} />
            </View>
            <View style={styles.keypadRow}>
              <View style={[styles.keypadBtn, styles.actionBtn]} />
              <SetupKeypadButton val="0" onPress={handleKeyPress} />
              <TouchableOpacity
                onPress={handleBackspace}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.keypadBtn, styles.actionBtn]}
              >
                <Delete size={24} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure OLED Black (#000000)
  },
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  stepBadgeText: {
    fontSize: 12,
    fontFamily: 'Jakarta-SemiBold',
    color: '#e4e4e7',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 10,
  },
  titleSection: {
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Regular',
    color: '#a1a1aa',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 24,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0d0d0d',
    borderWidth: 1.5,
    borderColor: '#1f1f1f',
  },
  dotActive: {
    backgroundColor: '#f43f5e',
    borderColor: '#fb7185',
  },
  dotConfirmActive: {
    backgroundColor: '#22c55e',
    borderColor: '#4ade80',
  },
  dotError: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Jakarta-SemiBold',
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    alignSelf: 'center',
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
});

export default PinSetupModal;
