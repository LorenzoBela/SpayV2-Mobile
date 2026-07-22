import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldAlert, LogOut, UserCheck } from 'lucide-react-native';
import { useImpersonation } from '../context/ImpersonationContext';

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, exitImpersonation } = useImpersonation();
  const insets = useSafeAreaInsets();

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.contentRow}>
        <View style={styles.infoGroup}>
          <View style={styles.iconContainer}>
            <ShieldAlert size={18} color="#fbbf24" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.badgeText}>ADMIN IMPERSONATION MODE</Text>
            <Text style={styles.userText} numberOfLines={1}>
              Impersonating: <Text style={styles.userNameText}>{impersonatedUser.name}</Text>
              {impersonatedUser.email ? ` (${impersonatedUser.email})` : ''}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.exitButton}
          onPress={exitImpersonation}
          activeOpacity={0.8}
        >
          <LogOut size={14} color="#7f1d1d" />
          <Text style={styles.exitButtonText}>Exit Impersonation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#7f1d1d',
    borderBottomWidth: 1.5,
    borderBottomColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingBottom: 10,
    zIndex: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  textContainer: {
    flex: 1,
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  userText: {
    color: '#fef2f2',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
    marginTop: 1,
  },
  userNameText: {
    fontFamily: 'Jakarta-Bold',
    color: '#ffffff',
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  exitButtonText: {
    color: '#7f1d1d',
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
});

export default ImpersonationBanner;
