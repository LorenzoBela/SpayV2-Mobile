import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import * as ReactNative from 'react-native'
import { SPLIT_READER_HEADERS } from './split-reader-contract'

const CHUNK_SIZE = 1800
const META_SUFFIX = '__meta'
const keyLocks = new Map<string, Promise<unknown>>()

type ChunkMeta = { gen: number; chunks: number }

function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = keyLocks.get(key) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  const settled = next.then(() => undefined, () => undefined)
  keyLocks.set(key, settled)
  settled.then(() => {
    if (keyLocks.get(key) === settled) keyLocks.delete(key)
  })
  return next
}

function parseMeta(raw: string | null): ChunkMeta | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.gen === 'number' && typeof parsed?.chunks === 'number' && parsed.chunks > 0) {
      return parsed as ChunkMeta
    }
  } catch {
    // Corrupted metadata treated as absent
  }
  return null
}

async function deleteChunks(key: string, meta: ChunkMeta | null): Promise<void> {
  if (!meta) return
  await Promise.all(
    Array.from({ length: meta.chunks }, (_, i) =>
      SecureStore.deleteItemAsync(`${key}__g${meta.gen}_c${i}`).catch(() => {}),
    ),
  )
}

/**
 * Atomic, generation-tagged SecureStore adapter that splits values >1800 bytes
 * so Google OAuth sessions (>2048B) persist reliably on iOS Keychain and Android Keystore.
 */
export const expoSecureStorage = {
  getItem: (key: string): Promise<string | null> =>
    withKeyLock(key, async () => {
      const meta = parseMeta(await SecureStore.getItemAsync(`${key}${META_SUFFIX}`))
      if (!meta) {
        return SecureStore.getItemAsync(key)
      }
      const parts = await Promise.all(
        Array.from({ length: meta.chunks }, (_, i) =>
          SecureStore.getItemAsync(`${key}__g${meta.gen}_c${i}`),
        ),
      )
      if (parts.some((p) => p === null)) return null
      return parts.join('')
    }),

  setItem: (key: string, value: string): Promise<void> =>
    withKeyLock(key, async () => {
      const prevMeta = parseMeta(await SecureStore.getItemAsync(`${key}${META_SUFFIX}`))
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value)
        if (prevMeta) {
          await SecureStore.deleteItemAsync(`${key}${META_SUFFIX}`).catch(() => {})
          await deleteChunks(key, prevMeta)
        }
        return
      }

      const nextGen = (prevMeta?.gen ?? 0) + 1
      const chunks: string[] = []
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE))
      }

      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}__g${nextGen}_c${i}`, chunks[i])
      }
      await SecureStore.setItemAsync(
        `${key}${META_SUFFIX}`,
        JSON.stringify({ gen: nextGen, chunks: chunks.length }),
      )
      await SecureStore.deleteItemAsync(key).catch(() => {})
      await deleteChunks(key, prevMeta)
    }),

  removeItem: (key: string): Promise<void> =>
    withKeyLock(key, async () => {
      const prevMeta = parseMeta(await SecureStore.getItemAsync(`${key}${META_SUFFIX}`))
      await Promise.all([
        SecureStore.deleteItemAsync(key).catch(() => {}),
        SecureStore.deleteItemAsync(`${key}${META_SUFFIX}`).catch(() => {}),
        deleteChunks(key, prevMeta),
      ])
    }),
}

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://drzqsptxeqsgnkythenv.supabase.co'
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyenFzcHR4ZXFzZ25reXRoZW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzIzMDAsImV4cCI6MjA4ODEwODMwMH0.0R1EN2z5RBT_2iWUFYZpLs8oauvM_arf_CNzxj0aSts'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: SPLIT_READER_HEADERS },
  auth: {
    storage: expoSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disables web-focused URL listeners
  },
})

// Tie Supabase auto-refresh loop to AppState so backgrounded timers don't fail on suspended sockets.
try {
  const rnAppState = (ReactNative as { AppState?: { currentState?: string; addEventListener?: (type: string, cb: (state: string) => void) => void } }).AppState
  if (typeof rnAppState?.addEventListener === 'function') {
    if (rnAppState.currentState === 'active') {
      supabase.auth.startAutoRefresh?.()
    }
    rnAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh?.()
      } else {
        supabase.auth.stopAutoRefresh?.()
      }
    })
  }
} catch {
  // Partial Vitest mocks of react-native may omit AppState.
}
