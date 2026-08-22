import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { hapticsHelper } from '../../utils/hapticsHelper';
import { requireStepUpAuth, isStepUpAuthAvailable } from '../stepUpAuth';

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  supportedAuthenticationTypesAsync: vi.fn(),
  authenticateAsync: vi.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

vi.mock('../../utils/hapticsHelper', () => ({
  hapticsHelper: {
    success: vi.fn().mockResolvedValue(undefined),
    warning: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    selection: vi.fn().mockResolvedValue(undefined),
    impactLight: vi.fn().mockResolvedValue(undefined),
    impactMedium: vi.fn().mockResolvedValue(undefined),
    impactHeavy: vi.fn().mockResolvedValue(undefined),
    impactRigid: vi.fn().mockResolvedValue(undefined),
    impactSoft: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('stepUpAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Platform.OS = 'ios';
    vi.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(true);
    vi.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);
    vi.mocked(LocalAuthentication.supportedAuthenticationTypesAsync).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    vi.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({
      success: true,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isStepUpAuthAvailable', () => {
    it('returns availability on supported mobile platform', async () => {
      const res = await isStepUpAuthAvailable();
      expect(res.hasHardware).toBe(true);
      expect(res.isEnrolled).toBe(true);
      expect(res.isAvailable).toBe(true);
      expect(res.supportedTypes).toEqual([2]);
    });

    it('returns false when no hardware is available', async () => {
      vi.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(false);
      const res = await isStepUpAuthAvailable();
      expect(res.hasHardware).toBe(false);
      expect(res.isAvailable).toBe(false);
    });

    it('returns web availability info when on web platform', async () => {
      Platform.OS = 'web';
      const res = await isStepUpAuthAvailable();
      expect(res.hasHardware).toBe(false);
      expect(res.isEnrolled).toBe(false);
      expect(res.isAvailable).toBe(true);
    });
  });

  describe('requireStepUpAuth - Native', () => {
    it('authenticates successfully on native and triggers success haptic', async () => {
      const result = await requireStepUpAuth({ promptMessage: 'Authorize Transfer' });

      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
      expect(LocalAuthentication.isEnrolledAsync).toHaveBeenCalled();
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authorize Transfer',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });
      expect(hapticsHelper.success).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.authMethod).toBe('biometrics');
    });

    it('handles no hardware available on native with requireEnrolled=true', async () => {
      vi.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(false);

      const result = await requireStepUpAuth();

      expect(hapticsHelper.warning).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_SUPPORTED');
    });

    it('bypasses when hardware unavailable and requireEnrolled=false', async () => {
      vi.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(false);

      const result = await requireStepUpAuth({ requireEnrolled: false });

      expect(result.success).toBe(true);
      expect(result.authMethod).toBe('bypassed');
    });

    it('handles no biometric enrolled on native with requireEnrolled=true', async () => {
      vi.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(false);

      const result = await requireStepUpAuth();

      expect(hapticsHelper.warning).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_ENROLLED');
    });

    it('handles authentication failure/rejection', async () => {
      vi.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({
        success: false,
        error: 'user_cancel',
      } as any);

      const result = await requireStepUpAuth();

      expect(hapticsHelper.error).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('USER_CANCEL');
    });

    it('handles system cancel or lockout', async () => {
      vi.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({
        success: false,
        error: 'system_cancel',
      } as any);

      const result = await requireStepUpAuth();

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SYSTEM_CANCEL');
    });
  });

  describe('requireStepUpAuth - Web Platform', () => {
    beforeEach(() => {
      Platform.OS = 'web';
    });

    it('allows web fallback by default', async () => {
      const result = await requireStepUpAuth();

      expect(hapticsHelper.success).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.authMethod).toBe('web_fallback');
    });

    it('rejects when allowWebFallback is false', async () => {
      const result = await requireStepUpAuth({ allowWebFallback: false });

      expect(hapticsHelper.error).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_SUPPORTED');
    });

    it('executes custom webFallbackHandler successfully', async () => {
      const customHandler = vi.fn().mockResolvedValue(true);
      const result = await requireStepUpAuth({ webFallbackHandler: customHandler });

      expect(customHandler).toHaveBeenCalled();
      expect(hapticsHelper.success).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.authMethod).toBe('web_fallback');
    });

    it('handles custom webFallbackHandler rejection', async () => {
      const customHandler = vi.fn().mockResolvedValue(false);
      const result = await requireStepUpAuth({ webFallbackHandler: customHandler });

      expect(customHandler).toHaveBeenCalled();
      expect(hapticsHelper.error).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('WEB_FALLBACK_FAILED');
    });
  });
});
