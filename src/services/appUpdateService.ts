import { PremiumAlert } from '../services/PremiumAlertService';
import { Linking, Platform, BackHandler } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import RNExitApp from 'react-native-exit-app';


type UpdateStatus = 'disabled' | 'available' | 'downloaded' | 'not-available' | 'error';

export type AppUpdateResult = {
  status: UpdateStatus;
  message: string;
  canInstallApk: boolean;
  error?: string;
};

export type AppUpdateRuntimeInfo = {
  channel: string;
  runtimeVersion: string;
  updateId: string;
  appVersion: string;
  nativeBuildVersion: string | null;
  apkUrl: string | null;
  apkManifestUrl: string | null;
  isEnabled: boolean;
};

type AndroidApkManifest = {
  versionCode?: number | string;
  versionName?: string;
  apkUrl?: string;
  publishedAt?: string;
  fileName?: string;
};

type NativeApkUpdate = {
  isAvailable: boolean;
  currentVersionCode: number | null;
  latestVersionCode: number | null;
  apkUrl: string | null;
  versionName: string | null;
  publishedAt: string | null;
};

const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const FLAG_ACTIVITY_NEW_TASK = 268435456;
const CHECK_COOLDOWN_MS = 5 * 60 * 1000; // Check at most every 5 minutes automatically
const MIN_APK_BYTES = 1024 * 1024;

let promptVisible = false;
let lastAutomaticCheckAt = 0;

const getExtraString = (key: string): string | null => {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const getAppUpdateRuntimeInfo = (): AppUpdateRuntimeInfo => ({
  channel:
    Updates.channel ||
    getExtraString('otaChannel') ||
    Constants.expoConfig?.updates?.requestHeaders?.['expo-channel-name'] ||
    'development',
  runtimeVersion: Updates.runtimeVersion || Constants.expoConfig?.version || 'unknown',
  updateId: Updates.updateId || (Updates.isEmbeddedLaunch ? 'embedded' : 'local'),
  appVersion: Constants.expoConfig?.version || 'unknown',
  nativeBuildVersion: Application.nativeBuildVersion ?? null,
  apkUrl: getExtraString('androidApkUrl'),
  apkManifestUrl: getExtraString('androidApkManifestUrl'),
  isEnabled: Updates.isEnabled,
});

const parseVersionCode = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
};

export const checkForConfiguredApkUpdateAsync = async (): Promise<NativeApkUpdate> => {
  const runtimeInfo = getAppUpdateRuntimeInfo();
  const currentVersionCode = parseVersionCode(runtimeInfo.nativeBuildVersion);

  if (Platform.OS !== 'android' || !runtimeInfo.apkManifestUrl) {
    return {
      isAvailable: false,
      currentVersionCode,
      latestVersionCode: null,
      apkUrl: runtimeInfo.apkUrl,
      versionName: null,
      publishedAt: null,
    };
  }

  const response = await fetch(runtimeInfo.apkManifestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`APK manifest request failed (${response.status})`);
  }

  const text = await response.text();
  const cleanText = text.startsWith('\uFEFF') ? text.slice(1) : text;

  let manifest: AndroidApkManifest;
  try {
    manifest = JSON.parse(cleanText) as AndroidApkManifest;
  } catch (parseError) {
    throw new Error('APK manifest was not valid JSON metadata.');
  }

  const latestVersionCode = parseVersionCode(manifest.versionCode);
  const apkUrl = typeof manifest.apkUrl === 'string' && manifest.apkUrl.trim()
    ? manifest.apkUrl.trim()
    : runtimeInfo.apkUrl;

  return {
    isAvailable: !!latestVersionCode && !!currentVersionCode && latestVersionCode > currentVersionCode && !!apkUrl,
    currentVersionCode,
    latestVersionCode,
    apkUrl,
    versionName: typeof manifest.versionName === 'string' ? manifest.versionName : null,
    publishedAt: typeof manifest.publishedAt === 'string' ? manifest.publishedAt : null,
  };
};

export const checkForAppUpdateAsync = async (): Promise<AppUpdateResult> => {
  const apkUrl = getAppUpdateRuntimeInfo().apkUrl;
  const canInstallApk = Platform.OS === 'android' && !!apkUrl;

  if (__DEV__) {
    return {
      status: 'disabled',
      canInstallApk,
      message: 'OTA updates are disabled in development mode.',
    };
  }

  if (!Updates.isEnabled) {
    return {
      status: 'disabled',
      canInstallApk,
      message: 'OTA updates are not enabled in this build.',
    };
  }

  try {
    const update = await Updates.checkForUpdateAsync();

    if (!update.isAvailable) {
      return {
        status: 'not-available',
        canInstallApk,
        message: update.isRollBackToEmbedded
          ? 'No downloadable OTA update is available for this build.'
          : 'You are already running the latest OTA update for this channel.',
      };
    }

    const fetched = await Updates.fetchUpdateAsync();
    return {
      status: fetched.isNew || fetched.isRollBackToEmbedded ? 'downloaded' : 'available',
      canInstallApk,
      message: fetched.isNew || fetched.isRollBackToEmbedded
        ? 'An update has been downloaded. Close and reopen S-Pay to load it.'
        : 'An update is available, but it could not be staged yet.',
    };
  } catch (error: any) {
    return {
      status: 'error',
      canInstallApk,
      error: error?.message || String(error),
      message: 'S-Pay could not check the OTA update server.',
    };
  }
};

export const closeAppForDownloadedUpdate = async () => {
  if (Platform.OS === 'android' && !__DEV__) {
    try {
      RNExitApp.exitApp();
      return;
    } catch (exitError) {
      BackHandler.exitApp();
      return;
    }
  }

  try {
    // Updates.reloadAsync() is the official Expo method to apply a downloaded OTA update.
    // It works on both iOS and Android release builds by restarting the JS runtime with the new bundle.
    await Updates.reloadAsync();
  } catch (error) {
    console.warn('[appUpdateService] reloadAsync failed, falling back to exitApp:', error);
    if (Platform.OS === 'android') {
      try {
        RNExitApp.exitApp();
      } catch (exitError) {
        BackHandler.exitApp();
      }
    }
    console.warn('[appUpdateService] reloadAsync failed, falling back to exitApp:', error);
    if (Platform.OS === 'android') {
      try {
        RNExitApp.exitApp();
      } catch (exitError) {
        BackHandler.exitApp();
      }
    }
  }
};

const getLocalApkUri = () => `${FileSystem.cacheDirectory}spay-latest.apk`;
const getLocalMetadataUri = () => `${FileSystem.cacheDirectory}spay-latest-metadata.json`;

export const getDownloadedApkVersionCode = async (): Promise<number | null> => {
  try {
    const apkUri = getLocalApkUri();
    const metadataUri = getLocalMetadataUri();

    const apkInfo = await FileSystem.getInfoAsync(apkUri);
    if (!apkInfo.exists || (typeof apkInfo.size === 'number' && apkInfo.size < MIN_APK_BYTES)) {
      return null;
    }

    const metadataInfo = await FileSystem.getInfoAsync(metadataUri);
    if (!metadataInfo.exists) {
      return null;
    }

    const metadataText = await FileSystem.readAsStringAsync(metadataUri);
    const metadata = JSON.parse(metadataText);
    return typeof metadata.versionCode === 'number' ? metadata.versionCode : null;
  } catch (error) {
    return null;
  }
};

export const downloadAndInstallConfiguredApkAsync = async (
  apkUrlOverride?: string | null,
  latestVersionCode?: number | null
) => {
  const apkUrl = apkUrlOverride || getAppUpdateRuntimeInfo().apkUrl;
  if (Platform.OS !== 'android') {
    throw new Error('APK installation is only available on Android.');
  }
  if (!apkUrl) {
    throw new Error('No Android APK URL is configured.');
  }

  const targetUri = getLocalApkUri();
  const metadataUri = getLocalMetadataUri();

  let targetVersionCode = latestVersionCode;
  if (!targetVersionCode) {
    try {
      const update = await checkForConfiguredApkUpdateAsync();
      targetVersionCode = update.latestVersionCode;
    } catch {
      // Ignore and proceed to download
    }
  }

  if (targetVersionCode) {
    const downloadedVersion = await getDownloadedApkVersionCode();
    if (downloadedVersion === targetVersionCode) {
      // Already fully downloaded! Just open the installer and return.
      const contentUri = await FileSystem.getContentUriAsync(targetUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: APK_MIME_TYPE,
        flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
      });
      return;
    }
  }

  // Show progress modal at 0%
  PremiumAlert.show({
    title: 'Downloading APK...',
    message: 'Please wait while the update is downloaded. This may take a moment depending on your connection.',
    buttons: [],
    options: { cancelable: false },
    isDownloading: true,
    progress: 0,
  });

  try {
    // Clean up any existing file before downloading to prevent conflicts
    const fileInfoBefore = await FileSystem.getInfoAsync(targetUri);
    if (fileInfoBefore.exists) {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      apkUrl,
      targetUri,
      {},
      (downloadProgress) => {
        const total = downloadProgress.totalBytesExpectedToWrite || 57000000; // Fallback to 57MB estimation if header missing
        const progress = Math.min(1, Math.max(0, downloadProgress.totalBytesWritten / total));
        
        PremiumAlert.show({
          title: 'Downloading APK...',
          message: 'Please wait while the update is downloaded. This may take a moment depending on your connection.',
          buttons: [],
          options: { cancelable: false },
          isDownloading: true,
          progress: progress,
        });
      }
    );

    const downloaded = await downloadResumable.downloadAsync();
    if (!downloaded) {
      throw new Error('Download was cancelled or failed.');
    }

    const status = typeof downloaded.status === 'number' ? downloaded.status : 200;
    const contentType = Object.entries(downloaded.headers ?? {}).find(
      ([key]) => key.toLowerCase() === 'content-type',
    )?.[1];
    const fileInfo = await FileSystem.getInfoAsync(downloaded.uri);

    if (status < 200 || status >= 300) {
      await FileSystem.deleteAsync(downloaded.uri, { idempotent: true });
      throw new Error(`APK download failed with HTTP ${status}.`);
    }

    if (typeof contentType === 'string' && contentType.includes('text/html')) {
      await FileSystem.deleteAsync(downloaded.uri, { idempotent: true });
      throw new Error('APK download returned a web page instead of an Android package.');
    }

    if (!fileInfo.exists || (typeof fileInfo.size === 'number' && fileInfo.size < MIN_APK_BYTES)) {
      await FileSystem.deleteAsync(downloaded.uri, { idempotent: true });
      throw new Error('APK download was incomplete.');
    }

    // Write version metadata on successful download
    if (targetVersionCode) {
      await FileSystem.writeAsStringAsync(
        metadataUri,
        JSON.stringify({ versionCode: targetVersionCode })
      ).catch(() => undefined);
    }

    // Dismiss download dialog and open installer
    PremiumAlert.dismiss();

    const contentUri = await FileSystem.getContentUriAsync(downloaded.uri);

    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: APK_MIME_TYPE,
      flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
    });
  } catch (error: any) {
    PremiumAlert.show({
      title: 'Download Failed',
      message: error?.message || 'Could not complete the APK download.',
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: () => PremiumAlert.dismiss() },
        {
          text: 'Open in Browser',
          onPress: async () => {
            await Linking.openURL(apkUrl);
            PremiumAlert.dismiss();
          }
        }
      ],
      icon: 'error'
    });
    throw error;
  }
};

const showApkFallbackPrompt = (
  message: string,
  apkUrlOverride?: string | null,
  latestVersionCode?: number | null,
  isAlreadyDownloaded = false
) => {
  if (promptVisible) return;
  promptVisible = true;

  PremiumAlert.alert(
    isAlreadyDownloaded ? 'Install latest app' : 'Download latest app',
    message,
    [
      {
        text: 'Later',
        style: 'cancel',
        onPress: () => {
          promptVisible = false;
        },
      },
      {
        text: isAlreadyDownloaded ? 'Install Now' : 'Download APK',
        onPress: async () => {
          try {
            await downloadAndInstallConfiguredApkAsync(apkUrlOverride, latestVersionCode);
          } catch (error: any) {
            PremiumAlert.alert(
              isAlreadyDownloaded ? 'APK installation failed' : 'APK installer opened',
              error?.message || 'Use the browser download if Android blocks direct install.'
            );
          } finally {
            promptVisible = false;
          }
        },
      },
    ]
  );
};

export const checkForConfiguredApkUpdateAndPromptAsync = async (manual = false) => {
  try {
    const update = await checkForConfiguredApkUpdateAsync();
    if (update.isAvailable) {
      const versionLabel = update.versionName
        ? `Version ${update.versionName}`
        : `Build ${update.latestVersionCode}`;

      // Verify if the latest version is already fully downloaded
      const downloadedVersion = await getDownloadedApkVersionCode();
      const isAlreadyDownloaded = !!downloadedVersion && downloadedVersion === update.latestVersionCode;

      showApkFallbackPrompt(
        isAlreadyDownloaded
          ? `${versionLabel} update has already been downloaded. Install it now to apply the updates.`
          : `${versionLabel} is available from GitHub. Download the latest Android build and confirm installation when Android opens the installer.`,
        update.apkUrl,
        update.latestVersionCode,
        isAlreadyDownloaded
      );
    } else if (manual && Platform.OS === 'android' && getAppUpdateRuntimeInfo().apkUrl) {
      PremiumAlert.alert(
        'Latest APK installed',
        update.currentVersionCode && update.latestVersionCode
          ? `Installed build ${update.currentVersionCode}; latest GitHub build ${update.latestVersionCode}.`
          : 'No newer Android APK was found on GitHub.',
      );
    }
    return update;
  } catch (error: any) {
    if (manual) {
      PremiumAlert.alert('APK update check failed', error?.message || 'Could not read the GitHub APK manifest.');
    }
    throw error;
  }
};

const showDownloadedUpdatePrompt = () => {
  if (promptVisible) return;
  promptVisible = true;

  PremiumAlert.alert(
    'Update Ready',
    'S-Pay has downloaded a new update. Would you like to restart the app now to apply it?',
    [
      {
        text: 'Later',
        style: 'cancel',
        onPress: () => {
          promptVisible = false;
        },
      },
      {
        text: 'Restart Now',
        onPress: () => {
          promptVisible = false;
          void closeAppForDownloadedUpdate();
        },
      },
    ],
  );
};

export const checkForUpdatesAndPromptAsync = async (manual = false): Promise<AppUpdateResult> => {
  const now = Date.now();
  if (!manual && now - lastAutomaticCheckAt < CHECK_COOLDOWN_MS) {
    return {
      status: 'not-available',
      canInstallApk: Platform.OS === 'android' && !!getAppUpdateRuntimeInfo().apkUrl,
      message: 'Automatic update check skipped during cooldown.',
    };
  }

  if (!manual) {
    lastAutomaticCheckAt = now;
  }

  const result = await checkForAppUpdateAsync();

  if (result.status === 'downloaded') {
    showDownloadedUpdatePrompt();
  } else if (manual && result.status === 'not-available') {
    await checkForConfiguredApkUpdateAndPromptAsync(true).catch(() => undefined);
  } else if ((result.status === 'disabled' || result.status === 'error') && result.canInstallApk) {
    await checkForConfiguredApkUpdateAndPromptAsync(manual).catch(() => {
      if (!manual) {
        showApkFallbackPrompt(`${result.message} Download the latest Android build instead.`);
      }
    });
  } else if (manual) {
    PremiumAlert.alert(
      result.status === 'error' ? 'Update check failed' : 'Updates unavailable',
      result.error ? `${result.message}\n\n${result.error}` : result.message,
    );
  }

  return result;
};
