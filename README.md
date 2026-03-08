# AutoVitrine

Plataforma SaaS white-label para lojistas de veiculos criarem sua propria vitrine digital com painel administrativo, estoque, leads e assinatura recorrente.

## Stack

- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: React + Vite + TailwindCSS
- Auth: JWT (access + refresh) + bcrypt
- Upload de imagens: Cloudinary
- Pagamentos: Stripe Checkout + Webhooks
- Logs: Winston
- Validacao: Zod
- Rate limiting: express-rate-limit
- Deploy: Railway (Dockerfile backend)

## Monorepo

```txt
/backend
/frontend
```

## Funcionalidades implementadas

### Perfis

- Super Admin: dashboard global, listagem de lojas, bloqueio/ativacao, gestao de planos e assinaturas
- Lojista: onboarding, personalizacao da loja, CRUD de veiculos, leads, dashboard e assinatura
- Visitante: vitrine publica por slug, filtros, busca, detalhe do veiculo, envio de lead e interesse via WhatsApp

### Core

- Cadastro/login com JWT + refresh token
- Recuperacao de senha por e-mail
- Wizard de onboarding da loja
- Personalizacao com tema, cores, banner, logo e textos
- CRUD completo de veiculos + upload multiplo (ate 15 imagens)
- Leads salvos no banco e notificados por e-mail
- Planos e checkout Stripe
- Webhook Stripe para sincronizar assinatura
- Contador de visualizacao da vitrine

## Modelos Prisma

- `User`
- `Store`
- `Vehicle`
- `VehicleImage`
- `Lead`
- `Plan`
- `Subscription`
- `StorefrontView`

## Variaveis de ambiente

Use o arquivo `.env.example` na raiz como base:

```bash
cp .env.example .env
```

## Rodando localmente

### 1) Instalar dependencias

```bash
npm install
```

### 2) Gerar cliente Prisma e sincronizar schema

```bash
npm run prisma:generate --workspace backend
npm run prisma:push --workspace backend
```

### 3) Seed (planos + super admin)

```bash
npm run seed --workspace backend
```

### 4) Executar backend + frontend

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Healthcheck: `GET http://localhost:4000/api/health`

## Stripe (assinaturas)

1. Configure no `.env`:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASIC`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_UNLIMITED`

2. Criar endpoint de webhook:
- URL: `POST /api/subscriptions/webhook`

3. Em ambiente local, use Stripe CLI:

```bash
stripe listen --forward-to http://localhost:4000/api/subscriptions/webhook
```

## Upload de imagens

Configure `CLOUDINARY_URL` no `.env`:

```txt
cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

## Deploy na Railway

## Backend (recomendado)

- O arquivo `railway.toml` esta configurado para usar `backend/Dockerfile`
- Defina no Railway as variaveis:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_BASIC`
  - `STRIPE_PRICE_PRO`
  - `STRIPE_PRICE_UNLIMITED`
  - `CLOUDINARY_URL`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`
  - `FRONTEND_URL`

## Frontend

Opcoes:

1. Deploy separado (servico estatico na Railway / Vercel / Netlify) com `VITE_API_URL` apontando para o backend.
2. Buildar frontend e servir pelo backend (o backend ja tenta servir `../frontend/dist` quando esse diretorio existe).

## Rotas principais

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Lojista
- `GET /api/stores/me`
- `PUT /api/stores/me/onboarding`
- `PUT /api/stores/me/customization`
- `POST /api/stores/me/upload/logo`
- `POST /api/stores/me/upload/banner`
- `GET /api/stores/me/dashboard`
- `GET /api/stores/me/leads`
- `GET /api/stores/me/users`
- `POST /api/stores/me/users`

### Veiculos
- `POST /api/vehicles`
- `GET /api/vehicles`
- `GET /api/vehicles/:id`
- `PUT /api/vehicles/:id`
- `DELETE /api/vehicles/:id`
- `POST /api/vehicles/:id/images`
- `DELETE /api/vehicles/:id/images/:imageId`

### Publico
- `GET /api/public/stores/:slug`
- `GET /api/public/stores/:slug/vehicles`
- `GET /api/public/stores/:slug/vehicles/:vehicleId`
- `POST /api/public/stores/:slug/leads`
- `POST /api/public/stores/:slug/views`

### Assinaturas
- `GET /api/subscriptions/plans`
- `GET /api/subscriptions/me`
- `POST /api/subscriptions/checkout-session`
- `POST /api/subscriptions/portal`
- `POST /api/subscriptions/webhook`

### Super Admin
- `GET /api/admin/stats`
- `GET /api/admin/stores`
- `PATCH /api/admin/stores/:id/status`
- `GET /api/admin/plans`
- `POST /api/admin/plans`
- `GET /api/admin/subscriptions`

## Observacoes

- O projeto esta preparado para evoluir para multi-tenant por subdominio, mas atualmente usa slug em rota (`/loja/:slug`).
- Para producao, recomenda-se adicionar testes automatizados (unitarios/integracao), monitoramento e fila de e-mails.