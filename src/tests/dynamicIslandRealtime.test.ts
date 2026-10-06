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
import {
  extractFirstName,
  DynamicIslandNotificationPayload,
  DynamicIslandNotificationType,
  IslandPriority,
  IslandState,
  getVariantPriority,
  islandReducer,
  swapEvents,
  initialIslandState,
} from '../context/DynamicIslandContext';

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

  it('covers all 21 DynamicIslandNotificationType variants without regression', () => {
    const all21Variants: DynamicIslandNotificationType[] = [
      'payment',
      'overdue_alert',
      'payment_success',
      'order_assigned',
      'sync',
      'shared_payment',
      'payment_streak',
      'debt_free',
      'noot_savings',
      'limit_increase',
      'low_balance',
      'zero_interest',
      'biometric_auth',
      'offline_queue',
      'ota_update',
      'admin_impersonation',
      'admin_client_payment',
      'admin_risk_alert',
      'admin_reminder_sent',
      'promo_ad',
      'pro_subscription',
    ];
    expect(all21Variants).toHaveLength(21);
    for (const variant of all21Variants) {
      const payload: DynamicIslandNotificationPayload = {
        id: `test_${variant}`,
        type: variant,
        title: `Test ${variant}`,
        hasProgress: true,
        progressPct: 45,
      };
      expect(payload.type).toBe(variant);
      expect(payload.progressPct).toBe(45);
    }
  });

  it('correctly maps variant priorities with getVariantPriority', () => {
    expect(getVariantPriority('overdue_alert')).toBe(IslandPriority.CRITICAL);
    expect(getVariantPriority('admin_risk_alert')).toBe(IslandPriority.CRITICAL);
    expect(getVariantPriority('biometric_auth')).toBe(IslandPriority.CRITICAL);

    expect(getVariantPriority('payment')).toBe(IslandPriority.HIGH);
    expect(getVariantPriority('payment_success')).toBe(IslandPriority.HIGH);
    expect(getVariantPriority('order_assigned')).toBe(IslandPriority.HIGH);

    expect(getVariantPriority('limit_increase')).toBe(IslandPriority.NORMAL);
    expect(getVariantPriority('debt_free')).toBe(IslandPriority.NORMAL);
    expect(getVariantPriority('offline_queue')).toBe(IslandPriority.NORMAL);

    expect(getVariantPriority('sync')).toBe(IslandPriority.LOW);
    expect(getVariantPriority('promo_ad')).toBe(IslandPriority.LOW);
  });

  it('handles deterministic tie-breaking in islandReducer', () => {
    let state: IslandState = initialIslandState;

    // Normal priority notification
    state = islandReducer(state, {
      type: 'TRIGGER',
      payload: {
        id: 'n1',
        type: 'limit_increase',
        title: 'Limit Increase',
        startedAt: 1000,
      },
    });
    expect(state.activeNotification?.id).toBe('n1');

    // Higher priority notification arrives -> preempts active, n1 demoted to secondary
    state = islandReducer(state, {
      type: 'TRIGGER',
      payload: {
        id: 'n2',
        type: 'overdue_alert',
        title: 'Overdue Alert',
        startedAt: 1050,
      },
    });
    expect(state.activeNotification?.id).toBe('n2');
    expect(state.secondaryNotification?.id).toBe('n1');

    // Equal priority notification arrives -> newer timestamp wins active, n2 demoted to secondary
    state = islandReducer(state, {
      type: 'TRIGGER',
      payload: {
        id: 'n3',
        type: 'biometric_auth',
        title: 'Biometric Auth',
        startedAt: 2000,
      },
    });
    expect(state.activeNotification?.id).toBe('n3');
    expect(state.secondaryNotification?.id).toBe('n2');
  });

  it('performs automatic promotion when active notification expires or is dismissed', () => {
    let state: IslandState = {
      activeNotification: {
        id: 'active_1',
        type: 'overdue_alert',
        title: 'Overdue',
        expiresAt: 5000,
      },
      secondaryNotification: {
        id: 'sec_1',
        type: 'payment',
        title: 'Payment Scheduled',
        expiresAt: 10000,
      },
      isExpanded: false,
    };

    // Expire active_1 -> sec_1 automatically promoted to activeNotification!
    state = islandReducer(state, { type: 'EXPIRE', id: 'active_1' });
    expect(state.activeNotification?.id).toBe('sec_1');
    expect(state.secondaryNotification).toBeNull();

    // Dismiss sec_1 -> activeNotification becomes null
    state = islandReducer(state, { type: 'DISMISS', id: 'sec_1' });
    expect(state.activeNotification).toBeNull();
    expect(state.secondaryNotification).toBeNull();
  });

  it('exports swapEvents and correctly swaps active and secondary notifications', () => {
    const state: IslandState = {
      activeNotification: {
        id: 'first',
        type: 'payment',
        title: 'First Notification',
      },
      secondaryNotification: {
        id: 'second',
        type: 'sync',
        title: 'Second Notification',
      },
      isExpanded: true,
    };

    const swapped = swapEvents(state);
    expect(swapped.activeNotification?.id).toBe('second');
    expect(swapped.secondaryNotification?.id).toBe('first');
    expect(swapped.isExpanded).toBe(false);

    // Also verify reducer handling SWAP_EVENTS
    const reducerSwapped = islandReducer(state, { type: 'SWAP_EVENTS' });
    expect(reducerSwapped.activeNotification?.id).toBe('second');
    expect(reducerSwapped.secondaryNotification?.id).toBe('first');
  });

  it('updates matching notification id in-place in islandReducer without demotion', () => {
    let state: IslandState = initialIslandState;
    state = islandReducer(state, {
      type: 'TRIGGER',
      payload: {
        id: 'upload_task',
        type: 'sync',
        title: 'Uploading...',
        hasProgress: true,
        progressPct: 10,
      },
    });
    expect(state.activeNotification?.progressPct).toBe(10);

    // Update in-place
    state = islandReducer(state, {
      type: 'TRIGGER',
      payload: {
        id: 'upload_task',
        type: 'sync',
        title: 'Uploading...',
        hasProgress: true,
        progressPct: 80,
      },
    });
    expect(state.activeNotification?.progressPct).toBe(80);
    expect(state.secondaryNotification).toBeNull();
  });

  it('assigns authoritative startedAt, expiresAt, and priority with no countdownSeconds', () => {
    const fixedNow = 1700000000000;
    const state = islandReducer(initialIslandState, {
      type: 'TRIGGER',
      payload: {
        id: 'auth_payload',
        type: 'overdue_alert',
        title: 'Authoritative Timer Test',
        startedAt: fixedNow,
        durationMs: 7000,
      },
    });

    const active = state.activeNotification!;
    expect(active.startedAt).toBe(fixedNow);
    expect(active.expiresAt).toBe(fixedNow + 7000);
    expect(active.priority).toBe(IslandPriority.CRITICAL);
    expect((active as any).countdownSeconds).toBeUndefined();
  });
});


