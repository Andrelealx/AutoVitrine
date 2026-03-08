import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../utils/app-error";

const router = Router();

const updateStoreStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean()
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
    stripePriceId: z.string().optional().nullable()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

router.use(requireAuth);
router.use(requireRole([UserRole.SUPER_ADMIN]));

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
              leads: true
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
    const { isActive } = req.body;

    const store = await prisma.store.update({
      where: { id },
      data: { isActive },
      include: {
        owner: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    await prisma.user.updateMany({
      where: {
        storeId: store.id,
        role: {
          not: UserRole.SUPER_ADMIN
        }
      },
      data: {
        isActive
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
      orderBy: {
        priceCents: "asc"
      }
    });

    return res.json(plans);
  } catch (error) {
    return next(error);
  }
});

router.post("/plans", validate(upsertPlanSchema), async (req, res, next) => {
  try {
    const { name, description, priceCents, vehicleLimit, userLimit, stripePriceId } = req.body;

    const plan = await prisma.plan.upsert({
      where: {
        name
      },
      update: {
        description,
        priceCents,
        vehicleLimit: vehicleLimit ?? null,
        userLimit: userLimit ?? null,
        stripePriceId: stripePriceId ?? null
      },
      create: {
        name,
        description,
        priceCents,
        vehicleLimit: vehicleLimit ?? null,
        userLimit: userLimit ?? null,
        stripePriceId: stripePriceId ?? null
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

router.get("/subscriptions", async (_req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true
          }
        },
        plan: true
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

router.get("/stats", async (_req, res, next) => {
  try {
    const [totalStores, activeStores, totalVehicles, totalLeads, activeSubscriptions] = await Promise.all([
      prisma.store.count(),
      prisma.store.count({ where: { isActive: true } }),
      prisma.vehicle.count(),
      prisma.lead.count(),
      prisma.subscription.count({
        where: {
          status: {
            in: ["ACTIVE", "TRIALING", "PAST_DUE"]
          }
        }
      })
    ]);

    return res.json({
      totalStores,
      activeStores,
      totalVehicles,
      totalLeads,
      activeSubscriptions
    });
  } catch (error) {
    return next(error);
  }
});

export default router;