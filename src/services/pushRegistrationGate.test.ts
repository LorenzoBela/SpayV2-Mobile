import { describe, expect, it } from 'vitest';
import { createPushRegistrationGate } from './pushRegistrationGate';

describe('push registration during account changes', () => {
  it('drains existing writes and rejects new writes during logout', async () => {
    const gate = createPushRegistrationGate();
    let finish!: () => void;
    const active = gate.run(() => new Promise<void>(resolve => { finish = resolve; }));
    await Promise.resolve();
    let drained = false;
    const pending = gate.suspend().then(() => { drained = true; });
    expect(await gate.run(async () => 'late')).toBeNull();
    expect(drained).toBe(false);
    finish();
    await Promise.all([active, pending]);
    expect(drained).toBe(true);
  });

  it('rejects old token callbacks after a new account signs in', async () => {
    const gate = createPushRegistrationGate();
    const oldVersion = gate.version;
    await gate.suspend();
    gate.finishSignOut();
    expect(await gate.run(async () => 'logged out')).toBeNull();
    gate.resume();
    expect(await gate.run(async () => 'old account', oldVersion)).toBeNull();
    expect(await gate.run(async () => 'new account')).toBe('new account');
  });

  it('does not reopen writes on a login event while logout is still draining', async () => {
    const gate = createPushRegistrationGate();
    await gate.suspend();
    gate.resume();
    expect(await gate.run(async () => 'unsafe')).toBeNull();
    gate.recover();
    expect(await gate.run(async () => 'retry')).toBe('retry');
  });
});
