import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../navigation/navigationTypes';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Easing,
} from 'react-native';
import {
  AlertCircle,
  RefreshCw,
  Wallet,
  CreditCard,
  BellRing,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';

export interface AdSlideItem {
  id: number;
  tag: string;
  title: string;
  desc: string;
  icon: React.ComponentType<any>;
}

const AD_SLIDES: AdSlideItem[] = [
  {
    id: 1,
    tag: 'FLEXIBLE FINANCING',
    title: '0% Bi-Monthly Repayments',
    desc: 'Spread your shopping expenses into flexible installments with zero hidden fees.',
    icon: CreditCard,
  },
  {
    id: 2,
    tag: 'HARDWARE ALERTS',
    title: 'Smart Due-Date Reminders',
    desc: 'Receive direct FCM system push alerts prior to billing dates to protect your credit.',
    icon: BellRing,
  },
  {
    id: 3,
    tag: 'OFFLINE ARCHITECTURE',
    title: 'Offline-Ready Ledgers',
    desc: 'Your payment schedules and balances are cached locally for zero-signal reliability.',
    icon: ShieldCheck,
  },
  {
    id: 4,
    tag: 'AI FINANCIAL ASSISTANT',
    title: 'NootAI Smart Analytics',
    desc: 'Get automated budget analysis, repayment forecasts, and credit extension insights.',
    icon: Sparkles,
  },
];

interface PremiumLoaderProps {
  title?: string;
  subtitle?: string;
  text?: string;
  progress?: number;
  error?: string | null;
  onRetry?: () => void;
  timeoutMs?: number;
  useSystemFonts?: boolean;
}

export default function PremiumLoader({
  title: titleProp = 'Initializing Workspace',
  subtitle = 'Syncing account configurations...',
  text,
  progress,
  error,
  onRetry,
  timeoutMs = 12000,
  useSystemFonts = false,
}: PremiumLoaderProps) {
  const title = text || titleProp;
  const [trackWidth, setTrackWidth] = useState(0);
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext ? themeContext.isDarkMode : true;
  const [isTimeout, setIsTimeout] = useState(false);
  const [activeAdIndex, setActiveAdIndex] = useState(0);

  // Animation values
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.97)).current;
  const indeterminateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(0.75)).current;

  // Carousel transition animations
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const slideTranslateY = useRef(new Animated.Value(0)).current;

  // Modern entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardScale]);

  // Subtle breathing pulse for brand icon
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.75,
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseOpacity]);

  // Automatic Ads Carousel rotation (every 3.6s)
  useEffect(() => {
    const adTimer = setInterval(() => {
      // 1. Fade out and translate up slightly
      Animated.parallel([
        Animated.timing(slideOpacity, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideTranslateY, {
          toValue: -8,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 2. Next slide
        setActiveAdIndex((prev) => (prev + 1) % AD_SLIDES.length);
        slideTranslateY.setValue(8);

        // 3. Fade in and slide to 0
        Animated.parallel([
          Animated.timing(slideOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slideTranslateY, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 3600);

    return () => clearInterval(adTimer);
  }, [slideOpacity, slideTranslateY]);

  const font = (styleName: any) => {
    const originalStyle = (styles as Record<string, any>)[styleName];
    if (useSystemFonts) {
      const { fontFamily, ...rest } = originalStyle;
      const isBold = fontFamily && (fontFamily.includes('Bold') || fontFamily.includes('SemiBold'));
      return {
        ...rest,
        fontWeight: isBold ? '600' : '400',
      };
    }
    return originalStyle;
  };

  // Indeterminate progress animation
  useEffect(() => {
    if (progress === undefined) {
      const runIndeterminate = () => {
        indeterminateAnim.setValue(0);
        Animated.timing(indeterminateAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }).start(() => {
          runIndeterminate();
        });
      };
      runIndeterminate();
    }
  }, [progress, indeterminateAnim]);

  // Deterministic progress animation
  useEffect(() => {
    if (progress !== undefined) {
      const bounded = Math.max(0, Math.min(1, progress));
      Animated.timing(progressAnim, {
        toValue: bounded,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [progress, progressAnim]);

  // Timeout monitoring for retry states
  useEffect(() => {
    if (!error && timeoutMs > 0 && onRetry) {
      const timer = setTimeout(() => {
        setIsTimeout(true);
      }, timeoutMs);
      return () => clearTimeout(timer);
    }
  }, [error, timeoutMs, onRetry]);

  const indeterminateTranslateX = indeterminateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [trackWidth ? -trackWidth * 0.4 : -100, trackWidth ? trackWidth : 300],
  });

  const deterministicTranslateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-trackWidth / 2, 0],
  });

  const getProgressStyle = () => {
    if (progress !== undefined) {
      return {
        width: '100%',
        transform: [
          { translateX: trackWidth ? deterministicTranslateX : 0 },
          { scaleX: progressAnim },
        ],
      } as any;
    } else {
      return {
        width: '35%',
        transform: [{ translateX: indeterminateTranslateX }],
      } as any;
    }
  };

  const currentAd = AD_SLIDES[activeAdIndex];
  const AdIcon = currentAd.icon;
  const showErrorOrTimeout = error || isTimeout;
  const displayErrorMsg = error || 'Connection is taking longer than expected.';

  // Pure True OLED Pitch Black Theme
  const containerBg = isDarkMode ? '#000000' : '#f8fafc';
  const cardBg = isDarkMode ? '#090d16' : '#ffffff';
  const cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
  const adCardBg = isDarkMode ? '#0f172a' : '#f8fafc';
  const titleColor = isDarkMode ? '#f8fafc' : '#0f172a';
  const subtitleColor = isDarkMode ? '#94a3b8' : '#64748b';
  const barTrackBg = isDarkMode ? '#1e293b' : '#e2e8f0';

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      <Animated.View 
        style={[
          styles.card, 
          { 
            backgroundColor: cardBg, 
            borderColor: cardBorder,
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          }
        ]}
      >
        
        {/* Minimalist S-Pay Brand Icon */}
        <Animated.View 
          style={[
            styles.iconContainer, 
            { 
              opacity: pulseOpacity, 
              backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.1)' : 'rgba(238, 77, 45, 0.06)',
              borderColor: isDarkMode ? 'rgba(238, 77, 45, 0.25)' : 'rgba(238, 77, 45, 0.15)',
            }
          ]}
        >
          <Wallet size={26} color="#ee4d2d" strokeWidth={2.2} />
        </Animated.View>
        
        {/* Header Titles */}
        <View style={styles.header}>
          <Text style={[font('titleText'), { color: titleColor }]}>{title}</Text>
          <Text style={[font('subtitleText'), { color: subtitleColor }]} numberOfLines={2}>
            {showErrorOrTimeout ? displayErrorMsg : subtitle}
          </Text>
        </View>

        {/* Clean Sleek Progress Bar */}
        <View style={styles.barContainer}>
          <View
            style={[styles.barTrack, { backgroundColor: barTrackBg }]}
            onLayout={(e) => {
              setTrackWidth(e.nativeEvent.layout.width);
            }}
          >
            <Animated.View style={[styles.barFill, getProgressStyle()]} />
          </View>
          {progress !== undefined && (
            <Text style={[font('percentText'), { color: subtitleColor }]}>
              {Math.round((progress || 0) * 100)}%
            </Text>
          )}
        </View>

        {/* Retry State if timeout */}
        {showErrorOrTimeout ? (
          onRetry && (
            <TouchableOpacity
              onPress={() => {
                setIsTimeout(false);
                onRetry();
              }}
              activeOpacity={0.8}
              style={styles.retryButton}
            >
              <RefreshCw size={14} color="#ffffff" strokeWidth={2.2} />
              <Text style={font('retryText')}>Retry Connection</Text>
            </TouchableOpacity>
          )
        ) : (
          /* S-Pay Features & Ads Carousel */
          <Animated.View
            style={[
              styles.adCard,
              {
                backgroundColor: adCardBg,
                borderColor: cardBorder,
                opacity: slideOpacity,
                transform: [{ translateY: slideTranslateY }],
              },
            ]}
          >
            <View style={styles.adHeaderRow}>
              <View style={[styles.adIconBox, { backgroundColor: isDarkMode ? 'rgba(238, 77, 45, 0.12)' : 'rgba(238, 77, 45, 0.08)' }]}>
                <AdIcon size={16} color="#ee4d2d" strokeWidth={2} />
              </View>
              <View style={styles.adTitleCol}>
                <Text style={[styles.adTag, { color: isDarkMode ? '#f97316' : '#ea580c' }]}>{currentAd.tag}</Text>
                <Text style={[font('adTitle'), { color: titleColor }]} numberOfLines={1}>{currentAd.title}</Text>
              </View>
            </View>
            <Text style={[font('adDesc'), { color: subtitleColor }]} numberOfLines={2}>
              {currentAd.desc}
            </Text>
            
            {/* Carousel Dot Indicators */}
            <View style={styles.dotRow}>
              {AD_SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    activeAdIndex === i ? styles.dotActive : styles.dotInactive,
                    { backgroundColor: activeAdIndex === i ? '#ee4d2d' : (isDarkMode ? '#334155' : '#cbd5e1') },
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        )}

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
    gap: 5,
  },
  titleText: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  barContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  barTrack: {
    width: '100%',
    height: 4,
    borderRadius: 99,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    height: '100%',
    backgroundColor: '#ee4d2d',
    borderRadius: 99,
  },
  percentText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    fontVariant: ['tabular-nums'],
  },
  adCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  adHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adTitleCol: {
    flex: 1,
    gap: 1,
  },
  adTag: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.6,
  },
  adTitle: {
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.2,
  },
  adDesc: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 16,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 4,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 14,
  },
  dotInactive: {
    width: 4,
  },
  retryButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ee4d2d',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 40,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
});
