import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './queryPersister';
import { supabase } from './supabase';

export type ThemePreference = 'dark' | 'light' | 'auto';

export const THEME_STORAGE_KEY = 'theme_preference';
export const ASYNC_THEME_KEY = '@spay_theme_preference';

/**
 * Resolves whether dark mode should be active based on a theme preference string
 * and the current device system appearance.
 */
export function resolveIsDark(themePref?: ThemePreference | string | null): boolean {
  if (themePref === 'dark') return true;
  if (themePref === 'light') return false;
  // If 'auto', undefined, or null: follow device system color scheme
  try {
    const systemScheme = Appearance?.getColorScheme ? Appearance.getColorScheme() : null;
    if (systemScheme === 'dark') return true;
    if (systemScheme === 'light') return false;
  } catch {
    // Fallback if Appearance is not initialized
  }
  return true;
}

/**
 * Synchronously retrieves the user's stored theme preference.
 * Checks MMKV first, then cached profile in MMKV, with default to 'auto' (follow device).
 */
export function getPersistedTheme(): ThemePreference {
  try {
    const saved = storage.getString(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'auto') {
      return saved as ThemePreference;
    }

    const cachedProfileRaw = storage.getString('cached_user_profile');
    if (cachedProfileRaw) {
      const parsed = JSON.parse(cachedProfileRaw);
      if (parsed?.theme === 'dark' || parsed?.theme === 'light' || parsed?.theme === 'auto') {
        return parsed.theme as ThemePreference;
      }
    }
  } catch (e) {
    console.warn('[themeStorage] Error reading theme from MMKV:', e);
  }
  // Default to 'auto' to follow device preference out of the box
  return 'auto';
}

/**
 * Persists theme preference across MMKV, AsyncStorage, cached profile, and Supabase.
 */
export function savePersistedTheme(
  theme: ThemePreference,
  userId?: string | null
): void {
  // 1. Synchronously persist to MMKV
  try {
    storage.set(THEME_STORAGE_KEY, theme);

    const cachedProfileRaw = storage.getString('cached_user_profile');
    if (cachedProfileRaw) {
      try {
        const parsed = JSON.parse(cachedProfileRaw);
        parsed.theme = theme;
        storage.set('cached_user_profile', JSON.stringify(parsed));
      } catch {
        // Ignore JSON parse error
      }
    }
  } catch (e) {
    console.warn('[themeStorage] Error saving theme to MMKV:', e);
  }

  // 2. Asynchronously persist to AsyncStorage for robust fallback
  try {
    AsyncStorage.setItem(ASYNC_THEME_KEY, theme).catch(() => {});
  } catch {
    // Ignore async storage error
  }

  // 3. Dual-write to Supabase user_settings in background if logged in
  if (userId) {
    void (async () => {
      try {
        const { error } = await supabase
          .from('user_settings')
          .upsert(
            {
              user_id: userId,
              setting_name: 'theme',
              setting_value: theme,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,setting_name' }
          );

        if (error) {
          console.warn('[themeStorage] Failed to sync theme setting to Supabase:', error.message);
        }
      } catch (err: any) {
        console.warn('[themeStorage] Error syncing theme to Supabase:', err);
      }
    })();
  }
}
