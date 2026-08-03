import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Download, RefreshCw } from 'lucide-react-native';
import {
  checkForConfiguredApkUpdateAsync,
  checkForAppUpdateAsync,
  closeAppForDownloadedUpdate,
  downloadAndInstallConfiguredApkAsync,
  getAppUpdateRuntimeInfo,
} from '../services/appUpdateService';
import OTAUpdateModal from './OTAUpdateModal';

const CHECK_COOLDOWN_MS = 5 * 60 * 1000;

export default function AppUpdateGate() {
  const [updateType, setUpdateType] = useState<'none' | 'ota' | 'apk'>('none');
  const [showModal, setShowModal] = useState(false);
  const [apkDetails, setApkDetails] = useState<{ apkUrl: string | null; latestVersionCode: number | null }>({
    apkUrl: null,
    latestVersionCode: null,
  });
  const [dismissed, setDismissed] = useState(false);
  const isExecutingAction = useRef(false);
  const lastCheckAt = useRef(0);
  const runtimeVersion = getAppUpdateRuntimeInfo().runtimeVersion;

  const runUpdateCheck = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheckAt.current < CHECK_COOLDOWN_MS) return;
    lastCheckAt.current = now;

    try {
      // 1. Check native APK update first
      const apkUpdate = await checkForConfiguredApkUpdateAsync().catch(() => null);
      if (apkUpdate && apkUpdate.isAvailable) {
        setApkDetails({ apkUrl: apkUpdate.apkUrl, latestVersionCode: apkUpdate.latestVersionCode });
        setUpdateType('apk');
        setShowModal(true);
        return;
      }

      // 2. Check OTA JS bundle update if no native APK update is needed
      const otaResult = await checkForAppUpdateAsync();
      if (otaResult.status === 'downloaded') {
        setUpdateType('ota');
        setShowModal(true);
        return;
      }
    } catch (error) {
      console.warn('[AppUpdateGate] Update check failed:', error);
    }
  }, []);

  const handleApplyUpdate = useCallback(async () => {
    if (isExecutingAction.current) return;
    isExecutingAction.current = true;
    setShowModal(false);

    if (updateType === 'apk') {
      try {
        await downloadAndInstallConfiguredApkAsync(apkDetails.apkUrl, apkDetails.latestVersionCode);
      } catch (error) {
        console.warn('[AppUpdateGate] APK install failed:', error);
      } finally {
        isExecutingAction.current = false;
      }
    } else if (updateType === 'ota') {
      void closeAppForDownloadedUpdate();
    }
  }, [updateType, apkDetails]);

  const handleDismiss = useCallback(() => {
    setShowModal(false);
    setDismissed(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runUpdateCheck(true);
    }, 1500);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runUpdateCheck();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [runUpdateCheck]);

  return (
    <>
      <OTAUpdateModal
        visible={showModal}
        type={updateType === 'apk' ? 'apk' : 'ota'}
        onRestart={handleApplyUpdate}
        onApply={handleApplyUpdate}
        onDismiss={handleDismiss}
        runtimeVersion={runtimeVersion}
      />
      {updateType !== 'none' && dismissed && !showModal ? (
        <View style={styles.bannerContainer}>
          <Pressable
            style={({ pressed }) => [styles.banner, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => setShowModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Open update modal"
          >
            <View style={styles.bannerLeft}>
              {updateType === 'apk' ? (
                <Download size={16} color="#ffffff" />
              ) : (
                <RefreshCw size={16} color="#ffffff" />
              )}
              <Text style={styles.bannerText}>
                {updateType === 'apk' ? 'APK update available' : 'OTA update ready'} — Tap to apply
              </Text>
            </View>
            <View style={styles.bannerPill}>
              <Text style={styles.bannerPillText}>Update</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ee4d2d',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit-SemiBold',
    flex: 1,
  },
  bannerPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bannerPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
  },
});
