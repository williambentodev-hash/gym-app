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
| S4 | Reconstruir o estado a partir de 1.000 eventos em < 1 s | ✅ **Passou** | **Android físico** (Samsung, Expo Go, bundle de desenvolvimento, que é mais lento que o de release): 1.000 eventos em **45 ms**, 2.000 em **71 ms**, 3.000 em **103 ms**. Crescimento linear de ~34 ms por 1.000 eventos, então o limite de 1 s chegaria por volta de **~29 mil eventos ≈ 3 anos de uso intenso** por usuário (estimativa de 10 mil/ano, ADR-0006). Snapshots de estado só serão necessários bem depois do MVP. Gravação em lote: 1.000 eventos em 525–825 ms numa transação (< 1 ms por evento). **Web (desktop):** 1.000 em 18 ms, 2.000 em 32 ms. Em ambos, a leitura do SQLite domina (~80%) e o reducer puro é desprezível |
| S3 | Login Google (APK + web) com Better Auth no Worker | ⏳ | Worker `gym-api` publicado em `https://gym-api.gym-api.workers.dev` (Hono, `/api/health`). Na primeira publicação, o Wrangler registrou o subdomínio `workers.dev` da conta automaticamente. O DNS respondeu logo, mas o **certificado TLS levou ~5 min** (curl com erro 35 até lá). Próximo: cliente OAuth no Google Cloud Console |
| S6 | Animação em loop offline a partir do cache | ⏳ | Depende de hospedagem de mídia (R2), por isso fica depois da configuração da Cloudflare |
| S5 | APK sem custo + sideload | ✅ **Passou** | APK instalado por sideload no Android do dono do produto. **Em modo avião**, eventos gravados persistiram depois de fechar e reabrir o app (contador do SQLite preservado). Os logs da tela somem ao reabrir porque são estado em memória, por design: a fonte da verdade é o SQLite |
| S5 (detalhes) | | | **Decisão:** build na nuvem com EAS, plano gratuito (conta Expo do dono do produto). Android SDK local descartado (~10 GB). `eas.json` com perfil `preview` (`distribution: internal`, `buildType: apk`). Keystore gerada e guardada pela Expo. Primeiro build: **~15 min** do envio ao APK (fila gratuita + build). Monorepo pnpm funcionou no EAS sem configuração extra. Falta confirmar a instalação por sideload no aparelho |

## Como o S1 foi testado (reproduzível)

1. `npx expo export --platform web --output-dir <dir>`
2. Servidor estático simples (Node `http`) adicionando os dois cabeçalhos COOP/COEP, para simular o Worker
3. `puppeteer-core` dirigindo o Edge instalado, com perfil persistente, abrindo `/?auto` duas vezes. O modo `?auto` da tela de spike grava 1.000 eventos, reconstrói o estado e escreve o resultado em `document.title`

Aprendizado: o `--dump-dom --virtual-time-budget` do navegador headless **não** espera o SQLite, porque ele roda num web worker fora do tempo virtual. Foi preciso controlar o navegador de fato.

**Falso alarme no teste do Android:** a tela mostrou "Estado (supino): {}" depois do rebuild. Não era bug do reducer, e sim do **gerador de dados de teste**: com 10 exercícios e `i % 5 === 0` para marcar aquecimento, todo índice de supino (múltiplo de 10) virava aquecimento, que corretamente fica fora das métricas. Corrigido para `i % 7`. Lição: dados sintéticos com padrões periódicos podem esconder ou simular bugs. Os testes de propriedade do motor de sync (ADR-0006) devem usar geração **aleatória com seed**, não aritmética modular.

## Cuidados registrados

- **Versões duplicadas de React / React Native no monorepo quebram o app.** Diagnóstico: `pnpm why --depth=10 react-native`. Usar sempre `npx expo install <pacote>` no app, para obter versões compatíveis com o SDK.
- O template do Expo inclui um `AGENTS.md` recomendando consultar a documentação **da versão do SDK** antes de usar qualquer API do Expo, porque elas mudam a cada versão. Mantido no repositório.
