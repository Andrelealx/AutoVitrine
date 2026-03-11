import { Prisma, UserRole } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../config/prisma";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  storeId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: UserRole | null;
  impersonatedByUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function getAuditContext(req: Request): Pick<
  AuditInput,
  | "actorUserId"
  | "actorEmail"
  | "actorRole"
  | "impersonatedByUserId"
  | "ipAddress"
  | "userAgent"
> {
  return {
    actorUserId: req.user?.id || null,
    actorEmail: req.user?.email || null,
    actorRole: req.user?.role || null,
    impersonatedByUserId: req.user?.impersonatedByUserId || null,
    ipAddress: req.ip || null,
    userAgent: req.headers["user-agent"] || null
  };
}

export async function logAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      description: input.description,
      metadata: input.metadata,
      storeId: input.storeId || null,
      actorUserId: input.actorUserId || null,
      actorEmail: input.actorEmail || null,
      actorRole: input.actorRole || null,
      impersonatedByUserId: input.impersonatedByUserId || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null
    }
  });
}
