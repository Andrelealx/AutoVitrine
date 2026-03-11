import crypto from "crypto";
import express, { Router } from "express";
import { BillingGateway, PaymentStatus, Prisma, SubscriptionStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { requireAuth, requireRole, requireStoreContext } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../utils/app-error";
import { assertStripe } from "../services/stripe.service";
import {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  validateMercadoPagoWebhookSignature
} from "../services/mercadopago.service";
import {
  activateSubscriptionFromPayment,
  cancelStoreSubscription,
  markSubscriptionPaymentFailed
} from "../services/subscription-lifecycle.service";
import { getStorePlanUsage } from "../utils/plan-limits";

const webhookRouter = Router();
const router = Router();

function addDays(baseDate: Date, days: number) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    case "paused":
      return SubscriptionStatus.PAUSED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

function parseReference(reference?: string | null) {
  if (!reference) {
    return {
      storeId: null,
      planId: null
    };
  }

  const chunks = reference.split("|");
  const storePart = chunks.find((item) => item.startsWith("store:"));
  const planPart = chunks.find((item) => item.startsWith("plan:"));

  return {
    storeId: storePart ? storePart.replace("store:", "") : null,
    planId: planPart ? planPart.replace("plan:", "") : null
  };
}

async function cancelGatewayIfNeeded(subscription: {
  gateway: BillingGateway | null;
  stripeSubscriptionId: string | null;
}) {
  if (subscription.gateway === BillingGateway.STRIPE && subscription.stripeSubscriptionId) {
    const stripe = assertStripe();
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
  }
}

async function handleStripeWebhook(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError("STRIPE_WEBHOOK_SECRET nao configurado", 500);
    }

    const stripe = assertStripe();
    const signature = req.headers["stripe-signature"];

    if (!signature || Array.isArray(signature)) {
      throw new AppError("Assinatura do webhook ausente", 400);
    }

    const event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id: string;
        metadata?: Record<string, string>;
        customer?: string;
        subscription?: string;
        amount_total?: number;
        currency?: string;
      };

      const storeId = session.metadata?.storeId;
      const planId = session.metadata?.planId;

      if (storeId && planId) {
        let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;
        let currentPeriodEnd: Date | null = null;

        if (session.subscription) {
          const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
          status = mapStripeStatus(stripeSub.status);
          currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
        }

        await activateSubscriptionFromPayment({
          storeId,
          planId,
          gateway: BillingGateway.STRIPE,
          status,
          currentPeriodEnd,
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          payment: {
            amountCents: session.amount_total || 0,
            currency: session.currency?.toUpperCase() || "BRL",
            paymentMethod: "card",
            externalPaymentId: `stripe_checkout_${session.id}`,
            externalReference: `stripe_checkout_session:${session.id}`,
            paidAt: new Date(),
            payload: event as unknown as Prisma.InputJsonValue,
            status: PaymentStatus.APPROVED
          }
        });
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as {
        id: string;
        subscription?: string;
        amount_paid?: number;
        currency?: string;
        customer?: string;
        payment_intent?: string;
        period_end?: number;
      };

      if (invoice.subscription) {
        const existing = await prisma.subscription.findFirst({
          where: {
            stripeSubscriptionId: invoice.subscription
          }
        });

        if (existing) {
          await activateSubscriptionFromPayment({
            storeId: existing.storeId,
            planId: existing.planId,
            gateway: BillingGateway.STRIPE,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: invoice.period_end
              ? new Date(invoice.period_end * 1000)
              : addDays(new Date(), 30),
            stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : existing.stripeCustomerId,
            stripeSubscriptionId: invoice.subscription,
            payment: {
              amountCents: invoice.amount_paid || 0,
              currency: invoice.currency?.toUpperCase() || "BRL",
              paymentMethod: "card",
              externalPaymentId:
                typeof invoice.payment_intent === "string" ? invoice.payment_intent : `stripe_invoice_${invoice.id}`,
              externalReference: `stripe_invoice:${invoice.id}`,
              paidAt: new Date(),
              payload: event as unknown as Prisma.InputJsonValue,
              status: PaymentStatus.APPROVED
            }
          });
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as {
        id: string;
        subscription?: string;
        amount_due?: number;
        currency?: string;
        payment_intent?: string;
      };

      if (invoice.subscription) {
        const existing = await prisma.subscription.findFirst({
          where: {
            stripeSubscriptionId: invoice.subscription
          }
        });

        if (existing) {
          await markSubscriptionPaymentFailed({
            storeId: existing.storeId,
            gateway: BillingGateway.STRIPE,
            reason: "Pagamento recusado no Stripe",
            payment: {
              amountCents: invoice.amount_due || 0,
              currency: invoice.currency?.toUpperCase() || "BRL",
              paymentMethod: "card",
              externalPaymentId:
                typeof invoice.payment_intent === "string" ? invoice.payment_intent : `stripe_invoice_failed_${invoice.id}`,
              externalReference: `stripe_invoice_failed:${invoice.id}`,
              payload: event as unknown as Prisma.InputJsonValue
            }
          });
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const stripeSub = event.data.object as {
        id: string;
        status: string;
        customer?: string;
        cancel_at_period_end?: boolean;
        current_period_end?: number;
        items?: {
          data: Array<{
            price?: {
              id?: string;
            };
          }>;
        };
      };

      const priceId = stripeSub.items?.data?.[0]?.price?.id;
      const plan = priceId
        ? await prisma.plan.findFirst({
            where: {
              stripePriceId: priceId
            }
          })
        : null;

      const existing = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id }
      });

      if (existing) {
        const mappedStatus = mapStripeStatus(stripeSub.status);

        if (mappedStatus === SubscriptionStatus.CANCELED || event.type === "customer.subscription.deleted") {
          await cancelStoreSubscription({
            storeId: existing.storeId,
            reason: "Cancelada no Stripe"
          });
        } else {
          await prisma.subscription.update({
            where: {
              id: existing.id
            },
            data: {
              ...(plan ? { planId: plan.id } : {}),
              stripeCustomerId:
                typeof stripeSub.customer === "string" ? stripeSub.customer : existing.stripeCustomerId,
              status: mappedStatus,
              cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
              currentPeriodEnd: stripeSub.current_period_end
                ? new Date(stripeSub.current_period_end * 1000)
                : existing.currentPeriodEnd
            }
          });

          if (mappedStatus === SubscriptionStatus.ACTIVE || mappedStatus === SubscriptionStatus.TRIALING) {
            await activateSubscriptionFromPayment({
              storeId: existing.storeId,
              planId: plan?.id || existing.planId,
              gateway: BillingGateway.STRIPE,
              status: mappedStatus,
              currentPeriodEnd: stripeSub.current_period_end
                ? new Date(stripeSub.current_period_end * 1000)
                : existing.currentPeriodEnd,
              stripeCustomerId:
                typeof stripeSub.customer === "string" ? stripeSub.customer : existing.stripeCustomerId,
              stripeSubscriptionId: stripeSub.id
            });
          }
        }
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return next(error);
  }
}

webhookRouter.post("/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
webhookRouter.post("/webhook/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);

webhookRouter.post("/webhook/mercadopago", express.json({ type: "application/json" }), async (req, res, next) => {
  try {
    const notificationType = (String(req.query.type || req.query.topic || "") || "").toLowerCase();
    const dataIdFromQuery = req.query["data.id"];
    const dataId =
      (typeof dataIdFromQuery === "string" ? dataIdFromQuery : undefined) ||
      (typeof req.body?.data?.id === "string" ? req.body.data.id : undefined) ||
      (typeof req.body?.id === "string" ? req.body.id : undefined);

    validateMercadoPagoWebhookSignature({
      signatureHeader: typeof req.headers["x-signature"] === "string" ? req.headers["x-signature"] : undefined,
      requestId: typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined,
      dataId
    });

    if (notificationType !== "payment" || !dataId) {
      return res.json({ received: true, ignored: true });
    }

    const payment = await getMercadoPagoPayment(dataId);
    const referenceInfo = parseReference(payment.external_reference);

    let storeId = payment.metadata?.storeId || referenceInfo.storeId;
    let planId = payment.metadata?.planId || referenceInfo.planId;

    if ((!storeId || !planId) && payment.external_reference) {
      const pendingPayment = await prisma.payment.findFirst({
        where: {
          externalReference: payment.external_reference
        },
        include: {
          subscription: true
        }
      });

      if (pendingPayment) {
        storeId = storeId || pendingPayment.storeId;
        planId = planId || pendingPayment.subscription?.planId || null;
      }
    }

    if (!storeId || !planId) {
      return res.json({ received: true, ignored: true });
    }

    if (payment.status === "approved") {
      await activateSubscriptionFromPayment({
        storeId,
        planId,
        gateway: BillingGateway.MERCADO_PAGO,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: addDays(new Date(), 30),
        mercadopagoPreferenceId: payment.external_reference || null,
        payment: {
          amountCents: Math.round((payment.transaction_amount || 0) * 100),
          currency: "BRL",
          paymentMethod: payment.payment_type_id || payment.payment_method_id || null,
          externalPaymentId: String(payment.id),
          externalReference: payment.external_reference || null,
          externalPreferenceId: payment.external_reference || null,
          paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
          payload: payment as unknown as Prisma.InputJsonValue,
          status: PaymentStatus.APPROVED
        }
      });
    }

    if (["rejected", "cancelled", "charged_back", "refunded"].includes(payment.status)) {
      await markSubscriptionPaymentFailed({
        storeId,
        gateway: BillingGateway.MERCADO_PAGO,
        reason: payment.status_detail || `Pagamento Mercado Pago com status ${payment.status}`,
        payment: {
          amountCents: Math.round((payment.transaction_amount || 0) * 100),
          currency: "BRL",
          paymentMethod: payment.payment_type_id || payment.payment_method_id || null,
          externalPaymentId: String(payment.id),
          externalReference: payment.external_reference || null,
          payload: payment as unknown as Prisma.InputJsonValue
        }
      });
    }

    return res.json({ received: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/plans", async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true
      },
      orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }]
    });

    return res.json(plans);
  } catch (error) {
    return next(error);
  }
});

const checkoutSchema = z.object({
  body: z.object({
    planId: z.string().min(1),
    gateway: z.nativeEnum(BillingGateway).optional(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

router.use(requireAuth);
router.use(requireStoreContext);

router.get("/me", async (req, res, next) => {
  try {
    const storeId = req.user!.storeId!;

    const [subscription, planUsage] = await Promise.all([
      prisma.subscription.findUnique({
        where: {
          storeId
        },
        include: {
          plan: true
        }
      }),
      getStorePlanUsage(storeId)
    ]);

    return res.json({
      subscription,
      planUsage
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/checkout-session",
  requireRole([UserRole.STORE_OWNER]),
  validate(checkoutSchema),
  async (req, res, next) => {
    try {
      const { planId, successUrl, cancelUrl } = req.body;
      const gateway = req.body.gateway || BillingGateway.STRIPE;
      const storeId = req.user!.storeId!;

      const [plan, store, owner, existingSubscription] = await Promise.all([
        prisma.plan.findUnique({ where: { id: planId } }),
        prisma.store.findUnique({ where: { id: storeId } }),
        prisma.user.findUnique({ where: { id: req.user!.id } }),
        prisma.subscription.findUnique({ where: { storeId } })
      ]);

      if (!plan || !plan.isActive) {
        throw new AppError("Plano nao encontrado", 404);
      }

      if (!store || !owner) {
        throw new AppError("Dados da loja nao encontrados", 404);
      }

      if (plan.isTrial) {
        const trialDays = plan.trialDays || 14;
        const trialEnd = addDays(new Date(), trialDays);

        await activateSubscriptionFromPayment({
          storeId,
          planId: plan.id,
          gateway: BillingGateway.TRIAL,
          status: SubscriptionStatus.TRIALING,
          currentPeriodEnd: trialEnd,
          trialEndsAt: trialEnd,
          payment: {
            amountCents: 0,
            currency: "BRL",
            paymentMethod: "trial",
            externalPaymentId: `trial_${storeId}_${Date.now()}`,
            externalReference: `store:${storeId}|plan:${plan.id}|trial:true`,
            paidAt: new Date(),
            status: PaymentStatus.APPROVED
          }
        });

        return res.json({
          mode: BillingGateway.TRIAL,
          message: `Trial ativado por ${trialDays} dias`,
          trialEndsAt: trialEnd
        });
      }

      if (gateway === BillingGateway.TRIAL) {
        throw new AppError("Gateway TRIAL so pode ser usado para planos trial", 400);
      }

      if (
        existingSubscription &&
        existingSubscription.gateway &&
        existingSubscription.gateway !== gateway &&
        existingSubscription.status !== SubscriptionStatus.CANCELED
      ) {
        await cancelGatewayIfNeeded({
          gateway: existingSubscription.gateway,
          stripeSubscriptionId: existingSubscription.stripeSubscriptionId
        });
      }

      if (gateway === BillingGateway.STRIPE) {
        const stripe = assertStripe();

        if (!plan.stripePriceId) {
          throw new AppError("Plano sem price ID do Stripe configurado", 400);
        }

        let customerId = existingSubscription?.stripeCustomerId || null;

        if (!customerId) {
          const customer = await stripe.customers.create({
            name: store.name,
            email: owner.email,
            metadata: {
              storeId
            }
          });
          customerId = customer.id;
        }

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          line_items: [
            {
              price: plan.stripePriceId,
              quantity: 1
            }
          ],
          success_url:
            successUrl ||
            `${env.FRONTEND_URL}/dashboard/assinatura?status=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl || `${env.FRONTEND_URL}/dashboard/assinatura?status=cancelled`,
          allow_promotion_codes: true,
          metadata: {
            storeId,
            planId: plan.id,
            gateway: BillingGateway.STRIPE
          }
        });

        await prisma.subscription.upsert({
          where: {
            storeId
          },
          update: {
            planId: plan.id,
            gateway: BillingGateway.STRIPE,
            stripeCustomerId: customerId,
            mercadopagoPreferenceId: null,
            mercadopagoSubscriptionId: null,
            mercadopagoPayerId: null,
            status: SubscriptionStatus.INCOMPLETE
          },
          create: {
            storeId,
            planId: plan.id,
            gateway: BillingGateway.STRIPE,
            stripeCustomerId: customerId,
            status: SubscriptionStatus.INCOMPLETE
          }
        });

        await prisma.payment.create({
          data: {
            storeId,
            subscriptionId: existingSubscription?.id,
            gateway: BillingGateway.STRIPE,
            status: PaymentStatus.PENDING,
            amountCents: plan.priceCents,
            currency: "BRL",
            paymentMethod: "card",
            externalReference: `stripe_checkout_session:${session.id}`,
            externalPreferenceId: session.id
          }
        });

        return res.json({
          gateway: BillingGateway.STRIPE,
          sessionId: session.id,
          url: session.url
        });
      }

      if (gateway === BillingGateway.MERCADO_PAGO) {
        const externalReference = `store:${storeId}|plan:${plan.id}|ref:${Date.now()}|hash:${crypto
          .createHash("sha1")
          .update(`${storeId}-${plan.id}-${Date.now()}`)
          .digest("hex")
          .slice(0, 10)}`;

        const preference = await createMercadoPagoPreference({
          planId: plan.id,
          planName: plan.name,
          amountCents: plan.priceCents,
          storeId,
          ownerEmail: owner.email,
          successUrl: successUrl || `${env.FRONTEND_URL}/dashboard/assinatura?status=success`,
          cancelUrl: cancelUrl || `${env.FRONTEND_URL}/dashboard/assinatura?status=cancelled`,
          pendingUrl: `${env.FRONTEND_URL}/dashboard/assinatura?status=pending`,
          externalReference
        });

        const subscription = await prisma.subscription.upsert({
          where: {
            storeId
          },
          update: {
            planId: plan.id,
            gateway: BillingGateway.MERCADO_PAGO,
            status: SubscriptionStatus.INCOMPLETE,
            mercadopagoPreferenceId: preference.id,
            stripeSubscriptionId: null
          },
          create: {
            storeId,
            planId: plan.id,
            gateway: BillingGateway.MERCADO_PAGO,
            status: SubscriptionStatus.INCOMPLETE,
            mercadopagoPreferenceId: preference.id
          }
        });

        await prisma.payment.create({
          data: {
            storeId,
            subscriptionId: subscription.id,
            gateway: BillingGateway.MERCADO_PAGO,
            status: PaymentStatus.PENDING,
            amountCents: plan.priceCents,
            currency: "BRL",
            paymentMethod: "pix_boleto_card",
            externalReference,
            externalPreferenceId: preference.id
          }
        });

        return res.json({
          gateway: BillingGateway.MERCADO_PAGO,
          preferenceId: preference.id,
          url: preference.checkoutUrl
        });
      }

      throw new AppError("Gateway de pagamento invalido", 400);
    } catch (error) {
      return next(error);
    }
  }
);

router.post("/portal", requireRole([UserRole.STORE_OWNER]), async (req, res, next) => {
  try {
    const stripe = assertStripe();
    const subscription = await prisma.subscription.findUnique({
      where: {
        storeId: req.user!.storeId!
      }
    });

    if (!subscription?.stripeCustomerId || subscription.gateway !== BillingGateway.STRIPE) {
      throw new AppError("Portal disponivel apenas para assinaturas Stripe", 400);
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${env.FRONTEND_URL}/dashboard/assinatura`
    });

    return res.json({ url: portalSession.url });
  } catch (error) {
    return next(error);
  }
});

router.post("/cancel", requireRole([UserRole.STORE_OWNER]), async (req, res, next) => {
  try {
    const storeId = req.user!.storeId!;
    const subscription = await prisma.subscription.findUnique({
      where: { storeId }
    });

    if (!subscription) {
      throw new AppError("Assinatura nao encontrada", 404);
    }

    if (subscription.gateway === BillingGateway.STRIPE && subscription.stripeSubscriptionId) {
      const stripe = assertStripe();
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }

    await cancelStoreSubscription({
      storeId,
      reason: "Cancelamento solicitado pelo lojista"
    });

    return res.json({
      message: "Assinatura cancelada e loja suspensa. Dados preservados por 30 dias."
    });
  } catch (error) {
    return next(error);
  }
});

export { webhookRouter as subscriptionWebhookRouter };
export default router;
