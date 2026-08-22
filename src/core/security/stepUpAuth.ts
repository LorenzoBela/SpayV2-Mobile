import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { hapticsHelper } from '../utils/hapticsHelper';

export type StepUpAuthErrorCode =
  | 'NOT_SUPPORTED'
  | 'NOT_ENROLLED'
  | 'AUTH_FAILED'
  | 'USER_CANCEL'
  | 'SYSTEM_CANCEL'
  | 'WEB_FALLBACK_FAILED'
  | 'UNKNOWN';

export type StepUpAuthMethod =
  | 'biometrics'
  | 'device_credential'
  | 'web_fallback'
  | 'bypassed'
  | 'none';

export interface StepUpAuthOptions {
  /** Prompt message displayed in the biometric / passcode dialog */
  promptMessage?: string;
  /** Cancel button text (Android) */
  cancelLabel?: string;
  /** Fallback button label (e.g. 'Use Passcode') */
  fallbackLabel?: string;
  /** Disable device PIN/passcode fallback */
  disableDeviceFallback?: boolean;
  /** Whether to fail if biometrics are not enrolled on native devices (default: true) */
  requireEnrolled?: boolean;
  /** Allow fallback on web platform instead of rejecting (default: true) */
  allowWebFallback?: boolean;
  /** Optional custom verification handler when running on web (defaults to returning true) */
  webFallbackHandler?: () => Promise<boolean> | boolean;
  /** Trigger success haptic on authenticated (default: true) */
  triggerSuccessHaptic?: boolean;
  /** Trigger error haptic on failure/cancellation (default: true) */
  triggerErrorHaptic?: boolean;
}

export interface StepUpAuthResult {
  /** Whether authentication succeeded */
  success: boolean;
  /** Error message if authentication failed */
  error?: string;
  /** Standardized error code if failed */
  errorCode?: StepUpAuthErrorCode;
  /** The authentication method used */
  authMethod: StepUpAuthMethod;
  /** Whether device biometric hardware is available */
  hasHardware: boolean;
  /** Whether biometrics/passcode are enrolled on device */
  isEnrolled: boolean;
}

export interface StepUpAuthAvailability {
  /** Whether biometric hardware is present */
  hasHardware: boolean;
  /** Whether biometrics or passcode are enrolled */
  isEnrolled: boolean;
  /** Whether step up authentication can be prompted */
  isAvailable: boolean;
  /** List of supported biometric types (Fingerprint, Facial, etc.) */
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

/**
 * Checks whether step-up authentication is supported and enrolled on the device.
 */
export async function isStepUpAuthAvailable(): Promise<StepUpAuthAvailability> {
  if (Platform.OS === 'web') {
    return {
      hasHardware: false,
      isEnrolled: false,
      isAvailable: true, // Web fallback is available
      supportedTypes: [],
    };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
    const supportedTypes = hasHardware
      ? await LocalAuthentication.supportedAuthenticationTypesAsync()
      : [];

    return {
      hasHardware,
      isEnrolled,
      isAvailable: hasHardware && isEnrolled,
      supportedTypes,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[stepUpAuth] Error checking availability:', error);
    }
    return {
      hasHardware: false,
      isEnrolled: false,
      isAvailable: false,
      supportedTypes: [],
    };
  }
}

/**
 * Requests step-up authentication (Biometrics / Device Passcode) before executing sensitive operations.
 * Handles hardware verification, enrollment checks, haptics feedback, and web fallback.
 *
 * @param options StepUpAuthOptions configuration
 * @returns StepUpAuthResult indicating status, method, and error details
 */
export async function requireStepUpAuth(
  options: StepUpAuthOptions = {}
): Promise<StepUpAuthResult> {
  const {
    promptMessage = 'Verify your identity to proceed',
    cancelLabel = 'Cancel',
    fallbackLabel = 'Use Passcode',
    disableDeviceFallback = false,
    requireEnrolled = true,
    allowWebFallback = true,
    webFallbackHandler,
    triggerSuccessHaptic = true,
    triggerErrorHaptic = true,
  } = options;

  // 1. Web Platform Handling
  if (Platform.OS === 'web') {
    if (!allowWebFallback) {
      if (triggerErrorHaptic) {
        await hapticsHelper.error();
      }
      return {
        success: false,
        error: 'Biometric step-up authentication is not supported on web',
        errorCode: 'NOT_SUPPORTED',
        authMethod: 'none',
        hasHardware: false,
        isEnrolled: false,
      };
    }

    if (webFallbackHandler) {
      try {
        const fallbackSuccess = await webFallbackHandler();
        if (fallbackSuccess) {
          if (triggerSuccessHaptic) {
            await hapticsHelper.success();
          }
          return {
            success: true,
            authMethod: 'web_fallback',
            hasHardware: false,
            isEnrolled: false,
          };
        } else {
          if (triggerErrorHaptic) {
            await hapticsHelper.error();
          }
          return {
            success: false,
            error: 'Web authentication check was not confirmed',
            errorCode: 'WEB_FALLBACK_FAILED',
            authMethod: 'web_fallback',
            hasHardware: false,
            isEnrolled: false,
          };
        }
      } catch (err: any) {
        if (triggerErrorHaptic) {
          await hapticsHelper.error();
        }
        return {
          success: false,
          error: err?.message || 'Web fallback error occurred',
          errorCode: 'WEB_FALLBACK_FAILED',
          authMethod: 'web_fallback',
          hasHardware: false,
          isEnrolled: false,
        };
      }
    }

    // Default web fallback pass-through
    if (triggerSuccessHaptic) {
      await hapticsHelper.success();
    }
    return {
      success: true,
      authMethod: 'web_fallback',
      hasHardware: false,
      isEnrolled: false,
    };
  }

  // 2. Native Biometric & Hardware Check
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      if (!requireEnrolled) {
        return {
          success: true,
          authMethod: 'bypassed',
          hasHardware: false,
          isEnrolled: false,
        };
      }
      if (triggerErrorHaptic) {
        await hapticsHelper.warning();
      }
      return {
        success: false,
        error: 'Biometric authentication hardware is not available on this device',
        errorCode: 'NOT_SUPPORTED',
        authMethod: 'none',
        hasHardware: false,
        isEnrolled: false,
      };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      if (!requireEnrolled) {
        return {
          success: true,
          authMethod: 'bypassed',
          hasHardware: true,
          isEnrolled: false,
        };
      }
      if (triggerErrorHaptic) {
        await hapticsHelper.warning();
      }
      return {
        success: false,
        error: 'No biometric credentials or device passcodes are enrolled',
        errorCode: 'NOT_ENROLLED',
        authMethod: 'none',
        hasHardware: true,
        isEnrolled: false,
      };
    }

    // 3. Prompt Local Authentication
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      fallbackLabel,
      disableDeviceFallback,
    });

    if (result.success) {
      if (triggerSuccessHaptic) {
        await hapticsHelper.success();
      }
      return {
        success: true,
        authMethod: 'biometrics',
        hasHardware: true,
        isEnrolled: true,
      };
    }

    // Handle authentication failure / cancellation
    if (triggerErrorHaptic) {
      await hapticsHelper.error();
    }

    let errorCode: StepUpAuthErrorCode = 'AUTH_FAILED';
    if (
      result.error === 'user_cancel' ||
      result.error === 'app_cancel' ||
      result.error === 'user_fallback'
    ) {
      errorCode = 'USER_CANCEL';
    } else if (result.error === 'system_cancel' || result.error === 'lockout') {
      errorCode = 'SYSTEM_CANCEL';
    } else if (result.error === 'not_enrolled') {
      errorCode = 'NOT_ENROLLED';
    }

    return {
      success: false,
      error: result.error || 'Authentication cancelled or failed',
      errorCode,
      authMethod: 'none',
      hasHardware: true,
      isEnrolled: true,
    };
  } catch (err: any) {
    if (triggerErrorHaptic) {
      await hapticsHelper.error();
    }
    if (__DEV__) {
      console.warn('[stepUpAuth] Authentication execution error:', err);
    }
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred during authentication',
      errorCode: 'UNKNOWN',
      authMethod: 'none',
      hasHardware: false,
      isEnrolled: false,
    };
  }
}

export default requireStepUpAuth;
