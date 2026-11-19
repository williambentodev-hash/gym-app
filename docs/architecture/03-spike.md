# Fase 3 — Spike técnico

> Objetivo: validar os riscos da [visão arquitetural §5](02-visao-arquitetural.md#5-riscos-técnicos--spike-da-fase-3) **antes** de escrever funcionalidades. Branch: `spike/fase-3`.

## Ambiente

| Ferramenta | Versão |
|---|---|
| Node.js | 26.13.1 (LTS) |
| pnpm | 12.21.0 |
| Expo SDK | 58 (React Native 0.88, React 19.3) |
| TypeScript | 6.0 |
| Turborepo | 2.11 |

Observação: a partir do Node 25 o `corepack` não vem mais junto; o pnpm foi instalado via `npm i -g pnpm`.

## Resultados

| # | Risco | Status | Evidência / aprendizado |
|---|---|---|---|
| S2 | Expo + pnpm + Metro em monorepo | ✅ **Passou** | Desde o SDK 52, o Expo configura o Metro para monorepos automaticamente, sem `metro.config.js`. O pnpm funciona no modo isolado padrão (suportado desde o SDK 54), e o plano B `nodeLinker: hoisted` não foi necessário. O pacote `@gym/domain` é consumido **direto do código TypeScript** (`exports: ./src/index.ts`, sem build): os bundles web e Android foram gerados e contêm o código do domínio. `pnpm typecheck` via Turborepo passa nos dois pacotes |
| S1 | SQLite WASM na web | ✅ **Passou** | `expo-sqlite` 58 tem suporte oficial à web (wa-sqlite em WASM, sem rótulo de experimental). Requisitos: `.wasm` em `assetExts` no Metro e cabeçalhos `Cross-Origin-Embedder-Policy: credentialless` + `Cross-Origin-Opener-Policy: same-origin`, no dev server (Metro) **e em produção** (o Worker vai precisar servi-los). Teste automatizado: build web de produção servida com esses cabeçalhos e aberta duas vezes no Edge headless com o mesmo perfil. Os dados **persistiram** entre execuções (0 → 1.000 → 2.000 eventos), com `crossOriginIsolated=true`. A **mesma porta `LocalDb`** atende nativo e web, então o plano B (Vite) não foi necessário. Limitação na web: `withExclusiveTransactionAsync` não existe |
| S4 | Reconstruir o estado a partir de 1.000 eventos em < 1 s | 🟡 Web ✅ / Android ⏳ | Web (desktop): rebuild de 1.000 eventos em **18 ms** (leitura 17 + redução 1) e de 2.000 em **32 ms**. A leitura do SQLite domina; o reducer puro é desprezível. Falta medir no Android físico (via Expo Go) |
| S6 | Animação em loop offline a partir do cache | ⏳ | |
| S3 | Login Google (APK + web) com Better Auth no Worker | ⏳ | Requer criar um cliente OAuth no Google Cloud Console (gratuito) |
| S5 | APK sem custo + sideload | ⏳ | **Decisão:** build na nuvem com EAS, plano gratuito (conta Expo do dono do produto). Android SDK local descartado (~10 GB) |

## Como o S1 foi testado (reproduzível)

1. `npx expo export --platform web --output-dir <dir>`
2. Servidor estático simples (Node `http`) adicionando os dois cabeçalhos COOP/COEP, para simular o Worker
3. `puppeteer-core` dirigindo o Edge instalado, com perfil persistente, abrindo `/?auto` duas vezes. O modo `?auto` da tela de spike grava 1.000 eventos, reconstrói o estado e escreve o resultado em `document.title`

Aprendizado: o `--dump-dom --virtual-time-budget` do navegador headless **não** espera o SQLite, porque ele roda num web worker fora do tempo virtual. Foi preciso controlar o navegador de fato.

## Cuidados registrados

- **Versões duplicadas de React / React Native no monorepo quebram o app.** Diagnóstico: `pnpm why --depth=10 react-native`. Usar sempre `npx expo install <pacote>` no app, para obter versões compatíveis com o SDK.
- O template do Expo inclui um `AGENTS.md` recomendando consultar a documentação **da versão do SDK** antes de usar qualquer API do Expo, porque elas mudam a cada versão. Mantido no repositório.
