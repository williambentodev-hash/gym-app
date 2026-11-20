# Fase 5 — Segurança e LGPD

> Decisões registradas no [ADR-0014](../adr/0014-seguranca-e-direitos-do-titular.md). Este documento é o raciocínio: o que proteger, de quem, e como cada ameaça é tratada.

## 1. Inventário de dados (o que existe e onde)

| Dado | Categoria | Onde fica | Retenção |
|---|---|---|---|
| Nome, e-mail, foto (Google) | Pessoal (identificação) | D1 `user` | Até excluir a conta |
| Vínculo com o Google (`providerId`, `accountId`) | Pessoal | D1 `account` | Até excluir a conta |
| ~~Tokens OAuth do Google~~ | Credencial de terceiro | **Não guardados** (hook + migração 0002) | — |
| Sessões (data, user agent, IP) | Pessoal (técnico) | D1 `session` | 60 dias (expiração) ou exclusão |
| Fichas, treinos, séries, cargas | Pessoal; **potencialmente sensível** (saúde) | Aparelho (SQLite) + Durable Object do usuário | Até excluir a conta |
| Exercícios personalizados | Pessoal | Idem | Até excluir a conta |
| `deviceId` (aleatório) | Técnico | Aparelho + nos eventos | Junto com os eventos |
| Catálogo de exercícios | Público, não pessoal | Asset estático | — |
| Perfil de treino enviado à IA (ADR-0015) | Pessoal; limitações podem ser **saúde** | Trânsito para a Anthropic (operadora); **não guardado** pelo app | Só durante a requisição |

**Sobre "saúde":** carga e repetições não são, por si, dado de saúde, mas, com histórico, permitem inferências sobre condição física. **Tratamos como sensível** (art. 11) por precaução, e a arquitetura já favorece isso: isolamento por usuário, sem terceiros e com eliminação total.

## 2. Modelo de ameaças (STRIDE)

Fronteiras de confiança: **aparelho ↔ Worker** (internet) e **Worker ↔ Google** (OAuth). O Worker, o D1 e os DOs estão na mesma conta Cloudflare.

| Ameaça | Exemplo no gym.app | Mitigação | Estado |
|---|---|---|---|
| **S**poofing (falsificar identidade) | Alguém se passa por outro usuário na API | Sessão Better Auth validada em **toda** rota de dados; o `userId` vem da sessão, **nunca** do cliente | ✅ |
| **T**ampering (adulterar) | Evento malformado ou gigante corrompe o log | Contratos zod na borda; payload ≤ 16 KB; corpo ≤ 1 MB; eventos inválidos viram no-op no reducer (P8) | ✅ |
| | Adulteração em trânsito | HTTPS obrigatório (workers.dev) + HSTS | ✅ |
| **R**epudiation (negar autoria) | "Eu não registrei esta série" | Log append-only com `deviceId`, `ocorridoEm` e `recebidoEm` | ✅ (suficiente para uso pessoal) |
| **I**nformation disclosure (vazamento) | Usuário A lê dados de B | **Isolamento por topologia**: cada usuário tem seu DO (`idFromName`), sem consulta compartilhada | ✅ |
| | Tokens do Google vazam do D1 | **Não guardamos** os tokens | ✅ |
| | Respostas com dados pessoais em caches | `Cache-Control: no-store` em `/api/*` | ✅ |
| | Clickjacking / sniffing | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` | ✅ |
| | XSS injetando script | React escapa saída; **CSP pendente** (estilos inline do Expo web) | ⚠️ |
| | Celular perdido | Sessão no SecureStore (cofre do SO); dados locais protegidos pelo bloqueio do aparelho | ⚠️ aceito |
| **D**enial of service | Cliente em laço inunda o sync | Rate limit por usuário (120/min no sync, 10/min na conta), limites de tamanho, plano Cloudflare | ✅ (aproximado) |
| **E**levation of privilege | Rota administrativa exposta | Não existe rota administrativa; migrações só pela CI (token com privilégio mínimo) | ✅ |
| Cadeia de suprimentos | Dependência comprometida | Lockfile congelado, `pnpm audit` na CI (alta/crítica), `allowBuilds` explícito no pnpm | ✅ |

## 3. LGPD: aplicabilidade e direitos

**Aplicabilidade (nota de arquiteto, não parecer jurídico):** o art. 4º, I exclui da LGPD o tratamento "realizado por pessoa natural para fins exclusivamente particulares e não econômicos". O uso atual (dono + família, sem fins comerciais) **provavelmente se enquadra**. Mesmo assim, **implementamos como se a lei se aplicasse**, porque:

1. o app pode virar produto (Fase 0), e retrofit de privacidade é caro;
2. *privacy by design* é mais barato no início (art. 46, §2º);
3. é o objetivo de estudo deste projeto.

| Direito (art. 18) | Implementação |
|---|---|
| Confirmação e **acesso** (I, II) | Exportação completa (`GET /api/conta/exportar`) |
| **Portabilidade** (V) | A mesma exportação em JSON legível; o log de eventos É o dado (ADR-0006) |
| **Eliminação** (VI) | `DELETE /api/conta`: DOs de todas as épocas + `session`, `account`, `user` no D1; e o banco local |
| Informação sobre compartilhamento (VII) | Política de privacidade no app: nenhum compartilhamento; Google só autentica; Cloudflare é operadora |
| Correção (III) | Fichas e exercícios editáveis; sessões imutáveis por decisão de produto (ADR-0012), com descarte enquanto em andamento |

| Princípio (art. 6) | Como aparece na arquitetura |
|---|---|
| Finalidade / adequação | Dados usados só para treino, sync e sugestões |
| **Necessidade (minimização)** | Sem tokens OAuth; escopos mínimos (`openid email profile`); sem analytics; bancos de teste antigos apagados |
| Livre acesso / transparência | Exportação + política em linguagem simples |
| Segurança / prevenção | Seção 2 |

**Transferência internacional (art. 33):** D1 e DOs podem estar fora do Brasil. A Cloudflare atua como **operadora**, com cláusulas contratuais padrão no DPA dela. Está declarado na política.

## 4. Riscos aceitos e pendências

| Item | Por que aceito agora | Gatilho para resolver |
|---|---|---|
| CSP ausente na web | Expo web injeta estilos inline; CSP com nonce exige configuração própria | Antes de qualquer distribuição pública |
| Rate limit aproximado (por localidade) | Proteção contra laço/abuso, não cota de cobrança | Se houver cobrança por uso |
| Vulnerabilidade moderada em `minimatch` (via `@expo/fingerprint`, ferramenta de build) | Não vai para o app em produção | Atualização do Expo |
| Dados locais não criptografados à parte | Protegidos pelo sandbox do app e pelo bloqueio do aparelho | Se houver dado de saúde explícito (medidas, fotos) |
| Exclusão não alcança outros aparelhos offline | O aparelho guarda sua cópia até sincronizar; o servidor responde 401 depois da exclusão | Mecanismo de "tombstone" quando houver mais usuários |
