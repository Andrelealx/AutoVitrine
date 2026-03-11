import { Router } from "express";
import { BillingGateway, PaymentStatus, StoreSuspensionReason, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../utils/app-error";
import { signImpersonationToken } from "../utils/jwt";
import { assertStripe } from "../services/stripe.service";
import { getAuditContext, logAudit } from "../services/audit.service";

const router = Router();

const ACTIVE_STATUS_FOR_STATS: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE
];

const updateStoreStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
    note: z.string().max(300).optional().nullable()
  }),
  params: z.object({
    id: z.string().min(1)
  }),
  query: z.object({}).optional()
});

const upsertPlanSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().min(3),
    priceCents: z.number().int().min(0),
    vehicleLimit: z.number().int().positive().nullable().optional(),
    userLimit: z.number().int().positive().nullable().optional(),
    maxPhotosPerVehicle: z.number().int().positive().nullable().optional(),
    allowCustomDomain: z.boolean().default(false),
    removeWatermark: z.boolean().default(false),
    includeReports: z.boolean().default(false),
    includeAdvancedReports: z.boolean().default(false),
    allowOutboundWebhooks: z.boolean().default(false),
    trialDays: z.number().int().positive().nullable().optional(),
    isTrial: z.boolean().default(false),
    showTrialBanner: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    stripePriceId: z.string().optional().nullable(),
    mercadopagoPlanId: z.string().optional().nullable()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updatePlanSchema = z.object({
  body: upsertPlanSchema.shape.body.partial(),
  params: z.object({
    id: z.string().min(1)
  }),
  query: z.object({}).optional()
});

const impersonateSchema = z.object({
  body: z.object({
    userId: z.string().min(1).optional()
  }),
  params: z.object({
    id: z.string().min(1)
  }),
  query: z.object({}).optional()
});

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get("/stores", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const search = String(req.query.search || "").trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
            { owner: { email: { contains: search, mode: "insensitive" as const } } }
          ]
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.store.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          subscriptions: {
            include: {
              plan: true
            },
            take: 1,
            orderBy: {
              updatedAt: "desc"
            }
          },
          _count: {
            select: {
              vehicles: true,
              leads: true,
              users: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.store.count({ where })
    ]);

    return res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/stores/:id/status", validate(updateStoreStatusSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, note } = req.body;

    const store = await prisma.store.update({
      where: { id },
      data: {
        isActive,
        suspendedAt: isActive ? null : new Date(),
        suspensionReason: isActive ? null : StoreSuspensionReason.MANUAL,
        suspensionNote: isActive ? null : note || "Suspensa manualmente pelo super admin"
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (!isActive) {
      await prisma.subscription.updateMany({
        where: {
          storeId: store.id,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE]
          }
        },
        data: {
          status: SubscriptionStatus.PAUSED,
          suspendedAt: new Date()
        }
      });
    }

    await logAudit({
      ...getAuditContext(req),
      action: isActive ? "ADMIN_STORE_REACTIVATED" : "ADMIN_STORE_SUSPENDED",
      entityType: "Store",
      entityId: store.id,
      storeId: store.id,
      description: isActive ? "Loja reativada manualmente" : "Loja suspensa manualmente",
      metadata: {
        isActive,
        note: note || null
      }
    });

    return res.json({
      message: isActive ? "Loja ativada" : "Loja bloqueada",
      store
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/plans", async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }]
    });

    return res.json(plans);
  } catch (error) {
    return next(error);
  }
});

router.post("/plans", validate(upsertPlanSchema), async (req, res, next) => {
  try {
    const data = req.body;

    const plan = await prisma.plan.upsert({
      where: {
        name: data.name
      },
      update: {
        description: data.description,
        priceCents: data.priceCents,
        vehicleLimit: data.vehicleLimit ?? null,
        userLimit: data.userLimit ?? null,
        maxPhotosPerVehicle: data.maxPhotosPerVehicle ?? null,
        allowCustomDomain: data.allowCustomDomain,
        removeWatermark: data.removeWatermark,
        includeReports: data.includeReports,
        includeAdvancedReports: data.includeAdvancedReports,
        allowOutboundWebhooks: data.allowOutboundWebhooks,
        trialDays: data.trialDays ?? null,
        isTrial: data.isTrial,
        showTrialBanner: data.showTrialBanner,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        stripePriceId: data.stripePriceId ?? null,
        mercadopagoPlanId: data.mercadopagoPlanId ?? null
      },
      create: {
        name: data.name,
        description: data.description,
        priceCents: data.priceCents,
        vehicleLimit: data.vehicleLimit ?? null,
        userLimit: data.userLimit ?? null,
        maxPhotosPerVehicle: data.maxPhotosPerVehicle ?? null,
        allowCustomDomain: data.allowCustomDomain,
        removeWatermark: data.removeWatermark,
        includeReports: data.includeReports,
        includeAdvancedReports: data.includeAdvancedReports,
        allowOutboundWebhooks: data.allowOutboundWebhooks,
        trialDays: data.trialDays ?? null,
        isTrial: data.isTrial,
        showTrialBanner: data.showTrialBanner,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        stripePriceId: data.stripePriceId ?? null,
        mercadopagoPlanId: data.mercadopagoPlanId ?? null
      }
    });

    await logAudit({
      ...getAuditContext(req),
      action: "ADMIN_PLAN_UPSERT",
      entityType: "Plan",
      entityId: plan.id,
      description: "Plano criado/atualizado pelo super admin",
      metadata: {
        name: plan.name,
        priceCents: plan.priceCents,
        isTrial: plan.isTrial
      }
    });

    return res.status(201).json({
      message: "Plano salvo",
      plan
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/plans/:id", validate(updatePlanSchema), async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...req.body,
        vehicleLimit:
          req.body.vehicleLimit !== undefined ? req.body.vehicleLimit : undefined,
        userLimit: req.body.userLimit !== undefined ? req.body.userLimit : undefined,
        maxPhotosPerVehicle:
          req.body.maxPhotosPerVehicle !== undefined ? req.body.maxPhotosPerVehicle : undefined,
        trialDays: req.body.trialDays !== undefined ? req.body.trialDays : undefined,
        stripePriceId: req.body.stripePriceId !== undefined ? req.body.stripePriceId : undefined,
        mercadopagoPlanId:
          req.body.mercadopagoPlanId !== undefined ? req.body.mercadopagoPlanId : undefined
      }
    });

    await logAudit({
      ...getAuditContext(req),
      action: "ADMIN_PLAN_UPDATED",
      entityType: "Plan",
      entityId: plan.id,
      description: "Plano atualizado pelo super admin",
      metadata: {
        changedFields: Object.keys(req.body)
      }
    });

    return res.json({
      message: "Plano atualizado",
      plan
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/subscriptions", async (_req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            suspendedAt: true,
            suspensionReason: true
          }
        },
        plan: true,
        payments: {
          orderBy: {
            createdAt: "desc"
          },
          take: 3
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return res.json(subscriptions);
  } catch (error) {
    return next(error);
  }
});

router.get("/audit-logs", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 50);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: {
          createdAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.auditLog.count()
    ]);

    return res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/stats", async (_req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      totalStores,
      activeStores,
      totalVehicles,
      totalLeads,
      activeSubscriptions,
      activePaidSubscriptions,
      newSubscriptionsThisMonth,
      newTrialsThisMonth,
      canceledThisMonth,
      activeAtMonthStart,
      approvedPayments
    ] = await Promise.all([
      prisma.store.count(),
      prisma.store.count({ where: { isActive: true } }),
      prisma.vehicle.count(),
      prisma.lead.count(),
      prisma.subscription.count({
        where: {
          status: {
            in: ACTIVE_STATUS_FOR_STATS
          }
        }
      }),
      prisma.subscription.findMany({
        where: {
          status: {
            in: ACTIVE_STATUS_FOR_STATS
          },
          plan: {
            isTrial: false
          }
        },
        include: {
          plan: true
        }
      }),
      prisma.subscription.count({
        where: {
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart
          }
        }
      }),
      prisma.subscription.count({
        where: {
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart
          },
          plan: {
            isTrial: true
          }
        }
      }),
      prisma.subscription.count({
        where: {
          canceledAt: {
            gte: monthStart,
            lt: nextMonthStart
          }
        }
      }),
      prisma.subscription.count({
        where: {
          createdAt: {
            lt: monthStart
          },
          OR: [
            {
              status: {
                in: ACTIVE_STATUS_FOR_STATS
              }
            },
            {
              canceledAt: {
                gte: monthStart
              }
            }
          ]
        }
      }),
      prisma.payment.aggregate({
        _sum: {
          amountCents: true
        },
        where: {
          status: PaymentStatus.APPROVED,
          paidAt: {
            gte: monthStart,
            lt: nextMonthStart
          }
        }
      })
    ]);

    const mrrCents = activePaidSubscriptions.reduce((acc, item) => acc + item.plan.priceCents, 0);
    const churnRate = activeAtMonthStart > 0 ? (canceledThisMonth / activeAtMonthStart) * 100 : 0;

    return res.json({
      totalStores,
      activeStores,
      totalVehicles,
      totalLeads,
      activeSubscriptions,
      mrrCents,
      monthlyRevenueCents: approvedPayments._sum.amountCents || 0,
      churnRate: Number(churnRate.toFixed(2)),
      newSubscriptionsThisMonth,
      newTrialsThisMonth,
      canceledThisMonth
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/impersonate/stores/:id", validate(impersonateSchema), async (req, res, next) => {
  try {
    const { id: storeId } = req.params;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        owner: true,
        users: {
          where: {
            role: {
              in: ["STORE_OWNER", "STORE_STAFF"]
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!store) {
      throw new AppError("Loja nao encontrada", 404);
    }

    const requestedUserId = req.body.userId;
    const targetUser = requestedUserId
      ? store.users.find((user) => user.id === requestedUserId)
      : store.owner;

    if (!targetUser) {
      throw new AppError("Usuario para impersonacao nao encontrado", 404);
    }

    const token = signImpersonationToken({
      userId: targetUser.id,
      role: targetUser.role,
      storeId: targetUser.storeId,
      email: targetUser.email,
      impersonatedByUserId: req.user!.id
    });

    await logAudit({
      ...getAuditContext(req),
      action: "ADMIN_IMPERSONATION_CREATED",
      entityType: "User",
      entityId: targetUser.id,
      storeId: store.id,
      description: "Super admin iniciou sessao de impersonacao",
      metadata: {
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        targetRole: targetUser.role,
        expiresIn: "1h"
      }
    });

    return res.json({
      accessToken: token,
      expiresInSeconds: 60 * 60,
      impersonatedUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        storeId: targetUser.storeId
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/stores/:id/cancel-subscription", async (req, res, next) => {
  try {
    const { id } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: {
        storeId: id
      }
    });

    if (!subscription) {
      throw new AppError("Assinatura nao encontrada para a loja", 404);
    }

    if (subscription.gateway === BillingGateway.STRIPE && subscription.stripeSubscriptionId) {
      const stripe = assertStripe();
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
        cancellationReason: "Cancelamento manual via super admin"
      }
    });

    await prisma.store.update({
      where: { id },
      data: {
        isActive: false,
        suspendedAt: new Date(),
        suspensionReason: StoreSuspensionReason.CANCELED,
        suspensionNote: "Assinatura cancelada manualmente pelo super admin"
      }
    });

    await logAudit({
      ...getAuditContext(req),
      action: "ADMIN_SUBSCRIPTION_CANCELED",
      entityType: "Subscription",
      entityId: subscription.id,
      storeId: id,
      description: "Assinatura cancelada manualmente pelo super admin"
    });

    return res.json({
      message: "Assinatura cancelada e loja suspensa"
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
