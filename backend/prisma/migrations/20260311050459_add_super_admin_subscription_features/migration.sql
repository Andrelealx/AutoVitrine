-- CreateEnum
CREATE TYPE "BillingGateway" AS ENUM ('STRIPE', 'MERCADO_PAGO', 'TRIAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'FAILED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "StoreSuspensionReason" AS ENUM ('MANUAL', 'PAYMENT_FAILED', 'CANCELED', 'TRIAL_EXPIRED');

-- AlterTable
ALTER TABLE "Store"
ADD COLUMN "customDomain" TEXT,
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspensionReason" "StoreSuspensionReason",
ADD COLUMN "suspensionNote" TEXT,
ADD COLUMN "unavailableMessage" TEXT,
ADD COLUMN "dataRetentionUntil" TIMESTAMP(3),
ADD COLUMN "outboundWebhookUrl" TEXT,
ADD COLUMN "outboundWebhookSecret" TEXT;

-- AlterTable
ALTER TABLE "Plan"
ADD COLUMN "maxPhotosPerVehicle" INTEGER,
ADD COLUMN "allowCustomDomain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "removeWatermark" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "includeReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "includeAdvancedReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allowOutboundWebhooks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trialDays" INTEGER,
ADD COLUMN "isTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "showTrialBanner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mercadopagoPlanId" TEXT;

-- AlterTable
ALTER TABLE "Subscription"
ADD COLUMN "gateway" "BillingGateway",
ADD COLUMN "mercadopagoSubscriptionId" TEXT,
ADD COLUMN "mercadopagoPreferenceId" TEXT,
ADD COLUMN "mercadopagoPayerId" TEXT,
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "gracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "dataRetentionUntil" TIMESTAMP(3),
ADD COLUMN "canceledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "activatedAt" TIMESTAMP(3),
ADD COLUMN "lastPaymentAt" TIMESTAMP(3),
ADD COLUMN "failedPaymentAt" TIMESTAMP(3),
ADD COLUMN "paymentFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3),
ADD COLUMN "dueReminderSentAt" TIMESTAMP(3),
ADD COLUMN "trialReminderSentAt" TIMESTAMP(3),
ADD COLUMN "failureEmailSentAt" TIMESTAMP(3),
ADD COLUMN "suspensionEmailSentAt" TIMESTAMP(3),
ADD COLUMN "reactivationEmailSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "gateway" "BillingGateway" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "paymentMethod" TEXT,
    "externalPaymentId" TEXT,
    "externalReference" TEXT,
    "externalPreferenceId" TEXT,
    "externalSubscriptionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "actorRole" "UserRole",
    "impersonatedByUserId" TEXT,
    "storeId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_customDomain_key" ON "Store"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_mercadopagoPlanId_key" ON "Plan"("mercadopagoPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_mercadopagoSubscriptionId_key" ON "Subscription"("mercadopagoSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Subscription_gracePeriodEndsAt_idx" ON "Subscription"("gracePeriodEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalPaymentId_key" ON "Payment"("externalPaymentId");

-- CreateIndex
CREATE INDEX "Payment_storeId_createdAt_idx" ON "Payment"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_createdAt_idx" ON "Payment"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_externalReference_idx" ON "Payment"("externalReference");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_storeId_createdAt_idx" ON "AuditLog"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_impersonatedByUserId_fkey" FOREIGN KEY ("impersonatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;