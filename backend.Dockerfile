# Backend deploy image for Railway
# v9 - 2026-05-13 entrypoint como arquivo separado + debug
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

# Runner: nginx:bookworm (Debian/glibc) + Node.js 20
FROM nginx:bookworm AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs npm openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Remove config default do nginx (evita conflito na porta 80)
# Cria config com placeholder literal RAILWAY_PORT (não $PORT para evitar expansão no shell do RUN)
RUN rm -f /etc/nginx/conf.d/default.conf && \
    printf 'server {\n  listen RAILWAY_PORT;\n  location / {\n    proxy_pass http://127.0.0.1:4000;\n    proxy_http_version 1.1;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n    proxy_read_timeout 300s;\n    proxy_connect_timeout 10s;\n  }\n}\n' > /etc/nginx/conf.d/backend.conf

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
CMD ["/entrypoint.sh"]
