import { describe, it, expect, vi } from 'vitest';

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

vi.mock('react-native-mmkv', () => {
  return {
    MMKV: class {
      getString = vi.fn().mockReturnValue(null);
      set = vi.fn();
      delete = vi.fn();
    },
  };
});

import { extractFirstName } from '../context/DynamicIslandContext';

describe('Dynamic Island & Profile Helpers', () => {
  describe('extractFirstName', () => {
    it('extracts first name from full name string and capitalizes it', () => {
      expect(extractFirstName('Lorenzo Bela', 'user@example.com')).toBe('Lorenzo');
      expect(extractFirstName('john doe', 'user@example.com')).toBe('John');
      expect(extractFirstName('Admin Lorenzo Bela', 'admin@example.com')).toBe('Lorenzo');
    });

    it('falls back to email prefix when name is missing or empty', () => {
      expect(extractFirstName(undefined, 'maria.clara@spay.com')).toBe('Maria');
      expect(extractFirstName(undefined, 'carlos_santos@spay.ph')).toBe('Carlos');
    });

    it('returns default fallback when name and email prefix are absent', () => {
      expect(extractFirstName(undefined, undefined)).toBe('Lorenzo');
      expect(extractFirstName('', '')).toBe('Lorenzo');
      expect(extractFirstName(undefined, 'admin@spay.ph')).toBe('Lorenzo');
    });
  });
});
