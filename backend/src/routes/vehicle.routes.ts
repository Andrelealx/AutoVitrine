import { Router } from "express";
import multer from "multer";
import { FuelType, TransmissionType, UserRole, VehicleStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole, requireStoreContext } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { deleteCloudinaryImage, uploadImageBuffer } from "../services/upload.service";
import { AppError } from "../utils/app-error";
import { assertVehicleLimit } from "../utils/plan-limits";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 15
  }
});

const createVehicleSchema = z.object({
  body: z.object({
    brand: z.string().min(2),
    model: z.string().min(1),
    year: z.coerce.number().int().min(1950).max(2100),
    color: z.string().min(2),
    mileage: z.coerce.number().int().min(0),
    fuel: z.nativeEnum(FuelType),
    transmission: z.nativeEnum(TransmissionType),
    price: z.coerce.number().min(0),
    description: z.string().min(5),
    optionalItems: z.union([z.array(z.string()), z.string()]).optional(),
    status: z.nativeEnum(VehicleStatus).optional(),
    featured: z.coerce.boolean().optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const updateVehicleSchema = z.object({
  body: z.object({
    brand: z.string().min(2).optional(),
    model: z.string().min(1).optional(),
    year: z.coerce.number().int().min(1950).max(2100).optional(),
    color: z.string().min(2).optional(),
    mileage: z.coerce.number().int().min(0).optional(),
    fuel: z.nativeEnum(FuelType).optional(),
    transmission: z.nativeEnum(TransmissionType).optional(),
    price: z.coerce.number().min(0).optional(),
    description: z.string().min(5).optional(),
    optionalItems: z.union([z.array(z.string()), z.string()]).optional(),
    status: z.nativeEnum(VehicleStatus).optional(),
    featured: z.coerce.boolean().optional()
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().min(1)
  })
});

function parseOptionalItems(value?: string | string[]) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // fallback below
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

router.use(requireAuth);
router.use(requireRole([UserRole.STORE_OWNER, UserRole.STORE_STAFF]));
router.use(requireStoreContext);

router.post("/", upload.array("images", 15), async (req, res, next) => {
  try {
    const parsed = createVehicleSchema.shape.body.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError("Dados invalidos", 422);
    }

    await assertVehicleLimit(req.user!.storeId!);

    const data = parsed.data;
    const optionalItems = parseOptionalItems(data.optionalItems);

    const vehicle = await prisma.vehicle.create({
      data: {
        storeId: req.user!.storeId!,
        brand: data.brand,
        model: data.model,
        year: data.year,
        color: data.color,
        mileage: data.mileage,
        fuel: data.fuel,
        transmission: data.transmission,
        price: data.price,
        description: data.description,
        optionalItems,
        status: data.status || VehicleStatus.AVAILABLE,
        featured: data.featured || false
      }
    });

    const files = (req.files as Express.Multer.File[]) || [];

    if (files.length > 0) {
      const images = [] as { url: string; publicId: string; isCover: boolean }[];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const uploaded = await uploadImageBuffer(file.buffer, `autovitrine/vehicles/${vehicle.id}`);
        images.push({
          url: uploaded.url,
          publicId: uploaded.publicId,
          isCover: index === 0
        });
      }

      await prisma.vehicleImage.createMany({
        data: images.map((image) => ({
          vehicleId: vehicle.id,
          url: image.url,
          publicId: image.publicId,
          isCover: image.isCover
        }))
      });
    }

    const fullVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      include: { images: true }
    });

    return res.status(201).json({
      message: "Veiculo criado com sucesso",
      vehicle: fullVehicle
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 12);
    const search = String(req.query.search || "").trim();
    const status = req.query.status ? String(req.query.status) : undefined;

    const where = {
      storeId: req.user!.storeId!,
      ...(search
        ? {
            OR: [
              { brand: { contains: search, mode: "insensitive" as const } },
              { model: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(status ? { status: status as VehicleStatus } : {})
    };

    const [items, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
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
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.vehicle.count({ where })
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

router.get("/:id", async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: req.params.id,
        storeId: req.user!.storeId!
      },
      include: {
        images: true
      }
    });

    if (!vehicle) {
      throw new AppError("Veiculo nao encontrado", 404);
    }

    return res.json(vehicle);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", validate(updateVehicleSchema), async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: req.params.id,
        storeId: req.user!.storeId!
      }
    });

    if (!vehicle) {
      throw new AppError("Veiculo nao encontrado", 404);
    }

    const optionalItems =
      req.body.optionalItems !== undefined
        ? parseOptionalItems(req.body.optionalItems)
        : vehicle.optionalItems;

    const updated = await prisma.vehicle.update({
      where: {
        id: vehicle.id
      },
      data: {
        ...req.body,
        optionalItems
      },
      include: {
        images: true
      }
    });

    return res.json({
      message: "Veiculo atualizado",
      vehicle: updated
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/images", upload.array("images", 15), async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: req.params.id,
        storeId: req.user!.storeId!
      },
      include: {
        images: true
      }
    });

    if (!vehicle) {
      throw new AppError("Veiculo nao encontrado", 404);
    }

    const files = (req.files as Express.Multer.File[]) || [];

    if (files.length === 0) {
      throw new AppError("Nenhuma imagem enviada", 400);
    }

    if (vehicle.images.length + files.length > 15) {
      throw new AppError("Cada veiculo suporta no maximo 15 imagens", 400);
    }

    const createdImages = [];

    for (const file of files) {
      const uploaded = await uploadImageBuffer(file.buffer, `autovitrine/vehicles/${vehicle.id}`);
      const image = await prisma.vehicleImage.create({
        data: {
          vehicleId: vehicle.id,
          url: uploaded.url,
          publicId: uploaded.publicId,
          isCover: false
        }
      });
      createdImages.push(image);
    }

    return res.status(201).json({
      message: "Imagens adicionadas",
      images: createdImages
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id/images/:imageId", async (req, res, next) => {
  try {
    const image = await prisma.vehicleImage.findFirst({
      where: {
        id: req.params.imageId,
        vehicle: {
          id: req.params.id,
          storeId: req.user!.storeId!
        }
      }
    });

    if (!image) {
      throw new AppError("Imagem nao encontrada", 404);
    }

    await prisma.vehicleImage.delete({ where: { id: image.id } });
    await deleteCloudinaryImage(image.publicId);

    const remaining = await prisma.vehicleImage.findMany({
      where: { vehicleId: req.params.id },
      orderBy: { createdAt: "asc" }
    });

    if (remaining.length > 0 && !remaining.some((item) => item.isCover)) {
      await prisma.vehicleImage.update({
        where: { id: remaining[0].id },
        data: { isCover: true }
      });
    }

    return res.json({ message: "Imagem removida" });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: req.params.id,
        storeId: req.user!.storeId!
      },
      include: {
        images: true
      }
    });

    if (!vehicle) {
      throw new AppError("Veiculo nao encontrado", 404);
    }

    await prisma.vehicle.delete({ where: { id: vehicle.id } });

    await Promise.all(vehicle.images.map((image) => deleteCloudinaryImage(image.publicId)));

    return res.json({ message: "Veiculo removido" });
  } catch (error) {
    return next(error);
  }
});

export default router;