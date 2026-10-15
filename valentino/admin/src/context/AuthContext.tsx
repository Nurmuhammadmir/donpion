import { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, setToken, setUnauthorizedHandler, ApiError } from "@/lib/api";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    clearToken();
    setAdmin(null);
  };

  // Registered on every render (cheap — just a module-level reference
  // swap), not inside an effect, so it's already in place before the
  // effect below fires its own request. From here on, any page's fetch
  // that comes back 401 (an expired/invalid token, not just the one-time
  // check on mount) runs this and ProtectedRoute redirects to /login on
  // its own, instead of that page quietly rendering an empty state.
  setUnauthorizedHandler(logout);

  useEffect(() => {
    api<{ admin: AdminUser }>("/auth/me")
      .then((res) => setAdmin(res.admin))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api<{ admin: AdminUser; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setAdmin(res.admin);
  };

  return <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
