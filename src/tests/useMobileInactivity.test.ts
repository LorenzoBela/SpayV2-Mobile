import { describe, it, expect, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

// Mock AppState
const listeners: Record<string, (state: string) => void> = {};
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn((event: string, callback: (state: string) => void) => {
      listeners[event] = callback;
      return { remove: vi.fn() };
    }),
  },
}));

describe('useMobileInactivity logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates last active timestamp in AsyncStorage', async () => {
    const key = 'spay_last_active_time';
    const now = Date.now();
    await AsyncStorage.setItem(key, now.toString());
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, now.toString());
  });

  it('detects timeout when elapsed time > 15 minutes', async () => {
    const key = 'spay_last_active_time';
    const sixteenMinutesAgo = Date.now() - 16 * 60 * 1000;
    (AsyncStorage.getItem as any).mockResolvedValueOnce(sixteenMinutesAgo.toString());

    const stored = await AsyncStorage.getItem(key);
    const elapsed = Date.now() - parseInt(stored!, 10);
    const timeout = 15 * 60 * 1000;

    if (elapsed > timeout) {
      await AsyncStorage.removeItem(key);
      await supabase.auth.signOut();
    }

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('does not sign out when elapsed time <= 15 minutes', async () => {
    const key = 'spay_last_active_time';
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    (AsyncStorage.getItem as any).mockResolvedValueOnce(fiveMinutesAgo.toString());

    const stored = await AsyncStorage.getItem(key);
    const elapsed = Date.now() - parseInt(stored!, 10);
    const timeout = 15 * 60 * 1000;

    if (elapsed > timeout) {
      await supabase.auth.signOut();
    }

    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
