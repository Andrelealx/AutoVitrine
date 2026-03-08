import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { api } from "../lib/api";
import {
  StoredUser,
  clearAuthStorage,
  getAccessToken,
  getStoredUser,
  setAuthStorage,
  setStoredUser
} from "../lib/auth-storage";

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  storeName?: string;
};

type AuthContextValue = {
  user: StoredUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<StoredUser>;
  register: (input: RegisterInput) => Promise<StoredUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      const currentUser: StoredUser = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        storeId: data.storeId
      };
      setUser(currentUser);
      setStoredUser(currentUser);
    } catch {
      clearAuthStorage();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = useCallback(async (input: LoginInput) => {
    const { data } = await api.post("/auth/login", input);
    setAuthStorage({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
    });
    setUser(data.user);
    return data.user as StoredUser;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { data } = await api.post("/auth/register", input);
    setAuthStorage({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
    });
    setUser(data.user);
    return data.user as StoredUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      clearAuthStorage();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshMe
    }),
    [user, loading, login, register, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
