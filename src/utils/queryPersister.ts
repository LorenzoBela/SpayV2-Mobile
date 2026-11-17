import { createMMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { withDeadline } from './networkResilience';

const SECURE_KEY_ALIAS = 'spay_mmkv_encryption_key';
const FALLBACK_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const RESTORE_DEADLINE_MS = 1500;

let cachedEncryptionKey: string | null = null;

/**
 * Helper to retrieve or generate a secure key for MMKV database encryption.
 * Cached in-process so SecureStore is hit at most once per startup.
 */
function getOrCreateEncryptionKey(): string {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  try {
    const rawKey = typeof SecureStore?.getItem === 'function' ? SecureStore.getItem(SECURE_KEY_ALIAS) : null;
    let key = typeof rawKey === 'string' && rawKey.length > 0 ? rawKey : null;
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

      if (typeof SecureStore?.setItem === 'function') {
        SecureStore.setItem(SECURE_KEY_ALIAS, generatedKey);
      }
      key = generatedKey;
    }
    cachedEncryptionKey = key;
    return key;
  } catch (error) {
    console.error('[queryPersister] Failed to get/create encryption key from SecureStore:', error);
    // Fallback to a stable local key in case SecureStore is failing, to avoid app crash.
    cachedEncryptionKey = FALLBACK_ENCRYPTION_KEY;
    return FALLBACK_ENCRYPTION_KEY;
  }
}

function createMemoryFallbackStorage() {
  const map = new Map<string, string>();
  return {
    getString: (k: string) => map.get(k),
    set: (k: string, v: string) => {
      map.set(k, String(v));
    },
    remove: (k: string) => {
      map.delete(k);
    },
    delete: (k: string) => {
      map.delete(k);
    },
    clearAll: () => {
      map.clear();
    },
  };
}

let mmkvInstance: any = null;

function isValidStorage(candidate: any): boolean {
  return Boolean(candidate && typeof candidate.getString === 'function' && typeof candidate.set === 'function');
}

function getStorageInstance(): any {
  if (!mmkvInstance) {
    const encryptionKey = getOrCreateEncryptionKey();
    try {
      const encrypted = createMMKV({
        id: 'spay-query-cache',
        encryptionKey,
        encryptionType: 'AES-256',
      });
      if (!isValidStorage(encrypted)) {
        throw new Error('Invalid MMKV instance');
      }
      mmkvInstance = encrypted;
    } catch (error) {
      console.error('[queryPersister] Failed to initialize encrypted MMKV. Re-initializing unencrypted fallback storage:', error);
      try {
        const unencrypted = createMMKV({ id: 'spay-query-cache-fallback' });
        if (!isValidStorage(unencrypted)) {
          throw new Error('Invalid fallback MMKV instance');
        }
        mmkvInstance = unencrypted;
      } catch (fallbackError) {
        console.error('[queryPersister] Fallback MMKV also failed. Using memory-only mock storage:', fallbackError);
        mmkvInstance = createMemoryFallbackStorage();
      }
    }
  }
  return mmkvInstance!;
}

/**
 * Exported MMKV storage proxy that lazily instantiates the underlying MMKV client
 * and encryption key on first access rather than module load time.
 */
export const storage = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getStorageInstance();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

const basePersister = createAsyncStoragePersister({
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
        if (typeof storage.remove === 'function') {
          storage.remove(key);
        } else {
          storage.delete?.(key);
        }
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

/**
 * Custom Persister for TanStack Query using encrypted MMKV.
 * Bounds restoreClient so corrupt or stalled persistence cannot block startup.
 */
export const clientPersister: typeof basePersister = {
  ...basePersister,
  restoreClient: () =>
    withDeadline(
      () => Promise.resolve(basePersister.restoreClient()),
      RESTORE_DEADLINE_MS,
      undefined,
      'queryPersister.restoreClient',
    ).catch((error) => {
      console.warn('[queryPersister] Restore skipped/failed; starting with fresh cache:', error);
      return undefined;
    }),
};
