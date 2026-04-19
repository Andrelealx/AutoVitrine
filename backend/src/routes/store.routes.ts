import { Router } from "express";
import multer from "multer";
import { ThemeMode, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole, requireStoreContext } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../utils/app-error";
import { hashPassword } from "../utils/password";
import { generateUniqueSlug } from "../utils/slug";
import { cache } from "../utils/cache";
import { assertStoreCanWrite, assertUserLimit, getStorePlanUsage } from "../utils/plan-limits";
import { uploadImageBuffer } from "../services/upload.service";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

const onboardingSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    city: z.string().min(2),
    state: z.string().min(2).max(2),
    whatsapp: z.string().min(8),
    instagram: z.string().optional().nullable(),
    description: z.string().max(300).optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
    secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const customizationSchema = z.object({
  body: z.object({
    theme: z.nativeEnum(ThemeMode).optional(),
    slogan: z.string().max(120).optional().nullable(),
    aboutUs: z.string().max(2500).optional().nullable(),
    bannerUrl: z.string().url().optional().nullable(),
    facebook: z.string().url().optional().nullable(),
    instagram: z.string().optional().nullable(),
    whatsapp: z.string().optional().nullable(),
    openingHours: z.string().max(300).optional().nullable(),
    address: z.string().max(300).optional().nullable(),
    mapEmbedUrl: z.string().url().optional().nullable(),
    primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional(),
    secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const createStaffSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

router.use(requireAuth);
router.use(requireStoreContext);

router.get("/me", async (req, res, next) => {
  try {
    const storeId = req.user!.storeId!;
    const [store, planUsage] = await Promise.all([
      prisma.store.findUnique({
        where: {
          id: storeId
        },
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { updatedAt: "desc" },
            take: 1
          }
        }
      }),
      getStorePlanUsage(storeId)
    ]);

    if (!store) {
      throw new AppError("Loja nao encontrada", 404);
    }

    return res.json({
      ...store,
      planUsage
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/me/onboarding", validate(onboardingSchema), async (req, res, next) => {
  try {
    await assertStoreCanWrite(req.user!.storeId!);
    const { name, city, state, whatsapp, instagram, description, logoUrl, primaryColor, secondaryColor } = req.body;
    const storeId = req.user!.storeId!;

    const slug = await generateUniqueSlug(name, async (candidate) => {
      const found = await prisma.store.findFirst({
        where: {
          slug: candidate,
          id: {
            not: storeId
          }
        }
      });
      return Boolean(found);
    });

    const store = await prisma.store.update({
      where: { id: storeId },
      data: {
        name,
        slug,
        city,
        state,
        whatsapp,
        instagram,
        description,
        logoUrl,
        primaryColor,
        secondaryColor,
        onboardingCompleted: true
      }
    });

    cache.invalidate(`store:${store.slug}`);
    cache.invalidate(`vehicles:${store.slug}`);

    return res.json({
      message: "Onboarding salvo com sucesso",
      store
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/me/customization", validate(customizationSchema), async (req, res, next) => {
  try {
    await assertStoreCanWrite(req.user!.storeId!);
    const store = await prisma.store.update({
      where: {
        id: req.user!.storeId!
      },
      data: req.body
    });

    cache.invalidate(`store:${store.slug}`);
    cache.invalidate(`vehicles:${store.slug}`);

    return res.json({
      message: "Personalizacao atualizada",
      store
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/me/upload/logo", upload.single("file"), async (req, res, next) => {
  try {
    await assertStoreCanWrite(req.user!.storeId!);
    if (!req.file) {
      throw new AppError("Arquivo obrigatorio", 400);
    }

    const image = await uploadImageBuffer(req.file.buffer, "autovitrine/logos");

    const store = await prisma.store.update({
      where: { id: req.user!.storeId! },
      data: { logoUrl: image.url }
    });

    cache.invalidate(`store:${store.slug}`);

    return res.json({ store, imageUrl: image.url });
  } catch (error) {
    return next(error);
  }
});

router.post("/me/upload/banner", upload.single("file"), async (req, res, next) => {
  try {
    await assertStoreCanWrite(req.user!.storeId!);
    if (!req.file) {
      throw new AppError("Arquivo obrigatorio", 400);
    }

    const image = await uploadImageBuffer(req.file.buffer, "autovitrine/banners");

    const store = await prisma.store.update({
      where: { id: req.user!.storeId! },
      data: { bannerUrl: image.url }
    });

    cache.invalidate(`store:${store.slug}`);

    return res.json({ store, imageUrl: image.url });
  } catch (error) {
    return next(error);
  }
});

router.get("/me/dashboard", async (req, res, next) => {
  try {
    const storeId = req.user!.storeId!;

    const [totalVehicles, availableVehicles, soldVehicles, leadsCount, viewsCount, latestLeads, planUsage] =
      await Promise.all([
        prisma.vehicle.count({ where: { storeId } }),
        prisma.vehicle.count({ where: { storeId, status: "AVAILABLE" } }),
        prisma.vehicle.count({ where: { storeId, status: "SOLD" } }),
        prisma.lead.count({ where: { storeId } }),
        prisma.storefrontView.count({ where: { storeId } }),
        prisma.lead.findMany({
          where: { storeId },
          include: {
            vehicle: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 8
        }),
        getStorePlanUsage(storeId)
      ]);

    return res.json({
      metrics: {
        totalVehicles,
        availableVehicles,
        soldVehicles,
        leadsCount,
        viewsCount
      },
      latestLeads,
      planUsage
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me/leads", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where: {
          storeId: req.user!.storeId!
        },
        include: {
          vehicle: true
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take: pageSize
      }),
      prisma.lead.count({ where: { storeId: req.user!.storeId! } })
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

router.get("/me/users", requireRole([UserRole.STORE_OWNER]), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        storeId: req.user!.storeId!
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/me/users",
  requireRole([UserRole.STORE_OWNER]),
  validate(createStaffSchema),
  async (req, res, next) => {
    try {
      const storeId = req.user!.storeId!;
      await assertStoreCanWrite(storeId);

      await assertUserLimit(storeId);

      const { name, email, password } = req.body;

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        throw new AppError("E-mail ja cadastrado", 409);
      }

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await hashPassword(password),
          role: UserRole.STORE_STAFF,
          storeId
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true
        }
      });

      return res.status(201).json({
        message: "Usuario criado com sucesso",
        user
      });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
