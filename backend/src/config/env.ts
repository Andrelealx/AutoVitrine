import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL nao definida"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter ao menos 16 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET precisa ter ao menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  APP_URL: z.string().url().default("http://localhost:4000"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_BASIC: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_UNLIMITED: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default("no-reply@autovitrine.com"),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variaveis de ambiente invalidas:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Falha ao validar variaveis de ambiente");
}

export const env = parsed.data;