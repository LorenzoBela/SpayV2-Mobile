import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { MotiView, AnimatePresence } from 'moti';
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Zap,
  ShieldCheck,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { ensureDeviceRegistration } from '../services/fcmNotificationService';
import { ensureTrayNotificationPermissions } from '../services/notificationService';
import { getLinkedProfileForCurrentUser } from '../utils/authProfile';
import { storage } from '../utils/queryPersister';

interface DevicePushStatusCardProps {
  userId?: string;
  onSyncComplete?: (token: string | null) => void;
  showDetailsDefault?: boolean;
}

export default function DevicePushStatusCard({
  userId: propUserId,
  onSyncComplete,
  showDetailsDefault = false,
}: DevicePushStatusCardProps) {
  const { isDarkMode } = useContext(ThemeContext);
  const [syncing, setSyncing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(showDetailsDefault);
  const [copied, setCopied] = useState(false);

  const deviceModel = Device.modelName || (Platform.OS === 'android' ? 'Android Device' : 'iOS Device');
  const manufacturer = (Device.manufacturer || '').toLowerCase();
  const brand = (Device.brand || '').toLowerCase();
  const isSamsung = manufacturer.includes('samsung') || brand.includes('samsung');

  const checkLocalStatus = useCallback(async () => {
    try {
      const perms = await Notifications.getPermissionsAsync();
      setPermissionGranted(perms.status === 'granted');

      const cachedToken = storage.getString('spay_cached_fcm_token');
      const cachedTime = storage.getString('spay_last_fcm_sync');
      if (cachedToken) {
        setActiveToken(cachedToken);
      }
      if (cachedTime) {
        setLastSyncTime(cachedTime);
      }
    } catch (err) {
      console.warn('[DevicePushStatusCard] checkLocalStatus error:', err);
    }
  }, []);

  useEffect(() => {
    void checkLocalStatus();
  }, [checkLocalStatus]);

  const handleSync = async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSyncing(true);

      let effectiveId = propUserId;
      if (!effectiveId) {
        const { profileId } = await getLinkedProfileForCurrentUser();
        effectiveId = profileId || undefined;
      }

      if (!effectiveId) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Authentication Required', 'Please log in to register your push notification device.');
        return;
      }

      const hasPerm = await ensureTrayNotificationPermissions();
      setPermissionGranted(hasPerm);

      if (!hasPerm) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Notifications Blocked',
          'Notification permission is disabled. Please open system settings and enable "Allow notifications" for Spay.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'android') {
                  void Linking.openSettings();
                }
              },
            },
          ],
        );
        return;
      }

      const token = await ensureDeviceRegistration(effectiveId);
      if (token) {
        const nowIso = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setActiveToken(token);
        setLastSyncTime(nowIso);
        storage.set('spay_cached_fcm_token', token);
        storage.set('spay_last_fcm_sync', nowIso);

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSyncComplete?.(token);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Push Registration Notice',
          'Could not retrieve token from Google Play Services. Please verify your internet connection and try again.',
        );
      }
    } catch (err: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sync Failed', err?.message || 'Error communicating with notification server.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyToken = async () => {
    if (!activeToken) return;
    await Clipboard.setStringAsync(activeToken);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isReady = permissionGranted === true && Boolean(activeToken);

  // High-Bandwidth Fintech Control Surface Design Tokens
  const theme = {
    cardBg: isDarkMode ? '#0f172a' : '#ffffff',
    cardBorder: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    statusReadyBg: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.08)',
    statusReadyBorder: isDarkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
    statusReadyText: '#22c55e',
    statusWarnBg: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
    statusWarnBorder: isDarkMode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)',
    statusWarnText: '#f59e0b',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    pillBg: isDarkMode ? '#1e293b' : '#f1f5f9',
    accentBtnBg: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
    accentBtnBorder: '#3b82f6',
    accentText: '#3b82f6',
    subtleBg: isDarkMode ? '#1e293b' : '#f8fafc',
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      {/* Header Bar */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: isReady ? theme.statusReadyBg : theme.statusWarnBg }]}>
            <Smartphone size={18} color={isReady ? theme.statusReadyText : theme.statusWarnText} />
          </View>
          <View style={styles.headerTextGroup}>
            <View style={styles.titleWithBadge}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>{deviceModel}</Text>
              <View
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: isReady ? theme.statusReadyBg : theme.statusWarnBg,
                    borderColor: isReady ? theme.statusReadyBorder : theme.statusWarnBorder,
                  },
                ]}
              >
                {isReady ? (
                  <CheckCircle2 size={11} color={theme.statusReadyText} />
                ) : (
                  <AlertCircle size={11} color={theme.statusWarnText} />
                )}
                <Text style={[styles.statusChipText, { color: isReady ? theme.statusReadyText : theme.statusWarnText }]}>
                  {isReady ? 'Push Active' : 'Needs Sync'}
                </Text>
              </View>
            </View>
            <Text style={[styles.subTitle, { color: theme.textSecondary }]}>
              {isReady
                ? `FCM v1 Engine • Synced ${lastSyncTime ? `${lastSyncTime}` : 'live'}`
                : 'Direct tray delivery ready for hardware sync'}
            </Text>
          </View>
        </View>

        {/* Sync Trigger Button */}
        <TouchableOpacity
          onPress={handleSync}
          disabled={syncing}
          style={[
            styles.syncBtn,
            { backgroundColor: theme.accentBtnBg, borderColor: theme.accentBtnBorder },
          ]}
          activeOpacity={0.7}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={theme.accentText} />
          ) : (
            <RefreshCw size={14} color={theme.accentText} />
          )}
          <Text style={[styles.syncBtnText, { color: theme.accentText }]}>
            {syncing ? 'Syncing...' : 'Sync'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Specs Grid */}
      <View style={[styles.specsGrid, { backgroundColor: theme.subtleBg, borderColor: theme.cardBorder }]}>
        <View style={styles.specItem}>
          <Text style={[styles.specLabel, { color: theme.textMuted }]}>ENGINE</Text>
          <View style={styles.specValueRow}>
            <Zap size={12} color="#3b82f6" />
            <Text style={[styles.specValue, { color: theme.textPrimary }]}>Firebase FCM v1</Text>
          </View>
        </View>

        <View style={[styles.specDivider, { backgroundColor: theme.cardBorder }]} />

        <View style={styles.specItem}>
          <Text style={[styles.specLabel, { color: theme.textMuted }]}>PRIORITY</Text>
          <View style={styles.specValueRow}>
            <ShieldCheck size={12} color="#22c55e" />
            <Text style={[styles.specValue, { color: theme.textPrimary }]}>High (Max Urgency)</Text>
          </View>
        </View>

        <View style={[styles.specDivider, { backgroundColor: theme.cardBorder }]} />

        <View style={styles.specItem}>
          <Text style={[styles.specLabel, { color: theme.textMuted }]}>PERMISSION</Text>
          <Text style={[styles.specValue, { color: permissionGranted ? '#22c55e' : '#f59e0b' }]}>
            {permissionGranted === null ? 'Checking...' : permissionGranted ? 'Granted' : 'Denied'}
          </Text>
        </View>
      </View>

      {/* Samsung Optimization Prompt if applicable */}
      {isSamsung && (
        <TouchableOpacity
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            void Linking.openSettings();
          }}
          style={[styles.samsungBanner, { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)' }]}
          activeOpacity={0.7}
        >
          <BatteryCharging size={14} color="#3b82f6" />
          <Text style={[styles.samsungBannerText, { color: theme.textSecondary }]}>
            Samsung OneUI detected: Set battery to <Text style={{ color: '#3b82f6', fontFamily: 'Jakarta-Bold' }}>Unrestricted</Text> for instant lock-screen alerts.
          </Text>
        </TouchableOpacity>
      )}

      {/* Expandable Diagnostic Token Details */}
      <TouchableOpacity
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowDetails(!showDetails);
        }}
        style={styles.detailsToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.detailsToggleText, { color: theme.textMuted }]}>
          {showDetails ? 'Hide Hardware Token' : 'View Hardware Token'}
        </Text>
        {showDetails ? (
          <ChevronUp size={14} color={theme.textMuted} />
        ) : (
          <ChevronDown size={14} color={theme.textMuted} />
        )}
      </TouchableOpacity>

      <AnimatePresence>
        {showDetails && (
          <MotiView
            from={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'timing', duration: 250 }}
            style={styles.detailsContainer}
          >
            {activeToken ? (
              <TouchableOpacity
                onPress={handleCopyToken}
                style={[styles.tokenBox, { backgroundColor: theme.pillBg, borderColor: theme.cardBorder }]}
                activeOpacity={0.8}
              >
                <View style={styles.tokenTextGroup}>
                  <Text style={[styles.tokenLabel, { color: theme.textMuted }]}>FCM TOKEN IDENTIFIER</Text>
                  <Text numberOfLines={2} style={[styles.tokenValue, { color: theme.textPrimary }]}>
                    {activeToken}
                  </Text>
                </View>
                <View style={[styles.copyBtn, { backgroundColor: copied ? '#22c55e' : theme.accentBtnBg }]}>
                  {copied ? (
                    <CheckCircle2 size={13} color="#ffffff" />
                  ) : (
                    <Copy size={13} color={theme.accentText} />
                  )}
                  <Text style={[styles.copyBtnText, { color: copied ? '#ffffff' : theme.accentText }]}>
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.tokenBox, { backgroundColor: theme.pillBg, borderColor: theme.cardBorder }]}>
                <Text style={[styles.noTokenText, { color: theme.textSecondary }]}>
                  No active token found yet. Tap "Sync" above to register this device.
                </Text>
              </View>
            )}
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.2,
  },
  subTitle: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 14,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.2,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
  },
  syncBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  specsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  specItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  specDivider: {
    width: 1,
    height: 24,
  },
  specLabel: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.5,
  },
  specValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specValue: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  samsungBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
  },
  samsungBannerText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    flex: 1,
    lineHeight: 15,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  detailsToggleText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
  },
  detailsContainer: {
    overflow: 'hidden',
  },
  tokenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  tokenTextGroup: {
    flex: 1,
    gap: 2,
  },
  tokenLabel: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.5,
  },
  tokenValue: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    fontVariant: ['tabular-nums'],
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  noTokenText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    width: '100%',
  },
});
