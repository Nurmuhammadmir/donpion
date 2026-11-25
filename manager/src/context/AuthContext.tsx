import { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, setToken, setUnauthorizedHandler, ApiError } from "@/lib/api";

interface ManagerUser {
  id: string;
  name: string;
  email: string;
  // Every manager is pinned to exactly one branch — there is no CEO/
  // all-branches case here, unlike admin/'s AdminUser.branch.
  branch: string;
}

interface AuthContextValue {
  manager: ManagerUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [manager, setManager] = useState<ManagerUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    clearToken();
    setManager(null);
  };

  setUnauthorizedHandler(logout);

  useEffect(() => {
    api<{ manager: ManagerUser }>("/manager/auth/me")
      .then((res) => setManager(res.manager))
      .catch(() => setManager(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api<{ manager: ManagerUser; token: string }>("/manager/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setManager(res.manager);
  };

  return <AuthContext.Provider value={{ manager, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
