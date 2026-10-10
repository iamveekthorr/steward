"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, type UserDto } from "./api";

interface AuthUser extends UserDto {
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: () => {},
  refreshUser: () => Promise.resolve(),
});

export function useAuth() {
  return useContext(AuthContext);
}

function decodeRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

// Match the API's ACCESS_TOKEN_EXPIRY_SECS (900 s = 15 min).
const ACCESS_TOKEN_MAX_AGE = 900;

export function setAuthCookie(token: string) {
  document.cookie = `access_token=${token}; path=/; SameSite=Lax; max-age=${ACCESS_TOKEN_MAX_AGE}`;
}

export function clearAuthCookie() {
  document.cookie = "access_token=; path=/; SameSite=Lax; max-age=0";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    clearAuthCookie();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const token =
      localStorage.getItem("access_token") ??
      sessionStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    const role = decodeRole(token) ?? "user";
    try {
      const res = await api.users.me();
      if (res.data) setUser({ ...res.data, role });
    } catch {
      const refreshToken =
        localStorage.getItem("refresh_token") ??
        sessionStorage.getItem("refresh_token");
      if (!refreshToken) {
        signOut();
        return;
      }
      try {
        const res = await api.auth.refresh(refreshToken);
        const data = (res as { data: { access_token: string } }).data;
        localStorage.setItem("access_token", data.access_token);
        setAuthCookie(data.access_token);
        const newRole = decodeRole(data.access_token) ?? "user";
        const meRes = await api.users.me();
        if (meRes.data) setUser({ ...meRes.data, role: newRole });
      } catch {
        signOut();
      }
    } finally {
      setLoading(false);
    }
  }, [signOut]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
