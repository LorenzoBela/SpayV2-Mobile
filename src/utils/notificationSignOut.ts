import { Alert } from 'react-native';
import { supabase } from './supabase';
import { getLinkedProfileForUser } from './authProfile';
import { pushRegistrationGate } from '../services/pushRegistrationGate';

let pendingSignOut: Promise<{ error: Error | null }> | null = null;

/** Every mobile logout uses global scope, so release all of this owner's devices. */
export function signOutWithNotifications(): Promise<{ error: Error | null }> {
  if (pendingSignOut) return pendingSignOut;
  pendingSignOut = (async () => {
    await pushRegistrationGate.suspend();
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const session = data.session;
      if (session) {
        // Resolve the signed-in owner, never an impersonated preview profile.
        const profile = await getLinkedProfileForUser(session.user);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
          const serverUrl = process.env.EXPO_PUBLIC_API_URL || 'https://nootspaytracker.vercel.app';
          const response = await fetch(`${serverUrl}/api/notifications/register-device`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal,
          });
          if (!response.ok) throw new Error('Device release failed');
          const local = await supabase.from('notification_devices').delete()
            .in('user_id', [...new Set([session.user.id, profile?.id])].filter((id): id is string => !!id))
            .abortSignal(controller.signal);
          if (local.error) throw local.error;
        } finally { clearTimeout(timer); }
      }
      const result = await supabase.auth.signOut({ scope: 'global' });
      if (result.error) throw result.error;
      pushRegistrationGate.finishSignOut();
      return { error: null };
    } catch {
      pushRegistrationGate.recover();
      const error = new Error('Could not safely sign out. Reconnect and try again.');
      Alert.alert('Sign out paused', error.message);
      return { error };
    }
  })().finally(() => { pendingSignOut = null; });
  return pendingSignOut;
}
