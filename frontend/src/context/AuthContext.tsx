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
  getImpersonationBackup,
  getRefreshToken,
  getStoredUser,
  restoreAuthFromImpersonationBackup,
  setAuthStorage,
  setImpersonationBackup,
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
  planId?: string;
};

type AuthContextValue = {
  user: StoredUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  login: (input: LoginInput) => Promise<StoredUser>;
  register: (input: RegisterInput) => Promise<StoredUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  impersonate: (input: { accessToken: string; impersonatedUser: StoredUser }) => void;
  stopImpersonation: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeUser(user: StoredUser): StoredUser {
  return {
    ...user,
    isImpersonation: Boolean(user.isImpersonation),
    impersonatedByUserId: user.impersonatedByUserId || null
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<StoredUser | null>(() => {
    const current = getStoredUser();
    return current ? normalizeUser(current) : null;
  });
  const [loading, setLoading] = useState(true);

  const isImpersonating = Boolean(user?.isImpersonation);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      const currentUser: StoredUser = normalizeUser({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        storeId: data.storeId,
        isImpersonation: Boolean(data.isImpersonation),
        impersonatedByUserId: data.impersonatedByUserId || null
      });
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
    const nextUser = normalizeUser({
      ...data.user,
      isImpersonation: false,
      impersonatedByUserId: null
    });

    setAuthStorage({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: nextUser
    });
    setUser(nextUser);
    return nextUser;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { data } = await api.post("/auth/register", input);
    const nextUser = normalizeUser({
      ...data.user,
      isImpersonation: false,
      impersonatedByUserId: null
    });

    setAuthStorage({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: nextUser
    });
    setUser(nextUser);
    return nextUser;
  }, []);

  const impersonate = useCallback((input: { accessToken: string; impersonatedUser: StoredUser }) => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    const currentUser = getStoredUser();

    if (accessToken && refreshToken && currentUser && !getImpersonationBackup()) {
      setImpersonationBackup({
        accessToken,
        refreshToken,
        user: currentUser
      });
    }

    const impersonated = normalizeUser({
      ...input.impersonatedUser,
      isImpersonation: true,
      impersonatedByUserId: currentUser?.id || null
    });

    setAuthStorage({
      accessToken: input.accessToken,
      refreshToken: "",
      user: impersonated
    });

    setUser(impersonated);
  }, []);

  const stopImpersonation = useCallback(() => {
    const restored = restoreAuthFromImpersonationBackup();

    if (restored) {
      const restoredUser = getStoredUser();
      setUser(restoredUser ? normalizeUser(restoredUser) : null);
      return;
    }

    clearAuthStorage();
    setUser(null);
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
      isImpersonating,
      login,
      register,
      logout,
      refreshMe,
      impersonate,
      stopImpersonation
    }),
    [user, loading, isImpersonating, login, register, logout, refreshMe, impersonate, stopImpersonation]
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
