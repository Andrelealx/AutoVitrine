# Backend deploy image for Railway
# v8 - 2026-05-13 nginx proxy na frente do Node (igual frontend)
FROM node:20-bookworm-slim AS builder
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY tsconfig.json ./
RUN npx tsc -p tsconfig.json

# Runner: nginx:alpine + Node.js
FROM nginx:alpine AS runner

# Instala Node.js 20 no alpine
RUN apk add --no-cache nodejs npm openssl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Nginx config: escuta em $PORT e faz proxy para Node na 4000
RUN echo 'server { \
  listen ${PORT}; \
  location / { \
    proxy_pass http://127.0.0.1:4000; \
    proxy_http_version 1.1; \
    proxy_set_header Upgrade $http_upgrade; \
    proxy_set_header Connection "upgrade"; \
    proxy_set_header Host $host; \
    proxy_set_header X-Real-IP $remote_addr; \
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
    proxy_set_header X-Forwarded-Proto $scheme; \
    proxy_read_timeout 300s; \
    proxy_connect_timeout 10s; \
  } \
}' > /etc/nginx/conf.d/default.conf

# Script de entrypoint
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'sed -i "s/\${PORT}/$PORT/g" /etc/nginx/conf.d/default.conf' >> /entrypoint.sh && \
    echo 'node /app/dist/server.js &' >> /entrypoint.sh && \
    echo 'nginx -g "daemon off;"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

EXPOSE 8080
CMD ["/entrypoint.sh"]
