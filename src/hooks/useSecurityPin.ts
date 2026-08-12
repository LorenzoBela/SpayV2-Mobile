import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export const SECURE_PIN_KEY = 'security_pin_hash';
export const SECURE_PIN_SALT_KEY = 'security_pin_salt';

async function getOrCreateSalt(): Promise<string> {
  try {
    let salt = await SecureStore.getItemAsync(SECURE_PIN_SALT_KEY);
    if (!salt) {
      const bytes = new Uint8Array(16);
      if (typeof globalThis.crypto?.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      salt = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync(SECURE_PIN_SALT_KEY, salt);
    }
    return salt;
  } catch {
    return 'spay_default_device_salt_2026';
  }
}

export async function hashPinSHA256(pin: string, salt?: string): Promise<string> {
  const targetSalt = salt ?? await getOrCreateSalt();
  const saltedInput = `${targetSalt}:${pin}`;

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    try {
      const msgUint8 = new TextEncoder().encode(saltedInput);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback
    }
  }
  return pureJsSha256(saltedInput);
}

function pureJsSha256(ascii: string): string {
  const maxWord = Math.pow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  const getFractionalBits = (n: number) => Math.floor((n - Math.floor(n)) * maxWord);

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = getFractionalBits(Math.pow(candidate, 1 / 2));
      }
      k[primeCounter] = getFractionalBits(Math.pow(candidate, 1 / 3));
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function useSecurityPin() {
  const [hasPin, setHasPin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkPinExists = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const storedHash = await SecureStore.getItemAsync(SECURE_PIN_KEY);
      const exists = Boolean(storedHash && storedHash.length > 0);
      setHasPin(exists);
      return exists;
    } catch (err) {
      console.warn('[useSecurityPin] Error checking stored PIN:', err);
      setHasPin(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkPinExists();
  }, [checkPinExists]);

  const setPin = useCallback(async (pin: string): Promise<void> => {
    try {
      const salt = await getOrCreateSalt();
      const hash = await hashPinSHA256(pin, salt);
      await SecureStore.setItemAsync(SECURE_PIN_KEY, hash);
      setHasPin(true);
    } catch (err) {
      console.error('[useSecurityPin] Error saving PIN hash:', err);
      throw err;
    }
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const storedHash = await SecureStore.getItemAsync(SECURE_PIN_KEY);
      if (!storedHash) return false;
      
      const salt = await getOrCreateSalt();
      const saltedHash = await hashPinSHA256(pin, salt);
      
      if (saltedHash === storedHash) {
        return true;
      }

      // Legacy fallback check (un-salted hash migration)
      const legacyUnsaltedHash = pureJsSha256(pin);
      if (legacyUnsaltedHash === storedHash) {
        // Transparently upgrade legacy un-salted hash to salted hash
        await setPin(pin);
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[useSecurityPin] Error verifying PIN:', err);
      return false;
    }
  }, [setPin]);

  const removePin = useCallback(async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(SECURE_PIN_KEY);
      await SecureStore.deleteItemAsync(SECURE_PIN_SALT_KEY);
      setHasPin(false);
    } catch (err) {
      console.warn('[useSecurityPin] Error removing PIN:', err);
      throw err;
    }
  }, []);

  return {
    hasPin,
    isLoading,
    checkPinExists,
    setPin,
    verifyPin,
    removePin,
  };
}

export default useSecurityPin;
