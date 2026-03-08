import express, { Router } from "express";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { requireAuth, requireRole, requireStoreContext } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../utils/app-error";
import { assertStripe } from "../services/stripe.service";

const webhookRouter = Router();
const router = Router();

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
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

webhookRouter.post("/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError("STRIPE_WEBHOOK_SECRET nao configurado", 500);
    }

    const stripe = assertStripe();
    const signature = req.headers["stripe-signature"];

    if (!signature || Array.isArray(signature)) {
      throw new AppError("Assinatura do webhook ausente", 400);
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id: string;
        metadata?: Record<string, string>;
        customer?: string;
        subscription?: string;
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

        await prisma.subscription.upsert({
          where: { storeId },
          update: {
            planId,
            stripeCustomerId: session.customer || null,
            stripeSubscriptionId: session.subscription || null,
            status,
            currentPeriodEnd,
            cancelAtPeriodEnd: false
          },
          create: {
            storeId,
            planId,
            stripeCustomerId: session.customer || null,
            stripeSubscriptionId: session.subscription || null,
            status,
            currentPeriodEnd,
            cancelAtPeriodEnd: false
          }
        });
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
        await prisma.subscription.update({
          where: {
            id: existing.id
          },
          data: {
            ...(plan ? { planId: plan.id } : {}),
            stripeCustomerId:
              typeof stripeSub.customer === "string" ? stripeSub.customer : existing.stripeCustomerId,
            status: mapStripeStatus(stripeSub.status),
            cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
            currentPeriodEnd: stripeSub.current_period_end
              ? new Date(stripeSub.current_period_end * 1000)
              : existing.currentPeriodEnd
          }
        });
      }
    }

    return res.json({ received: true });
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

const checkoutSchema = z.object({
  body: z.object({
    planId: z.string().min(1),
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
    const subscription = await prisma.subscription.findUnique({
      where: {
        storeId: req.user!.storeId!
      },
      include: {
        plan: true
      }
    });

    return res.json(subscription);
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
      const stripe = assertStripe();
      const { planId, successUrl, cancelUrl } = req.body;
      const storeId = req.user!.storeId!;

      const [plan, store, owner, existingSubscription] = await Promise.all([
        prisma.plan.findUnique({ where: { id: planId } }),
        prisma.store.findUnique({ where: { id: storeId } }),
        prisma.user.findUnique({ where: { id: req.user!.id } }),
        prisma.subscription.findUnique({ where: { storeId } })
      ]);

      if (!plan) {
        throw new AppError("Plano nao encontrado", 404);
      }

      if (!plan.stripePriceId) {
        throw new AppError("Plano sem price ID do Stripe configurado", 400);
      }

      if (!store || !owner) {
        throw new AppError("Dados da loja nao encontrados", 404);
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
          successUrl || `${env.FRONTEND_URL}/dashboard/assinatura?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${env.FRONTEND_URL}/dashboard/assinatura?status=cancelled`,
        allow_promotion_codes: true,
        metadata: {
          storeId,
          planId: plan.id
        }
      });

      await prisma.subscription.upsert({
        where: {
          storeId
        },
        update: {
          planId: plan.id,
          stripeCustomerId: customerId
        },
        create: {
          storeId,
          planId: plan.id,
          stripeCustomerId: customerId,
          status: SubscriptionStatus.INCOMPLETE
        }
      });

      return res.json({
        sessionId: session.id,
        url: session.url
      });
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

    if (!subscription?.stripeCustomerId) {
      throw new AppError("Cliente Stripe nao encontrado para esta loja", 404);
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

export { webhookRouter as subscriptionWebhookRouter };
export default router;
