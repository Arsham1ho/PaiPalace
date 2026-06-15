import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, type User } from "../lib/api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { user } = await api.me();
          setUser(user);
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user } = await api.login({ email, password });
    setToken(token);
    setUser(user);
  };
  const register = async (email: string, username: string, password: string) => {
    const { token, user } = await api.register({ email, username, password });
    setToken(token);
    setUser(user);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };
  const refresh = async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      /* ignore */
    }
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}
