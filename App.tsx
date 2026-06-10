import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProgressProvider } from './src/context/ProgressContext';
import AppNavigator from './src/navigation/AppNavigator';
import PremiumLoader from './src/components/PremiumLoader';
import AppUpdateGate from './src/components/AppUpdateGate';
import GlobalPremiumAlert from './src/components/GlobalPremiumAlert';
import GlobalProgressBar from './src/components/GlobalProgressBar';

// Import Google Fonts loaders
import {
  useFonts,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

// Configure TanStack Query client for fetching states
const queryClient = new QueryClient();

// Clean themed styles overlay for react-native-paper if required
const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#ee4d2d',
    background: '#0b0f19',
    surface: '#161c2a',
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    'Outfit-Light': Outfit_300Light,
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
    'Outfit-ExtraBold': Outfit_800ExtraBold,
    'Jakarta-Light': PlusJakartaSans_300Light,
    'Jakarta-Regular': PlusJakartaSans_400Regular,
    'Jakarta-Medium': PlusJakartaSans_500Medium,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
    'Jakarta-ExtraBold': PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <PremiumLoader
        title="Loading System Fonts"
        subtitle="Downloading Outfit & Plus Jakarta Sans typography..."
        useSystemFonts={true}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={darkTheme}>
          <ProgressProvider>
            <SafeAreaProvider>
              <AppUpdateGate />
              <AppNavigator />
              <GlobalPremiumAlert />
              <GlobalProgressBar />
            </SafeAreaProvider>
          </ProgressProvider>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
