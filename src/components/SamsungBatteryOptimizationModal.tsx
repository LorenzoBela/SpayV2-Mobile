import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  Modal,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { BatteryCharging, ExternalLink, X } from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';

const STORAGE_KEY = 'spay_samsung_battery_guide_dismissed';

export default function SamsungBatteryOptimizationModal() {
  const [visible, setVisible] = useState(false);
  const { isDarkMode } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (Platform.OS !== 'android') return;

      const manufacturer = (Device.manufacturer || '').toLowerCase();
      const brand = (Device.brand || '').toLowerCase();
      const isSamsung = manufacturer.includes('samsung') || brand.includes('samsung');

      if (!isSamsung) return;

      try {
        const dismissed = await AsyncStorage.getItem(STORAGE_KEY);
        if (!dismissed && isMounted) {
          setVisible(true);
        }
      } catch {
        // Ignore storage read error
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          stiffness: 300,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropAnim.setValue(0);
      slideAnim.setValue(300);
    }
  }, [visible]);

  const handleDismiss = useCallback(async () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setVisible(false);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // Ignore storage write error
      }
    });
  }, [backdropAnim, slideAnim]);

  const handleOpenSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // Ignore linking error
    }
  }, []);

  if (!visible) return null;

  const colors = isDarkMode
    ? {
        backdrop: 'rgba(5, 8, 15, 0.78)',
        sheetBg: '#141a27',
        border: 'rgba(255, 255, 255, 0.08)',
        dragHandle: '#334155',
        title: '#f8fafc',
        body: '#94a3b8',
        cardBg: 'rgba(15, 23, 42, 0.65)',
        cardBorder: 'rgba(255, 255, 255, 0.06)',
        badgeBg: 'rgba(238, 77, 45, 0.12)',
        badgeText: '#ee4d2d',
        textStrong: '#f1f5f9',
        secondaryBtnBg: '#1e293b',
        secondaryBtnBorder: 'rgba(255, 255, 255, 0.08)',
        secondaryBtnText: '#94a3b8',
      }
    : {
        backdrop: 'rgba(15, 23, 42, 0.45)',
        sheetBg: '#ffffff',
        border: '#e2e8f0',
        dragHandle: '#cbd5e1',
        title: '#0f172a',
        body: '#64748b',
        cardBg: '#f8fafc',
        cardBorder: '#e2e8f0',
        badgeBg: 'rgba(238, 77, 45, 0.1)',
        badgeText: '#ee4d2d',
        textStrong: '#0f172a',
        secondaryBtnBg: '#f1f5f9',
        secondaryBtnBorder: '#e2e8f0',
        secondaryBtnText: '#475569',
      };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            backgroundColor: colors.backdrop,
            opacity: backdropAnim,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.sheetBg,
              borderColor: colors.border,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.safeAreaSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={[styles.dragIndicator, { backgroundColor: colors.dragHandle }]} />

              <View style={styles.headerRow}>
                <View style={styles.iconFrame}>
                  <BatteryCharging size={26} color="#ee4d2d" />
                </View>
                <Pressable
                  onPress={handleDismiss}
                  style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.5 : 1 }]}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={18} color={colors.body} />
                </Pressable>
              </View>

              <Text style={[styles.title, { color: colors.title }]}>
                Ensure Instant Notifications
              </Text>
              <Text style={[styles.description, { color: colors.body }]}>
                Samsung One UI may pause background activity. Whitelist S-Pay to ensure payment reminders and transaction updates arrive without delay:
              </Text>

              <View
                style={[
                  styles.stepsCard,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <View style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNum}>1</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.body }]}>
                    Open <Text style={[styles.boldText, { color: colors.textStrong }]}>Settings → Apps → S-Pay</Text>
                  </Text>
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNum}>2</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.body }]}>
                    Tap <Text style={[styles.boldText, { color: colors.textStrong }]}>Battery</Text> and set to{' '}
                    <Text style={styles.highlightText}>Unrestricted</Text>
                  </Text>
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNum}>3</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.body }]}>
                    Or add to <Text style={[styles.boldText, { color: colors.textStrong }]}>Never sleeping apps</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}
                  onPress={handleOpenSettings}
                  accessibilityRole="button"
                  accessibilityLabel="Open device settings"
                >
                  <ExternalLink size={17} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Open Device Settings</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    {
                      backgroundColor: colors.secondaryBtnBg,
                      borderColor: colors.secondaryBtnBorder,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                  onPress={handleDismiss}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss notification prompt"
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.secondaryBtnText }]}>
                    Got it, don't show again
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 16,
  },
  safeAreaSheet: {
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 22,
    alignItems: 'center',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  iconFrame: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(238, 77, 45, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  description: {
    fontSize: 13.5,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  stepsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Outfit-Bold',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 18,
  },
  boldText: {
    fontFamily: 'Jakarta-SemiBold',
  },
  highlightText: {
    color: '#ee4d2d',
    fontFamily: 'Jakarta-Bold',
  },
  buttonContainer: {
    width: '100%',
    gap: 8,
  },
  primaryButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#ee4d2d',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
  },
  secondaryButton: {
    width: '100%',
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 13.5,
    fontFamily: 'Outfit-SemiBold',
  },
});
