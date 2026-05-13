import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { startSubscriptionLifecycleJob } from "./services/subscription-lifecycle.service";

// Quando há Nginx na frente, Node escuta sempre na 4000 (interno)
// O Nginx recebe $PORT do Railway e faz proxy_pass para localhost:4000
const port = env.PORT; // 4000
const server = app.listen(port, "127.0.0.1", () => {
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
