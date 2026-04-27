import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

async function fetchAuthMe() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  return res;
}

function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.username !== 'string') return null;
  return {
    username: raw.username,
    role: typeof raw.role === 'string' ? raw.role : 'manager',
    sleeperUserId: raw.sleeperUserId == null ? null : String(raw.sleeperUserId),
  };
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    ready: false,
    authenticated: false,
    authEnabled: false,
    devBypass: false,
    user: null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetchAuthMe();
      if (res.status === 503 && import.meta.env.DEV) {
        setState({
          ready: true,
          authenticated: true,
          authEnabled: false,
          devBypass: true,
          user: null,
        });
        return;
      }
      if (!res.ok) {
        setState({
          ready: true,
          authenticated: false,
          authEnabled: true,
          devBypass: false,
          user: null,
        });
        return;
      }
      const data = await res.json();
      setState({
        ready: true,
        authenticated: Boolean(data.authenticated),
        authEnabled: Boolean(data.authEnabled),
        devBypass: false,
        user: normalizeUser(data.user),
      });
    } catch {
      if (import.meta.env.DEV) {
        setState({
          ready: true,
          authenticated: true,
          authEnabled: false,
          devBypass: true,
          user: null,
        });
        return;
      }
      setState({
        ready: true,
        authenticated: false,
        authEnabled: true,
        devBypass: false,
        user: null,
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [state, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
