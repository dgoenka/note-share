"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PublicUser } from "@note-share/shared";
import { api } from "./api";

const TOKEN_KEY = "note-share-token";

type AuthContextValue = {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  setSession: (token: string, user: PublicUser) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((nextToken: string, nextUser: PublicUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setToken(null);
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.me(stored);
      setToken(stored);
      setUser(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, token, loading, setSession, logout, refresh }),
    [user, token, loading, setSession, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
