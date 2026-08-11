import React, { useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  CreditCard,
  RefreshCw,
  Users,
  Flame,
  ChevronRight,
  Zap,
  Check,
  ShoppingBag,
  Trophy,
  Lightbulb,
  Lock,
  WifiOff,
  AlertTriangle,
  Gift,
  TrendingUp,
  Download,
  ShieldAlert,
  Sparkles,
  SunMedium,
  Tag,
} from 'lucide-react-native';

import { ThemeContext } from '../navigation/navigationTypes';
import { useDynamicIsland, DynamicIslandNotificationPayload } from '../context/DynamicIslandContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SPAY_PRIMARY = '#ee4d2d';
const RED_ALERT = '#ef4444';

const SPRING_PHYSICS = {
  damping: 24,
  stiffness: 340,
  mass: 0.4,
  overshootClamping: false,
};

// Animated 4-Bar Equalizer Waveform for Live Syncing
const EqualizerWaveform: React.FC<{ color?: string }> = ({ color = '#00F2FE' }) => {
  return (
    <View style={styles.eqContainer}>
      <View style={[styles.eqBar, { backgroundColor: color, height: 12 }]} />
      <View style={[styles.eqBar, { backgroundColor: color, height: 8 }]} />
      <View style={[styles.eqBar, { backgroundColor: color, height: 10 }]} />
      <View style={[styles.eqBar, { backgroundColor: color, height: 6 }]} />
    </View>
  );
};

export const FloatingDynamicIsland: React.FC = () => {
  const insets = useSafeAreaInsets();
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext?.isDarkMode ?? true;

  const {
    activeNotification,
    secondaryNotification,
    isExpanded,
    dismissIsland,
    toggleExpand,
  } = useDynamicIsland();

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = event.translationY < 0 ? event.translationY * 0.4 : event.translationY * 0.15;
      translateX.value = event.translationX * 0.45;
    })
    .onEnd((event) => {
      if (
        event.translationY < -20 ||
        Math.abs(event.translationX) > 40 ||
        event.velocityY < -200 ||
        Math.abs(event.velocityX) > 300
      ) {
        runOnJS(dismissIsland)();
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
      }
      translateY.value = withSpring(0, SPRING_PHYSICS);
      translateX.value = withSpring(0, SPRING_PHYSICS);
    });

  // When no active notification exists, return null so zero stuck pills block the screen
  if (!activeNotification) {
    return null;
  }

  const islandData = activeNotification;

  const animatedContainerStyle = useAnimatedStyle(() => {
    let targetHeight = 40;
    if (isExpanded) {
      targetHeight = islandData.actionText ? (islandData.hasProgress ? 184 : 172) : 132;
    }

    const isCompactMinimal = !!secondaryNotification && !isExpanded;
    const targetWidth = isExpanded
      ? Math.min(SCREEN_WIDTH - 24, 380)
      : isCompactMinimal
      ? 160
      : 220;

    return {
      width: withSpring(targetWidth, SPRING_PHYSICS),
      height: withSpring(targetHeight, SPRING_PHYSICS),
      borderRadius: withSpring(isExpanded ? 24 : 20, SPRING_PHYSICS),
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
      ],
    };
  });

  const renderIcon = (type: string) => {
    const iconColor =
      type === 'payment' || type === 'order_assigned' || type === 'biometric_auth'
        ? SPAY_PRIMARY
        : type === 'overdue_alert' || type === 'admin_risk_alert' || type === 'low_balance'
        ? RED_ALERT
        : type === 'payment_success' || type === 'cashback' || type === 'debt_free' || type === 'admin_client_payment'
        ? '#10b981'
        : type === 'ota_update' || type === 'sync' || type === 'limit_increase' || type === 'offline_queue'
        ? '#00F2FE'
        : type === 'shared_payment' || type === 'pro_subscription' || type === 'zero_interest'
        ? '#a855f7'
        : '#f59e0b';

    switch (type) {
      case 'promo_ad':
        return <Tag size={13} color={iconColor} strokeWidth={2.0} />;
      case 'ota_update':
        return <Download size={13} color={iconColor} strokeWidth={2.0} />;
      case 'admin_impersonation':
      case 'admin_risk_alert':
        return <ShieldAlert size={13} color={iconColor} strokeWidth={2.0} />;
      case 'pro_subscription':
        return <Sparkles size={13} color={iconColor} strokeWidth={2.0} />;
      case 'overdue_alert':
        return <AlertTriangle size={13} color={iconColor} strokeWidth={2.0} />;
      case 'payment_success':
      case 'admin_client_payment':
        return <Check size={13} color={iconColor} strokeWidth={2.2} />;
      case 'order_assigned':
        return <ShoppingBag size={13} color={iconColor} strokeWidth={2.0} />;
      case 'sync':
        return <RefreshCw size={13} color={iconColor} strokeWidth={2.0} />;
      case 'cashback':
        return <Gift size={13} color={iconColor} strokeWidth={2.0} />;
      case 'shared_payment':
        return <Users size={13} color={iconColor} strokeWidth={2.0} />;
      case 'offline_queue':
        return <WifiOff size={13} color={iconColor} strokeWidth={2.0} />;
      case 'payment':
      default:
        return <CreditCard size={13} color={iconColor} strokeWidth={2.0} />;
    }
  };

  const compactTextDisplay = islandData.compactText || islandData.title || 'SPayV2 Wallet';
  const compactBadgeDisplay = islandData.compactBadge || islandData.amount || 'Info';

  const textColor = isDarkMode ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDarkMode ? '#94A3B8' : '#64748B';
  const containerBg = isDarkMode ? 'rgba(8, 9, 12, 0.96)' : 'rgba(255, 255, 255, 0.96)';
  const containerBorder = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
  const boxBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
  const boxBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <View style={[styles.wrapper, { top: Math.max(insets.top, 12) }]} pointerEvents="box-none">
      <View style={styles.notchGroup} pointerEvents="box-none">
        <GestureDetector gesture={panGesture}>
          <Pressable onPress={toggleExpand}>
            <Animated.View
              style={[
                styles.islandContainer,
                { backgroundColor: containerBg, borderColor: containerBorder },
                animatedContainerStyle,
              ]}
            >
              {/* Top Specular Reflection Rim */}
              <View style={[styles.topSpecularRim, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)' }]} />

              <BlurView intensity={Platform.OS === 'ios' ? 85 : 100} tint={isDarkMode ? 'dark' : 'light'} style={styles.blurFill}>
                {!isExpanded ? (
                  // Compact View (Strict Zero Font Overlap)
                  <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(100)} style={styles.compactContent}>
                    <View style={styles.compactLeft}>
                      <View style={styles.lineIconPod}>
                        {renderIcon(islandData.type)}
                      </View>
                      <Text style={[styles.compactTitleText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
                        {compactTextDisplay}
                      </Text>
                    </View>
                    <View style={styles.compactBadgeTag}>
                      {islandData.type === 'sync' ? (
                        <EqualizerWaveform />
                      ) : (
                        <Text style={[styles.compactBadgeText, styles.tabularNum]} numberOfLines={1}>
                          {compactBadgeDisplay}
                        </Text>
                      )}
                    </View>
                  </Animated.View>
                ) : (
                  // Expanded View (Strict Zero Font Overlap)
                  <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(100)} style={styles.expandedContent}>
                    <View style={styles.expandedHeader}>
                      <View style={styles.expandedTitleRow}>
                        <View style={styles.lineIconPod}>
                          {renderIcon(islandData.type)}
                        </View>
                        <View style={styles.titleTextGroup}>
                          <Text style={[styles.expandedTitleText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
                            {islandData.title}
                          </Text>
                          {islandData.subtitle && (
                            <Text style={[styles.expandedSubtitleText, { color: subtitleColor }]} numberOfLines={1} ellipsizeMode="tail">
                              {islandData.subtitle}
                            </Text>
                          )}
                        </View>
                      </View>
                      {islandData.amount && (
                        <Text style={[styles.amountText, styles.tabularNum]} numberOfLines={1}>
                          {islandData.amount}
                        </Text>
                      )}
                    </View>

                    {/* Detail Strip */}
                    <View style={[styles.detailBox, { backgroundColor: boxBg, borderColor: boxBorder }]}>
                      <Text style={[styles.detailBoxLeft, { color: subtitleColor }]} numberOfLines={1} ellipsizeMode="tail">
                        {islandData.detailLeft || 'Detail'}
                      </Text>
                      <Text style={[styles.detailBoxRight, styles.tabularNum]} numberOfLines={1} ellipsizeMode="tail">
                        {islandData.detailRight || 'Status'}
                      </Text>
                    </View>

                    {/* Progress Bar for Downloads/Sync */}
                    {islandData.hasProgress && (
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${islandData.progressPct || 68}%` }]} />
                      </View>
                    )}

                    {/* Action Button (44pt WCAG AA Compliant) */}
                    {islandData.actionText && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.actionButton}
                        onPress={() => {
                          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                          if (islandData.onAction) islandData.onAction();
                          dismissIsland();
                        }}
                      >
                        <Zap size={14} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.actionButtonText} numberOfLines={1}>{islandData.actionText}</Text>
                        <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.2} />
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                )}
              </BlurView>
            </Animated.View>
          </Pressable>
        </GestureDetector>

        {/* Secondary Orb Badge (Dual Event Mode) */}
        {secondaryNotification && !isExpanded && (
          <Animated.View entering={FadeIn.duration(180)} style={[styles.secondaryOrb, { backgroundColor: containerBg, borderColor: containerBorder }]}>
            <View style={styles.lineIconPod}>
              {renderIcon(secondaryNotification.type)}
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 99999, elevation: 99999 },
  notchGroup: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  islandContainer: {
    overflow: 'hidden', borderWidth: 1,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12, position: 'relative',
  },
  secondaryOrb: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  topSpecularRim: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 10 },
  blurFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center' },
  tabularNum: { fontVariant: ['tabular-nums'], fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  
  compactContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  compactLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, marginRight: 8 },
  lineIconPod: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.16)', flexShrink: 0,
  },
  compactTitleText: { fontSize: 12, fontWeight: '600', letterSpacing: -0.1, flex: 1, minWidth: 0 },
  compactBadgeTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(238, 77, 45, 0.14)', borderWidth: 1, borderColor: 'rgba(238, 77, 45, 0.35)', flexShrink: 0,
  },
  compactBadgeText: { fontSize: 11, fontWeight: '700', color: SPAY_PRIMARY },
  
  expandedContent: { flex: 1, justifyContent: 'space-between', paddingVertical: 2 },
  expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  titleTextGroup: { flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: 6 },
  expandedTitleText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2, lineHeight: 17 },
  expandedSubtitleText: { fontSize: 11, lineHeight: 14, marginTop: 1 },
  amountText: { fontSize: 15, fontWeight: '800', color: SPAY_PRIMARY, flexShrink: 0, marginLeft: 6 },
  
  detailBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6, borderWidth: 1 },
  detailBoxLeft: { fontSize: 11, flex: 1, minWidth: 0 },
  detailBoxRight: { fontSize: 11, fontWeight: '700', color: '#10b981', flexShrink: 0, marginLeft: 6 },
  
  progressTrack: { width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: SPAY_PRIMARY, borderRadius: 2 },
  
  actionButton: { height: 44, backgroundColor: SPAY_PRIMARY, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, elevation: 4 },
  actionButtonText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  
  eqContainer: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 12 },
  eqBar: { width: 2, borderRadius: 1 },
});

export default FloatingDynamicIsland;
