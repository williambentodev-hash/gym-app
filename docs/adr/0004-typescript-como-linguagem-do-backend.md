# ADR-0004: TypeScript como linguagem do backend

- **Status:** Aceito
- **Data:** 2026-11-18
- **Fase:** 0
- **Substitui:** [ADR-0002](0002-go-como-linguagem-do-backend.md)
- **Relacionado:** [ADR-0005](0005-cloudflare-como-plataforma-de-nuvem.md) (decisões acopladas)

## Contexto

O ADR-0002 escolheu Go antes de a plataforma de nuvem estar fechada. Ao avaliar Cloudflare Workers ([ADR-0005](0005-cloudflare-como-plataforma-de-nuvem.md)), ficou claro que linguagem e plataforma são **decisões acopladas**: Workers executa JavaScript/TypeScript nativamente, e Go só via WebAssembly — com suporte parcial à stdlib, goroutines limitadas, binários grandes frente ao limite de tamanho e ao orçamento de CPU por requisição do plano gratuito.

O driver "custo zero sem prazo" foi priorizado sobre o driver "aprender Go".

## Opções consideradas

1. **Manter Go + AWS** — Go de primeira classe; custo após fim dos créditos.
2. **Go via WebAssembly no Workers** — mantém ambas as escolhas no papel, mas Go vira cidadão de segunda classe; alto risco técnico.
3. **Go no Cloudflare Containers** — viável, mas exige plano pago e produto mais novo.
4. **TypeScript no Workers** — runtime nativo, ecossistema maduro (Hono, Drizzle, Zod), mesma linguagem do frontend.

## Decisão

Backend em **TypeScript**, executando nativamente no Cloudflare Workers.

## Consequências

- ✅ Uma única linguagem no sistema inteiro → possibilidade de **compartilhar tipos e schemas de validação** entre backend, web e mobile (monorepo). Isso reduz a necessidade de geração de código a partir de OpenAPI apontada no ADR-0002.
- ✅ Free tier sem prazo de expiração.
- ⚠️ Perde-se o objetivo de aprendizado de Go.
- ⚠️ Compartilhar código entre camadas facilita **acoplamento indevido** (ex.: frontend importando regras de domínio do backend). Precisaremos de fronteiras explícitas de pacote e regras automatizadas (fitness functions) — bom tema de estudo.
- ⚠️ O runtime do Workers não é Node.js completo (compatibilidade parcial via flag `nodejs_compat`): nem toda biblioteca npm funciona.
- 🔁 Revisar se surgir carga de CPU intensa que não caiba no modelo de Workers (ex.: processamento pesado de IA), possivelmente movendo só aquele módulo.
