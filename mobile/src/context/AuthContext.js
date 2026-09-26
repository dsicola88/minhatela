import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  bootstrapSession,
  getActiveProfile,
  getMe,
  logout as authLogout,
} from '../services/auth';
import { ensurePushRegistration } from '../platform/push';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const existing = await bootstrapSession();
      if (!mounted) return;

      if (existing) {
        setToken(existing);
        try {
          const me = await getMe();
          const active = await getActiveProfile();
          if (!mounted) return;
          setUser(me);
          setProfile(active);
          ensurePushRegistration().catch(() => {});
        } catch {
          await authLogout();
          if (!mounted) return;
          setToken(null);
          setUser(null);
          setProfile(null);
        }
      }
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const markAuthenticated = useCallback(async () => {
    const me = await getMe();
    setUser(me);
    setToken('session');
    ensurePushRegistration().catch(() => {});
  }, []);

  const selectProfile = useCallback((nextProfile) => {
    setProfile(nextProfile);
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setToken(null);
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      token,
      user,
      profile,
      isAuthenticated: Boolean(token && user),
      hasProfile: Boolean(profile),
      markAuthenticated,
      selectProfile,
      logout,
    }),
    [ready, token, user, profile, markAuthenticated, selectProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
