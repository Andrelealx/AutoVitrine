# Backend only deploy image for Railway
# v3 - usa comandos diretos para ser robusto a qualquer build context
FROM node:20-bookworm-slim AS builder
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copia package.json do backend (contexto = backend/)
COPY package*.json ./
RUN npm install

COPY . .
# Usa comandos diretos — não depende de qual package.json está no contexto
RUN npx prisma generate
RUN npx tsc -p tsconfig.json

FROM node:20-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
