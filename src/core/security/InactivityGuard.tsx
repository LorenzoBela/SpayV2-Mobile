import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  View,
  Text,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { BlurView, BlurTint } from 'expo-blur';
import { queryClient } from '../../utils/queryClient';
import { clearClipboard } from '../utils/smartClipboard';

export interface InactivityGuardProps {
  /** Main application component tree to guard */
  children?: React.ReactNode;
  /** Inactivity timeout threshold in milliseconds (default: 30,000ms / 30s) */
  timeoutMs?: number;
  /** Enables or disables app-switcher privacy overlay and session locking (default: true) */
  enabled?: boolean;
  /** Blur intensity strength for app-switcher obscure view (default: 80) */
  blurIntensity?: number;
  /** Blur tint color theme (default: 'dark') */
  blurTint?: BlurTint;
  /** Custom overlay component to display when app is obscured or locked */
  customOverlay?: React.ReactNode;
  /** Callback invoked when the user session is locked due to inactivity */
  onSessionLock?: () => void;
  /** Callback invoked when memory cleanup is triggered */
  onMemoryCleanup?: () => void;
  /** Custom wrapper style */
  style?: StyleProp<ViewStyle>;
}

export const InactivityGuard: React.FC<InactivityGuardProps> = ({
  children,
  timeoutMs = 30000,
  enabled = true,
  blurIntensity = 80,
  blurTint = 'dark',
  customOverlay,
  onSessionLock,
  onMemoryCleanup,
  style,
}) => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isObscured, setIsObscured] = useState<boolean>(false);
  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(false);

  const backgroundTimestampRef = useRef<number | null>(null);
  const backgroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Executes privacy & memory cleanup routines when idle or locked.
   */
  const performMemoryCleanup = useCallback(() => {
    try {
      // 1. Purge query client cache
      queryClient.clear();

      // 2. Clear sensitive clipboard items
      clearClipboard();

      // 3. Explicit JS engine GC invocation if exposed
      if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
        (global as any).gc();
      }

      // 4. Notify optional subscriber callback
      if (onMemoryCleanup) {
        onMemoryCleanup();
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[InactivityGuard] Memory cleanup error:', err);
      }
    }
  }, [onMemoryCleanup]);

  /**
   * Locks user session and triggers security memory cleanup.
   */
  const triggerSessionLock = useCallback(() => {
    setIsSessionLocked(true);
    performMemoryCleanup();
    if (onSessionLock) {
      onSessionLock();
    }
  }, [performMemoryCleanup, onSessionLock]);

  /**
   * Resets foreground active user interaction timer.
   */
  const resetActiveIdleTimer = useCallback(() => {
    if (!enabled || timeoutMs <= 0) return;

    if (activeIdleTimerRef.current) {
      clearTimeout(activeIdleTimerRef.current);
    }

    activeIdleTimerRef.current = setTimeout(() => {
      if (AppState.currentState === 'active') {
        triggerSessionLock();
      }
    }, timeoutMs);
  }, [enabled, timeoutMs, triggerSessionLock]);

  useEffect(() => {
    if (!enabled) {
      setIsObscured(false);
      return;
    }

    resetActiveIdleTimer();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const isNowInactive = nextAppState === 'background' || nextAppState === 'inactive';
      const wasActive = appState === 'active';
      const isReturningToActive = nextAppState === 'active' && isNowInactive === false;

      // 1. App entering background/app-switcher -> render obscure blur overlay immediately
      if (isNowInactive) {
        setIsObscured(true);

        if (wasActive) {
          backgroundTimestampRef.current = Date.now();

          if (activeIdleTimerRef.current) {
            clearTimeout(activeIdleTimerRef.current);
          }

          if (backgroundTimerRef.current) {
            clearTimeout(backgroundTimerRef.current);
          }

          backgroundTimerRef.current = setTimeout(() => {
            triggerSessionLock();
          }, timeoutMs);
        }
      }

      // 2. App returning to foreground active state
      if (isReturningToActive) {
        if (backgroundTimerRef.current) {
          clearTimeout(backgroundTimerRef.current);
          backgroundTimerRef.current = null;
        }

        const bgTime = backgroundTimestampRef.current;
        backgroundTimestampRef.current = null;

        if (bgTime) {
          const elapsed = Date.now() - bgTime;
          if (elapsed >= timeoutMs) {
            triggerSessionLock();
          }
        }

        setIsObscured(false);
        resetActiveIdleTimer();
      }

      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
      if (activeIdleTimerRef.current) clearTimeout(activeIdleTimerRef.current);
    };
  }, [appState, enabled, timeoutMs, resetActiveIdleTimer, triggerSessionLock]);

  const showBlurOverlay = enabled && (isObscured || appState !== 'active');

  return (
    <View
      style={[styles.container, style]}
      onStartShouldSetResponderCapture={() => {
        resetActiveIdleTimer();
        return false;
      }}
    >
      {children}

      {showBlurOverlay && (
        <View style={styles.overlayWrapper} pointerEvents="auto">
          {customOverlay ? (
            customOverlay
          ) : (
            <View style={styles.defaultOverlay}>
              {Platform.OS !== 'web' ? (
                <BlurView
                  intensity={blurIntensity}
                  tint={blurTint}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={styles.webFallbackOverlay} />
              )}
              <View style={styles.lockInfoContainer}>
                <View style={styles.shieldBadge}>
                  <Text style={styles.shieldIcon}>🔒</Text>
                </View>
                <Text style={styles.securityTitle}>Protected Screen</Text>
                <Text style={styles.securitySubtext}>
                  {isSessionLocked
                    ? 'Session locked due to inactivity'
                    : 'App content obscured for privacy'}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlayWrapper: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    elevation: 99999,
  },
  defaultOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 15, 26, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFallbackOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  lockInfoContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  shieldBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldIcon: {
    fontSize: 28,
  },
  securityTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  securitySubtext: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default InactivityGuard;
