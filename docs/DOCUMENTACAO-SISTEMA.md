# Documentacao do Sistema

## 1. Visao geral
AutoVitrine e um SaaS white-label para lojas de carros criarem vitrine publica e gerenciarem operacao interna (estoque, leads, equipe e assinatura).

### Stack
- Backend: Node.js, Express, Prisma, PostgreSQL
- Frontend: React, Vite, TailwindCSS
- Auth: JWT (access + refresh)
- Pagamentos: Stripe e Mercado Pago
- Upload: Cloudinary
- Email: SMTP (Nodemailer)

## 2. Estrutura do repositorio

```text
/backend
  /prisma
  /src
/frontend
  /src
/docs
```

## 3. Backend

### 3.1 Boot e infraestrutura
- `backend/src/server.ts`: sobe API e inicia job de lifecycle de assinatura.
- `backend/src/app.ts`: middlewares globais, rotas, webhook raw e fallback SPA.
- `backend/src/config/env.ts`: validacao de variaveis de ambiente com Zod.
- `backend/src/config/prisma.ts`: cliente Prisma.
- `backend/src/config/logger.ts`: logger Winston.

### 3.2 Middlewares
- `requireAuth`, `requireRole`, `requireStoreContext`, `requireSuperAdmin`
- `validate` (Zod)
- `publicLimiter` e `authLimiter`
- `errorHandler`

### 3.3 Modulos de rota
- `auth.routes.ts`: cadastro, login, refresh, logout, me, recuperar senha.
- `store.routes.ts`: onboarding, personalizacao, dashboard da loja, usuarios da equipe.
- `vehicle.routes.ts`: CRUD de veiculos e imagens.
- `subscription.routes.ts`: planos, assinatura atual, checkout, cancelamento e webhooks.
- `admin.routes.ts`: gestao SaaS (lojas, planos, stats, auditoria, impersonacao).
- `public.routes.ts`: vitrine publica, listagem, detalhes, leads e views.

### 3.4 Servicos de negocio
- `subscription-lifecycle.service.ts`
  - ativacao de assinatura por pagamento
  - falha de pagamento e carencia
  - suspensao apos carencia
  - cancelamento com retencao
  - job recorrente
- `stripe.service.ts` e `mercadopago.service.ts`
- `audit.service.ts`
- `upload.service.ts`
- `email.service.ts`

## 4. Modelo de dados (Prisma)

### Entidades principais
- `User`: usuarios da plataforma (owner, staff, super admin)
- `Store`: dados da loja e configuracoes de vitrine
- `Vehicle` e `VehicleImage`: estoque
- `Lead`: contatos recebidos na vitrine
- `Plan`: catalogo de planos
- `Subscription`: estado da assinatura por loja
- `Payment`: historico de cobrancas
- `AuditLog`: trilha de auditoria
- `StorefrontView`: metricas de visualizacao unica

## 5. Fluxos principais

### 5.1 Cadastro e onboarding
1. Usuario cria conta em `/auth/register`.
2. Sistema cria `User`, `Store` e assinatura inicial.
3. Frontend autentica automaticamente e redireciona:
   - plano trial: `/dashboard/loja`
   - plano pago: `/dashboard/assinatura`

### 5.2 Checkout
1. Owner escolhe plano/gateway em `/dashboard/assinatura`.
2. Backend cria sessao Stripe ou preferencia Mercado Pago.
3. Webhook confirma pagamento.
4. Assinatura vai para `ACTIVE`/`TRIALING` e loja fica ativa.

### 5.3 Expiracao e suspensao
1. Ao vencer `currentPeriodEnd`, assinatura vai para `PAST_DUE`.
2. Sistema aplica carencia (`SUBSCRIPTION_GRACE_DAYS`).
3. Sem pagamento no fim da carencia, assinatura vira `PAUSED`.
4. Loja e suspensa e escrita e bloqueada.

## 6. Frontend

### 6.1 Base
- `frontend/src/App.tsx`: roteamento principal.
- `frontend/src/context/AuthContext.tsx`: sessao, login/register/logout/refresh e impersonacao.
- `frontend/src/lib/api.ts`: axios com interceptor de refresh token.

### 6.2 Areas
- Publico: `HomePage`, `StorefrontPage`, `VehicleDetailsPage`
- Auth: `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`
- Dashboard lojista: `OwnerDashboardPage`, `VehiclesPage`, `LeadsPage`, `StoreSettingsPage`, `SubscriptionPage`, `UsersPage`
- Super admin: `AdminOverviewPage`, `AdminStoresPage`, `AdminPlansPage`, `AdminAuditLogsPage`

## 7. Variaveis de ambiente
Ver:
- `.env.example`
- `backend/src/config/env.ts`

Grupos mais importantes:
- banco e JWT
- URLs (`FRONTEND_URL`, `APP_URL`)
- Stripe / Mercado Pago
- assinatura (`SUBSCRIPTION_*`, `TRIAL_WARNING_DAYS`)
- Cloudinary
- SMTP
- super admin

## 8. Execucao local

```bash
npm install
npm run prisma:generate --workspace backend
npm run prisma:deploy --workspace backend
npm run seed --workspace backend
npm run dev
```

## 9. Estado atual da documentacao
Este documento e a base inicial.
Proximos passos de documentacao (recomendado):
1. Documento de API por endpoint (request/response).
2. Documento de regras de negocio de assinatura (casos de borda).
3. Playbook operacional (webhook, incidentes, suporte, conciliacao).
4. Guia de deploy/producao e rollback.
