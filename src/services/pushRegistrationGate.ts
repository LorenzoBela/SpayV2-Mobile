/** Drains writes before global logout and blocks late token-refresh callbacks. */
export function createPushRegistrationGate() {
  const pending = new Set<Promise<unknown>>();
  let blocked = false;
  let signingOut = false;
  let generation = 0;
  return {
    get version() { return generation; },
    async run<T>(operation: (signal: AbortSignal) => Promise<T>, version = generation): Promise<T | null> {
      if (blocked || version !== generation) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const task = Promise.resolve().then(() => operation(controller.signal));
      pending.add(task);
      try { return await task; }
      finally { pending.delete(task); clearTimeout(timer); }
    },
    async suspend() {
      blocked = true;
      signingOut = true;
      await Promise.allSettled([...pending]);
    },
    finishSignOut() { signingOut = false; generation++; },
    recover() { signingOut = false; blocked = false; },
    resume() { if (!signingOut) blocked = false; },
  };
}

export const pushRegistrationGate = createPushRegistrationGate();
