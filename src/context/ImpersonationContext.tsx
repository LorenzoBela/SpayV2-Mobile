import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { expoSecureStorage } from '../utils/supabase';
import { setCachedImpersonatedUserId } from '../utils/trpc';

export interface ImpersonatedUser {
  id: string;
  name: string;
  email: string;
  mobile_number?: string;
  avatar_url?: string;
  role?: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  startImpersonation: (user: ImpersonatedUser) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  exitImpersonation: () => Promise<void>;
}

export const ImpersonationContext = createContext<ImpersonationContextType>({
  isImpersonating: false,
  impersonatedUser: null,
  startImpersonation: async () => {},
  stopImpersonation: async () => {},
  exitImpersonation: async () => {},
});

const STORAGE_KEY = 'impersonated_user';

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadPersistedUser = async () => {
      try {
        const stored = await expoSecureStorage.getItem(STORAGE_KEY);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) {
            setImpersonatedUser(parsed);
            setCachedImpersonatedUserId(parsed.id);
          }
        }
      } catch (e) {
        console.warn('[ImpersonationContext] Error reading persisted impersonation state:', e);
      }
    };
    loadPersistedUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const isImpersonating = Boolean(impersonatedUser);

  const startImpersonation = useCallback(async (clientUser: ImpersonatedUser) => {
    try {
      const userData: ImpersonatedUser = {
        id: clientUser.id,
        name: clientUser.name || 'Client',
        email: clientUser.email || '',
        mobile_number: clientUser.mobile_number,
        avatar_url: clientUser.avatar_url,
        role: clientUser.role || 'CLIENT',
      };
      setImpersonatedUser(userData);
      setCachedImpersonatedUserId(userData.id);
      await expoSecureStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      try {
        const { queryClient } = require('../../App');
        queryClient?.clear();
      } catch (err) {}
    } catch (e) {
      console.warn('[ImpersonationContext] Failed to start impersonation:', e);
    }
  }, []);

  const stopImpersonation = useCallback(async () => {
    try {
      setImpersonatedUser(null);
      setCachedImpersonatedUserId(null);
      await expoSecureStorage.removeItem(STORAGE_KEY);
      try {
        const { queryClient } = require('../../App');
        queryClient?.clear();
      } catch (err) {}
    } catch (e) {
      console.warn('[ImpersonationContext] Failed to stop impersonation:', e);
    }
  }, []);

  const value = useMemo(
    () => ({
      isImpersonating,
      impersonatedUser,
      startImpersonation,
      stopImpersonation,
      exitImpersonation: stopImpersonation,
    }),
    [isImpersonating, impersonatedUser, startImpersonation, stopImpersonation]
  );

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => useContext(ImpersonationContext);
