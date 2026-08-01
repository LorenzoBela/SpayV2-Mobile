import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  CreditCard,
  Bot,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Lock,
  Wallet,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PinSetupModal from '../../components/PinSetupModal';
import { useSecurityPin } from '../../hooks/useSecurityPin';

export const ONBOARDING_COMPLETED_KEY = 'has_completed_onboarding';

interface OnboardingScreenProps {
  onComplete?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    id: 'slide-1',
    icon: Wallet,
    accentColor: '#ee4d2d',
    title: 'Smart Expense &\nInstallment Tracking',
    subtitle:
      'Seamlessly manage your monthly spending, credit card balances, and multi-month installment schedules in one unified dark dashboard.',
    badge: 'AUTOMATED TRACKING',
  },
  {
    id: 'slide-2',
    icon: Bot,
    accentColor: '#3b82f6',
    title: 'NootAI Financial\nAssistant Preview',
    subtitle:
      'Get personalized budget recommendations, anomaly alerts, and instant breakdown of your cash flows powered by AI.',
    badge: 'AI FINANCIAL ADVISOR',
  },
  {
    id: 'slide-3',
    icon: ShieldCheck,
    accentColor: '#10b981',
    title: 'Vault Security &\nHardware Encryption',
    subtitle:
      'Your financial records are protected by hardware biometrics, SHA-256 PIN hashing, and client-side encrypted storage.',
    badge: 'BANK-GRADE VAULT',
  },
];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { setPin } = useSecurityPin();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeIndex && index >= 0 && index < SLIDES.length) {
      setActiveIndex(index);
    }
  };

  const handleNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeIndex < SLIDES.length - 1) {
      const nextIndex = activeIndex + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      setActiveIndex(nextIndex);
    } else {
      // Final slide: trigger PIN Setup Modal
      setShowPinModal(true);
    }
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPinModal(true);
  };

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (e) {
      console.warn('[OnboardingScreen] Error saving onboarding state:', e);
    }
    if (onComplete) {
      onComplete();
    }
  };

  const handlePinSuccess = async (newPin: string) => {
    try {
      await setPin(newPin);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn('[OnboardingScreen] Error setting PIN:', e);
    } finally {
      setShowPinModal(false);
      await finishOnboarding();
    }
  };

  const handlePinModalClose = async () => {
    setShowPinModal(false);
    await finishOnboarding();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Top Bar with Skip */}
      <View style={styles.topBar}>
        <View style={styles.brandTitleRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandTitle}>S-PAY</Text>
        </View>
        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Carousel Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((slide) => {
          const IconComponent = slide.icon;
          return (
            <View key={slide.id} style={styles.slideContainer}>
              {/* Hero Icon Card */}
              <View style={styles.heroCard}>
                <View style={styles.iconCircle}>
                  <IconComponent size={48} color="#f4f4f5" />
                </View>
                <View style={styles.badgeContainer}>
                  <Sparkles size={12} color="#a1a1aa" style={{ marginRight: 6 }} />
                  <Text style={styles.badgeText}>{slide.badge}</Text>
                </View>
              </View>

              {/* Text Content */}
              <View style={styles.textContent}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Bar: Animated Dots + Action CTA */}
      <View style={styles.bottomBar}>
        {/* Pagination Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, idx) => {
            const isActive = idx === activeIndex;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>

        {/* Solid Pill CTA Button */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.85}
          style={styles.ctaButton}
        >
          <Text style={styles.ctaText}>
            {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
          <ChevronRight size={18} color="#ffffff" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* PIN Setup Modal */}
      <PinSetupModal
        isVisible={showPinModal}
        onClose={handlePinModalClose}
        onSuccess={handlePinSuccess}
      />
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
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ee4d2d',
  },
  brandTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Jakarta-SemiBold',
    color: '#a1a1aa',
  },
  scrollView: {
    flex: 1,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  heroCard: {
    width: 140,
    height: 140,
    borderRadius: 36,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: '#a1a1aa',
    letterSpacing: 1,
  },
  textContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Regular',
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: '#ee4d2d',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#1f1f1f',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ee4d2d',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
  },
});

export default OnboardingScreen;
