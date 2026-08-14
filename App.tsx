import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { trpc, getTrpcHeaders, fetchWithTimeout } from './src/utils/trpc';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { supabase, expoSecureStorage } from './src/utils/supabase';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { clientPersister } from './src/utils/queryPersister';
import { ProgressProvider } from './src/context/ProgressContext';
import { ImpersonationProvider } from './src/context/ImpersonationContext';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from './src/utils/posthog';
import AppNavigator from './src/navigation/AppNavigator';
import AppUpdateGate from './src/components/AppUpdateGate';
import GlobalPremiumAlert from './src/components/GlobalPremiumAlert';
import GlobalProgressBar from './src/components/GlobalProgressBar';
import * as SplashScreen from 'expo-splash-screen';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';

// Keep the native splash screen visible until the custom animated splash mounts
SplashScreen.preventAutoHideAsync().catch(() => {});

// Import Google Fonts loaders (essential 3 font weights: Regular 400, SemiBold 600, Bold 700)
import {
  useFonts,
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { queryClient } from './src/utils/queryClient';
export { queryClient };

const getApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://nootspaytracker.vercel.app';
};

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getApiUrl()}/api/trpc`,
      headers: getTrpcHeaders,
      fetch: fetchWithTimeout,
      transformer: superjson as any,
      maxURLLength: 2083,
    }),
  ],
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
    'Outfit-Light': Outfit_400Regular,
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_600SemiBold,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
    'Outfit-ExtraBold': Outfit_700Bold,
    'Jakarta-Light': PlusJakartaSans_400Regular,
    'Jakarta-Regular': PlusJakartaSans_400Regular,
    'Jakarta-Medium': PlusJakartaSans_600SemiBold,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
    'Jakarta-ExtraBold': PlusJakartaSans_700Bold,
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
      <PostHogProvider client={posthog}>
        <ImpersonationProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: clientPersister,
              maxAge: 1000 * 60 * 60 * 24, // Match 24 hours cache retention
              dehydrateOptions: {
                shouldDehydrateQuery: () => true, // Persist all queries
              },
            }}
          >
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
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
            </trpc.Provider>
          </PersistQueryClientProvider>
        </ImpersonationProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}
