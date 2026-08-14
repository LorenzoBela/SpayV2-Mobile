import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMMKVStorage: Record<string, string> = {};

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

import { resolveIsDark, getPersistedTheme, savePersistedTheme, THEME_STORAGE_KEY } from '../utils/themeStorage';

describe('themeStorage module', () => {
  beforeEach(() => {
    Object.keys(mockMMKVStorage).forEach((k) => delete mockMMKVStorage[k]);
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
