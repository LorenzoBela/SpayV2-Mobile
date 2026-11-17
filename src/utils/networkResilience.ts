import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import pRetry from 'p-retry';
import { isSplitReaderUpgradeError } from './split-reader-contract';

const ORIGINAL_ERROR = Symbol('originalError');

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

function toAbortError(reason?: unknown): Error {
  if (reason instanceof Error && reason.name === 'AbortError') {
    return reason;
  }
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string' && reason.length > 0
        ? reason
        : 'Aborted';
  const err = new Error(message);
  err.name = 'AbortError';
  if (reason !== undefined) {
    (err as Error & { cause?: unknown }).cause = reason;
  }
  return err;
}

function unwrapError(err: unknown): unknown {
  if (err && typeof err === 'object' && ORIGINAL_ERROR in err) {
    return (err as { [ORIGINAL_ERROR]: unknown })[ORIGINAL_ERROR];
  }
  return err;
}

/**
 * Runs `fn` under a hard per-attempt deadline while propagating external aborts.
 * External aborts reject with `AbortError` (non-retryable); deadline expiry rejects
 * with `TimeoutError` (retryable).
 */
export function withDeadline<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal,
  label?: string,
): Promise<T> {
  if (externalSignal?.aborted) {
    return Promise.reject(toAbortError(externalSignal.reason));
  }

  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    const timeoutErr = new TimeoutError(
      label ? `${label} timed out after ${timeoutMs}ms` : `Operation timed out after ${timeoutMs}ms`,
    );

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      externalSignal?.removeEventListener('abort', onExternalAbort);
    };

    const onExternalAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const abortErr = toAbortError(externalSignal?.reason);
      controller.abort(abortErr);
      reject(abortErr);
    };

    const onTimeout = () => {
      if (settled) return;
      settled = true;
      cleanup();
      controller.abort(timeoutErr);
      reject(timeoutErr);
    };

    if (externalSignal) {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    if (Number.isFinite(timeoutMs)) {
      if (timeoutMs <= 0) {
        onTimeout();
        return;
      }
      timer = setTimeout(onTimeout, timeoutMs);
    }

    new Promise<T>((res) => res(fn(controller.signal))).then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (externalSignal?.aborted) {
          reject(toAbortError(externalSignal.reason ?? err));
          return;
        }
        reject(err);
      },
    );
  });
}

/**
 * Classifies whether a failure is transient and safe to retry.
 * Rejects 401/403 (and non-408/429 4xx), SPLIT_READER_UPGRADE_REQUIRED, and AbortError.
 */
export function isRetryableNetworkError(err: unknown): boolean {
  const raw = unwrapError(err);
  if (raw == null) return false;
  if (isSplitReaderUpgradeError(raw)) return false;

  if (typeof raw === 'object') {
    const record = raw as Record<string, any>;
    if (record.name === 'AbortError') return false;

    const status =
      record.data?.httpStatus ??
      record.status ??
      record.statusCode ??
      record.response?.status;

    if (
      typeof status === 'number' &&
      status >= 400 &&
      status < 500 &&
      status !== 408 &&
      status !== 429
    ) {
      return false;
    }

    const trpcCode = record.data?.code;
    if (
      trpcCode === 'UNAUTHORIZED' ||
      trpcCode === 'FORBIDDEN' ||
      trpcCode === 'NOT_FOUND' ||
      trpcCode === 'BAD_REQUEST'
    ) {
      return false;
    }
  }

  return true;
}

export async function retryWithJitter<T>(
  fn: (attempt: number) => Promise<T>,
  opts?: {
    retries?: number;
    minTimeoutMs?: number;
    maxTimeoutMs?: number;
    signal?: AbortSignal;
    shouldRetry?: (err: unknown) => boolean;
  },
): Promise<T> {
  const maxTimeout = opts?.maxTimeoutMs ?? 1500;
  const minTimeout = Math.min(opts?.minTimeoutMs ?? 300, maxTimeout);
  const shouldRetry = opts?.shouldRetry ?? isRetryableNetworkError;

  try {
    return await pRetry(
      async (attempt) => {
        try {
          return await fn(attempt);
        } catch (err) {
          // p-retry rejects non-Error throws without retrying; wrap plain-object SDK errors.
          if (err instanceof Error) throw err;
          const wrapped = new Error(
            typeof (err as any)?.message === 'string' ? (err as any).message : String(err),
          ) as Error & { [ORIGINAL_ERROR]?: unknown };
          wrapped[ORIGINAL_ERROR] = err;
          throw wrapped;
        }
      },
      {
        retries: opts?.retries ?? 2,
        minTimeout,
        maxTimeout,
        randomize: true,
        signal: opts?.signal,
        shouldRetry: ({ error }) => shouldRetry(unwrapError(error)),
      },
    );
  } catch (err) {
    if (opts?.signal?.aborted) {
      throw toAbortError(opts.signal.reason ?? unwrapError(err));
    }
    throw unwrapError(err);
  }
}

let activeMonitorCount = 0;
let monitorEpoch = 0;
let netInfoUnsubscribe: (() => void) | null = null;
let onlineManagerBound = false;
let wasOffline = false;
let receivedLiveEvent = false;
const reconnectListeners = new Set<() => void>();

function applyNetInfoState(state: Partial<NetInfoState> | null | undefined, fromEvent: boolean): void {
  if (fromEvent) {
    receivedLiveEvent = true;
  }
  const isOnline = Boolean(state?.isConnected && state?.isInternetReachable !== false);
  onlineManager.setOnline(isOnline);

  if (!isOnline) {
    wasOffline = true;
    return;
  }

  if (wasOffline) {
    wasOffline = false;
    for (const listener of [...reconnectListeners]) {
      try {
        listener();
      } catch {
        // Isolate subscriber errors from other reconnect handlers.
      }
    }
  }
}

/**
 * Registers at most one NetInfo listener, seeds initial online state via NetInfo.fetch(),
 * and updates TanStack Query's onlineManager + reconnect subscribers.
 */
export function initNetworkMonitor(): () => void {
  if (activeMonitorCount === 0) {
    if (!onlineManagerBound) {
      // Prevent onlineManager's default browser listener from racing the NetInfo hub.
      onlineManager.setEventListener(() => () => {});
      onlineManagerBound = true;
    }
    monitorEpoch += 1;
    const epoch = monitorEpoch;
    wasOffline = false;
    receivedLiveEvent = false;

    if (typeof NetInfo?.addEventListener === 'function') {
      netInfoUnsubscribe = NetInfo.addEventListener((state) => {
        applyNetInfoState(state, true);
      });
    }

    if (typeof NetInfo?.fetch === 'function') {
      void Promise.resolve(NetInfo.fetch())
        .then((state) => {
          if (epoch === monitorEpoch && !receivedLiveEvent && activeMonitorCount > 0) {
            applyNetInfoState(state, false);
          }
        })
        .catch(() => {});
    }
  }

  activeMonitorCount += 1;
  let disposed = false;

  return () => {
    if (disposed) return;
    disposed = true;
    activeMonitorCount = Math.max(0, activeMonitorCount - 1);
    if (activeMonitorCount === 0) {
      monitorEpoch += 1;
      netInfoUnsubscribe?.();
      netInfoUnsubscribe = null;
      wasOffline = false;
      receivedLiveEvent = false;
    }
  };
}

export function subscribeReconnect(cb: () => void): () => void {
  reconnectListeners.add(cb);
  return () => {
    reconnectListeners.delete(cb);
  };
}
