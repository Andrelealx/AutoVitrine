# AutoVitrine (VitrineAuto SaaS)

Plataforma SaaS white-label para lojistas criarem sua vitrine digital de veiculos.

## Stack

- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: React + Vite + TailwindCSS
- Auth: JWT (access + refresh)
- Pagamentos: Stripe + Mercado Pago
- Upload de imagens: Cloudinary
- Emails: SMTP (Nodemailer)
- Deploy: Railway

## Novos modulos implementados

### 1) Super Admin

- Protecao forte por `SUPER_ADMIN_EMAIL` (alem de role)
- Dashboard com metricas globais:
  - MRR
  - Receita do mes
  - Churn
  - Novas assinaturas e novos trials
- Gestao completa de lojas:
  - Suspender/Reativar
  - Cancelar assinatura manualmente
- Gestao dinamica de planos (sem editar codigo)
- Impersonacao com token temporario de 1h (`/admin/impersonate/stores/:id`)
- Auditoria persistida em banco (`AuditLog`)

### 2) Assinaturas (Stripe + Mercado Pago)

- Checkout por gateway escolhido pelo lojista
- Troca de gateway com cancelamento do gateway anterior
- Webhooks com validacao de assinatura:
  - Stripe: assinatura via `STRIPE_WEBHOOK_SECRET`
  - Mercado Pago: assinatura HMAC via `MERCADOPAGO_WEBHOOK_SECRET`
- Historico de pagamentos em `Payment`
- Cancelamento com suspensao e retencao de dados

### 3) Ciclo de vida da assinatura

- Ativacao imediata no webhook de pagamento aprovado
- Falha de pagamento -> carencia (`SUBSCRIPTION_GRACE_DAYS`)
- Carencia vencida -> suspensao automatica
- Cancelamento -> suspensao + retencao (`SUBSCRIPTION_DATA_RETENTION_DAYS`)
- Job recorrente de lifecycle (`SUBSCRIPTION_LIFECYCLE_INTERVAL_MINUTES`)

### 4) Planos configuraveis

Campos suportados por plano:

- `vehicleLimit`
- `userLimit`
- `maxPhotosPerVehicle`
- `allowCustomDomain`
- `removeWatermark`
- `includeReports`
- `includeAdvancedReports`
- `allowOutboundWebhooks`
- `isTrial`
- `trialDays`
- `showTrialBanner`

Seed padrao:

- `TRIAL` (14 dias)
- `BASICO`
- `PROFISSIONAL`
- `ENTERPRISE`

### 5) Controle de limites

No backend:

- Bloqueio por limite de veiculos
- Bloqueio por limite de fotos por veiculo
- Bloqueio por limite de usuarios
- Bloqueio de escrita para loja suspensa

No frontend:

- Exibicao clara de uso dos limites
- Contador de trial
- Modal de upgrade quando limite e atingido

### 6) Vitrine publica

- Loja suspensa nao retorna 404 silencioso
- Mostra mensagem de indisponibilidade temporaria
- Banner de trial exibido quando configurado no plano
- Rodape "Powered by" removido quando plano remove watermark

## Modelos Prisma

- `User`
- `Store`
- `Vehicle`
- `VehicleImage`
- `Lead`
- `Plan`
- `Subscription`
- `Payment` (novo)
- `AuditLog` (novo)
- `StorefrontView`

## Migrations

Agora o projeto usa migration versionada:

- `backend/prisma/migrations/20260311050459_add_super_admin_subscription_features/migration.sql`

Em producao (Railway), use:

```bash
npm run prisma:deploy --workspace backend
```

## Rodando localmente

### 1) Instalar dependencias

```bash
npm install
```

### 2) Gerar cliente Prisma e aplicar migration

```bash
npm run prisma:generate --workspace backend
npm run prisma:deploy --workspace backend
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

## Variaveis de ambiente

### Backend (Railway)

| Variavel | Uso | Onde obter |
|---|---|---|
| `DATABASE_URL` | Conexao Postgres | Railway Postgres service |
| `JWT_SECRET` | Assinatura do access token | Gerar chave aleatoria forte |
| `JWT_REFRESH_SECRET` | Assinatura do refresh token | Gerar chave aleatoria forte |
| `JWT_EXPIRES_IN` | Duracao do access token | Definicao interna (ex.: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Duracao do refresh token | Definicao interna (ex.: `7d`) |
| `FRONTEND_URL` | CORS e redirects | URL publica do frontend |
| `APP_URL` | URL publica da API | URL publica do backend |
| `SUPER_ADMIN_EMAIL` | Conta permitida no painel admin | Email decidido pela operacao |
| `SUPER_ADMIN_PASSWORD` | Senha inicial no seed | Definida internamente |
| `STRIPE_SECRET_KEY` | API Stripe server-side | Stripe Dashboard > Developers > API keys |
| `STRIPE_WEBHOOK_SECRET` | Validacao webhook Stripe | Stripe Dashboard > Webhooks (Signing secret) |
| `STRIPE_PRICE_BASIC` | Price ID do plano BASICO | Stripe Dashboard > Product price |
| `STRIPE_PRICE_PRO` | Price ID do plano PROFISSIONAL | Stripe Dashboard > Product price |
| `STRIPE_PRICE_UNLIMITED` | Price ID do plano ENTERPRISE | Stripe Dashboard > Product price |
| `MERCADOPAGO_ACCESS_TOKEN` | API Mercado Pago server-side | Mercado Pago Developers > Credentials |
| `MERCADOPAGO_WEBHOOK_SECRET` | Validacao webhook Mercado Pago | Mercado Pago Developers > Webhooks > Secret key |
| `MERCADOPAGO_WEBHOOK_URL` | Endpoint de notificacao | URL publica do backend (`/api/subscriptions/webhook/mercadopago`) |
| `MERCADOPAGO_PUBLIC_KEY` | Chave publica MP (frontend/futuro) | Mercado Pago Developers > Credentials |
| `SUBSCRIPTION_GRACE_DAYS` | Dias de carencia apos falha | Regra de negocio |
| `SUBSCRIPTION_DATA_RETENTION_DAYS` | Retencao apos cancelamento/suspensao | Regra de negocio |
| `SUBSCRIPTION_DUE_REMINDER_DAYS` | Aviso antes do vencimento | Regra de negocio |
| `TRIAL_WARNING_DAYS` | Aviso antes do fim do trial | Regra de negocio |
| `SUBSCRIPTION_LIFECYCLE_INTERVAL_MINUTES` | Frequencia do job de lifecycle | Regra de negocio |
| `CLOUDINARY_URL` / `CLOUDINARY_*` | Upload de imagens | Cloudinary console |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Envio de emails | Provedor SMTP (Resend, SendGrid SMTP, Mailgun SMTP, etc.) |

### Frontend

| Variavel | Uso | Onde obter |
|---|---|---|
| `VITE_API_URL` | URL base da API | URL publica do backend + `/api` |

## Rotas principais

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
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

### Assinaturas
- `GET /api/subscriptions/plans`
- `GET /api/subscriptions/me`
- `POST /api/subscriptions/checkout-session`
- `POST /api/subscriptions/portal`
- `POST /api/subscriptions/cancel`
- `POST /api/subscriptions/webhook` (Stripe legado)
- `POST /api/subscriptions/webhook/stripe`
- `POST /api/subscriptions/webhook/mercadopago`

### Super Admin
- `GET /api/admin/stats`
- `GET /api/admin/stores`
- `PATCH /api/admin/stores/:id/status`
- `POST /api/admin/stores/:id/cancel-subscription`
- `GET /api/admin/plans`
- `POST /api/admin/plans`
- `PATCH /api/admin/plans/:id`
- `GET /api/admin/subscriptions`
- `GET /api/admin/audit-logs`
- `POST /api/admin/impersonate/stores/:id`

### Publico
- `GET /api/public/stores/:slug`
- `GET /api/public/stores/:slug/vehicles`
- `GET /api/public/stores/:slug/vehicles/:vehicleId`
- `POST /api/public/stores/:slug/leads`
- `POST /api/public/stores/:slug/views`