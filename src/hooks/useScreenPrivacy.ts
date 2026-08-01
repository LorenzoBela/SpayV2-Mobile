import { useEffect } from 'react';
import { preventScreenCaptureAsync, allowScreenCaptureAsync } from 'expo-screen-capture';

/**
 * Hook to prevent screenshot capture and screen recording while the component is mounted.
 * Re-allows screen capture when the component unmounts.
 */
export function useScreenPrivacy(key?: string) {
  useEffect(() => {
    preventScreenCaptureAsync(key).catch((err) => {
      console.warn('[useScreenPrivacy] Failed to enable screen capture prevention:', err);
    });

    return () => {
      allowScreenCaptureAsync(key).catch((err) => {
        console.warn('[useScreenPrivacy] Failed to disable screen capture prevention:', err);
      });
    };
  }, [key]);
}

export default useScreenPrivacy;
