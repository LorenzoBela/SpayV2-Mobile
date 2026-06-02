import { useEffect } from 'react';
import { AppState } from 'react-native';
import { checkForUpdatesAndPromptAsync } from '../services/appUpdateService';

export default function AppUpdateGate() {
  useEffect(() => {
    const timer = setTimeout(() => {
      void checkForUpdatesAndPromptAsync(false);
    }, 2500);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkForUpdatesAndPromptAsync(false);
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return null;
}
