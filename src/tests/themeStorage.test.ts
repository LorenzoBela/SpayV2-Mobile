import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMMKVStorage: Record<string, string> = {};
const remote = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));

vi.mock('../utils/supabase', () => ({
  supabase: { from: () => {
    const query: any = {
      select: () => query,
      eq: () => query,
      maybeSingle: remote.read,
      upsert: remote.write,
    };
    return query;
  } },
}));

vi.mock('react-native-mmkv', () => ({
  createMMKV: vi.fn(() => ({
    getString: (k: string) => mockMMKVStorage[k],
    set: (k: string, v: string) => {
      mockMMKVStorage[k] = v;
    },
    remove: (k: string) => {
      delete mockMMKVStorage[k];
    },
    clearAll: () => {
      Object.keys(mockMMKVStorage).forEach((k) => delete mockMMKVStorage[k]);
    },
  })),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('expo-secure-store', () => ({
  getItem: vi.fn().mockReturnValue('mock-encryption-key-1234567890abcdef'),
  setItem: vi.fn(),
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(null),
  deleteItemAsync: vi.fn().mockResolvedValue(null),
}));

import { resolveIsDark, getPersistedTheme, savePersistedTheme, syncStartupTheme, THEME_STORAGE_KEY } from '../utils/themeStorage';

describe('themeStorage module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remote.read.mockResolvedValue({ data: { setting_value: 'dark' }, error: null });
    remote.write.mockResolvedValue({ error: null });
    Object.keys(mockMMKVStorage).forEach((k) => delete mockMMKVStorage[k]);
  });

  describe('startup theme synchronization', () => {
    it('preserves System selected while an older remote preference is loading', async () => {
      let finish!: (response: any) => void;
      remote.read.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
      let version = 0;
      const capturedVersion = version;
      const pending = syncStartupTheme('owner', () => version === capturedVersion);
      version += 1;
      savePersistedTheme('auto', 'owner');
      remote.write.mockClear();
      finish({ data: { setting_value: 'dark' }, error: null });
      expect(await pending).toBeNull();
      expect(getPersistedTheme()).toBe('auto');
      expect(remote.write).not.toHaveBeenCalled();
    });

    it('ignores a response after its account is no longer active', async () => {
      expect(await syncStartupTheme('old-owner', () => false)).toBeNull();
      expect(remote.write).not.toHaveBeenCalled();
    });

    it('loads the remote preference when no user change has superseded it', async () => {
      expect(await syncStartupTheme('owner', () => true)).toBe('dark');
      expect(getPersistedTheme()).toBe('dark');
      expect(remote.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveIsDark', () => {
    it('resolves dark preference to true', () => {
      expect(resolveIsDark('dark')).toBe(true);
    });

    it('resolves light preference to false', () => {
      expect(resolveIsDark('light')).toBe(false);
    });

    it('resolves auto preference according to Appearance', () => {
      expect(typeof resolveIsDark('auto')).toBe('boolean');
      expect(typeof resolveIsDark(undefined)).toBe('boolean');
      expect(typeof resolveIsDark(null)).toBe('boolean');
    });
  });

  describe('getPersistedTheme and savePersistedTheme', () => {
    it('defaults to auto when no theme stored so it follows device', () => {
      expect(getPersistedTheme()).toBe('auto');
    });

    it('persists theme to MMKV and updates cached profile', () => {
      mockMMKVStorage['cached_user_profile'] = JSON.stringify({ role: 'CLIENT', theme: 'light' });
      
      savePersistedTheme('dark', 'user_123');

      expect(mockMMKVStorage[THEME_STORAGE_KEY]).toBe('dark');
      expect(getPersistedTheme()).toBe('dark');

      const updatedProfile = JSON.parse(mockMMKVStorage['cached_user_profile']);
      expect(updatedProfile.theme).toBe('dark');
    });

    it('persists light theme accurately without glitching to dark', () => {
      savePersistedTheme('light', 'user_123');
      expect(getPersistedTheme()).toBe('light');
      expect(resolveIsDark(getPersistedTheme())).toBe(false);
    });

    it('persists auto theme to follow device', () => {
      savePersistedTheme('auto', 'user_123');
      expect(getPersistedTheme()).toBe('auto');
    });
  });
});
