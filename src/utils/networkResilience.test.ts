import { afterEach, describe, expect, it, vi } from 'vitest';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import {
  TimeoutError,
  initNetworkMonitor,
  isRetryableNetworkError,
  retryWithJitter,
  subscribeReconnect,
  withDeadline,
} from './networkResilience';
import { queryClient } from './queryClient';
import { clientPersister, storage } from './queryPersister';
import { SPLIT_READER_UPGRADE_CODE } from './split-reader-contract';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('withDeadline', () => {
  it('resolves when operation finishes before deadline', async () => {
    const result = await withDeadline(async () => 'ok', 500);
    expect(result).toBe('ok');
  });

  it('rejects with retryable TimeoutError and aborts inner signal on deadline expiry', async () => {
    vi.useFakeTimers();
    let innerAborted = false;

    const promise = withDeadline(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            innerAborted = true;
            reject(signal.reason);
          });
        }),
      250,
      undefined,
      'profile.load',
    );

    const assertion = expect(promise).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    await vi.advanceTimersByTimeAsync(250);
    await assertion;
    expect(innerAborted).toBe(true);

    try {
      await promise;
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError);
      expect(isRetryableNetworkError(err)).toBe(true);
    }
  });

  it('rejects with non-retryable AbortError when external signal aborts', async () => {
    const external = new AbortController();
    let innerAborted = false;

    const promise = withDeadline(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            innerAborted = true;
            reject(signal.reason);
          });
        }),
      5000,
      external.signal,
    );

    external.abort('user cancelled');
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(innerAborted).toBe(true);

    try {
      await promise;
    } catch (err) {
      expect(isRetryableNetworkError(err)).toBe(false);
    }
  });

  it('rejects immediately with AbortError if external signal is already aborted', async () => {
    const external = new AbortController();
    external.abort();
    const fn = vi.fn(async () => 'never');

    await expect(withDeadline(fn, 1000, external.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('isRetryableNetworkError', () => {
  it('marks 401, 403, split-reader upgrade, and AbortError as non-retryable', () => {
    expect(isRetryableNetworkError({ data: { httpStatus: 401 } })).toBe(false);
    expect(isRetryableNetworkError({ status: 403 })).toBe(false);
    expect(isRetryableNetworkError({ code: SPLIT_READER_UPGRADE_CODE })).toBe(false);
    expect(isRetryableNetworkError(SPLIT_READER_UPGRADE_CODE)).toBe(false);
    const abortErr = new Error('cancelled');
    abortErr.name = 'AbortError';
    expect(isRetryableNetworkError(abortErr)).toBe(false);
  });

  it('marks timeouts, 5xx, 429, and transient network errors as retryable', () => {
    expect(isRetryableNetworkError(new TimeoutError('timed out'))).toBe(true);
    expect(isRetryableNetworkError({ status: 503 })).toBe(true);
    expect(isRetryableNetworkError({ status: 429 })).toBe(true);
    expect(isRetryableNetworkError(new Error('network timeout'))).toBe(true);
    expect(isRetryableNetworkError(new TypeError('Network request failed'))).toBe(true);
  });
});

describe('retryWithJitter', () => {
  it('retries TimeoutError and recovers on subsequent attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TimeoutError('first attempt timed out'))
      .mockResolvedValueOnce('recovered');

    const result = await retryWithJitter(fn, {
      retries: 2,
      minTimeoutMs: 1,
      maxTimeoutMs: 5,
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry external AbortError, 401/403, or SPLIT_READER_UPGRADE_REQUIRED', async () => {
    const external = new AbortController();
    const abortFn = vi.fn(() =>
      withDeadline(
        () => new Promise(() => {}),
        1000,
        external.signal,
      ),
    );
    const p = retryWithJitter(abortFn, { retries: 3, minTimeoutMs: 1, maxTimeoutMs: 5 });
    external.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(abortFn).toHaveBeenCalledTimes(1);

    const authFn = vi.fn().mockRejectedValue({ data: { httpStatus: 401 } });
    await expect(
      retryWithJitter(authFn, { retries: 3, minTimeoutMs: 1, maxTimeoutMs: 5 }),
    ).rejects.toEqual({ data: { httpStatus: 401 } });
    expect(authFn).toHaveBeenCalledTimes(1);

    const upgradeFn = vi.fn().mockRejectedValue({ code: SPLIT_READER_UPGRADE_CODE });
    await expect(
      retryWithJitter(upgradeFn, { retries: 3, minTimeoutMs: 1, maxTimeoutMs: 5 }),
    ).rejects.toEqual({ code: SPLIT_READER_UPGRADE_CODE });
    expect(upgradeFn).toHaveBeenCalledTimes(1);
  });

  it('normalizes custom opts.signal abort reasons into non-retryable AbortError', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new TimeoutError('slow'));
    const promise = retryWithJitter(fn, {
      retries: 3,
      minTimeoutMs: 100,
      maxTimeoutMs: 200,
      signal: controller.signal,
    });

    await Promise.resolve();
    controller.abort('custom-stop');

    try {
      await promise;
      expect.unreachable('expected AbortError');
    } catch (err) {
      expect(err).toMatchObject({ name: 'AbortError' });
      expect(isRetryableNetworkError(err)).toBe(false);
    }
  });

  it('works with React Native polyfilled AbortSignal lacking throwIfAborted and reason', async () => {
    const controller = new AbortController();
    const rnSignal = Object.create(Object.getPrototypeOf(controller.signal));
    Object.defineProperties(rnSignal, {
      aborted: { get: () => controller.signal.aborted },
      throwIfAborted: { value: undefined },
      reason: { value: undefined },
      addEventListener: { value: controller.signal.addEventListener.bind(controller.signal) },
      removeEventListener: { value: controller.signal.removeEventListener.bind(controller.signal) },
    });

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TimeoutError('transient'))
      .mockResolvedValueOnce('ok');

    await expect(
      retryWithJitter(fn, { retries: 1, minTimeoutMs: 1, maxTimeoutMs: 5, signal: rnSignal }),
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);

    const hungFn = vi.fn().mockRejectedValue(new TimeoutError('slow'));
    const abortedPromise = retryWithJitter(hungFn, {
      retries: 2,
      minTimeoutMs: 100,
      maxTimeoutMs: 200,
      signal: rnSignal,
    });
    await Promise.resolve();
    controller.abort();
    await expect(abortedPromise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('initNetworkMonitor and subscribeReconnect', () => {
  it('registers at most one NetInfo listener, seeds via fetch, and notifies on reconnect', async () => {
    const addSpy = vi.spyOn(NetInfo, 'addEventListener');
    const fetchSpy = vi
      .spyOn(NetInfo, 'fetch')
      .mockResolvedValue({ isConnected: false, isInternetReachable: false } as any);

    const stopA = initNetworkMonitor();
    const stopB = initNetworkMonitor();

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Let initial offline seed resolve
    await Promise.resolve();
    await Promise.resolve();
    expect(onlineManager.isOnline()).toBe(false);

    const onReconnect = vi.fn();
    const unsubReconnect = subscribeReconnect(onReconnect);

    (NetInfo as any).__triggerChange({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true);
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // Repeating online event without offline gap does not re-trigger reconnect
    (NetInfo as any).__triggerChange({ isConnected: true, isInternetReachable: true });
    expect(onReconnect).toHaveBeenCalledTimes(1);

    unsubReconnect();
    stopA();
    // Listener remains active until last monitor handle disposes
    (NetInfo as any).__triggerChange({ isConnected: false, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);

    stopB();
    // After full disposal, __triggerChange is a no-op
    (NetInfo as any).__triggerChange({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('ignores stale NetInfo.fetch seed across stop and restart', async () => {
    let resolveStaleFetch!: (state: any) => void;
    const fetchSpy = vi
      .spyOn(NetInfo, 'fetch')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStaleFetch = resolve;
          }),
      )
      .mockResolvedValueOnce({ isConnected: true, isInternetReachable: true } as any);

    const stopFirst = initNetworkMonitor();
    stopFirst();

    const stopSecond = initNetworkMonitor();
    await Promise.resolve();
    await Promise.resolve();
    expect(onlineManager.isOnline()).toBe(true);

    // Resolving the stale offline fetch from the stopped epoch must not flip state offline
    resolveStaleFetch({ isConnected: false, isInternetReachable: false });
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(onlineManager.isOnline()).toBe(true);

    stopSecond();
  });
});

describe('queryClient retryDelay', () => {
  it('computes bounded jittered retry delays in 400-800ms', () => {
    const retryDelay = queryClient.getDefaultOptions().queries?.retryDelay;
    expect(typeof retryDelay).toBe('function');
    if (typeof retryDelay === 'function') {
      for (let i = 0; i < 20; i++) {
        const delay = retryDelay(0, new Error('transient'));
        expect(delay).toBeGreaterThanOrEqual(400);
        expect(delay).toBeLessThanOrEqual(800);
      }
    }
  });
});

describe('queryPersister startup safety', () => {
  it('keeps fast sync MMKV reads working and recovers cleanly from corrupt cache restore', async () => {
    storage.set('sync_probe', 'ok');
    expect(storage.getString('sync_probe')).toBe('ok');

    storage.set('SPAY_QUERY_OFFLINE_CACHE', '{corrupt-json');
    await expect(clientPersister.restoreClient()).resolves.toBeUndefined();
    await clientPersister.removeClient();
  });
});
