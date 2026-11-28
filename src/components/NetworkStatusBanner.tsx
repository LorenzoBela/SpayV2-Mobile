import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff, RefreshCw } from 'lucide-react-native';

const getHealthUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  const base = url ? url.replace(/\/$/, '') : 'https://nootspaytracker.vercel.app';
  return `${base}/api/health`;
};

export default function NetworkStatusBanner() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [isOffline, setIsOffline] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      if (!offline) {
        setServerDown(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRetry = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(getHealthUrl(), { method: 'GET', signal: controller.signal });
      if (res.ok) {
        setIsOffline(false);
        setServerDown(false);
        queryClient.invalidateQueries({ type: 'active' });
      } else {
        setServerDown(true);
      }
    } catch {
      const net = await NetInfo.fetch();
      const offline = net.isConnected === false || net.isInternetReachable === false;
      setIsOffline(offline);
      if (!offline) setServerDown(true);
    } finally {
      clearTimeout(timer);
      setChecking(false);
    }
  }, [checking, queryClient]);

  if (!isOffline && !serverDown) return null;

  return (
    <View style={[styles.wrapper, { top: Math.max(insets.top + 6, 12) }]} pointerEvents="box-none">
      <View style={styles.pill} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <WifiOff size={14} color="#fef2f2" />
        <Text style={styles.text} numberOfLines={1}>
          {isOffline ? 'Offline — showing cached data' : 'Server unreachable'}
        </Text>
        <TouchableOpacity
          onPress={handleRetry}
          disabled={checking}
          style={styles.retryBtn}
          accessibilityLabel="Retry connection"
        >
          {checking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <RefreshCw size={12} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#b91c1c',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  text: {
    color: '#fef2f2',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  retryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
