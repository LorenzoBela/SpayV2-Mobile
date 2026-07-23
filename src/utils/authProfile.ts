import type { User } from '@supabase/supabase-js';

import { supabase, expoSecureStorage } from './supabase';
import { storage } from './queryPersister';

export type LinkedProfile = {
  id: string;
  email: string | null;
  name?: string | null;
  role?: string | null;
  mobile_number?: string | null;
};

export type CachedUserProfile = {
  role: string;
  linkedProfileId: string;
  theme?: string;
};

export function getCachedUserProfile(): CachedUserProfile | null {
  try {
    const raw = storage.getString('cached_user_profile');
    if (raw) {
      return JSON.parse(raw);
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

export async function getLinkedProfileForUser(user: Pick<User, 'id' | 'email'>): Promise<LinkedProfile | null> {
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
          },
          profileId: imp.id,
        };
      }
    }
  } catch (e) {
    // Fall back to default session user
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, profileId: null };
  }

  const profile = await getLinkedProfileForUser(user);

  return {
    user,
    profile,
    profileId: profile?.id || user.id,
  };
}
