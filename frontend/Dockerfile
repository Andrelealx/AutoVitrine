FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Passa VITE_API_URL como build arg para o Vite embeddar no bundle
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback + porta dinâmica via variável PORT do Railway
RUN echo 'server { \
  listen ${PORT}; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["/bin/sh", "-c", "sed -i 's/${PORT}/'\"$PORT\"'/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
