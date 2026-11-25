import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

import { expoSecureStorage } from './supabase';

describe('expoSecureStorage atomic chunking', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('round-trips >3KB Google OAuth session JSON and cleans up legacy key', async () => {
    store.set('sb-auth-token', 'legacy-small');
    const bigSession = JSON.stringify({
      access_token: 'a'.repeat(1200),
      refresh_token: 'r'.repeat(400),
      user: { id: 'u1', user_metadata: { bio: 'x'.repeat(2200) } },
    });

    await expoSecureStorage.setItem('sb-auth-token', bigSession);

    expect(store.has('sb-auth-token')).toBe(false);
    expect(store.has('sb-auth-token__meta')).toBe(true);
    expect(await expoSecureStorage.getItem('sb-auth-token')).toBe(bigSession);
  });

  it('reads legacy unchunked keys for backward compatibility', async () => {
    store.set('legacy-key', 'plain-session');
    expect(await expoSecureStorage.getItem('legacy-key')).toBe('plain-session');
  });

  it('handles concurrent writes and deletes stale chunks from older generations', async () => {
    const payloadV1 = '1'.repeat(4000); // 3 chunks
    const payloadV2 = '2'.repeat(2000); // 2 chunks

    await Promise.all([
      expoSecureStorage.setItem('session', payloadV1),
      expoSecureStorage.setItem('session', payloadV2),
    ]);

    expect(await expoSecureStorage.getItem('session')).toBe(payloadV2);
    expect(store.has('session__g1_c0')).toBe(false);
    expect(store.has('session__g1_c2')).toBe(false);
  });

  it('returns null instead of corrupt data if a chunk is missing, and removes all chunks on removeItem', async () => {
    await expoSecureStorage.setItem('session', 'z'.repeat(3800));
    store.delete('session__g1_c1');
    expect(await expoSecureStorage.getItem('session')).toBeNull();

    await expoSecureStorage.removeItem('session');
    expect(store.size).toBe(0);
  });
});
