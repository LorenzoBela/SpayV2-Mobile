import PostHog from 'posthog-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() || '';
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';

export const posthog = new PostHog(posthogApiKey, {
  host: posthogHost,
  customStorage: AsyncStorage,
  captureAppLifecycleEvents: true,
  disabled: !posthogApiKey,
});
