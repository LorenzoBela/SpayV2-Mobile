import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { offlineQueue, QueueStatus } from './offlineQueue';

export type BannerMode = 'offline' | 'syncing' | 'online' | 'hidden';

export interface NetworkBannerProps {
  /** Top inset override (defaults to safe area top) */
  topInset?: number;
  /** Custom offline message */
  offlineText?: string;
  /** Custom syncing message */
  syncingText?: string;
  /** Custom online message */
  onlineText?: string;
  /** Duration in ms for green "Back online" toast before auto-hiding (default 2000) */
  autoHideOnlineMs?: number;
  /** Override status for testing or manual control */
  forcedStatus?: BannerMode;
  /** Pending count override */
  pendingCount?: number;
}

export const NetworkBanner: React.FC<NetworkBannerProps> = ({
  topInset,
  offlineText = 'Offline — Changes will sync automatically',
  syncingText = 'Syncing...',
  onlineText = 'Back online',
  autoHideOnlineMs = 2000,
  forcedStatus,
  pendingCount: customPendingCount,
}) => {
  const insets = useSafeAreaInsets();
  const actualTopInset = topInset ?? Math.max(insets.top, 8);

  const [queueStatus, setQueueStatus] = useState<QueueStatus>(() => offlineQueue.getStatus());
  const [isNetOffline, setIsNetOffline] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  const wasOfflineRef = useRef(false);
  const autoHideTimerRef = useRef<any>(null);

  // Subscribe to offline queue status
  useEffect(() => {
    const unsubQueue = offlineQueue.subscribeStatus((status) => {
      setQueueStatus(status);
    });
    return unsubQueue;
  }, []);

  // Subscribe to NetInfo connection changes
  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((state) => {
      const offline = !Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsNetOffline(offline);

      if (offline) {
        wasOfflineRef.current = true;
        setShowOnlineToast(false);
        if (autoHideTimerRef.current) {
          clearTimeout(autoHideTimerRef.current);
          autoHideTimerRef.current = null;
        }
      } else if (wasOfflineRef.current) {
        // Transitioned offline -> online
        wasOfflineRef.current = false;
        setShowOnlineToast(true);

        if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = setTimeout(() => {
          setShowOnlineToast(false);
        }, autoHideOnlineMs);
      }
    });

    return () => {
      unsubNet();
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [autoHideOnlineMs]);

  // Determine current active mode
  let mode: BannerMode = 'hidden';

  if (forcedStatus) {
    mode = forcedStatus;
  } else if (isNetOffline || queueStatus.isOffline) {
    mode = 'offline';
  } else if (queueStatus.isSyncing) {
    mode = 'syncing';
  } else if (showOnlineToast) {
    mode = 'online';
  }

  // Animation values using react-native-reanimated
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (mode !== 'hidden') {
      translateY.value = withSpring(0, { damping: 15, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withTiming(-100, { duration: 200, easing: Easing.in(Easing.ease) });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [mode, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (mode === 'hidden' && opacity.value === 0) {
    return null;
  }

  const pendingCount = customPendingCount ?? queueStatus.pendingCount;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: actualTopInset },
        mode === 'offline' && styles.offlineBanner,
        mode === 'syncing' && styles.syncingBanner,
        mode === 'online' && styles.onlineBanner,
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.contentRow}>
        {mode === 'offline' && (
          <>
            <View style={[styles.iconContainer, styles.offlineIconBg]}>
              <WifiOff size={16} color="#f59e0b" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.titleText}>{offlineText}</Text>
              {pendingCount > 0 && (
                <Text style={styles.subText}>
                  {pendingCount} action{pendingCount > 1 ? 's' : ''} queued offline
                </Text>
              )}
            </View>
          </>
        )}

        {mode === 'syncing' && (
          <>
            <View style={[styles.iconContainer, styles.syncingIconBg]}>
              <RefreshCw size={16} color="#3b82f6" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.titleText}>{syncingText}</Text>
              {pendingCount > 0 && (
                <Text style={styles.subText}>Processing {pendingCount} item(s)</Text>
              )}
            </View>
          </>
        )}

        {mode === 'online' && (
          <>
            <View style={[styles.iconContainer, styles.onlineIconBg]}>
              <CheckCircle2 size={16} color="#10b981" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.titleText}>{onlineText}</Text>
              <Text style={styles.subText}>Connection restored</Text>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  titleText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
    color: '#ffffff',
  },
  subText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 1,
  },

  // State Themes
  offlineBanner: {
    backgroundColor: '#1e1b18',
    borderColor: '#b45309',
  },
  offlineIconBg: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },

  syncingBanner: {
    backgroundColor: '#0f172a',
    borderColor: '#2563eb',
  },
  syncingIconBg: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },

  onlineBanner: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
  },
  onlineIconBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
});

export default NetworkBanner;
