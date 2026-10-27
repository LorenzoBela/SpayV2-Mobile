import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), cached: null as string | null, getSession: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: state.rpc, from: state.from, auth: { getSession: state.getSession } }, expoSecureStorage: { getItem: async () => null } }));
vi.mock('./queryPersister', () => ({ storage: { getString: () => state.cached, set: vi.fn() } }));
import { getLinkedProfileForUser, getLinkedProfileForCurrentUser, primeCurrentUserProfile, clearMemoryProfileCache, getCachedUserProfile } from './authProfile';

describe('startup profile request coalescing', () => {
  beforeEach(() => { vi.clearAllMocks(); state.cached = null; clearMemoryProfileCache(); });

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
});
