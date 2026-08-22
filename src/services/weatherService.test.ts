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
  };
});

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

vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: vi.fn(async () => ({
    coords: { latitude: 14.5995, longitude: 120.9842 },
  })),
  getLastKnownPositionAsync: vi.fn(async () => null),
  Accuracy: { Balanced: 3 },
}));

import {
  getWeatherDetails,
  getLiveWeatherSnapshot,
  fetchFreshWeather,
  subscribeToWeatherUpdates,
  deriveStormAlert,
  parseLocalDate,
  getRainChanceColor,
  getRainBarColor,
  CACHE_KEY_PAYLOAD,
  CACHE_KEY_TIME,
  WEATHER_CACHE_TTL_MS,
  WeatherSnapshot,
  WeatherInfo,
} from './weatherService';
import { storage } from '../utils/queryPersister';

describe('weatherService', () => {
  beforeEach(() => {
    storage.clearAll();
    vi.clearAllMocks();
  });

  it('correctly maps WMO weather codes to details and Lucide icons', () => {
    const clear = getWeatherDetails(0);
    expect(clear.label).toBe('Clear Sky');
    expect(clear.color).toBe('#fbbf24');
    expect(clear.icon).toBeDefined();

    const rain = getWeatherDetails(61);
    expect(rain.label).toBe('Rainy');
    expect(rain.color).toBe('#3b82f6');
    expect(rain.icon).toBeDefined();

    const thunder = getWeatherDetails(95);
    expect(thunder.label).toBe('Thunderstorm');
    expect(thunder.color).toBe('#a855f7');
    expect(thunder.icon).toBeDefined();
  });

  it('returns default snapshot when MMKV cache is empty', () => {
    const snapshot = getLiveWeatherSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.temp).toBe(29);
    expect(snapshot.tempStr).toBe('29°C');
    expect(snapshot.isFresh).toBe(false);
  });

  it('returns live snapshot from MMKV when cached payload is present', () => {
    const cachedWeather: WeatherInfo = {
      temp: 31,
      feelsLike: 34,
      humidity: 80,
      windSpeed: 15,
      code: 1,
      label: 'Partly Cloudy',
      locationName: 'Quezon City, PH',
      lastUpdated: '10:00 AM',
      rainChance: 45,
      rainTime: '2:00 PM',
      dailyForecast: [],
      hourlyRain: [],
      stormAlert: null,
    };

    storage.set(
      CACHE_KEY_PAYLOAD,
      JSON.stringify({
        timestamp: Date.now(),
        lat: 14.676,
        lon: 121.0437,
        city: 'Quezon City, PH',
        weather: cachedWeather,
      })
    );
    storage.set(CACHE_KEY_TIME, Date.now().toString());

    const snapshot = getLiveWeatherSnapshot();
    expect(snapshot.temp).toBe(31);
    expect(snapshot.tempStr).toBe('31°C');
    expect(snapshot.rainChance).toBe(45);
    expect(snapshot.rainStr).toBe('🌧️ 45%');
    expect(snapshot.locationName).toBe('Quezon City, PH');
    expect(snapshot.isFresh).toBe(true);
  });

  it('notifies subscribers upon weather update', async () => {
    const subscriber = vi.fn();
    const unsubscribe = subscribeToWeatherUpdates(subscriber);

    // Provide cached data to trigger update
    const sampleWeather: WeatherInfo = {
      temp: 28,
      feelsLike: 30,
      humidity: 75,
      windSpeed: 10,
      code: 0,
      label: 'Clear Sky',
      locationName: 'Manila, PH',
      dailyForecast: [
        {
          day: 'Today',
          dateLabel: 'Aug 21',
          code: 0,
          tempMax: 32,
          tempMin: 25,
          precipSum: 0,
          rainChanceMax: 10,
          windMax: 15,
        },
      ],
      hourlyRain: [{ hour: '1 PM', prob: 10, code: 0, temp: 31 }],
      stormAlert: null,
      rainChance: 10,
    };

    storage.set(
      CACHE_KEY_PAYLOAD,
      JSON.stringify({
        timestamp: Date.now(),
        weather: sampleWeather,
      })
    );

    const result = await fetchFreshWeather(false);
    expect(result).toBeDefined();
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('derives storm alert warning for severe weather', () => {
    const alert = deriveStormAlert(
      [
        {
          day: 'Today',
          dateLabel: 'Aug 21',
          code: 95,
          tempMax: 30,
          tempMin: 24,
          precipSum: 60,
          rainChanceMax: 90,
          windMax: 70,
        },
      ],
      [{ hour: '3 PM', prob: 90, code: 95, temp: 28 }]
    );

    expect(alert).not.toBeNull();
    expect(alert?.level).toBe('WARNING');
    expect(alert?.message).toContain('Thunderstorm');
  });

  it('formats rain chance colors properly', () => {
    expect(getRainChanceColor(70)).toBe('#ef4444');
    expect(getRainChanceColor(40)).toBe('#fbbf24');
    expect(getRainChanceColor(10)).toBe('#10b981');
    expect(getRainBarColor(20)).toBe('#60a5fa');
  });

  it('parses local date safely', () => {
    const d = parseLocalDate('2026-08-21');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // 0-indexed month (August = 7)
    expect(d.getDate()).toBe(21);
  });
});
