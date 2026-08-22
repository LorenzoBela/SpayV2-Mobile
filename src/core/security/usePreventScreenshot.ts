import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  preventScreenCaptureAsync,
  allowScreenCaptureAsync,
  addScreenshotListener,
  type Subscription,
} from 'expo-screen-capture';

export interface UsePreventScreenshotOptions {
  /** Optional key identifier for screen capture prevention scope */
  key?: string;
  /** Whether screen capture prevention is active (default: true) */
  enabled?: boolean;
  /** Callback fired when a screenshot is taken */
  onScreenshot?: () => void;
}

/**
 * Hook to prevent screen capture / screenshots on mobile platforms.
 * Guards against web execution, catches errors gracefully, and cleans up on unmount.
 *
 * @param optionsOrEnabled boolean or configuration object
 * @param key optional key tag when passing boolean
 */
export function usePreventScreenshot(
  optionsOrEnabled: boolean | UsePreventScreenshotOptions = true,
  keyParam?: string
): void {
  const options: UsePreventScreenshotOptions =
    typeof optionsOrEnabled === 'boolean'
      ? { enabled: optionsOrEnabled, key: keyParam }
      : optionsOrEnabled;

  const { enabled = true, key, onScreenshot } = options;

  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) {
      return;
    }

    let isMounted = true;

    // Prevent screenshot capture
    preventScreenCaptureAsync(key).catch((error) => {
      if (isMounted) {
        console.warn('[usePreventScreenshot] Failed to enable screen capture prevention:', error);
      }
    });

    // Optional listener for screenshot detection
    let subscription: Subscription | null = null;
    if (onScreenshot) {
      try {
        subscription = addScreenshotListener(onScreenshot);
      } catch (error) {
        console.warn('[usePreventScreenshot] Failed to register screenshot listener:', error);
      }
    }

    return () => {
      isMounted = false;

      if (subscription) {
        try {
          subscription.remove();
        } catch (error) {
          console.warn('[usePreventScreenshot] Failed to remove screenshot listener:', error);
        }
      }

      if (Platform.OS !== 'web') {
        allowScreenCaptureAsync(key).catch((error) => {
          console.warn('[usePreventScreenshot] Failed to restore screen capture:', error);
        });
      }
    };
  }, [enabled, key, onScreenshot]);
}

export default usePreventScreenshot;
