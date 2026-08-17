import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, AppState, Animated, Easing } from 'react-native';
import { Wallet, ShieldCheck } from 'lucide-react-native';

/**
 * Multitasking Privacy Curtain (App Switcher Shield)
 * Instantly obscures balances, accounts, and PIN screens when the app
 * is minimized or viewed in the Android Recents / iOS multitasking switcher.
 */
export default function PrivacyCurtain() {
  const [isShieldVisible, setIsShieldVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        // Immediate synchronous shielding to beat OS screenshot timing
        setIsShieldVisible(true);
        fadeAnim.setValue(1);
      } else if (nextAppState === 'active') {
        // Smooth 150ms reveal when returning to the app
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(() => {
          setIsShieldVisible(false);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fadeAnim]);

  if (!isShieldVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents={isShieldVisible ? 'auto' : 'none'}
    >
      <View style={styles.content}>
        <View style={styles.iconBox}>
          <Wallet size={36} color="#ee4d2d" strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>S-Pay</Text>
        <View style={styles.shieldRow}>
          <ShieldCheck size={14} color="#22c55e" strokeWidth={2} />
          <Text style={styles.shieldText}>Financial Privacy Shield</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 999999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(238, 77, 45, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  shieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shieldText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    color: '#94a3b8',
  },
});
