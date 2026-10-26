import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), signOut: vi.fn(), linked: vi.fn(), remove: vi.fn(), filter: vi.fn(), abort: vi.fn(), alert: vi.fn() }));
vi.mock('react-native', () => ({ Alert: { alert: mocks.alert } }));
vi.mock('./supabase', () => ({ supabase: {
  auth: { getSession: mocks.session, signOut: mocks.signOut },
  from: () => ({ delete: mocks.remove }),
} }));
vi.mock('./authProfile', () => ({ getLinkedProfileForUser: mocks.linked }));

import { signOutWithNotifications } from './notificationSignOut';
import { pushRegistrationGate } from '../services/pushRegistrationGate';

describe('authenticated logout device release', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetAllMocks();
    pushRegistrationGate.recover();
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'auth-owner' }, access_token: 'verified-token' } }, error: null });
    mocks.linked.mockResolvedValue({ id: 'linked-owner' });
    mocks.remove.mockReturnValue({ in: mocks.filter });
    mocks.filter.mockReturnValue({ abortSignal: mocks.abort });
    mocks.abort.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('releases both device stores before signing out globally', async () => {
    expect(await signOutWithNotifications()).toEqual({ error: null });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE', headers: { Authorization: 'Bearer verified-token' } });
    expect(mocks.filter).toHaveBeenCalledWith('user_id', ['auth-owner', 'linked-owner']);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
    expect(mocks.abort.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
    expect(await pushRegistrationGate.run(async () => 'late write')).toBeNull();
  });

  it('keeps the session and explains a failed backend release', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    expect((await signOutWithNotifications()).error).toBeInstanceOf(Error);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalled();
    expect(await pushRegistrationGate.run(async () => 'active account')).toBe('active account');
  });

  it('keeps the session if the local Supabase release fails', async () => {
    mocks.abort.mockResolvedValue({ error: new Error('Unavailable') });
    expect((await signOutWithNotifications()).error).toBeInstanceOf(Error);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('coalesces concurrent logout requests', async () => {
    await Promise.all([signOutWithNotifications(), signOutWithNotifications()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('waits for an active registration before deleting devices', async () => {
    let finish!: () => void;
    const registration = pushRegistrationGate.run(() => new Promise<void>(resolve => { finish = resolve; }));
    await Promise.resolve();
    const logout = signOutWithNotifications();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    finish();
    await Promise.all([registration, logout]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves the actual session owner instead of an impersonated profile', async () => {
    await signOutWithNotifications();
    expect(mocks.linked).toHaveBeenCalledWith({ id: 'auth-owner' });
  });

  it('keeps the session if global authentication logout fails', async () => {
    mocks.signOut.mockResolvedValue({ error: new Error('Auth service unavailable') });
    expect((await signOutWithNotifications()).error).toBeInstanceOf(Error);
    expect(mocks.alert).toHaveBeenCalled();
    expect(await pushRegistrationGate.run(async () => 'still signed in')).toBe('still signed in');
  });

  it('does not require device release for an already absent session', async () => {
    mocks.session.mockResolvedValue({ data: { session: null }, error: null });
    expect(await signOutWithNotifications()).toEqual({ error: null });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
