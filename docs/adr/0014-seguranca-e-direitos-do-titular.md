# ADR-0014: Segurança e direitos do titular (LGPD)

- **Status:** Aceito
- **Data:** 2026-11-19
- **Fase:** 5
- **Relacionado:** [06-seguranca-lgpd.md](../architecture/06-seguranca-lgpd.md), [ADR-0006](0006-estrategia-de-sincronizacao-offline.md), [ADR-0008](0008-autenticacao.md), [ADR-0012](0012-catalogo-de-eventos-v1.md)

## Contexto

O QA-2 (Fase 0) exige que o usuário possa **exportar e excluir** todos os seus dados. O ADR-0012 deixou pendente apagar os Durable Objects da época de testes. O modelo de ameaças (STRIDE, ver documento relacionado) levantou lacunas: tokens OAuth guardados sem necessidade, ausência de limites de taxa e de tamanho, e ausência de cabeçalhos de segurança.

A LGPD provavelmente não se aplica ao uso atual (art. 4º, I: uso particular, não econômico), mas o projeto pode virar produto, e privacidade desde a concepção é mais barata agora.

## Decisões

1. **Minimização: não guardar tokens OAuth.** O Better Auth não tem opção para "não guardar", só para criptografar (`encryptOAuthTokens`). Como o Google é usado só para login, os tokens são **descartados** num `databaseHooks.account.{create,update}.before`. A migração `0002` limpa os já gravados. Criptografar algo inútil seria pior do que não ter.
2. **Direitos do titular em rotas próprias** (em vez da API de exclusão do Better Auth, pouco documentada):
   - `GET /api/conta/exportar`: identidade + contas vinculadas + sessões + **log completo** (épocas v1 e anterior), em JSON.
   - `DELETE /api/conta`: exige `{"confirmacao": "EXCLUIR MINHA CONTA"}`; apaga os DOs de **todas as épocas** (`storage.deleteAll()`) e, explicitamente, `session`, `account` e `user` no D1 (sem depender só do `ON DELETE CASCADE`).
   - `POST /api/conta/limpar-epoca-anterior`: apaga a época de testes (pendência do ADR-0012). Idempotente.
   - No cliente: "apagar dados deste aparelho" (fecha e apaga o SQLite) e remoção automática dos bancos locais das épocas anteriores.
3. **Limites:** corpo do push ≤ 1 MB; payload de evento ≤ 16 KB; **rate limit por usuário** com o binding nativo dos Workers (120/min no sync, 10/min nas rotas de conta). É aproximado e por localidade: proteção contra laço e abuso, não cota exata.
4. **Cabeçalhos:** na web, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` e HSTS; na API, `secureHeaders` do Hono + `Cache-Control: no-store`. **CSP fica pendente** (estilos inline do Expo web).
5. **Cadeia de suprimentos:** `pnpm audit --prod --audit-level high` na CI. Moderadas em ferramentas de build são avaliadas e registradas.
6. **Política de privacidade** no app, em linguagem simples, coerente com a arquitetura real (inclusive transferência internacional via Cloudflare).

## Consequências

- ✅ QA-2 atendido: exportar e excluir funcionam de ponta a ponta, e a exclusão é total por construção (um DO por usuário).
- ✅ Superfície menor: sem credenciais de terceiros guardadas.
- ✅ Pendência do ADR-0012 resolvida (épocas antigas apagáveis no servidor e removidas no cliente).
- ⚠️ A exclusão não alcança cópias em **outros aparelhos offline**; elas ficam inacessíveis ao servidor (401), mas não são apagadas remotamente.
- ⚠️ Sem CSP, a defesa contra XSS depende do escape do React.
- 🔁 **Gatilhos de revisão:** distribuição pública (CSP, termos de uso, DPA formal); dados de saúde explícitos (medidas, fotos: criptografia local); cobrança por uso (rate limit exato via DO).
