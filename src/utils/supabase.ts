import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// Custom storage adapter for React Native to store auth tokens securely
const expoSecureStorage = {
  getItem: async (key: string) => {
    return SecureStore.getItemAsync(key)
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value)
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key)
  },
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: expoSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disables web-focused URL listeners
  },
})
