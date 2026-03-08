import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE
];

export async function getStoreCurrentPlan(storeId: string) {
  const subscription = await prisma.subscription.findFirst({
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

  if (subscription) {
    return subscription.plan;
  }

  return prisma.plan.findUnique({
    where: { name: "BASICO" }
  });
}

export async function assertVehicleLimit(storeId: string) {
  const plan = await getStoreCurrentPlan(storeId);

  if (!plan || plan.vehicleLimit === null) {
    return;
  }

  const count = await prisma.vehicle.count({ where: { storeId } });
  if (count >= plan.vehicleLimit) {
    throw new Error(
      `Limite de veiculos do plano atingido (${plan.vehicleLimit}). Faça upgrade para continuar.`
    );
  }
}

export async function assertUserLimit(storeId: string) {
  const plan = await getStoreCurrentPlan(storeId);

  if (!plan || plan.userLimit === null) {
    return;
  }

  const count = await prisma.user.count({ where: { storeId } });
  if (count >= plan.userLimit) {
    throw new Error(
      `Limite de usuarios do plano atingido (${plan.userLimit}). Faça upgrade para continuar.`
    );
  }
}