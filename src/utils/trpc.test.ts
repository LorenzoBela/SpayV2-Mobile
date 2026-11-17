import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getSession: vi.fn(),
  secureGetItem: vi.fn(),
  cached: null as string | null,
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: state.getSession,
    },
  },
  expoSecureStorage: {
    getItem: state.secureGetItem,
  },
}));

vi.mock('./queryPersister', () => ({
  storage: {
    getString: () => state.cached,
    set: vi.fn(),
  },
}));

vi.mock('@trpc/react-query', () => ({
  createTRPCReact: () => ({}),
}));

vi.mock('@trpc/client', () => ({
  createTRPCClient: () => ({}),
  httpBatchLink: (options: unknown) => options,
}));

import { clearMemoryProfileCache, setCachedAuthSession } from './authProfile';
import { getTrpcHeaders, setCachedImpersonatedUserId } from './trpc';

describe('trpc getTrpcHeaders RAM token cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.cached = null;
    state.secureGetItem.mockResolvedValue(null);
    clearMemoryProfileCache();
    setCachedImpersonatedUserId(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves cached RAM token synchronously without hitting getSession when expiresAtMs - 30s > now', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    setCachedAuthSession({ access_token: 'ram-token-123', expires_at: nowSec + 120 });
    setCachedImpersonatedUserId('client-42');

    const headers = await getTrpcHeaders();

    expect(headers).toEqual({
      'x-spay-split-reader': '1',
      Authorization: 'Bearer ram-token-123',
      'x-impersonate-user-id': 'client-42',
    });
    expect(state.getSession).not.toHaveBeenCalled();
  });

  it('falls back to getSessionWithTimeout when token is within 30s of expiry', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    setCachedAuthSession({ access_token: 'near-expiry-token', expires_at: nowSec + 20 });
    state.getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'refreshed-token-456',
          expires_at: nowSec + 3600,
        },
      },
      error: null,
    });

    const headers = await getTrpcHeaders();

    expect(state.getSession).toHaveBeenCalledTimes(1);
    expect(headers).toEqual({
      'x-spay-split-reader': '1',
      Authorization: 'Bearer refreshed-token-456',
    });

    // Subsequent call uses the newly cached RAM token without calling getSession again.
    const nextHeaders = await getTrpcHeaders();
    expect(nextHeaders.Authorization).toBe('Bearer refreshed-token-456');
    expect(state.getSession).toHaveBeenCalledTimes(1);
  });

  it('clears RAM token on clearMemoryProfileCache and falls back to getSession', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    setCachedAuthSession({ access_token: 'stale-user-token', expires_at: nowSec + 600 });
    clearMemoryProfileCache();
    state.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    const headers = await getTrpcHeaders();

    expect(state.getSession).toHaveBeenCalledTimes(1);
    expect(headers).toEqual({
      'x-spay-split-reader': '1',
      Authorization: '',
    });
  });
});
