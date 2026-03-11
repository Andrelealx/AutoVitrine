const ACCESS_TOKEN_KEY = "autovitrine_access_token";
const REFRESH_TOKEN_KEY = "autovitrine_refresh_token";
const USER_KEY = "autovitrine_user";
const IMPERSONATION_BACKUP_KEY = "autovitrine_impersonation_backup";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "STORE_OWNER" | "STORE_STAFF";
  storeId: string | null;
  isImpersonation?: boolean;
  impersonatedByUserId?: string | null;
};

type ImpersonationBackup = {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
};

export function setAuthStorage(payload: {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
}) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
}

export function updateAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  const value = localStorage.getItem(USER_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setImpersonationBackup(payload: ImpersonationBackup) {
  localStorage.setItem(IMPERSONATION_BACKUP_KEY, JSON.stringify(payload));
}

export function getImpersonationBackup(): ImpersonationBackup | null {
  const value = localStorage.getItem(IMPERSONATION_BACKUP_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as ImpersonationBackup;
  } catch {
    return null;
  }
}

export function clearImpersonationBackup() {
  localStorage.removeItem(IMPERSONATION_BACKUP_KEY);
}

export function restoreAuthFromImpersonationBackup() {
  const backup = getImpersonationBackup();
  if (!backup) {
    return false;
  }

  setAuthStorage({
    accessToken: backup.accessToken,
    refreshToken: backup.refreshToken,
    user: backup.user
  });
  clearImpersonationBackup();
  return true;
}

export function clearAuthStorage() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(IMPERSONATION_BACKUP_KEY);
}
