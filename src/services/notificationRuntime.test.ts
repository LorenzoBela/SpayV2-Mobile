import { beforeEach, describe, expect, it, vi } from 'vitest';
const store = vi.hoisted(() => new Map<string, string>());
vi.mock('../utils/queryPersister', () => ({ storage: {
  getString: (key: string) => store.get(key),
  set: (key: string, value: string) => { store.set(key, value); },
  remove: (key: string) => { store.delete(key); },
} }));
const id = '11111111-1111-4111-a111-111111111111';
beforeEach(() => { store.clear(); vi.resetModules(); });
describe('shared tray presentation ownership', () => {
  it('hands an event to one native renderer when foreground and realtime race', async () => {
    const runtime = await import('./notificationRuntime');
    runtime.notificationRuntime.bind({ authUserId: 'auth-a', profileId: 'a' });
    let release!: () => void;
    const display = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const first = runtime.presentNotificationOnce(id, display);
    expect(await runtime.presentNotificationOnce(id, display)).toBe(false);
    release(); expect(await first).toBe(true); expect(display).toHaveBeenCalledTimes(1);
  });
  it('retains unknown native handoff state across module recreation instead of blindly redisplaying', async () => {
    const runtime = await import('./notificationRuntime');
    runtime.notificationRuntime.bind({ authUserId: 'auth-a', profileId: 'a' });
    await expect(runtime.presentNotificationOnce(id, async () => { throw new Error('Native outcome unknown'); })).rejects.toThrow('unknown');
    vi.resetModules();
    const restarted = await import('./notificationRuntime');
    const display = vi.fn(async () => {});
    expect(await restarted.presentNotificationOnce(id, display)).toBe(false);
    expect(display).not.toHaveBeenCalled();
  });
  it('stores only allowlisted action fields and notifies mounted navigation', async () => {
    const runtime = await import('./notificationRuntime');
    runtime.notificationRuntime.bind({ authUserId: 'auth-a', profileId: 'a' });
    const listener = vi.fn(); const unsubscribe = runtime.subscribeToPendingNotificationAction(listener);
    runtime.queueNotificationAction({ notificationId: id, recipientUserId: 'a', screen: 'Orders', amount: '252.67', name: 'Private Name', arbitraryUrl: 'https://attacker.example' });
    expect(runtime.notificationRuntime.pending()?.data).toEqual({ notificationId: id, recipientUserId: 'a', screen: 'Orders' });
    expect(listener).toHaveBeenCalledTimes(1); unsubscribe();
  });
});
