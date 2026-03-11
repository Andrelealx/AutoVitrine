# AutoVitrine

Plataforma SaaS white-label para lojas de carros criarem e operarem sua vitrine digital com controle comercial, assinaturas e gestao centralizada.

## Missao

Permitir que lojistas vendam mais, com presenca digital propria, visual profissional e operacao simples, sem depender de marketplace unico.

## Visao do Sistema

O AutoVitrine conecta tres frentes:

- Operacao da loja (estoque, equipe, leads e personalizacao)
- Gestao de negocio SaaS (planos, assinaturas, cobranca e auditoria)
- Vitrine publica da loja (catalogo, filtros, detalhe do veiculo e captura de interesse)

## Funcionalidades Principais

### Area da Loja

- Cadastro e gestao de veiculos com imagens
- Controle de limites por plano (veiculos, usuarios e fotos)
- Painel com metricas de leads e visualizacoes
- Gestao de equipe (owner e staff)
- Personalizacao visual e conteudo da vitrine
- Gestao de assinatura e gateway de pagamento

### Area Super Admin

- Visao global de operacao da plataforma
- Gestao de lojas (ativar, suspender, cancelar assinatura)
- Gestao dinamica de planos
- Auditoria de eventos administrativos
- Impersonacao segura para suporte operacional

### Vitrine Publica

- Catalogo publico por loja
- Filtros de busca de veiculos
- Pagina de detalhes do veiculo
- Captura de leads e contabilizacao de visitas
- Comportamento controlado para loja suspensa

## Assinaturas e Cobranca

O sistema possui ciclo de vida de assinatura com estados de ativacao, carencia, suspensao e cancelamento, incluindo retencao de dados e reativacao mediante pagamento.

## Integracoes Nativas

- Stripe
- Mercado Pago
- Cloudinary
- SMTP (Nodemailer)

## Tecnologias

- Backend: Node.js, Express, Prisma, PostgreSQL
- Frontend: React, Vite, TailwindCSS
- Autenticacao: JWT (access + refresh)
- Observabilidade/Logs: Winston
- Deploy alvo: Railway

## Diretriz de Privacidade deste README

Este README foi mantido em nivel institucional e funcional.
Detalhes operacionais, configuracoes internas, endpoints completos, variaveis de ambiente e processos de execucao/deploy ficam em documentacao interna do projeto.
