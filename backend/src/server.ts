import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { startSubscriptionLifecycleJob } from "./services/subscription-lifecycle.service";

// Node escuta diretamente no PORT injetado pelo Railway (0.0.0.0)
const port = env.PORT;
const server = app.listen(port, () => {
  logger.info(`AutoVitrine API rodando na porta ${port}`);
  startSubscriptionLifecycleJob();
});

async function shutdown(signal: string) {
  logger.info(`Recebido ${signal}. Encerrando servidor...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
