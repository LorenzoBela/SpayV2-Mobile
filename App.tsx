import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { trpc, getTrpcHeaders, fetchWithTimeout } from './src/utils/trpc';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { getCachedUserProfile } from './src/utils/authProfile';
import { initNetworkMonitor } from './src/utils/networkResilience';
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
import RootErrorBoundary from './src/components/RootErrorBoundary';
import PrivacyCurtain from './src/components/PrivacyCurtain';
import { useNetworkReconciliation } from './src/hooks/useNetworkReconciliation';
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

function AppContent() {
  useNetworkReconciliation();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PostHogProvider client={posthog} autocapture={{ captureScreens: false }}>
        <ImpersonationProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: clientPersister,
              maxAge: 1000 * 60 * 60 * 24, // Match 24 hours cache retention
              dehydrateOptions: {
                shouldDehydrateQuery: (query) => query.state.status === 'success',
              },
            }}
          >
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
              <PaperProvider theme={darkTheme}>
                <ProgressProvider>
                  <SafeAreaProvider>
                    <AppUpdateGate />
                    <AppNavigator />
                    <PrivacyCurtain />
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

export default function App() {
  const [hasCachedStartup] = useState(() => {
    const cached = getCachedUserProfile();
    return Boolean(cached?.linkedProfileId && ['ADMIN', 'CLIENT'].includes(cached?.role));
  });
  const [isSplashAnimationComplete, setIsSplashAnimationComplete] = useState(hasCachedStartup);

  const [fontsLoaded, fontError] = useFonts({
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

  // Start network monitoring immediately on boot without waiting for fonts or splash animation.
  useEffect(() => initNetworkMonitor(), []);

  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (fontsReady && hasCachedStartup) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady, hasCachedStartup]);

  // Safety net so native/animated splash can never wedge startup if an animation callback drops.
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setIsSplashAnimationComplete(true);
    }, 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <RootErrorBoundary>
      <View style={{ flex: 1 }}>
        <AppContent />
        {fontsReady && !isSplashAnimationComplete && (
          <View style={StyleSheet.absoluteFill}>
            <AnimatedSplashScreen
              onAnimationComplete={() => setIsSplashAnimationComplete(true)}
            />
          </View>
        )}
      </View>
    </RootErrorBoundary>
  );
}
