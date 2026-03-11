import { env } from "../config/env";

export function isSuperAdminEmail(email: string) {
  if (!env.SUPER_ADMIN_EMAIL) {
    return false;
  }

  return email.trim().toLowerCase() === env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
}
