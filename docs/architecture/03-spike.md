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
| S1 | SQLite WASM + OPFS na web | ⏳ | |
| S4 | Reconstruir o estado a partir de 1.000 eventos em < 1 s no Android | ⏳ | |
| S6 | Animação em loop offline a partir do cache | ⏳ | |
| S3 | Login Google (APK + web) com Better Auth no Worker | ⏳ | Requer criar um cliente OAuth no Google Cloud Console (gratuito) |
| S5 | APK sem custo + sideload | ⏳ | Requer conta Expo gratuita (EAS) **ou** Android SDK local |

## Cuidados registrados

- **Versões duplicadas de React / React Native no monorepo quebram o app.** Diagnóstico: `pnpm why --depth=10 react-native`. Usar sempre `npx expo install <pacote>` no app, para obter versões compatíveis com o SDK.
- O template do Expo inclui um `AGENTS.md` recomendando consultar a documentação **da versão do SDK** antes de usar qualquer API do Expo, porque elas mudam a cada versão. Mantido no repositório.
