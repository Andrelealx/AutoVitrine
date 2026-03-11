import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        storeId: string | null;
        email: string;
        isImpersonation: boolean;
        impersonatedByUserId: string | null;
      };
    }
  }
}

export {};
