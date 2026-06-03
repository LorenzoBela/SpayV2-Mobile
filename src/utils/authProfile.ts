import type { User } from '@supabase/supabase-js';

import { supabase } from './supabase';

export type LinkedProfile = {
  id: string;
  email: string | null;
  name?: string | null;
  role?: string | null;
  mobile_number?: string | null;
};

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
