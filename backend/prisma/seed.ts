import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: "TRIAL",
      description: "Trial gratis por 14 dias sem cartao",
      priceCents: 0,
      vehicleLimit: 10,
      userLimit: 1,
      maxPhotosPerVehicle: 5,
      allowCustomDomain: false,
      removeWatermark: false,
      includeReports: false,
      includeAdvancedReports: false,
      allowOutboundWebhooks: false,
      trialDays: 14,
      isTrial: true,
      showTrialBanner: true,
      isActive: true,
      sortOrder: 0,
      stripePriceId: null,
      mercadopagoPlanId: null
    },
    {
      name: "BASICO",
      description: "Ate 20 veiculos e 1 usuario",
      priceCents: 7900,
      vehicleLimit: 20,
      userLimit: 1,
      maxPhotosPerVehicle: 8,
      allowCustomDomain: false,
      removeWatermark: false,
      includeReports: false,
      includeAdvancedReports: false,
      allowOutboundWebhooks: false,
      trialDays: null,
      isTrial: false,
      showTrialBanner: false,
      isActive: true,
      sortOrder: 1,
      stripePriceId: process.env.STRIPE_PRICE_BASIC || null,
      mercadopagoPlanId: null
    },
    {
      name: "PROFISSIONAL",
      description: "Ate 100 veiculos, 5 usuarios e dominio customizado",
      priceCents: 14900,
      vehicleLimit: 100,
      userLimit: 5,
      maxPhotosPerVehicle: 15,
      allowCustomDomain: true,
      removeWatermark: true,
      includeReports: true,
      includeAdvancedReports: false,
      allowOutboundWebhooks: false,
      trialDays: null,
      isTrial: false,
      showTrialBanner: false,
      isActive: true,
      sortOrder: 2,
      stripePriceId: process.env.STRIPE_PRICE_PRO || null,
      mercadopagoPlanId: null
    },
    {
      name: "ENTERPRISE",
      description: "Sem limites, relatorios avancados e webhooks de saida",
      priceCents: 24900,
      vehicleLimit: null,
      userLimit: null,
      maxPhotosPerVehicle: null,
      allowCustomDomain: true,
      removeWatermark: true,
      includeReports: true,
      includeAdvancedReports: true,
      allowOutboundWebhooks: true,
      trialDays: null,
      isTrial: false,
      showTrialBanner: false,
      isActive: true,
      sortOrder: 3,
      stripePriceId: process.env.STRIPE_PRICE_UNLIMITED || null,
      mercadopagoPlanId: null
    }
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        description: plan.description,
        priceCents: plan.priceCents,
        vehicleLimit: plan.vehicleLimit,
        userLimit: plan.userLimit,
        maxPhotosPerVehicle: plan.maxPhotosPerVehicle,
        allowCustomDomain: plan.allowCustomDomain,
        removeWatermark: plan.removeWatermark,
        includeReports: plan.includeReports,
        includeAdvancedReports: plan.includeAdvancedReports,
        allowOutboundWebhooks: plan.allowOutboundWebhooks,
        trialDays: plan.trialDays,
        isTrial: plan.isTrial,
        showTrialBanner: plan.showTrialBanner,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        stripePriceId: plan.stripePriceId,
        mercadopagoPlanId: plan.mercadopagoPlanId
      },
      create: plan
    });
  }

  const adminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@autovitrine.com";
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "admin123456";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Super Admin",
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      isActive: true
    },
    create: {
      name: "Super Admin",
      email: adminEmail,
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      isActive: true
    }
  });

  console.log("Seed finalizado com planos e super admin.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
