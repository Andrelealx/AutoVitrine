import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";

const server = app.listen(env.PORT, () => {
  logger.info(`AutoVitrine API rodando na porta ${env.PORT}`);
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