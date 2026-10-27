import type { User } from '@supabase/supabase-js';

import { supabase, expoSecureStorage } from './supabase';
import { storage } from './queryPersister';

export type LinkedProfile = {
  id: string;
  email: string | null;
  name?: string | null;
  role?: string | null;
  mobile_number?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
};

export function getClientAvatarUrl(
  item: { avatar_url?: string | null; avatarUrl?: string | null; avatar?: string | null; name?: string | null; full_name?: string | null; email?: string | null } | null | undefined,
  fallbackName?: string,
  size = 120
): string {
  const url = item?.avatar_url || item?.avatarUrl || item?.avatar;
  if (url && typeof url === 'string' && url.trim().length > 0 && !url.includes('undefined') && !url.includes('null')) {
    return url.trim();
  }
  const name = fallbackName || item?.name || item?.full_name || item?.email || '?';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ee4d2d&color=fff&size=${size}&bold=true`;
}

export type CachedUserProfile = {
  authUserId?: string;
  role: string;
  linkedProfileId: string;
  theme?: string;
};

export function getCachedUserProfile(authUserId?: string): CachedUserProfile | null {
  try {
    const raw = storage.getString('cached_user_profile');
    if (raw) {
      const cached = JSON.parse(raw);
      if (authUserId && (cached?.authUserId !== authUserId ||
        !cached?.linkedProfileId || !['ADMIN', 'CLIENT'].includes(cached?.role))) return null;
      return cached;
    }
  } catch (e) {
    console.warn('[AuthProfile] Failed to read cached_user_profile from MMKV:', e);
  }
  return null;
}

export function setCachedUserProfile(cached: CachedUserProfile): void {
  try {
    storage.set('cached_user_profile', JSON.stringify(cached));
  } catch (e) {
    console.warn('[AuthProfile] Failed to write cached_user_profile to MMKV:', e);
  }
}

const PROFILE_SELECT = 'id, email, name, role, mobile_number';

const pendingProfiles = new Map<string, Promise<LinkedProfile | null>>();

export function getLinkedProfileForUser(user: Pick<User, 'id' | 'email'>): Promise<LinkedProfile | null> {
  const key = JSON.stringify([user.id, user.email ?? null]);
  const pending = pendingProfiles.get(key);
  if (pending) return pending;
  const request = lookupLinkedProfile(user).finally(() => {
    if (pendingProfiles.get(key) === request) pendingProfiles.delete(key);
  });
  pendingProfiles.set(key, request);
  return request;
}

async function lookupLinkedProfile(user: Pick<User, 'id' | 'email'>): Promise<LinkedProfile | null> {
  const { data: linkedProfile, error: rpcError } = await supabase
    .rpc('get_current_linked_profile')
    .maybeSingle();

  if (rpcError) {
    console.warn('[AuthProfile] Linked profile RPC unavailable, falling back to direct profile lookup:', rpcError.message);
  } else if (linkedProfile) {
    return linkedProfile as LinkedProfile;
  }

  const { data: profileById, error: idError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle();

  if (idError) {
    throw idError;
  }

  if (profileById) {
    return profileById;
  }

  if (!user.email) {
    return null;
  }

  const { data: profileByEmail, error: emailError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .ilike('email', user.email)
    .limit(1)
    .maybeSingle();

  if (emailError) {
    throw emailError;
  }

  return profileByEmail;
}

let memoryProfileCache: { userId: string; profile: LinkedProfile | null; profileId: string; timestamp: number } | null = null;
let profileCacheGeneration = 0;

export function primeCurrentUserProfile(userId: string, profile: LinkedProfile | null): void {
  memoryProfileCache = { userId, profile, profileId: profile?.id || userId, timestamp: Date.now() };
}

export function clearMemoryProfileCache(): void {
  profileCacheGeneration += 1;
  pendingProfiles.clear();
  memoryProfileCache = null;
}

export async function getLinkedProfileForCurrentUser() {
  try {
    const raw = await expoSecureStorage.getItem('impersonated_user');
    if (raw) {
      const imp = JSON.parse(raw);
      if (imp?.id) {
        const profile = await getLinkedProfileForUser({ id: imp.id, email: imp.email });
        return {
          user: {
            id: imp.id,
            email: imp.email,
            user_metadata: {
              full_name: imp.name,
              name: imp.name,
              avatar_url: imp.avatarUrl || null,
              picture: imp.avatarUrl || null,
            },
          } as any,
          profile: profile || {
            id: imp.id,
            email: imp.email,
            name: imp.name,
            role: 'CLIENT',
            mobile_number: null,
            avatar_url: imp.avatarUrl || null,
            avatarUrl: imp.avatarUrl || null,
          },
          profileId: imp.id,
        };
      }
    }
  } catch (e) {
    // Fall back to default session user
  }

  let { data: { session } } = await supabase.auth.getSession();

  if (session && session.expires_at) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (session.expires_at <= nowSec) {
      try {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession();
        if (refreshed) {
          session = refreshed;
        }
      } catch (refreshErr) {
        console.warn('[AuthProfile] Failed to refresh expired session:', refreshErr);
      }
    }
  }

  const user = session?.user || null;

  if (!user) {
    memoryProfileCache = null;
    return { user: null, profile: null, profileId: null };
  }

  if (memoryProfileCache && memoryProfileCache.userId === user.id && Date.now() - memoryProfileCache.timestamp < 5 * 60_000) {
    return {
      user,
      profile: memoryProfileCache.profile,
      profileId: memoryProfileCache.profileId,
    };
  }

  const generation = profileCacheGeneration;
  const profile = await getLinkedProfileForUser(user);
  const profileId = profile?.id || user.id;

  if (generation !== profileCacheGeneration) return { user: null, profile: null, profileId: null };
  primeCurrentUserProfile(user.id, profile);

  if (profile) {
    setCachedUserProfile({
      authUserId: user.id,
      role: profile.role || 'CLIENT',
      linkedProfileId: profileId,
    });
  }

  return {
    user,
    profile,
    profileId,
  };
}
