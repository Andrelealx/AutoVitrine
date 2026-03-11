import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "@prisma/client";

export type JwtPayload = {
  userId: string;
  role: UserRole;
  storeId: string | null;
  email: string;
  isImpersonation?: boolean;
  impersonatedByUserId?: string | null;
};

export function signAccessToken(payload: JwtPayload, options?: { expiresIn?: string }) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: (options?.expiresIn || env.JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"]
  });
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export function signImpersonationToken(payload: JwtPayload & { impersonatedByUserId: string }) {
  return signAccessToken(
    {
      ...payload,
      isImpersonation: true
    },
    { expiresIn: "1h" }
  );
}
