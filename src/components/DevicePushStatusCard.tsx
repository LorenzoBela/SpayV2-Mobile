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
  RefreshCw,
  Copy,
  Zap,
  ShieldCheck,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  BellRing,
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

function formatSyncTimestamp(timeStr: string | null): string {
  if (!timeStr) return 'Pending sync';
  try {
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;

      const isToday = date.toDateString() === now.toDateString();
      const timeFormatted = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      if (isToday) {
        return `Today, ${timeFormatted}`;
      }
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeFormatted}`;
    }
  } catch {
    // Non-blocking
  }
  return timeStr;
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

      const token = await ensureDeviceRegistration(effectiveId, 2);
      if (token) {
        const nowIso = new Date().toISOString();
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

  const isPermissionDenied = permissionGranted === false;
  const isReady = permissionGranted === true && Boolean(activeToken);

  const theme = {
    cardBg: isDarkMode ? '#090d16' : '#ffffff',
    cardBorder: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    iconBg: isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
    activeGreen: '#22c55e',
    activeGreenBg: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.08)',
    warnAmber: '#f59e0b',
    warnAmberBg: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
    pillBg: isDarkMode ? '#0f172a' : '#f8fafc',
    syncBtnBg: isReady
      ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)')
      : '#ee4d2d',
    syncBtnBorder: isReady
      ? (isDarkMode ? 'rgba(59, 130, 246, 0.35)' : '#3b82f6')
      : '#ee4d2d',
    syncBtnText: isReady ? '#3b82f6' : '#ffffff',
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      
      {/* ── Top Header Bar ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.deviceIconBox, { backgroundColor: theme.iconBg }]}>
            <Smartphone size={22} color="#3b82f6" strokeWidth={2.2} />
          </View>
          <View style={styles.headerMeta}>
            <Text style={[styles.deviceTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {deviceModel}
            </Text>
            <View style={styles.syncStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: isReady ? theme.activeGreen : theme.warnAmber }]} />
              <Text style={[styles.syncStatusText, { color: theme.textSecondary }]}>
                {isReady ? `Synced ${formatSyncTimestamp(lastSyncTime)}` : 'Manual sync required'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Action Button */}
        <TouchableOpacity
          onPress={isPermissionDenied ? () => void Linking.openSettings() : handleSync}
          disabled={syncing}
          style={[
            styles.syncBtn,
            { backgroundColor: theme.syncBtnBg, borderColor: theme.syncBtnBorder },
          ]}
          activeOpacity={0.8}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={theme.syncBtnText} />
          ) : (
            <RefreshCw size={14} color={theme.syncBtnText} strokeWidth={2.2} />
          )}
          <Text style={[styles.syncBtnText, { color: theme.syncBtnText }]}>
            {syncing ? 'Syncing...' : isReady ? 'Re-Sync' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Key-Value Specs List ── */}
      <View style={styles.specsList}>
        
        {/* Row 1: Engine */}
        <View style={styles.specRow}>
          <View style={styles.specRowLeft}>
            <Zap size={15} color="#3b82f6" strokeWidth={2} />
            <Text style={[styles.specRowLabel, { color: theme.textSecondary }]}>Push Engine</Text>
          </View>
          <Text style={[styles.specRowValue, { color: theme.textPrimary }]}>Firebase FCM v1</Text>
        </View>

        <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />

        {/* Row 2: Priority */}
        <View style={styles.specRow}>
          <View style={styles.specRowLeft}>
            <ShieldCheck size={15} color={theme.activeGreen} strokeWidth={2} />
            <Text style={[styles.specRowLabel, { color: theme.textSecondary }]}>Priority & Delivery</Text>
          </View>
          <Text style={[styles.specRowValue, { color: theme.textPrimary }]}>High (Instant Tray)</Text>
        </View>

        <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />

        {/* Row 3: Permission */}
        <View style={styles.specRow}>
          <View style={styles.specRowLeft}>
            <BellRing size={15} color={permissionGranted ? theme.activeGreen : theme.warnAmber} strokeWidth={2} />
            <Text style={[styles.specRowLabel, { color: theme.textSecondary }]}>System Permission</Text>
          </View>
          <View style={[styles.pillBadge, { backgroundColor: permissionGranted ? theme.activeGreenBg : theme.warnAmberBg }]}>
            <Text style={[styles.pillBadgeText, { color: permissionGranted ? theme.activeGreen : theme.warnAmber }]}>
              {permissionGranted === null ? 'Checking...' : permissionGranted ? 'Granted' : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* Row 4 (Optional): Samsung OneUI Battery */}
        {isSamsung && (
          <>
            <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />
            <TouchableOpacity
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void Linking.openSettings();
              }}
              style={styles.specRow}
              activeOpacity={0.7}
            >
              <View style={styles.specRowLeft}>
                <BatteryCharging size={15} color="#3b82f6" strokeWidth={2} />
                <Text style={[styles.specRowLabel, { color: theme.textSecondary }]}>OneUI Battery</Text>
              </View>
              <View style={styles.samsungActionRow}>
                <Text style={styles.samsungActionText}>Set Unrestricted</Text>
                <ChevronRight size={14} color="#3b82f6" />
              </View>
            </TouchableOpacity>
          </>
        )}

      </View>

      {/* ── Expandable Hardware Token ── */}
      <TouchableOpacity
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowDetails(!showDetails);
        }}
        style={styles.detailsToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.detailsToggleText, { color: theme.textMuted }]}>
          {showDetails ? 'Hide Device Token' : 'View Device Token'}
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
            transition={{ type: 'timing', duration: 200 }}
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
                <View style={[styles.copyBtn, { backgroundColor: copied ? theme.activeGreen : theme.iconBg }]}>
                  {copied ? (
                    <CheckCircle2 size={13} color="#ffffff" />
                  ) : (
                    <Copy size={13} color="#3b82f6" />
                  )}
                  <Text style={[styles.copyBtnText, { color: copied ? '#ffffff' : '#3b82f6' }]}>
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.tokenBox, { backgroundColor: theme.pillBg, borderColor: theme.cardBorder }]}>
                <Text style={[styles.noTokenText, { color: theme.textSecondary }]}>
                  No active token found. Tap "Sync Now" above to register.
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    flex: 1,
    gap: 3,
  },
  deviceTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.2,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncStatusText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 15,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncBtnText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  specsList: {
    borderRadius: 14,
    paddingVertical: 4,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  specRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  specRowLabel: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
  },
  specRowValue: {
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  rowDivider: {
    width: '100%',
    height: 1,
  },
  pillBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
  },
  pillBadgeText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.2,
  },
  samsungActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  samsungActionText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
    color: '#3b82f6',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  detailsToggleText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  detailsContainer: {
    overflow: 'hidden',
  },
  tokenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  tokenTextGroup: {
    flex: 1,
    gap: 4,
  },
  tokenLabel: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 0.6,
  },
  tokenValue: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  noTokenText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    textAlign: 'center',
    width: '100%',
  },
});
