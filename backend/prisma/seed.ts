import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: "BASICO",
      description: "Ate 20 veiculos e 1 usuario",
      priceCents: 7900,
      vehicleLimit: 20,
      userLimit: 1,
      stripePriceId: process.env.STRIPE_PRICE_BASIC || null
    },
    {
      name: "PRO",
      description: "Ate 100 veiculos e 3 usuarios",
      priceCents: 14900,
      vehicleLimit: 100,
      userLimit: 3,
      stripePriceId: process.env.STRIPE_PRICE_PRO || null
    },
    {
      name: "ILIMITADO",
      description: "Sem limites de usuarios e veiculos",
      priceCents: 24900,
      vehicleLimit: null,
      userLimit: null,
      stripePriceId: process.env.STRIPE_PRICE_UNLIMITED || null
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
        stripePriceId: plan.stripePriceId
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