import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getToken, clearToken, setToken, AuthState, PermissionRecord, UserInfo } from "@/lib/auth";
import { API_BASE } from "@/lib/queryClient";

interface AuthContextValue extends AuthState {
  login: (token: string, user: UserInfo, permissions: PermissionRecord[]) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Сразу начинаем без loading — нет токена = сразу страница входа
  const hasToken = !!getToken();
  const [state, setState] = useState<AuthState>({ user: null, permissions: [], loading: hasToken });

  async function refresh() {
    const token = getToken();
    if (!token) { setState({ user: null, permissions: [], loading: false }); return; }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { "x-session-token": token },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { clearToken(); setState({ user: null, permissions: [], loading: false }); return; }
      const data = await res.json();
      setState({ user: data.user, permissions: data.permissions, loading: false });
    } catch {
      // Сервер недоступен — сбрасываем токен, показываем вход
      clearToken();
      setState({ user: null, permissions: [], loading: false });
    }
  }

  useEffect(() => { refresh(); }, []);

  function login(token: string, user: UserInfo, permissions: PermissionRecord[]) {
    setToken(token);
    setState({ user, permissions, loading: false });
  }

  async function logout() {
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { "x-session-token": token },
        });
      } catch {}
    }
    clearToken();
    setState({ user: null, permissions: [], loading: false });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
