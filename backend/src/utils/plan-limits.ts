import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "./app-error";

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.INCOMPLETE
];

export async function getStoreCurrentSubscription(storeId: string) {
  return prisma.subscription.findFirst({
    where: {
      storeId,
      status: {
        in: ACTIVE_STATUSES
      }
    },
    include: {
      plan: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function getStoreCurrentPlan(storeId: string) {
  const subscription = await getStoreCurrentSubscription(storeId);

  if (subscription?.plan) {
    return subscription.plan;
  }

  return prisma.plan.findFirst({
    where: {
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }]
  });
}

export async function assertStoreCanWrite(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      isActive: true,
      suspensionReason: true,
      suspensionNote: true
    }
  });

  if (!store) {
    throw new AppError("Loja nao encontrada", 404);
  }

  if (!store.isActive) {
    throw new AppError("Loja suspensa. Operacoes de escrita estao bloqueadas.", 423, {
      code: "STORE_SUSPENDED",
      suspensionReason: store.suspensionReason,
      suspensionNote: store.suspensionNote
    });
  }
}

export async function assertVehicleLimit(storeId: string) {
  await assertStoreCanWrite(storeId);
  const plan = await getStoreCurrentPlan(storeId);

  if (!plan || plan.vehicleLimit === null) {
    return;
  }

  const count = await prisma.vehicle.count({ where: { storeId } });
  if (count >= plan.vehicleLimit) {
    throw new AppError(
      `Limite de veiculos do plano atingido (${plan.vehicleLimit}). Faca upgrade para continuar.`,
      402,
      {
        code: "PLAN_LIMIT_REACHED",
        resource: "vehicles",
        limit: plan.vehicleLimit,
        usage: count
      }
    );
  }
}

export async function assertUserLimit(storeId: string) {
  await assertStoreCanWrite(storeId);
  const plan = await getStoreCurrentPlan(storeId);

  if (!plan || plan.userLimit === null) {
    return;
  }

  const count = await prisma.user.count({ where: { storeId } });
  if (count >= plan.userLimit) {
    throw new AppError(
      `Limite de usuarios do plano atingido (${plan.userLimit}). Faca upgrade para continuar.`,
      402,
      {
        code: "PLAN_LIMIT_REACHED",
        resource: "users",
        limit: plan.userLimit,
        usage: count
      }
    );
  }
}

export async function assertVehiclePhotoLimit(storeId: string, vehicleId: string, incomingFilesCount: number) {
  await assertStoreCanWrite(storeId);
  const plan = await getStoreCurrentPlan(storeId);

  if (!plan || plan.maxPhotosPerVehicle === null) {
    return;
  }

  const existingPhotos = await prisma.vehicleImage.count({
    where: {
      vehicleId,
      vehicle: {
        storeId
      }
    }
  });

  if (existingPhotos + incomingFilesCount > plan.maxPhotosPerVehicle) {
    throw new AppError(
      `Limite de fotos por veiculo atingido (${plan.maxPhotosPerVehicle}). Faca upgrade para continuar.`,
      402,
      {
        code: "PLAN_LIMIT_REACHED",
        resource: "vehiclePhotos",
        limit: plan.maxPhotosPerVehicle,
        usage: existingPhotos
      }
    );
  }
}

export async function getStorePlanUsage(storeId: string) {
  const [plan, subscription, vehiclesCount, usersCount] = await Promise.all([
    getStoreCurrentPlan(storeId),
    getStoreCurrentSubscription(storeId),
    prisma.vehicle.count({ where: { storeId } }),
    prisma.user.count({ where: { storeId } })
  ]);

  return {
    plan,
    subscription,
    usage: {
      vehicles: {
        used: vehiclesCount,
        limit: plan?.vehicleLimit ?? null
      },
      users: {
        used: usersCount,
        limit: plan?.userLimit ?? null
      },
      photosPerVehicle: {
        limit: plan?.maxPhotosPerVehicle ?? null
      }
    },
    trial: {
      isTrialing: subscription?.status === SubscriptionStatus.TRIALING,
      trialEndsAt: subscription?.trialEndsAt || null
    }
  };
}