import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';

interface AdminErrorBannerProps {
  error: string | null | undefined;
  onRetry: () => void;
}

export default function AdminErrorBanner({ error, onRetry }: AdminErrorBannerProps) {
  if (!error) return null;

  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        marginBottom: 12,
        gap: 10,
      }}
      onPress={onRetry}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Retry loading cached data"
    >
      <AlertCircle size={18} color="#ef4444" />
      <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={2}>
        {error} Showing cached data — tap to retry.
      </Text>
      <RefreshCw size={15} color="#ef4444" />
    </TouchableOpacity>
  );
}
