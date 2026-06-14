import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { clientPersister } from './src/utils/queryPersister';
import { ProgressProvider } from './src/context/ProgressContext';
import AppNavigator from './src/navigation/AppNavigator';
import PremiumLoader from './src/components/PremiumLoader';
import AppUpdateGate from './src/components/AppUpdateGate';
import GlobalPremiumAlert from './src/components/GlobalPremiumAlert';
import GlobalProgressBar from './src/components/GlobalProgressBar';
import * as SplashScreen from 'expo-splash-screen';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';

// Keep the native splash screen visible until the custom animated splash mounts
SplashScreen.preventAutoHideAsync().catch(() => {});

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

// Configure TanStack Query client for fetching states with custom cache/gc lifetime
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days cache retention
      staleTime: 1000 * 60 * 5, // 5 minutes stale time
    },
  },
});

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
  const [isSplashAnimationComplete, setIsSplashAnimationComplete] = useState(false);

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
    return null; // Hold the native splash screen until fonts are loaded
  }

  if (!isSplashAnimationComplete) {
    return (
      <AnimatedSplashScreen
        onAnimationComplete={() => setIsSplashAnimationComplete(true)}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: clientPersister,
          maxAge: 1000 * 60 * 60 * 24 * 30, // Match 30 days cache retention
          dehydrateOptions: {
            shouldDehydrateQuery: () => true, // Persist all queries
          },
        }}
      >
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
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
