import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SessionUser } from "../lib/types";
import { setStaffBranch } from "../lib/branch";

interface AuthState {
  user: SessionUser | null;
  /** true until we know whether a session cookie exists */
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<Omit<SessionUser, "mustChangePassword"> & { mustChangePassword?: boolean }>("/auth/me");
      setUser({ ...data, mustChangePassword: Boolean(data.mustChangePassword) });
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Only staff areas need a session; the public booking site never calls this.
    const needsSession = window.location.pathname.startsWith("/app") || window.location.pathname.startsWith("/change-password");
    if (!needsSession) {
      setLoading(false);
      return;
    }
    void refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    const onExpired = () => {
      setStaffBranch(null);
      setUser(null);
      qc.clear();
    };
    window.addEventListener("session-expired", onExpired);
    return () => window.removeEventListener("session-expired", onExpired);
  }, [qc]);

  const login = useCallback(async (email: string, password: string) => {
    setStaffBranch(null);
    const { data } = await api.post<{ user: SessionUser }>("/auth/login", { email, password });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setStaffBranch(null);
      setUser(null);
      qc.clear();
    }
  }, [qc]);

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading, login, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const homeFor = (role: SessionUser["role"]) => (role === "OWNER" || role === "MANAGER" ? "/app/dashboard" : "/app/calendar");
