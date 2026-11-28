import React, { useContext, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Clock, ShieldAlert, RefreshCw, LogOut, CheckCircle2, Mail } from 'lucide-react-native';
import { ThemeContext } from '../../navigation/navigationTypes';

interface AccountScreeningScreenProps {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
  notes?: string | null;
  onRefreshStatus: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
}

export default function AccountScreeningScreen({
  name,
  email,
  avatarUrl,
  status,
  notes,
  onRefreshStatus,
  onSignOut,
}: AccountScreeningScreenProps) {
  const { isDarkMode } = useContext(ThemeContext);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isRejected = status === 'REJECTED';
  const displayName = name || email?.split('@')[0] || 'Account';

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatusMessage(null);
    try {
      await onRefreshStatus();
      setStatusMessage(
        isRejected
          ? 'Still not approved. Please contact the administrator.'
          : 'Still pending review. You will enter automatically once approved.'
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const bg = isDarkMode ? '#020617' : '#f8fafc';
  const cardBg = isDarkMode ? '#0f172a' : '#ffffff';
  const border = isDarkMode ? '#1e293b' : '#e2e8f0';
  const textPrimary = isDarkMode ? '#f8fafc' : '#0f172a';
  const textSecondary = isDarkMode ? '#94a3b8' : '#475569';
  const identityBg = isDarkMode ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#ee4d2d"
            colors={['#ee4d2d']}
          />
        }
      >
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isRejected ? 'rgba(244, 63, 94, 0.12)' : 'rgba(238, 77, 45, 0.12)',
                borderColor: isRejected ? 'rgba(244, 63, 94, 0.25)' : 'rgba(238, 77, 45, 0.25)',
              },
            ]}
          >
            {isRejected ? (
              <ShieldAlert size={28} color="#f43f5e" />
            ) : (
              <Clock size={28} color="#ee4d2d" />
            )}
          </View>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: isRejected ? 'rgba(244, 63, 94, 0.12)' : 'rgba(245, 158, 11, 0.14)',
              },
            ]}
          >
            <View style={[styles.badgeDot, { backgroundColor: isRejected ? '#f43f5e' : '#f59e0b' }]} />
            <Text style={[styles.badgeText, { color: isRejected ? '#f43f5e' : '#d97706' }]}>
              {isRejected ? 'Account Not Approved' : 'Pending Review'}
            </Text>
          </View>

          <Text style={[styles.title, { color: textPrimary }]}>
            {isRejected ? 'Access Not Approved' : 'Your Account Is Pending Review'}
          </Text>

          <Text style={[styles.subtitle, { color: textSecondary }]}>
            {isRejected
              ? 'Your account could not be approved at this time. Please reach out to the administrator if you believe this was a mistake.'
              : 'Thanks for signing in! An administrator needs to verify your account before you can access your dashboard.'}
          </Text>

          <View style={[styles.identityCard, { backgroundColor: identityBg, borderColor: border }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.identityInfo}>
              <Text style={[styles.identityName, { color: textPrimary }]} numberOfLines={1}>
                {displayName}
              </Text>
              {!!email && (
                <View style={styles.emailRow}>
                  <Mail size={12} color={textSecondary} />
                  <Text style={[styles.identityEmail, { color: textSecondary }]} numberOfLines={1}>
                    {email}
                  </Text>
                </View>
              )}
            </View>
            <CheckCircle2 size={16} color="#10b981" />
          </View>

          {!!notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Note from Administrator</Text>
              <Text style={styles.notesBody}>{notes}</Text>
            </View>
          )}

          {!!statusMessage && (
            <Text style={[styles.statusMessage, { color: textSecondary }]}>
              {statusMessage}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, (refreshing || signingOut) && styles.btnDisabled]}
            onPress={handleRefresh}
            disabled={refreshing || signingOut}
            activeOpacity={0.85}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <RefreshCw size={16} color="#ffffff" />
            )}
            <Text style={styles.primaryBtnText}>
              {refreshing ? 'Checking Status...' : 'Check Status'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' },
              (refreshing || signingOut) && styles.btnDisabled,
            ]}
            onPress={handleSignOut}
            disabled={refreshing || signingOut}
            activeOpacity={0.85}
          >
            <LogOut size={16} color={textPrimary} />
            <Text style={[styles.secondaryBtnText, { color: textPrimary }]}>
              {signingOut ? 'Signing Out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  identityCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginTop: 20,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ee4d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  identityInfo: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontSize: 14,
    fontWeight: '700',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  identityEmail: {
    fontSize: 12,
    flexShrink: 1,
  },
  notesBox: {
    width: '100%',
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    padding: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e11d48',
    marginBottom: 2,
  },
  notesBody: {
    fontSize: 12,
    color: '#be123c',
    lineHeight: 18,
  },
  statusMessage: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ee4d2d',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
