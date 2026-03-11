import {
  BillingGateway,
  PaymentStatus,
  Prisma,
  StoreSuspensionReason,
  SubscriptionStatus
} from "@prisma/client";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { prisma } from "../config/prisma";
import { sendEmail } from "./email.service";

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE
];

function addDays(baseDate: Date, days: number) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

async function sendEmailToStoreOwner(params: {
  storeId: string;
  subject: string;
  html: string;
}) {
  const store = await prisma.store.findUnique({
    where: { id: params.storeId },
    include: {
      owner: {
        select: {
          email: true,
          name: true
        }
      }
    }
  });

  if (!store?.owner?.email) {
    return;
  }

  await sendEmail({
    to: store.owner.email,
    subject: params.subject,
    html: params.html.replace("{{ownerName}}", store.owner.name || "cliente")
  });
}

export async function activateSubscriptionFromPayment(input: {
  storeId: string;
  planId: string;
  gateway: BillingGateway;
  status?: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  mercadopagoSubscriptionId?: string | null;
  mercadopagoPreferenceId?: string | null;
  mercadopagoPayerId?: string | null;
  payment?: {
    amountCents: number;
    currency?: string;
    paymentMethod?: string | null;
    externalPaymentId?: string | null;
    externalReference?: string | null;
    externalPreferenceId?: string | null;
    externalSubscriptionId?: string | null;
    status?: PaymentStatus;
    paidAt?: Date | null;
    dueAt?: Date | null;
    failureReason?: string | null;
    payload?: Prisma.InputJsonValue;
  };
}) {
  const now = new Date();
  const previous = await prisma.subscription.findUnique({
    where: { storeId: input.storeId }
  });

  const wasSuspended =
    previous?.status === SubscriptionStatus.PAUSED ||
    previous?.status === SubscriptionStatus.CANCELED ||
    previous?.status === SubscriptionStatus.UNPAID;

  const subscription = await prisma.subscription.upsert({
    where: { storeId: input.storeId },
    update: {
      planId: input.planId,
      gateway: input.gateway,
      status: input.status || SubscriptionStatus.ACTIVE,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      trialEndsAt: input.trialEndsAt ?? null,
      stripeCustomerId: input.stripeCustomerId ?? undefined,
      stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
      mercadopagoSubscriptionId: input.mercadopagoSubscriptionId ?? undefined,
      mercadopagoPreferenceId: input.mercadopagoPreferenceId ?? undefined,
      mercadopagoPayerId: input.mercadopagoPayerId ?? undefined,
      gracePeriodEndsAt: null,
      suspendedAt: null,
      dataRetentionUntil: null,
      canceledAt: null,
      cancellationReason: null,
      activatedAt: now,
      lastPaymentAt: now,
      failedPaymentAt: null,
      paymentFailureCount: 0,
      failureEmailSentAt: null,
      suspensionEmailSentAt: null,
      dueReminderSentAt: null,
      trialReminderSentAt: null,
      cancelAtPeriodEnd: false
    },
    create: {
      storeId: input.storeId,
      planId: input.planId,
      gateway: input.gateway,
      status: input.status || SubscriptionStatus.ACTIVE,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      trialEndsAt: input.trialEndsAt ?? null,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      mercadopagoSubscriptionId: input.mercadopagoSubscriptionId ?? null,
      mercadopagoPreferenceId: input.mercadopagoPreferenceId ?? null,
      mercadopagoPayerId: input.mercadopagoPayerId ?? null,
      activatedAt: now,
      lastPaymentAt: now,
      paymentFailureCount: 0
    }
  });

  await prisma.store.update({
    where: { id: input.storeId },
    data: {
      isActive: true,
      suspendedAt: null,
      suspensionReason: null,
      suspensionNote: null,
      dataRetentionUntil: null
    }
  });

  if (input.payment) {
    if (input.payment.externalPaymentId) {
      await prisma.payment.upsert({
        where: {
          externalPaymentId: input.payment.externalPaymentId
        },
        update: {
          subscriptionId: subscription.id,
          storeId: input.storeId,
          gateway: input.gateway,
          status: input.payment.status || PaymentStatus.APPROVED,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency || "BRL",
          paymentMethod: input.payment.paymentMethod || null,
          externalReference: input.payment.externalReference || null,
          externalPreferenceId: input.payment.externalPreferenceId || null,
          externalSubscriptionId: input.payment.externalSubscriptionId || null,
          paidAt: input.payment.paidAt || now,
          dueAt: input.payment.dueAt || null,
          failureReason: input.payment.failureReason || null,
          payload: input.payment.payload
        },
        create: {
          subscriptionId: subscription.id,
          storeId: input.storeId,
          gateway: input.gateway,
          status: input.payment.status || PaymentStatus.APPROVED,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency || "BRL",
          paymentMethod: input.payment.paymentMethod || null,
          externalPaymentId: input.payment.externalPaymentId,
          externalReference: input.payment.externalReference || null,
          externalPreferenceId: input.payment.externalPreferenceId || null,
          externalSubscriptionId: input.payment.externalSubscriptionId || null,
          paidAt: input.payment.paidAt || now,
          dueAt: input.payment.dueAt || null,
          failureReason: input.payment.failureReason || null,
          payload: input.payment.payload
        }
      });
    } else {
      await prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          storeId: input.storeId,
          gateway: input.gateway,
          status: input.payment.status || PaymentStatus.APPROVED,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency || "BRL",
          paymentMethod: input.payment.paymentMethod || null,
          externalReference: input.payment.externalReference || null,
          externalPreferenceId: input.payment.externalPreferenceId || null,
          externalSubscriptionId: input.payment.externalSubscriptionId || null,
          paidAt: input.payment.paidAt || now,
          dueAt: input.payment.dueAt || null,
          failureReason: input.payment.failureReason || null,
          payload: input.payment.payload
        }
      });
    }
  }

  const refreshed = await prisma.subscription.findUnique({
    where: { storeId: input.storeId },
    include: {
      plan: true
    }
  });

  if (!refreshed) {
    return null;
  }

  if (!refreshed.welcomeEmailSentAt) {
    await sendEmailToStoreOwner({
      storeId: input.storeId,
      subject: "Bem-vindo(a)! Sua assinatura foi ativada",
      html: `
        <p>Ola, {{ownerName}}.</p>
        <p>Sua assinatura do plano <strong>${refreshed.plan.name}</strong> foi ativada com sucesso.</p>
        <p>Sua vitrine ja esta disponivel para seus clientes.</p>
      `
    });

    await prisma.subscription.update({
      where: { id: refreshed.id },
      data: { welcomeEmailSentAt: now }
    });
  } else if (wasSuspended) {
    await sendEmailToStoreOwner({
      storeId: input.storeId,
      subject: "Assinatura reativada",
      html: `
        <p>Ola, {{ownerName}}.</p>
        <p>Recebemos seu pagamento e sua loja foi reativada.</p>
        <p>Plano atual: <strong>${refreshed.plan.name}</strong>.</p>
      `
    });

    await prisma.subscription.update({
      where: { id: refreshed.id },
      data: { reactivationEmailSentAt: now }
    });
  }

  return refreshed;
}

export async function markSubscriptionPaymentFailed(input: {
  storeId: string;
  gateway: BillingGateway;
  reason?: string | null;
  payment?: {
    amountCents: number;
    currency?: string;
    paymentMethod?: string | null;
    externalPaymentId?: string | null;
    externalReference?: string | null;
    externalPreferenceId?: string | null;
    externalSubscriptionId?: string | null;
    dueAt?: Date | null;
    payload?: Prisma.InputJsonValue;
  };
}) {
  const now = new Date();
  const graceEndsAt = addDays(now, env.SUBSCRIPTION_GRACE_DAYS);

  const subscription = await prisma.subscription.findUnique({
    where: { storeId: input.storeId },
    include: { plan: true }
  });

  if (!subscription) {
    return null;
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.PAST_DUE,
      failedPaymentAt: now,
      paymentFailureCount: {
        increment: 1
      },
      gracePeriodEndsAt: graceEndsAt
    }
  });

  if (input.payment) {
    if (input.payment.externalPaymentId) {
      await prisma.payment.upsert({
        where: {
          externalPaymentId: input.payment.externalPaymentId
        },
        update: {
          subscriptionId: updated.id,
          storeId: input.storeId,
          gateway: input.gateway,
          status: PaymentStatus.FAILED,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency || "BRL",
          paymentMethod: input.payment.paymentMethod || null,
          externalReference: input.payment.externalReference || null,
          externalPreferenceId: input.payment.externalPreferenceId || null,
          externalSubscriptionId: input.payment.externalSubscriptionId || null,
          dueAt: input.payment.dueAt || null,
          failureReason: input.reason || null,
          payload: input.payment.payload
        },
        create: {
          subscriptionId: updated.id,
          storeId: input.storeId,
          gateway: input.gateway,
          status: PaymentStatus.FAILED,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency || "BRL",
          paymentMethod: input.payment.paymentMethod || null,
          externalPaymentId: input.payment.externalPaymentId,
          externalReference: input.payment.externalReference || null,
          externalPreferenceId: input.payment.externalPreferenceId || null,
          externalSubscriptionId: input.payment.externalSubscriptionId || null,
          dueAt: input.payment.dueAt || null,
          failureReason: input.reason || null,
          payload: input.payment.payload
        }
      });
    } else {
      await prisma.payment.create({
        data: {
          subscriptionId: updated.id,
          storeId: input.storeId,
          gateway: input.gateway,
          status: PaymentStatus.FAILED,
          amountCents: input.payment.amountCents,
          currency: input.payment.currency || "BRL",
          paymentMethod: input.payment.paymentMethod || null,
          externalReference: input.payment.externalReference || null,
          externalPreferenceId: input.payment.externalPreferenceId || null,
          externalSubscriptionId: input.payment.externalSubscriptionId || null,
          dueAt: input.payment.dueAt || null,
          failureReason: input.reason || null,
          payload: input.payment.payload
        }
      });
    }
  }

  await sendEmailToStoreOwner({
    storeId: input.storeId,
    subject: "Falha no pagamento da assinatura",
    html: `
      <p>Ola, {{ownerName}}.</p>
      <p>Houve uma falha no pagamento da sua assinatura.</p>
      <p>Sua loja entrou em carencia ate <strong>${graceEndsAt.toLocaleString("pt-BR")}</strong>.</p>
      <p>${input.reason || "Atualize seu metodo de pagamento para evitar suspensao."}</p>
    `
  });

  await prisma.subscription.update({
    where: { id: updated.id },
    data: {
      failureEmailSentAt: now
    }
  });

  return updated;
}

export async function cancelStoreSubscription(input: {
  storeId: string;
  reason?: string;
  suspendStore?: boolean;
}) {
  const now = new Date();
  const dataRetentionUntil = addDays(now, env.SUBSCRIPTION_DATA_RETENTION_DAYS);

  const subscription = await prisma.subscription.findUnique({
    where: { storeId: input.storeId },
    include: {
      plan: true
    }
  });

  if (!subscription) {
    return null;
  }

  const canceled = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: now,
      cancellationReason: input.reason || "cancelada",
      suspendedAt: input.suspendStore === false ? null : now,
      dataRetentionUntil: input.suspendStore === false ? null : dataRetentionUntil,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: false
    }
  });

  if (input.suspendStore !== false) {
    await prisma.store.update({
      where: { id: input.storeId },
      data: {
        isActive: false,
        suspendedAt: now,
        suspensionReason: StoreSuspensionReason.CANCELED,
        suspensionNote: input.reason || "Assinatura cancelada",
        dataRetentionUntil
      }
    });

    await sendEmailToStoreOwner({
      storeId: input.storeId,
      subject: "Loja suspensa por cancelamento",
      html: `
        <p>Ola, {{ownerName}}.</p>
        <p>Sua assinatura foi cancelada e sua loja foi suspensa.</p>
        <p>Seus dados serao preservados ate <strong>${dataRetentionUntil.toLocaleString("pt-BR")}</strong>.</p>
      `
    });

    await prisma.subscription.update({
      where: { id: canceled.id },
      data: {
        suspensionEmailSentAt: now
      }
    });
  }

  return canceled;
}

async function suspendPastDueSubscription(subscriptionId: string) {
  const now = new Date();
  const dataRetentionUntil = addDays(now, env.SUBSCRIPTION_DATA_RETENTION_DAYS);

  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.PAUSED,
      suspendedAt: now,
      dataRetentionUntil,
      suspensionEmailSentAt: now
    },
    include: {
      plan: true
    }
  });

  await prisma.store.update({
    where: { id: subscription.storeId },
    data: {
      isActive: false,
      suspendedAt: now,
      suspensionReason: StoreSuspensionReason.PAYMENT_FAILED,
      suspensionNote: "Pagamento nao confirmado durante a carencia",
      dataRetentionUntil
    }
  });

  await sendEmailToStoreOwner({
    storeId: subscription.storeId,
    subject: "Loja suspensa por falta de pagamento",
    html: `
      <p>Ola, {{ownerName}}.</p>
      <p>Sua loja foi suspensa por falta de pagamento.</p>
      <p>Os dados permanecerao preservados por 30 dias.</p>
    `
  });
}

export async function runSubscriptionLifecycle() {
  const now = new Date();
  const dueWarningDate = addDays(now, env.SUBSCRIPTION_DUE_REMINDER_DAYS);
  const trialWarningDate = addDays(now, env.TRIAL_WARNING_DAYS);

  const dueCandidates = await prisma.subscription.findMany({
    where: {
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
      },
      currentPeriodEnd: {
        lte: dueWarningDate,
        gt: now
      },
      dueReminderSentAt: null
    },
    include: {
      plan: true
    }
  });

  for (const subscription of dueCandidates) {
    if (subscription.plan.isTrial) {
      continue;
    }

    await sendEmailToStoreOwner({
      storeId: subscription.storeId,
      subject: "Lembrete: vencimento da assinatura em 7 dias",
      html: `
        <p>Ola, {{ownerName}}.</p>
        <p>Sua assinatura do plano <strong>${subscription.plan.name}</strong> vence em 7 dias.</p>
        <p>Vencimento previsto: <strong>${subscription.currentPeriodEnd?.toLocaleDateString("pt-BR")}</strong>.</p>
      `
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { dueReminderSentAt: now }
    });
  }

  const trialCandidates = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: {
        lte: trialWarningDate,
        gt: now
      },
      trialReminderSentAt: null
    }
  });

  for (const subscription of trialCandidates) {
    await sendEmailToStoreOwner({
      storeId: subscription.storeId,
      subject: "Seu trial esta acabando",
      html: `
        <p>Ola, {{ownerName}}.</p>
        <p>Seu periodo de trial termina em 3 dias.</p>
        <p>Data de termino: <strong>${subscription.trialEndsAt?.toLocaleDateString("pt-BR")}</strong>.</p>
      `
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { trialReminderSentAt: now }
    });
  }

  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
      },
      currentPeriodEnd: {
        lte: now
      }
    },
    include: {
      plan: true
    }
  });

  for (const subscription of expiredSubscriptions) {
    await markSubscriptionPaymentFailed({
      storeId: subscription.storeId,
      gateway: subscription.gateway || BillingGateway.TRIAL,
      reason: subscription.status === SubscriptionStatus.TRIALING ? "Trial expirado" : "Assinatura vencida",
      payment: {
        amountCents: subscription.plan.priceCents,
        dueAt: subscription.currentPeriodEnd
      }
    });
  }

  const graceExpired = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.PAST_DUE,
      gracePeriodEndsAt: {
        lte: now
      }
    }
  });

  for (const subscription of graceExpired) {
    await suspendPastDueSubscription(subscription.id);
  }

  return {
    dueWarnings: dueCandidates.length,
    trialWarnings: trialCandidates.length,
    expiredSubscriptions: expiredSubscriptions.length,
    graceSuspensions: graceExpired.length
  };
}

let lifecycleTimer: NodeJS.Timeout | null = null;

export function startSubscriptionLifecycleJob() {
  if (lifecycleTimer) {
    return;
  }

  const intervalMs = env.SUBSCRIPTION_LIFECYCLE_INTERVAL_MINUTES * 60 * 1000;

  runSubscriptionLifecycle().catch((error) => {
    logger.error("Falha na execucao inicial do ciclo de assinaturas", {
      message: error instanceof Error ? error.message : String(error)
    });
  });

  lifecycleTimer = setInterval(() => {
    runSubscriptionLifecycle().catch((error) => {
      logger.error("Falha no job de ciclo de assinaturas", {
        message: error instanceof Error ? error.message : String(error)
      });
    });
  }, intervalMs);

  lifecycleTimer.unref();
}

export { ACTIVE_STATUSES as ACTIVE_SUBSCRIPTION_STATUSES };
