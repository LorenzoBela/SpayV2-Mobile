import React from 'react';
import { Text, View } from 'react-native';

export default function SplitOptionsHint({ sharingEnabled, primarySelected, hasParticipants, isDarkMode }: { sharingEnabled: boolean; primarySelected: boolean; hasParticipants: boolean; isDarkMode: boolean }) {
  return <View style={{ gap: 4, marginTop: 8 }}>
    <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11, lineHeight: 16 }}>Split equally, by percentage (30/70), exact amount, or ratio (1:2).</Text>
    <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11, lineHeight: 16, fontWeight: '500' }}>{!sharingEnabled
      ? 'Turn on sharing to choose how each client pays.'
      : !primarySelected
        ? 'Select the primary client, then choose who shares this order.'
        : !hasParticipants
          ? 'Add at least one sharing participant to set the split.'
          : ''}</Text>
  </View>;
}
