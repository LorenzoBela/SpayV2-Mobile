import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { isSplitReaderUpgradeError } from './split-reader-contract';

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
  if (err == null) return false;
  if (isSplitReaderUpgradeError(err)) return false;

  if (typeof err === 'object') {
    const record = err as Record<string, any>;
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

function waitForRetryDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(toAbortError((signal as any).reason));
  }
  if (delayMs <= 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      reject(toAbortError((signal as any)?.reason));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
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
  const maxRetries = Math.max(0, opts?.retries ?? 2);
  const maxTimeout = opts?.maxTimeoutMs ?? 1500;
  const minTimeout = Math.min(opts?.minTimeoutMs ?? 300, maxTimeout);
  const shouldRetry = opts?.shouldRetry ?? isRetryableNetworkError;
  const signal = opts?.signal;

  // Avoid p-retry's signal.throwIfAborted() which throws in RN Hermes's abort-controller polyfill.
  for (let retriesConsumed = 0; ; retriesConsumed += 1) {
    if (signal?.aborted) {
      throw toAbortError((signal as any).reason);
    }
    try {
      const result = await fn(retriesConsumed + 1);
      if (signal?.aborted) {
        throw toAbortError((signal as any).reason);
      }
      return result;
    } catch (err) {
      if (signal?.aborted) {
        throw toAbortError((signal as any).reason ?? err);
      }
      if (retriesConsumed >= maxRetries || !shouldRetry(err)) {
        throw err;
      }
      const jitteredDelay = Math.min(
        maxTimeout,
        Math.round(minTimeout * (1 + Math.random()) * 2 ** retriesConsumed),
      );
      await waitForRetryDelay(jitteredDelay, signal);
    }
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

/**
 * Converts internal network, timeout, HTML, or stack-trace errors into concise user-facing text.
 */
export function formatUserErrorMessage(
  error: unknown,
  fallback = 'Unable to reach the server right now. Please try again.',
): string {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : (error && typeof error === 'object' && typeof (error as any).message === 'string')
          ? String((error as any).message)
          : '';
  const name = error instanceof Error ? error.name : (error && typeof error === 'object' ? String((error as any).name || '') : '');
  const trimmed = raw.trim();

  if (name === 'TimeoutError' || /timed out|timeout|ETIMEDOUT/i.test(trimmed)) {
    return 'Request timed out. Please try again.';
  }
  if (/network request failed|failed to fetch|ECONNREFUSED|ENOTFOUND|ERR_NETWORK/i.test(trimmed)) {
    return 'No internet connection. Please check your network and try again.';
  }
  if (/unauthorized|invalid.*token|jwt|session expired/i.test(trimmed)) {
    return 'Your session expired. Please sign in again.';
  }
  const looksTechnical =
    /\n\s*at\s+/.test(trimmed) ||
    /<\/?[a-z][\s\S]*>/i.test(trimmed) ||
    /TRPCClientError|PrismaClient|SyntaxError|TypeError|ReferenceError|ECONN|trpc\./i.test(trimmed) ||
    (trimmed.length > 220 && /[\n{}[\]]|Error:/i.test(trimmed));

  if (!trimmed || looksTechnical) {
    return fallback;
  }
  return trimmed;
}
