import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

let cleanupFns: Array<() => void> = [];

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: vi.fn((effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (typeof cleanup === 'function') {
        cleanupFns.push(cleanup);
      }
    }),
  };
});

vi.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: vi.fn(),
  allowScreenCaptureAsync: vi.fn(),
  addScreenshotListener: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

import { usePreventScreenshot } from '../usePreventScreenshot';

describe('usePreventScreenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupFns = [];
    Platform.OS = 'ios';
    vi.mocked(ScreenCapture.preventScreenCaptureAsync).mockResolvedValue(undefined as never);
    vi.mocked(ScreenCapture.allowScreenCaptureAsync).mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const unmountAll = () => {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
  };

  it('prevents screen capture on mount and allows on unmount with default args', async () => {
    usePreventScreenshot();

    expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalledWith(undefined);

    unmountAll();

    expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalledWith(undefined);
  });

  it('passes key to prevent and allow screen capture', async () => {
    usePreventScreenshot(true, 'custom-key');

    expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalledWith('custom-key');

    unmountAll();

    expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalledWith('custom-key');
  });

  it('supports options object and attaches screenshot listener', async () => {
    const onScreenshot = vi.fn();
    const mockSubscription = { remove: vi.fn() };
    vi.mocked(ScreenCapture.addScreenshotListener).mockReturnValue(mockSubscription as never);

    usePreventScreenshot({ key: 'options-key', enabled: true, onScreenshot });

    expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalledWith('options-key');
    expect(ScreenCapture.addScreenshotListener).toHaveBeenCalledWith(onScreenshot);

    unmountAll();

    expect(mockSubscription.remove).toHaveBeenCalled();
    expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalledWith('options-key');
  });

  it('does nothing when enabled is false', () => {
    usePreventScreenshot(false);

    expect(ScreenCapture.preventScreenCaptureAsync).not.toHaveBeenCalled();

    unmountAll();

    expect(ScreenCapture.allowScreenCaptureAsync).not.toHaveBeenCalled();
  });

  it('guards against Platform.OS === "web"', () => {
    Platform.OS = 'web';

    usePreventScreenshot(true);

    expect(ScreenCapture.preventScreenCaptureAsync).not.toHaveBeenCalled();

    unmountAll();

    expect(ScreenCapture.allowScreenCaptureAsync).not.toHaveBeenCalled();
  });

  it('catches and warns on preventScreenCaptureAsync rejection', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(ScreenCapture.preventScreenCaptureAsync).mockRejectedValue(new Error('Permission denied'));

    usePreventScreenshot(true);

    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[usePreventScreenshot] Failed to enable screen capture prevention'),
      expect.any(Error)
    );
  });
});
