"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, getAccessToken, setAccessToken } from "./api-client";

export interface PublicUser {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface TokenResponse {
  accessToken: string;
  accessTokenExpiresInMs: number;
  user: PublicUser;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  authedFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  setUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<PublicUser | null>(null);

  const applySession = useCallback((token: TokenResponse) => {
    setAccessToken(token.accessToken);
    setUserState(token.user);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setStatus("unauthenticated");
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const token = await apiFetch<TokenResponse>("/auth/refresh", {
        method: "POST",
        withCsrf: true,
      });
      applySession(token);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    void refreshSession();
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      const token = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      });
      applySession(token);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, firstName?: string, lastName?: string) => {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST", withCsrf: true });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const authedFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiFetch<T>(path, options);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && getAccessToken()) {
          const refreshed = await refreshSession();
          if (refreshed) {
            return apiFetch<T>(path, options);
          }
        }
        throw error;
      }
    },
    [refreshSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      register,
      logout,
      refreshSession,
      authedFetch,
      setUser: setUserState,
    }),
    [status, user, login, register, logout, refreshSession, authedFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
