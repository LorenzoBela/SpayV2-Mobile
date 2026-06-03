import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  checkForAppUpdateAsync,
  closeAppForDownloadedUpdate,
  getAppUpdateRuntimeInfo,
} from '../services/appUpdateService';
import OTAUpdateModal from './OTAUpdateModal';

const CHECK_COOLDOWN_MS = 5 * 60 * 1000;

export default function AppUpdateGate() {
  const [showModal, setShowModal] = useState(false);
  const hasPrompted = useRef(false);
  const isRestarting = useRef(false);
  const lastCheckAt = useRef(0);
  const runtimeVersion = getAppUpdateRuntimeInfo().runtimeVersion;

  const checkForDownloadedUpdate = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheckAt.current < CHECK_COOLDOWN_MS) return;
    lastCheckAt.current = now;

    const result = await checkForAppUpdateAsync();
    if (result.status === 'downloaded' && !hasPrompted.current) {
      hasPrompted.current = true;
      setShowModal(true);
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (isRestarting.current) return;
    isRestarting.current = true;
    setShowModal(false);
    void closeAppForDownloadedUpdate();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkForDownloadedUpdate(true);
    }, 2500);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkForDownloadedUpdate();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [checkForDownloadedUpdate]);

  return (
    <OTAUpdateModal
      visible={showModal}
      onRestart={handleRestart}
      runtimeVersion={runtimeVersion}
    />
  );
}
