import { createMMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const SECURE_KEY_ALIAS = 'spay_mmkv_encryption_key';

/**
 * Helper to retrieve or generate a secure key for MMKV database encryption.
 * Stores a 64-character hex string (representing a 256-bit key) in Expo SecureStore.
 */
function getOrCreateEncryptionKey(): string {
  try {
    let key = SecureStore.getItem(SECURE_KEY_ALIAS);
    if (!key) {
      // Generate a random 64-character hex key (32 bytes / 256 bits)
      // Since we don't have expo-crypto, we use a slightly better random generation
      // than Math.random() if possible, but in this environment Math.random is our baseline.
      const chars = '0123456789abcdef';
      let generatedKey = '';
      for (let i = 0; i < 64; i++) {
        generatedKey += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      SecureStore.setItem(SECURE_KEY_ALIAS, generatedKey);
      key = generatedKey;
    }
    return key;
  } catch (error) {
    console.error('[queryPersister] Failed to get/create encryption key from SecureStore:', error);
    // Fallback to a stable local key in case SecureStore is failing, to avoid app crash.
    // This key is exactly 64 characters (32 bytes in hex).
    return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  }
}

const encryptionKey = getOrCreateEncryptionKey();

/**
 * Instantiate MMKV client with AES-256 encryption.
 * The encryptionKey must be a hex string of 32 bytes (64 characters).
 * Wrapped in a try-catch block to prevent decryption/corruption failure crashes.
 */
export const storage = (() => {
  try {
    return createMMKV({
      id: 'spay-query-cache',
      encryptionKey: encryptionKey,
      encryptionType: 'AES-256',
    });
  } catch (error) {
    console.error('[queryPersister] Failed to initialize encrypted MMKV. Re-initializing unencrypted fallback storage:', error);
    try {
      return createMMKV({ id: 'spay-query-cache-fallback' });
    } catch (fallbackError) {
      console.error('[queryPersister] Fallback MMKV also failed. Using memory-only mock storage:', fallbackError);
      return {
        getString: (k: string) => undefined,
        set: (k: string, v: string) => {},
        remove: (k: string) => {},
      } as any;
    }
  }
})();

/**
 * Custom Persister for TanStack Query using encrypted MMKV.
 * We use createAsyncStoragePersister because it provides built-in throttling,
 * serialization, and robust error handling.
 */
export const clientPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => {
      try {
        const value = storage.getString(key);
        return value === undefined ? null : value;
      } catch (error) {
        console.error('[queryPersister] Decryption or read failure in MMKV. Clearing cache to recover:', error);
        try {
          storage.clearAll();
        } catch (clearError) {
          console.error('[queryPersister] Failed to clear MMKV storage:', clearError);
        }
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        storage.set(key, value);
      } catch (error) {
        console.error('[queryPersister] Decryption or write failure in MMKV. Clearing cache to recover:', error);
        try {
          storage.clearAll();
          storage.set(key, value);
        } catch (recoveryError) {
          console.error('[queryPersister] MMKV recovery write also failed:', recoveryError);
        }
      }
    },
    removeItem: (key) => {
      try {
        storage.remove(key);
      } catch (error) {
        console.error('[queryPersister] Decryption or remove failure in MMKV. Clearing cache to recover:', error);
        try {
          storage.clearAll();
        } catch (clearError) {
          console.error('[queryPersister] Failed to clear MMKV storage during removal:', clearError);
        }
      }
    },
  },
  // Default throttleTime is 1000ms
  throttleTime: 1000,
  // Custom key for the storage
  key: 'SPAY_QUERY_OFFLINE_CACHE',
});
