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
 */
export const storage = createMMKV({
  id: 'spay-query-cache',
  encryptionKey: encryptionKey,
  encryptionType: 'AES-256',
});

/**
 * Custom Persister for TanStack Query using encrypted MMKV.
 * We use createAsyncStoragePersister because it provides built-in throttling,
 * serialization, and robust error handling.
 */
export const clientPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => {
      const value = storage.getString(key);
      return value === undefined ? null : value;
    },
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.remove(key);
    },
  },
  // Default throttleTime is 1000ms
  throttleTime: 1000,
  // Custom key for the storage
  key: 'SPAY_QUERY_OFFLINE_CACHE',
});
