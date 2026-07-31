import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (900,000 ms)
const SPAY_LAST_ACTIVE_KEY = 'spay_last_active_time';
const UPDATE_INTERVAL_MS = 60 * 1000; // Update timestamp every minute while active

/**
 * Hook to track mobile inactivity and automatically invalidate the session
 * if the app has been in the background/inactive for more than 15 minutes.
 *
 * @param enabled Whether inactivity tracking is currently active (defaults to true)
 */
export function useMobileInactivity(enabled: boolean = true) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const updateLastActiveTime = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SPAY_LAST_ACTIVE_KEY, Date.now().toString());
    } catch (error) {
      console.warn('[useMobileInactivity] Failed to update last active timestamp:', error);
    }
  }, []);

  const checkInactivity = useCallback(async (): Promise<boolean> => {
    try {
      const storedTime = await AsyncStorage.getItem(SPAY_LAST_ACTIVE_KEY);
      if (storedTime) {
        const lastActiveTime = parseInt(storedTime, 10);
        if (!isNaN(lastActiveTime)) {
          const elapsed = Date.now() - lastActiveTime;
          if (elapsed > INACTIVITY_TIMEOUT_MS) {
            console.log(
              `[useMobileInactivity] Session timed out after ${elapsed} ms (> ${INACTIVITY_TIMEOUT_MS} ms). Signing out.`
            );
            await AsyncStorage.removeItem(SPAY_LAST_ACTIVE_KEY);
            await supabase.auth.signOut();
            return true;
          }
        }
      }
    } catch (error) {
      console.warn('[useMobileInactivity] Error checking inactivity:', error);
    }
    return false;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Record initial active time when mounted
    updateLastActiveTime();

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const currentAppState = appStateRef.current;

      // Returning to foreground (active) from background or inactive
      if (currentAppState.match(/inactive|background/) && nextAppState === 'active') {
        const timedOut = await checkInactivity();
        if (!timedOut) {
          await updateLastActiveTime();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // Shifting into background or inactive
        await updateLastActiveTime();
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Periodically update timestamp while active
    const intervalId = setInterval(() => {
      if (appStateRef.current === 'active') {
        updateLastActiveTime();
      }
    }, UPDATE_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [enabled, checkInactivity, updateLastActiveTime]);

  return { updateLastActiveTime };
}

export default useMobileInactivity;
