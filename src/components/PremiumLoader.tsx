import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Easing,
} from 'react-native';
import { AlertCircle, RefreshCw, Sparkles, Shield, Wifi, Bell, Wallet } from 'lucide-react-native';

export interface SlideItem {
  id: number;
  title: string;
  desc: string;
  icon: React.ComponentType<any>;
}

const DEFAULT_SLIDES: SlideItem[] = [
  {
    id: 1,
    title: 'Secure Environment',
    desc: 'Every session is fully signed and encrypted via Supabase Auth and RLS protocols.',
    icon: Shield,
  },
  {
    id: 2,
    title: 'Offline-First Ready',
    desc: 'Entering a basement or elevator? S-Pay caches your logs to run seamlessly without signal.',
    icon: Wifi,
  },
  {
    id: 3,
    title: 'AI Smart Assistant',
    desc: 'Talk with NootAI to verify balances, limit extensions, and receive customized budget analyses.',
    icon: Sparkles,
  },
  {
    id: 4,
    title: 'Dues & Alerts',
    desc: 'Receive push notifications prior to billing dates to maintain excellent credit standing.',
    icon: Bell,
  },
];

interface PremiumLoaderProps {
  title?: string;
  subtitle?: string;
  progress?: number; // Deterministic value between 0 and 1
  error?: string | null;
  onRetry?: () => void;
  timeoutMs?: number; // Shows a timeout retry after this duration
  useSystemFonts?: boolean;
}

export default function PremiumLoader({
  title = 'Initializing Workspace',
  subtitle = 'Loading account configurations...',
  progress,
  error,
  onRetry,
  timeoutMs = 12000, // 12 seconds default timeout
  useSystemFonts = false,
}: PremiumLoaderProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);

  // Animation values
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const slideTranslateX = useRef(new Animated.Value(0)).current;
  const indeterminateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  // Logo pulse animation loop
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [logoScale]);

  // Helper to dynamically strip custom font family if system fonts are forced
  const font = (styleName: keyof typeof styles) => {
    const originalStyle = styles[styleName] as any;
    if (useSystemFonts) {
      const { fontFamily, ...rest } = originalStyle;
      const isBold = fontFamily && (fontFamily.includes('Bold') || fontFamily.includes('SemiBold') || fontFamily.includes('ExtraBold'));
      return {
        ...rest,
        fontWeight: isBold ? '700' : '400',
      };
    }
    return originalStyle;
  };

  // Slide rotation loop with subtle sliding transitions
  useEffect(() => {
    const slideTimer = setInterval(() => {
      // 1. Fade out and slide left slightly
      Animated.parallel([
        Animated.timing(slideOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideTranslateX, {
          toValue: -15,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 2. Change content
        setActiveSlide((prev) => (prev + 1) % DEFAULT_SLIDES.length);
        
        // 3. Teleport translation position to the right side instantly
        slideTranslateX.setValue(15);
        
        // 4. Fade in and slide to center (0)
        Animated.parallel([
          Animated.timing(slideOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(slideTranslateX, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 3200); // engaging 3.2 seconds interval

    return () => clearInterval(slideTimer);
  }, []);

  // Indeterminate progress animation loop
  useEffect(() => {
    if (progress === undefined) {
      const runIndeterminate = () => {
        indeterminateAnim.setValue(0);
        Animated.timing(indeterminateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false, // width/left positioning doesn't support native driver in RN
        }).start(() => {
          runIndeterminate();
        });
      };
      runIndeterminate();
    }
  }, [progress]);

  // Deterministic progress animation
  useEffect(() => {
    if (progress !== undefined) {
      const bounded = Math.max(0, Math.min(1, progress));
      Animated.timing(progressAnim, {
        toValue: bounded,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress]);

  // Timeout monitoring for retry states
  useEffect(() => {
    if (!error && timeoutMs > 0 && onRetry) {
      const timer = setTimeout(() => {
        setIsTimeout(true);
      }, timeoutMs);
      return () => clearTimeout(timer);
    }
  }, [error, timeoutMs, onRetry]);

  // Map progress values to style widths
  const getProgressStyle = () => {
    if (progress !== undefined) {
      return {
        width: progressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '100%'],
        }),
      } as any;
    } else {
      // Indeterminate loops across the bar
      return {
        width: '35%',
        left: indeterminateAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['-35%', '100%'],
        }),
      } as any;
    }
  };

  const currentSlideItem = DEFAULT_SLIDES[activeSlide];
  const SlideIcon = currentSlideItem.icon;
  const showErrorOrTimeout = error || isTimeout;
  const displayErrorMsg = error || 'Connecting taking longer than expected. Please check network.';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        
        {/* Logo Badge with micro-animation */}
        <Animated.View style={[styles.logoBadge, { transform: [{ scale: logoScale }] }]}>
          <Wallet size={40} color="#ee4d2d" strokeWidth={1.8} />
        </Animated.View>
        
        {/* Dynamic Branding & Loading Titles */}
        <View style={styles.header}>
          <Text style={font('loaderTitle')}>{title}</Text>
          <Text style={font('loaderSubtitle')} numberOfLines={2}>
            {showErrorOrTimeout ? 'Network latency encountered' : subtitle}
          </Text>
        </View>

        {/* Premium Progress Bar Wrapper */}
        <View style={styles.barWrapper}>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, getProgressStyle()]} />
          </View>
          {progress !== undefined && (
            <Text style={font('progressPercent')}>
              {Math.round((progress || 0) * 100)}%
            </Text>
          )}
        </View>

        {/* Retry Actions / Information Widget */}
        {showErrorOrTimeout ? (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <AlertCircle size={20} color="#ef4444" />
              <Text style={font('errorTitle')}>Latency Alert</Text>
            </View>
            <Text style={font('errorDesc')}>{displayErrorMsg}</Text>
            
            {onRetry && (
              <TouchableOpacity
                onPress={() => {
                  setIsTimeout(false);
                  if (onRetry) onRetry();
                }}
                activeOpacity={0.85}
                style={styles.retryBtn}
              >
                <RefreshCw size={14} color="#f8fafc" />
                <Text style={font('retryBtnText')}>Retry Connection</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Animated.View
            style={[
              styles.carouselCard,
              {
                opacity: slideOpacity,
                transform: [{ translateX: slideTranslateX }],
              },
            ]}
          >
            <View style={styles.carouselHeader}>
              <View style={styles.iconBox}>
                <SlideIcon size={20} color="#ee4d2d" />
              </View>
              <Text style={font('carouselSlideTitle')}>{currentSlideItem.title}</Text>
            </View>
            <Text style={font('carouselSlideDesc')}>{currentSlideItem.desc}</Text>
            
            {/* Carousel Index Indicator Dots */}
            <View style={styles.dotRow}>
              {DEFAULT_SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    activeSlide === i ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19', // Solid S-Pay dark background
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  logoBadge: {
    backgroundColor: 'rgba(238, 77, 45, 0.04)',
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(238, 77, 45, 0.2)',
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  loaderTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  loaderSubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  barWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
    gap: 8,
  },
  barTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#1f293d',
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
  progressPercent: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.5,
  },
  carouselCard: {
    width: '100%',
    backgroundColor: '#161c2a',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#2d3748',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(238, 77, 45, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselSlideTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.1,
  },
  carouselSlideDesc: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#ee4d2d',
    width: 14,
  },
  dotInactive: {
    backgroundColor: '#334155',
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#161c2a',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 20,
    alignItems: 'center',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
  },
  errorDesc: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ee4d2d',
    borderRadius: 99,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  retryBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
});
