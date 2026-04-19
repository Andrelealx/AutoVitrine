import crypto from "crypto";
import { Router } from "express";
import { FuelType, ThemeMode, TransmissionType, VehicleStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { validate } from "../middleware/validate";
import { sendEmail } from "../services/email.service";
import { cache } from "../utils/cache";
import { leadsLimiter } from "../middleware/rate-limit";

const router = Router();

const leadSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().email().optional().nullable(),
    message: z.string().min(5).max(1200),
    vehicleId: z.string().optional().nullable()
  }),
  params: z.object({
    slug: z.string().min(2)
  }),
  query: z.object({}).optional()
});

const viewSchema = z.object({
  body: z.object({
    sessionId: z.string().optional()
  }),
  params: z.object({
    slug: z.string().min(2)
  }),
  query: z.object({}).optional()
});

async function findStoreBySlug(slug: string) {
  return prisma.store.findFirst({
    where: {
      slug,
      onboardingCompleted: true
    },
    include: {
      owner: {
        select: {
          email: true,
          name: true
        }
      },
      subscriptions: {
        include: {
          plan: true
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 1
      }
    }
  });
}

function assertPublicStoreAvailable(
  store: Awaited<ReturnType<typeof findStoreBySlug>>
): asserts store is NonNullable<Awaited<ReturnType<typeof findStoreBySlug>>> {
  if (!store) {
    throw new AppError("Loja nao encontrada", 404);
  }

  if (!store.isActive) {
    throw new AppError(
      store.unavailableMessage || "Esta loja esta temporariamente indisponivel. Tente novamente mais tarde.",
      503,
      {
        code: "STORE_SUSPENDED",
        unavailableMessage: store.unavailableMessage || null
      }
    );
  }
}

router.get("/stores/:slug", async (req, res, next) => {
  try {
    const cacheKey = `store:${req.params.slug}`;
    const cached = cache.get<object>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const store = await findStoreBySlug(req.params.slug);

    if (!store) {
      throw new AppError("Loja nao encontrada", 404);
    }

    const currentSubscription = store.subscriptions[0] || null;
    const featuredVehicles = store.isActive
      ? await prisma.vehicle.findMany({
          where: {
            storeId: store.id,
            status: VehicleStatus.AVAILABLE,
            featured: true
          },
          include: {
            images: {
              orderBy: {
                isCover: "desc"
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 12
        })
      : [];

    const payload = {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        logoUrl: store.logoUrl,
        bannerUrl: store.bannerUrl,
        primaryColor: store.primaryColor,
        secondaryColor: store.secondaryColor,
        theme: store.theme || ThemeMode.LUXURY,
        city: store.city,
        state: store.state,
        whatsapp: store.whatsapp,
        instagram: store.instagram,
        facebook: store.facebook,
        description: store.description,
        slogan: store.slogan,
        aboutUs: store.aboutUs,
        openingHours: store.openingHours,
        address: store.address,
        mapEmbedUrl: store.mapEmbedUrl,
        isActive: store.isActive,
        unavailableMessage:
          store.unavailableMessage || "Loja temporariamente indisponivel. Tente novamente mais tarde."
      },
      subscription: currentSubscription
        ? {
            status: currentSubscription.status,
            trialEndsAt: currentSubscription.trialEndsAt,
            plan: {
              name: currentSubscription.plan.name,
              isTrial: currentSubscription.plan.isTrial,
              showTrialBanner: currentSubscription.plan.showTrialBanner,
              removeWatermark: currentSubscription.plan.removeWatermark
            }
          }
        : null,
      featuredVehicles,
      isSuspended: !store.isActive
    };

    // Cache por 60 segundos — reduz queries no banco para visitantes frequentes
    cache.set(cacheKey, payload, 60);

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

router.get("/stores/:slug/vehicles", async (req, res, next) => {
  try {
    // Cache dos filtros disponíveis (marcas/anos) por 2 minutos — sem filtros ativos
    const hasFilters = req.query.search || req.query.brand || req.query.year ||
      req.query.minPrice || req.query.maxPrice || req.query.transmission || req.query.fuel;
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 12);
    const filterCacheKey = !hasFilters && page === 1
      ? `vehicles:${req.params.slug}:p1`
      : null;

    if (filterCacheKey) {
      const cached = cache.get<object>(filterCacheKey);
      if (cached) return res.json(cached);
    }

    const store = await findStoreBySlug(req.params.slug);
    assertPublicStoreAvailable(store);
    const search = String(req.query.search || "").trim();
    const brand = req.query.brand ? String(req.query.brand) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const transmission = req.query.transmission ? (String(req.query.transmission) as TransmissionType) : undefined;
    const fuel = req.query.fuel ? (String(req.query.fuel) as FuelType) : undefined;

    const where = {
      storeId: store.id,
      status: VehicleStatus.AVAILABLE,
      ...(search
        ? {
            OR: [
              { brand: { contains: search, mode: "insensitive" as const } },
              { model: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(brand ? { brand: { equals: brand, mode: "insensitive" as const } } : {}),
      ...(year ? { year } : {}),
      ...(transmission ? { transmission } : {}),
      ...(fuel ? { fuel } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {})
            }
          }
        : {})
    };

    const [items, total, brands, years] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          images: {
            orderBy: { isCover: "desc" }
          }
        },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where: {
          storeId: store.id,
          status: VehicleStatus.AVAILABLE
        },
        distinct: ["brand"],
        select: {
          brand: true
        },
        orderBy: {
          brand: "asc"
        }
      }),
      prisma.vehicle.findMany({
        where: {
          storeId: store.id,
          status: VehicleStatus.AVAILABLE
        },
        distinct: ["year"],
        select: {
          year: true
        },
        orderBy: {
          year: "desc"
        }
      })
    ]);

    const vehiclePayload = {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      filters: {
        brands: brands.map((item) => item.brand),
        years: years.map((item) => item.year),
        fuels: Object.values(FuelType),
        transmissions: Object.values(TransmissionType)
      }
    };

    if (filterCacheKey) {
      cache.set(filterCacheKey, vehiclePayload, 120);
    }

    return res.json(vehiclePayload);
  } catch (error) {
    return next(error);
  }
});

router.get("/stores/:slug/vehicles/:vehicleId", async (req, res, next) => {
  try {
    const store = await findStoreBySlug(req.params.slug);
    assertPublicStoreAvailable(store);

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: req.params.vehicleId,
        storeId: store.id,
        status: VehicleStatus.AVAILABLE
      },
      include: {
        images: {
          orderBy: {
            isCover: "desc"
          }
        }
      }
    });

    if (!vehicle) {
      throw new AppError("Veiculo nao encontrado", 404);
    }

    return res.json({
      store: {
        name: store.name,
        slug: store.slug,
        whatsapp: store.whatsapp,
        city: store.city,
        state: store.state,
        primaryColor: store.primaryColor,
        secondaryColor: store.secondaryColor
      },
      vehicle
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/stores/:slug/leads", leadsLimiter, validate(leadSchema), async (req, res, next) => {
  try {
    const store = await findStoreBySlug(req.params.slug);
    assertPublicStoreAvailable(store);

    const { name, phone, email, message, vehicleId } = req.body;

    if (vehicleId) {
      const vehicleExists = await prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          storeId: store.id
        }
      });

      if (!vehicleExists) {
        throw new AppError("Veiculo informado nao pertence a loja", 400);
      }
    }

    const lead = await prisma.lead.create({
      data: {
        storeId: store.id,
        vehicleId: vehicleId || null,
        name,
        phone,
        email,
        message
      },
      include: {
        vehicle: true
      }
    });

    await sendEmail({
      to: store.owner.email,
      subject: `Novo lead recebido - ${store.name}`,
      html: `
        <p>Voce recebeu um novo lead na AutoVitrine.</p>
        <p><strong>Nome:</strong> ${lead.name}</p>
        <p><strong>Telefone:</strong> ${lead.phone}</p>
        <p><strong>Email:</strong> ${lead.email || "Nao informado"}</p>
        <p><strong>Mensagem:</strong> ${lead.message}</p>
        <p><strong>Veiculo:</strong> ${lead.vehicle ? `${lead.vehicle.brand} ${lead.vehicle.model}` : "Nao informado"}</p>
      `
    });

    return res.status(201).json({
      message: "Lead enviado com sucesso",
      lead
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/stores/:slug/views", validate(viewSchema), async (req, res, next) => {
  try {
    const store = await findStoreBySlug(req.params.slug);
    assertPublicStoreAvailable(store);

    const candidateSession = req.body.sessionId || req.headers["x-session-id"];

    const sessionId =
      typeof candidateSession === "string"
        ? candidateSession
        : crypto
            .createHash("sha1")
            .update(`${req.ip}-${req.headers["user-agent"] || "unknown"}`)
            .digest("hex");

    await prisma.storefrontView.upsert({
      where: {
        storeId_sessionId: {
          storeId: store.id,
          sessionId
        }
      },
      update: {},
      create: {
        storeId: store.id,
        sessionId
      }
    });

    return res.status(201).json({ message: "View contabilizada" });
  } catch (error) {
    return next(error);
  }
});

export default router;
