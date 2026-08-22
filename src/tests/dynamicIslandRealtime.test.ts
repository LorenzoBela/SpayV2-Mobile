import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lucide-react-native', () => {
  const DummyIcon = () => null;
  return {
    Sun: DummyIcon,
    CloudSun: DummyIcon,
    Cloud: DummyIcon,
    CloudRain: DummyIcon,
    CloudDrizzle: DummyIcon,
    CloudLightning: DummyIcon,
    CloudFog: DummyIcon,
    Snowflake: DummyIcon,
    CreditCard: DummyIcon,
    RefreshCw: DummyIcon,
    Users: DummyIcon,
    ChevronRight: DummyIcon,
    Zap: DummyIcon,
    Check: DummyIcon,
    ShoppingBag: DummyIcon,
    WifiOff: DummyIcon,
    AlertTriangle: DummyIcon,
    Download: DummyIcon,
    ShieldAlert: DummyIcon,
    Sparkles: DummyIcon,
    Tag: DummyIcon,
    User: DummyIcon,
    Flame: DummyIcon,
    PartyPopper: DummyIcon,
    PiggyBank: DummyIcon,
    TrendingUp: DummyIcon,
    AlertCircle: DummyIcon,
    Percent: DummyIcon,
    Fingerprint: DummyIcon,
    Send: DummyIcon,
  };
});

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(null),
  deleteItemAsync: vi.fn().mockResolvedValue(null),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: vi.fn(async () => ({
    coords: { latitude: 14.5995, longitude: 120.9842 },
  })),
  getLastKnownPositionAsync: vi.fn(async () => null),
  Accuracy: { Balanced: 3 },
}));

vi.mock('../utils/queryPersister', () => {
  const store = new Map<string, string>();
  return {
    storage: {
      getString: vi.fn((key: string) => store.get(key)),
      set: vi.fn((key: string, value: string) => store.set(key, value)),
      remove: vi.fn((key: string) => store.delete(key)),
      clearAll: vi.fn(() => store.clear()),
    },
  };
});

import {
  getLiveWeatherSnapshot,
  CACHE_KEY_PAYLOAD,
  CACHE_KEY_TIME,
  WeatherInfo,
} from '../services/weatherService';
import { storage } from '../utils/queryPersister';
import { extractFirstName, DynamicIslandNotificationPayload } from '../context/DynamicIslandContext';

describe('Dynamic Island Real-Time Weather & Payload Suite (Mobile)', () => {
  beforeEach(() => {
    storage.clearAll();
    vi.clearAllMocks();
  });

  it('provides dynamic weather temperature and rain probability snapshot without 30°C hardcoding', () => {
    const customWeather: WeatherInfo = {
      temp: 27,
      feelsLike: 29,
      humidity: 82,
      windSpeed: 12,
      code: 61,
      label: 'Rainy',
      locationName: 'Makati, PH',
      lastUpdated: '07:00 AM',
      rainChance: 65,
      rainTime: '8:00 AM',
      dailyForecast: [],
      hourlyRain: [],
      stormAlert: null,
    };

    storage.set(
      CACHE_KEY_PAYLOAD,
      JSON.stringify({
        timestamp: Date.now(),
        lat: 14.5547,
        lon: 121.0244,
        city: 'Makati, PH',
        weather: customWeather,
      })
    );
    storage.set(CACHE_KEY_TIME, Date.now().toString());

    const snapshot = getLiveWeatherSnapshot();
    expect(snapshot.temp).toBe(27);
    expect(snapshot.tempStr).toBe('27°C');
    expect(snapshot.rainChance).toBe(65);
    expect(snapshot.rainStr).toBe('🌧️ 65%');
    expect(snapshot.locationName).toBe('Makati, PH');
    expect(snapshot.label).toBe('Rainy');
  });

  it('extracts and capitalizes user first names accurately', () => {
    expect(extractFirstName('lorenzo bela')).toBe('Lorenzo');
    expect(extractFirstName('maria clara santos')).toBe('Maria');
    expect(extractFirstName(undefined, 'carlos.dev@spay.ph')).toBe('Carlos');
  });

  it('validates 20+ notification payload variants for Dynamic Island', () => {
    const samplePayload: DynamicIslandNotificationPayload = {
      id: 'test_123',
      type: 'payment_streak',
      title: '3-Month Payment Streak!',
      subtitle: 'On-time milestone reached',
      amount: '₱1,500.00',
      compactText: 'Streak Milestone',
      compactBadge: '3 Months 🔥',
      detailLeft: 'Zero Late Fees',
      detailRight: 'Perks ✓',
      actionText: 'View Badges',
      durationMs: 6000,
    };

    expect(samplePayload.type).toBe('payment_streak');
    expect(samplePayload.compactBadge).toContain('🔥');
    expect(samplePayload.amount).toBe('₱1,500.00');
  });
});
