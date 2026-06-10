import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useSharedValue, withTiming, withSequence, withDelay, cancelAnimation } from 'react-native-reanimated';

interface ProgressContextType {
  progress: { value: number };
  opacity: { value: number };
  start: (actionName?: string) => void;
  finish: () => void;
}

const ACTION_DURATIONS: Record<string, number> = {
  'fetch-admin-dashboard': 1500,
  'fetch-admin-reminders': 6000,
  'default': 15000,
};

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const start = useCallback((actionName?: string) => {
    // Reset and show progress bar
    cancelAnimation(progress);
    cancelAnimation(opacity);
    progress.value = 0;
    opacity.value = 1;

    const duration = actionName && ACTION_DURATIONS[actionName] 
      ? ACTION_DURATIONS[actionName] 
      : ACTION_DURATIONS['default'];

    // Trickle progress: 0 to 0.3 quickly, then slowly towards 0.9 based on action duration
    progress.value = withSequence(
      withTiming(0.3, { duration: 400 }),
      withTiming(0.9, { duration })
    );
  }, [progress, opacity]);

  const handleProgressUpdate = useCallback((event: { percent: number; action?: string }) => {
    // If we have actual progress from Content-Length, use it
    // We cancel the trickle and jump to the reported percentage (mapping 0-1 to 0.9 range)
    // Or just use the reported percentage directly if it's high fidelity.
    // The prompt says "set progress.value", so we set it.
    cancelAnimation(progress);
    progress.value = withTiming(event.percent * 0.9, { duration: 200 });
  }, [progress]);

  const finish = useCallback(() => {
    cancelAnimation(progress);
    // Jump to 100%
    progress.value = withTiming(1, { duration: 300 }, (finished) => {
      if (finished) {
        // Fade out after a small delay
        opacity.value = withDelay(
          400,
          withTiming(0, { duration: 300 }, (done) => {
            if (done) {
              // Reset progress value after fade out
              progress.value = 0;
            }
          })
        );
      }
    });
  }, [progress, opacity]);

  useEffect(() => {
    const startSub = DeviceEventEmitter.addListener('progress-start', start);
    const finishSub = DeviceEventEmitter.addListener('progress-finish', finish);
    const updateSub = DeviceEventEmitter.addListener('progress-update', handleProgressUpdate);

    return () => {
      startSub.remove();
      finishSub.remove();
      updateSub.remove();
    };
  }, [start, finish, handleProgressUpdate]);

  return (
    <ProgressContext.Provider value={{ progress, opacity, start, finish }}>
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgressBar = () => {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgressBar must be used within a ProgressProvider');
  }
  return context;
};
