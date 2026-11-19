# ADR-0003: AWS como provedor de nuvem, com guarda-corpos de custo

- **Status:** Substituído por [ADR-0005](0005-cloudflare-como-plataforma-de-nuvem.md)
- **Data:** 2026-11-18
- **Fase:** 0

## Contexto

Restrição principal: custo próximo de zero enquanto é laboratório, sem impedir que vire produto real.

Modelo de gratuidade da AWS (a confirmar no site oficial no momento da criação da conta — muda com frequência):

- Contas criadas a partir de jul/2025: **plano gratuito com créditos** (até ~US$ 200: parte no cadastro, parte ao concluir atividades de onboarding), válido por ~6 meses ou até esgotar.
- **Always Free** (sem prazo), entre outros: Lambda (1M requisições/mês), DynamoDB (25 GB), SQS/SNS (1M req), CloudWatch básico, Cognito (faixa gratuita de usuários ativos).
- Recursos "sempre ligados" (RDS, NAT Gateway, ALB, Fargate) **consomem créditos rápido** — NAT Gateway e ALB são as armadilhas clássicas.

## Opções consideradas

1. **AWS** — maior mercado, mais valor de estudo para arquiteto, Always Free generoso para serverless.
2. **GCP** — Cloud Run com free tier muito bom para containers; menor relevância de mercado.
3. **PaaS (Fly.io, Render) + Postgres gerenciado gratuito (Neon/Supabase)** — mais simples e barato, menos aprendizado de arquitetura cloud.

## Decisão

**AWS**, com:

- Billing alarm e AWS Budgets configurados **antes** de qualquer recurso.
- Preferência por serviços pagos-por-uso/Always Free na fase de laboratório.
- Toda infraestrutura como código (decisão de ferramenta em ADR futuro).
- Código de domínio isolado de SDKs AWS (portas e adaptadores), para manter a troca de provedor viável.

A escolha entre **serverless (Lambda)** e **containers (Fargate/App Runner)**, e entre **DynamoDB** e **Postgres**, fica para a Fase 2 — depende dos requisitos da Fase 0 e do modelo de domínio da Fase 1.

## Consequências

- ✅ Custo ~zero viável se a arquitetura respeitar o modelo de cobrança — o custo vira um **requisito arquitetural explícito** (bom exercício).
- ⚠️ Risco de fatura surpresa → mitigado por budgets e revisão de custos a cada ADR de infraestrutura.
- 🔁 Revisar ao fim dos créditos ou ao atingir usuários reais pagantes.
