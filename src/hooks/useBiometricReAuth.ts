import { useState, useCallback, useRef } from 'react';
import useBiometrics from './useBiometrics';
import useSecurityPin from './useSecurityPin';

export interface ReAuthOptions {
  title?: string;
  message?: string;
  description?: string;
  reason?: string;
}

export interface ReAuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

export function useBiometricReAuth() {
  const {
    isSupported,
    isEnrolled,
    biometricType,
    authenticate,
    isLoading: isBiometricsLoading,
  } = useBiometrics();
  const { hasPin, verifyPin, isLoading: isPinLoading } = useSecurityPin();

  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [promptTitle, setPromptTitle] = useState<string>('Security Re-Authentication');
  const [promptMessage, setPromptMessage] = useState<string>(
    'Please verify your identity to proceed.'
  );
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const resolverRef = useRef<((result: ReAuthResult) => void) | null>(null);

  const generateReAuthToken = useCallback((): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `reauth_${timestamp}_${random}`;
  }, []);

  const authenticateBiometrics = useCallback(
    async (reason?: string): Promise<ReAuthResult> => {
      if (!isSupported || !isEnrolled) {
        return { success: false, error: 'Biometric authentication unavailable' };
      }

      setIsAuthenticating(true);
      setError(null);

      try {
        const msg = reason || promptMessage;
        const result = await authenticate(msg);
        if (result.success) {
          const token = generateReAuthToken();
          return { success: true, token };
        } else {
          const errorMsg = result.error || 'Biometric verification cancelled or failed';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch (err: any) {
        const errorMsg = err?.message || 'Biometric authentication error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsAuthenticating(false);
      }
    },
    [isSupported, isEnrolled, promptMessage, authenticate, generateReAuthToken]
  );

  const verifySecurityPin = useCallback(
    async (pin: string): Promise<ReAuthResult> => {
      setIsAuthenticating(true);
      setError(null);

      try {
        const isValid = await verifyPin(pin);
        if (isValid) {
          const token = generateReAuthToken();
          return { success: true, token };
        } else {
          const errorMsg = 'Incorrect Security PIN';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }
      } catch (err: any) {
        const errorMsg = err?.message || 'PIN verification error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsAuthenticating(false);
      }
    },
    [verifyPin, generateReAuthToken]
  );

  const requestReAuth = useCallback(
    (options?: ReAuthOptions): Promise<ReAuthResult> => {
      if (resolverRef.current) {
        resolverRef.current({ success: false, error: 'Cancelled by new re-auth request' });
      }

      setPromptTitle(options?.title || 'Security Re-Authentication');
      setPromptMessage(
        options?.message ||
          options?.description ||
          options?.reason ||
          'Please verify your identity to proceed with this sensitive action.'
      );
      setError(null);
      setIsVisible(true);

      return new Promise<ReAuthResult>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    []
  );

  const handleSuccess = useCallback(
    (token?: string): ReAuthResult => {
      const finalToken = token || generateReAuthToken();
      setIsVisible(false);
      setError(null);
      if (resolverRef.current) {
        resolverRef.current({ success: true, token: finalToken });
        resolverRef.current = null;
      }
      return { success: true, token: finalToken };
    },
    [generateReAuthToken]
  );

  const handleCancel = useCallback(
    (reason?: string): ReAuthResult => {
      setIsVisible(false);
      setError(null);
      const errorMsg = reason || 'Re-authentication cancelled by user';
      if (resolverRef.current) {
        resolverRef.current({ success: false, error: errorMsg });
        resolverRef.current = null;
      }
      return { success: false, error: errorMsg };
    },
    []
  );

  return {
    isVisible,
    promptTitle,
    promptMessage,
    isSupported,
    isEnrolled,
    biometricType,
    hasPin,
    isAuthenticating,
    isLoading: isBiometricsLoading || isPinLoading,
    error,
    requestReAuth,
    authenticateBiometrics,
    verifySecurityPin,
    handleSuccess,
    handleCancel,
    setIsVisible,
    generateReAuthToken,
  };
}

export default useBiometricReAuth;
