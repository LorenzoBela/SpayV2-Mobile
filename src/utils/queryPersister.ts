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
      // Generate a cryptographically secure 64-character hex key (32 bytes / 256 bits)
      const bytes = new Uint8Array(32);
      if (typeof globalThis.crypto?.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        // Fallback for engines without globalThis.crypto
        for (let i = 0; i < 32; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      const generatedKey = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      SecureStore.setItem(SECURE_KEY_ALIAS, generatedKey);
      key = generatedKey;
    }
    return key;
  } catch (error) {
    console.error('[queryPersister] Failed to get/create encryption key from SecureStore:', error);
    // Fallback to a stable local key in case SecureStore is failing, to avoid app crash.
    return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  }
}

let mmkvInstance: ReturnType<typeof createMMKV> | null = null;

function getStorageInstance(): ReturnType<typeof createMMKV> {
  if (!mmkvInstance) {
    const encryptionKey = getOrCreateEncryptionKey();
    try {
      mmkvInstance = createMMKV({
        id: 'spay-query-cache',
        encryptionKey: encryptionKey,
        encryptionType: 'AES-256',
      });
    } catch (error) {
      console.error('[queryPersister] Failed to initialize encrypted MMKV. Re-initializing unencrypted fallback storage:', error);
      try {
        mmkvInstance = createMMKV({ id: 'spay-query-cache-fallback' });
      } catch (fallbackError) {
        console.error('[queryPersister] Fallback MMKV also failed. Using memory-only mock storage:', fallbackError);
        mmkvInstance = {
          getString: (k: string) => undefined,
          set: (k: string, v: string) => {},
          remove: (k: string) => {},
          clearAll: () => {},
        } as any;
      }
    }
  }
  return mmkvInstance!;
}

/**
 * Exported MMKV storage proxy that lazily instantiates the underlying MMKV client
 * and encryption key on first access rather than module load time.
 */
export const storage = new Proxy({} as ReturnType<typeof createMMKV>, {
  get(_target, prop, receiver) {
    const instance = getStorageInstance();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

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
