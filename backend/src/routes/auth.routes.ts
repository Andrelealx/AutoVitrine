import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { BillingGateway, SubscriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authLimiter } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { sendEmail } from "../services/email.service";
import { AppError } from "../utils/app-error";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { comparePassword, hashPassword } from "../utils/password";
import { generateUniqueSlug } from "../utils/slug";
import { env } from "../config/env";
import { isSuperAdminEmail } from "../utils/super-admin";

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    storeName: z.string().min(2).optional(),
    planId: z.string().min(1).optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    password: z.string().min(8)
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

async function issueTokens(user: { id: string; role: UserRole; storeId: string | null; email: string }) {
  const payload = {
    userId: user.id,
    role: user.role,
    storeId: user.storeId,
    email: user.email
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash: await hashPassword(refreshToken)
    }
  });

  return { accessToken, refreshToken };
}

router.post("/register", authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, storeName, planId } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("E-mail ja cadastrado", 409);
    }

    const passwordHash = await hashPassword(password);

    const created = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: UserRole.STORE_OWNER
        }
      });

      const finalStoreName = storeName || `${name} Veiculos`;
      const slug = await generateUniqueSlug(finalStoreName, async (candidate) => {
        const store = await tx.store.findUnique({ where: { slug: candidate } });
        return Boolean(store);
      });

      const store = await tx.store.create({
        data: {
          ownerId: owner.id,
          name: finalStoreName,
          slug,
          description: "Sua vitrine digital premium de veiculos"
        }
      });

      await tx.user.update({
        where: { id: owner.id },
        data: {
          storeId: store.id
        }
      });

      let selectedPlan = null as Awaited<ReturnType<typeof tx.plan.findFirst>>;

      if (planId) {
        selectedPlan = await tx.plan.findFirst({
          where: {
            id: planId,
            isActive: true
          }
        });

        if (!selectedPlan) {
          throw new AppError("Plano selecionado nao encontrado", 404);
        }
      }

      if (!selectedPlan) {
        const trialPlan = await tx.plan.findFirst({
          where: {
            name: "TRIAL",
            isActive: true
          }
        });
        const basicPlan = await tx.plan.findFirst({
          where: {
            name: "BASICO",
            isActive: true
          }
        });
        const firstActivePlan = await tx.plan.findFirst({
          where: {
            isActive: true
          },
          orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }]
        });

        selectedPlan = trialPlan || basicPlan || firstActivePlan;
      }

      if (selectedPlan) {
        const trialDays = selectedPlan.isTrial ? selectedPlan.trialDays || 14 : 0;
        const currentPeriodEnd = trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;

        await tx.subscription.upsert({
          where: { storeId: store.id },
          update: {
            planId: selectedPlan.id,
            gateway: selectedPlan.isTrial ? BillingGateway.TRIAL : null,
            status: selectedPlan.isTrial ? SubscriptionStatus.TRIALING : SubscriptionStatus.INCOMPLETE,
            trialEndsAt: currentPeriodEnd,
            currentPeriodEnd
          },
          create: {
            storeId: store.id,
            planId: selectedPlan.id,
            gateway: selectedPlan.isTrial ? BillingGateway.TRIAL : null,
            status: selectedPlan.isTrial ? SubscriptionStatus.TRIALING : SubscriptionStatus.INCOMPLETE,
            trialEndsAt: currentPeriodEnd,
            currentPeriodEnd
          }
        });
      }

      return {
        user: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          role: owner.role,
          storeId: store.id
        },
        store
      };
    });

    const tokens = await issueTokens({
      id: created.user.id,
      role: created.user.role,
      storeId: created.user.storeId,
      email: created.user.email
    });

    return res.status(201).json({
      message: "Cadastro realizado com sucesso",
      user: created.user,
      store: created.store,
      ...tokens
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        store: true
      }
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw new AppError("Credenciais invalidas", 401);
    }

    if (!user.isActive) {
      throw new AppError("Usuario inativo", 403);
    }

    if (user.role === UserRole.SUPER_ADMIN && !isSuperAdminEmail(user.email)) {
      throw new AppError("Conta super admin invalida para este ambiente", 403);
    }

    const tokens = await issueTokens({
      id: user.id,
      role: user.role,
      storeId: user.storeId,
      email: user.email
    });

    return res.json({
      message: "Login efetuado",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId
      },
      store: user.store,
      ...tokens
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.refreshTokenHash) {
      throw new AppError("Sessao invalida", 401);
    }

    const valid = await comparePassword(refreshToken, user.refreshTokenHash);
    if (!valid) {
      throw new AppError("Sessao invalida", 401);
    }

    const tokens = await issueTokens({
      id: user.id,
      role: user.role,
      storeId: user.storeId,
      email: user.email
    });

    return res.json(tokens);
  } catch (error) {
    return next(new AppError("Refresh token invalido", 401));
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError("Nao autenticado", 401);
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        refreshTokenHash: null
      }
    });

    return res.json({ message: "Logout efetuado" });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError("Nao autenticado", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        store: {
          include: {
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
        }
      }
    });

    if (!user) {
      throw new AppError("Usuario nao encontrado", 404);
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      isImpersonation: req.user?.isImpersonation || false,
      impersonatedByUserId: req.user?.impersonatedByUserId || null,
      store: user.store
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: token,
          resetTokenExpiresAt: expiresAt
        }
      });

      const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: "Recuperacao de senha - AutoVitrine",
        html: `<p>Ola, ${user.name}</p><p>Para redefinir sua senha, acesse: <a href="${resetLink}">${resetLink}</a></p><p>Este link expira em 1 hora.</p>`
      });
    }

    return res.json({
      message: "Se o e-mail existir, voce recebera instrucoes para redefinir a senha."
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/reset-password", authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiresAt: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new AppError("Token invalido ou expirado", 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        resetToken: null,
        resetTokenExpiresAt: null,
        refreshTokenHash: null
      }
    });

    return res.json({ message: "Senha redefinida com sucesso" });
  } catch (error) {
    return next(error);
  }
});

export default router;
