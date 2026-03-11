# Levantamento Tecnico - 2026-03-11

## Escopo
Este levantamento cobre backend, frontend, modelo de dados, fluxo de assinatura e operacao de administracao.

## Respostas diretas das suas duvidas

### 1) Quando a assinatura expira, perde o uso ou volta para free?
Hoje o comportamento e este:
1. Quando `currentPeriodEnd` vence, a assinatura vai para `PAST_DUE` e entra em carencia (`SUBSCRIPTION_GRACE_DAYS`).
2. Se nao houver pagamento ate o fim da carencia, a assinatura vai para `PAUSED`.
3. A loja e suspensa (`store.isActive = false`) e as operacoes de escrita ficam bloqueadas.

Conclusao: **nao existe downgrade automatico para plano free** no fluxo atual.

### 2) Quem cria conta pode escolher plano no cadastro?
Antes: nao.
Agora (nesta entrega): sim.
- O frontend de cadastro agora carrega os planos em `/subscriptions/plans` e exige selecao de plano.
- O backend de cadastro agora aceita `planId` em `/auth/register` e cria assinatura inicial com o plano escolhido.

## Mudancas aplicadas nesta rodada

- `backend/src/routes/auth.routes.ts`
  - `register` aceita `planId` opcional.
  - Se `planId` for enviado, valida plano ativo e usa esse plano na assinatura inicial.
  - Se nao for enviado, mantem fallback para `TRIAL`, `BASICO` ou primeiro plano ativo.

- `frontend/src/context/AuthContext.tsx`
  - Tipo de `register` atualizado para aceitar `planId`.

- `frontend/src/pages/auth/RegisterPage.tsx`
  - Busca planos publicos.
  - Exibe seletor de plano no cadastro.
  - Envia `planId` no registro.
  - Para plano pago, redireciona para `/dashboard/assinatura` apos criar conta.

## Melhorias recomendadas (priorizadas)

### P0 (alta prioridade)
1. Criar testes automatizados para fluxos criticos:
   - autenticacao
   - checkout
   - webhooks Stripe/MP
   - lifecycle de assinatura
2. Configurar lint real (ESLint + regras de seguranca + import order).
3. Definir observabilidade basica (Sentry/alertas) para erros 5xx e falhas de webhook.

### P1 (media prioridade)
1. Unificar cancelamento manual do admin com o mesmo servico usado no cancelamento do lojista, para manter consistencia de retencao de dados.
2. Revisar regra de `INCOMPLETE` nos limites de plano para evitar liberar uso de recurso pago sem assinatura ativa.
3. Adicionar idempotencia explicita para webhooks (registro de evento processado).
4. Implementar soft-delete/retencao com rotina real de purge apos `dataRetentionUntil`.

### P2 (evolucao)
1. Melhorar UX de onboarding com wizard por etapas.
2. Adicionar exportacao de leads/relatorios.
3. Separar dashboards de owner/staff com permissoes mais finas.

## Observacoes de arquitetura
- O sistema esta bem modularizado por dominio (`auth`, `stores`, `vehicles`, `subscriptions`, `admin`, `public`).
- O ciclo de assinatura ja esta centralizado em servico dedicado, o que facilita evolucao.
- Build de backend e frontend esta passando sem erro no estado atual.
