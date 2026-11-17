import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  AlertCircle: 'AlertCircle',
  RefreshCw: 'RefreshCw',
  Wallet: 'Wallet',
  CreditCard: 'CreditCard',
  BellRing: 'BellRing',
  ShieldCheck: 'ShieldCheck',
  Sparkles: 'Sparkles',
}));

import PremiumLoader, {
  DEFAULT_LOADER_TIMEOUT_MS,
  getLoaderDisplayState,
  scheduleLoaderTimeout,
} from './PremiumLoader';

describe('PremiumLoader timeout & retry state', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('defaults timeoutMs to 16000ms (> 2x7s + jitter)', () => {
    expect(DEFAULT_LOADER_TIMEOUT_MS).toBe(16000);
    const vnode = React.createElement(PremiumLoader, { onRetry: () => {} });
    expect(vnode.type).toBe(PremiumLoader);
  });

  it('schedules timeout only when !error, timeoutMs > 0, and onRetry exists, and restarts cleanly on retry', () => {
    const onTimeout = vi.fn();

    expect(scheduleLoaderTimeout({ error: 'Boom', timeoutMs: 16000, hasRetryHandler: true }, onTimeout)).toBeUndefined();
    expect(scheduleLoaderTimeout({ error: null, timeoutMs: 16000, hasRetryHandler: false }, onTimeout)).toBeUndefined();
    expect(scheduleLoaderTimeout({ error: null, timeoutMs: 0, hasRetryHandler: true }, onTimeout)).toBeUndefined();

    const cancelFirst = scheduleLoaderTimeout({ error: null, timeoutMs: 16000, hasRetryHandler: true }, onTimeout);
    vi.advanceTimersByTime(15999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    cancelFirst?.();

    // Advancing retryNonce cleans up prior timer and starts a fresh full window.
    const cancelSecond = scheduleLoaderTimeout({ error: null, timeoutMs: 16000, hasRetryHandler: true }, onTimeout);
    vi.advanceTimersByTime(8000);
    cancelSecond?.();
    const cancelThird = scheduleLoaderTimeout({ error: null, timeoutMs: 16000, hasRetryHandler: true }, onTimeout);
    vi.advanceTimersByTime(8000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(8000);
    expect(onTimeout).toHaveBeenCalledTimes(2);
    cancelThird?.();
  });

  it('computes clear retrying feedback, timeout fallback copy, and retry button state', () => {
    expect(
      getLoaderDisplayState({
        error: null,
        isTimeout: false,
        isRetrying: false,
        subtitle: 'Loading your account...',
        hasRetryHandler: true,
      }),
    ).toEqual({
      showErrorOrTimeout: false,
      displaySubtitle: 'Loading your account...',
      showRetryButton: false,
      retryLabel: 'Retry',
      effectiveRetrying: false,
    });

    expect(
      getLoaderDisplayState({
        error: null,
        isTimeout: false,
        isRetrying: true,
        subtitle: 'Loading your account...',
        hasRetryHandler: true,
      }),
    ).toEqual({
      showErrorOrTimeout: false,
      displaySubtitle: 'Retrying connection...',
      showRetryButton: false,
      retryLabel: 'Retrying...',
      effectiveRetrying: true,
    });

    expect(
      getLoaderDisplayState({
        error: null,
        isTimeout: true,
        isRetrying: false,
        subtitle: 'Loading your account...',
        hasRetryHandler: true,
      }),
    ).toEqual({
      showErrorOrTimeout: true,
      displaySubtitle: 'Connection is taking longer than expected.',
      showRetryButton: true,
      retryLabel: 'Retry',
      effectiveRetrying: false,
    });

    // Regression: callers that keep `error` truthy during/after retry must not latch Retry disabled.
    expect(
      getLoaderDisplayState({
        error: 'Network offline',
        isTimeout: false,
        isRetrying: true,
        subtitle: 'Loading your account...',
        hasRetryHandler: true,
      }),
    ).toEqual({
      showErrorOrTimeout: true,
      displaySubtitle: 'Network offline',
      showRetryButton: true,
      retryLabel: 'Retry',
      effectiveRetrying: false,
    });

    expect(
      getLoaderDisplayState({
        error: 'Network offline',
        isTimeout: false,
        isRetrying: false,
        isRetryingProp: true,
        subtitle: 'Loading your account...',
        hasRetryHandler: true,
      }),
    ).toEqual({
      showErrorOrTimeout: true,
      displaySubtitle: 'Network offline',
      showRetryButton: true,
      retryLabel: 'Retrying...',
      effectiveRetrying: true,
    });
  });
});
