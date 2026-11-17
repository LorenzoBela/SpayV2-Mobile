import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), cached: null as string | null, getSession: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: state.rpc, from: state.from, auth: { getSession: state.getSession } }, expoSecureStorage: { getItem: async () => null } }));
vi.mock('./queryPersister', () => ({ storage: { getString: () => state.cached, set: vi.fn() } }));
import {
  getLinkedProfileForUser,
  getLinkedProfileForCurrentUser,
  primeCurrentUserProfile,
  clearMemoryProfileCache,
  getCachedUserProfile,
  getSessionWithTimeout,
} from './authProfile';

describe('startup profile request coalescing', () => {
  beforeEach(() => { vi.clearAllMocks(); state.cached = null; clearMemoryProfileCache(); });
  afterEach(() => { vi.useRealTimers(); });

  it('reuses the profile resolved by navigation without a second RPC', async () => {
    state.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } });
    primeCurrentUserProfile('owner', { id: 'linked', email: 'owner@example.com', role: 'CLIENT' });
    expect((await getLinkedProfileForCurrentUser()).profileId).toBe('linked');
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('restores only the signed-in account profile', () => {
    const profile = { authUserId: 'owner', linkedProfileId: 'linked', role: 'CLIENT' };
    state.cached = JSON.stringify(profile);
    expect(getCachedUserProfile('owner')).toEqual(profile);
    expect(getCachedUserProfile('other')).toBeNull();
  });

  it('rejects old unscoped profiles and incomplete caches', () => {
    state.cached = JSON.stringify({ linkedProfileId: 'linked', role: 'ADMIN' });
    expect(getCachedUserProfile('owner')).toBeNull();
    state.cached = JSON.stringify({ authUserId: 'owner' });
    expect(getCachedUserProfile('owner')).toBeNull();
  });

  it('shares the in-flight lookup between navigation, widgets and dashboard', async () => {
    let finish!: (value: any) => void;
    state.rpc.mockReturnValue({ maybeSingle: () => new Promise(resolve => { finish = resolve; }) });
    const user = { id: 'owner', email: 'owner@example.com' };
    const requests = [getLinkedProfileForUser(user), getLinkedProfileForUser(user), getLinkedProfileForUser(user)];
    expect(state.rpc).toHaveBeenCalledTimes(1);
    finish({ data: { id: 'linked', role: 'CLIENT' }, error: null });
    expect(await Promise.all(requests)).toEqual(Array(3).fill({ id: 'linked', role: 'CLIENT' }));
  });

  it('does not share results across accounts', async () => {
    state.rpc.mockReturnValue({ maybeSingle: async () => ({ data: { id: 'linked' }, error: null }) });
    await Promise.all([getLinkedProfileForUser({ id: 'a' }), getLinkedProfileForUser({ id: 'b' })]);
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });

  it('retries a failed lookup instead of caching its rejection', async () => {
    state.rpc.mockReturnValue({ maybeSingle: () => Promise.reject(new Error('offline')) });
    await expect(getLinkedProfileForUser({ id: 'a' })).rejects.toThrow('offline');
    await expect(getLinkedProfileForUser({ id: 'a' })).rejects.toThrow('offline');
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });

  it('resolves session or rejects with TimeoutError/AbortError in getSessionWithTimeout', async () => {
    state.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'owner' } } }, error: null });
    await expect(getSessionWithTimeout(500)).resolves.toEqual({ user: { id: 'owner' } });

    state.getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('storage corrupted') });
    await expect(getSessionWithTimeout(500)).rejects.toThrow('storage corrupted');

    vi.useFakeTimers();
    state.getSession.mockReturnValueOnce(new Promise(() => {}));
    const timedOut = getSessionWithTimeout(250);
    const assertion = expect(timedOut).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(250);
    await assertion;

    const controller = new AbortController();
    state.getSession.mockReturnValueOnce(new Promise(() => {}));
    const aborted = getSessionWithTimeout(5000, controller.signal);
    controller.abort('cancelled');
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('evicts a wedged pendingProfiles promise when force: true is passed', async () => {
    let finishFirst!: (value: any) => void;
    state.rpc
      .mockReturnValueOnce({ maybeSingle: () => new Promise(resolve => { finishFirst = resolve; }) })
      .mockReturnValueOnce({ maybeSingle: async () => ({ data: { id: 'fresh-linked', role: 'ADMIN' }, error: null }) });

    const user = { id: 'owner', email: 'owner@example.com' };
    const first = getLinkedProfileForUser(user);
    const forced = getLinkedProfileForUser(user, { force: true });

    expect(state.rpc).toHaveBeenCalledTimes(2);
    await expect(forced).resolves.toEqual({ id: 'fresh-linked', role: 'ADMIN' });

    finishFirst({ data: { id: 'stale-linked', role: 'CLIENT' }, error: null });
    await expect(first).resolves.toEqual({ id: 'stale-linked', role: 'CLIENT' });
  });

  it('forwards AbortSignal, rejects with AbortError, and evicts pendingProfiles on abort or timeout', async () => {
    const abortSpy = vi.fn();
    state.rpc.mockImplementation(() => {
      const builder: any = {
        abortSignal: (signal: AbortSignal) => {
          abortSpy(signal);
          return builder;
        },
        maybeSingle: () => new Promise(() => {}),
      };
      return builder;
    });

    const controller = new AbortController();
    const user = { id: 'abort-user', email: 'abort@example.com' };
    const abortedReq = getLinkedProfileForUser(user, { signal: controller.signal });
    expect(abortSpy).toHaveBeenCalledTimes(1);
    controller.abort('user retry');
    await expect(abortedReq).rejects.toMatchObject({ name: 'AbortError' });

    vi.useFakeTimers();
    state.rpc.mockReturnValueOnce({
      maybeSingle: async () => ({ data: { id: 'recovered', role: 'CLIENT' }, error: null }),
    });
    await expect(getLinkedProfileForUser(user)).resolves.toEqual({ id: 'recovered', role: 'CLIENT' });
    expect(state.rpc).toHaveBeenCalledTimes(2);

    state.rpc.mockReturnValueOnce({ maybeSingle: () => new Promise(() => {}) });
    const hungReq = getLinkedProfileForUser({ id: 'timeout-user' });
    const timeoutAssert = expect(hungReq).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(6000);
    await timeoutAssert;
  });
});
