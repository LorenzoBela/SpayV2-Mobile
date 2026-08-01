import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export function useBiometrics() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkBiometrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      setIsSupported(hasHardware);
      setIsEnrolled(enrolled);

      if (hasHardware && enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('Iris Scan');
        } else {
          setBiometricType('Biometrics');
        }
      } else {
        setBiometricType('None');
      }
    } catch (err) {
      console.warn('[useBiometrics] Error checking biometric hardware status:', err);
      setIsSupported(false);
      setIsEnrolled(false);
      setBiometricType('None');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkBiometrics();
  }, [checkBiometrics]);

  const authenticate = useCallback(
    async (
      promptMessage: string = 'Unlock S-Pay Vault'
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage,
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false,
        });

        if (result.success) {
          return { success: true };
        } else {
          return {
            success: false,
            error: result.error || 'Authentication cancelled or failed',
          };
        }
      } catch (err: any) {
        console.warn('[useBiometrics] Authentication error:', err);
        return {
          success: false,
          error: err?.message || 'Biometric authentication error',
        };
      }
    },
    []
  );

  return {
    isSupported,
    isEnrolled,
    biometricType,
    isLoading,
    checkBiometrics,
    authenticate,
  };
}

export default useBiometrics;
