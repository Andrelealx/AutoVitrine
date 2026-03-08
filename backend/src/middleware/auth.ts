import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/app-error";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Token ausente", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { store: true }
    });

    if (!user || !user.isActive) {
      throw new AppError("Usuario inativo ou inexistente", 401);
    }

    if (user.role !== UserRole.SUPER_ADMIN && user.store && !user.store.isActive) {
      throw new AppError("Loja bloqueada", 403);
    }

    req.user = {
      id: user.id,
      role: user.role,
      storeId: user.storeId ?? null
    };

    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError("Token invalido", 401));
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Nao autenticado", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError("Sem permissao para este recurso", 403));
    }

    return next();
  };
}

export function requireStoreContext(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError("Nao autenticado", 401));
  }

  if (!req.user.storeId) {
    return next(new AppError("Usuario sem loja vinculada", 400));
  }

  return next();
}
