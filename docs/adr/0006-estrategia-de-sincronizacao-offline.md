# ADR-0006: Sincronização local-first com log de eventos por usuário

- **Status:** Aceito
- **Data:** 2026-11-18
- **Fase:** 2
- **Relacionado:** [ADR-0005](0005-cloudflare-como-plataforma-de-nuvem.md), [01-dominio.md](../architecture/01-dominio.md)

## Contexto

Drivers vindos das Fases 0 e 1:

- **QA-1 (offline, prioridade alta):** registrar um treino inteiro sem sinal, sem perda nem duplicação.
- **QA-6 (consistência entre dispositivos):** o mesmo usuário em celular e web.
- **QA-3 (custo zero):** dentro do plano gratuito da Cloudflare.
- **Domínio:** um único usuário dono de cada dado (sem colaboração); **sessões encerradas são imutáveis**; os eventos já foram modelados no event storming; as regras de Orientação rodam no cliente.
- **Escala:** 20 usuários. Estimativa: ~4 sessões/semana × ~25 séries × ~2 eventos ≈ **10 mil eventos por usuário por ano**. Isso é trivial para repetir todos os eventos do zero no aparelho.

O problema é que o aparelho precisa ser a fonte primária de escrita, e o servidor precisa ficar consistente com vários aparelhos que escrevem offline.

## Opções consideradas

| # | Opção | Prós | Contras |
|---|---|---|---|
| A | **Sincronização própria: log de eventos por usuário** num Durable Object, com ordem definida pelo servidor e *rebase* no cliente | Nativa na Cloudflare; usa os eventos já modelados; máximo aprendizado; sem dependência de terceiros | Nós mantemos o código; casos de borda (evolução de schema, *rebase*) são nossa responsabilidade |
| B | **LiveStore**: biblioteca de event sourcing com SQLite no cliente e sincronização via Durable Objects (`@livestore/sync-cf`) | Mesmo modelo da opção A, já implementado; integração com Cloudflare e Expo | Ainda antes da 1.0 (0.4.x); API instável; menos aprendizado do mecanismo |
| C | **TinyBase MergeableStore** + Durable Object | Maduro, recomendado no guia local-first da Expo; mesclagem automática célula a célula (*last-writer-wins* com relógio híbrido) | Sincroniza *estado*, não *eventos*: perde a semântica do domínio ("série registrada" vira "célula alterada"); modelo chave-valor tabular |
| D | **PowerSync / Zero** | Os mais maduros para offline em produção | Exigem **Postgres** e um serviço de sincronização externo, o que quebra o ADR-0005 (plataforma e custo) |
| E | **CRDTs de documento** (Automerge, Yjs, Loro) | Mesclagem automática sem servidor | Feitos para colaboração simultânea, como edição de texto. Aqui não há colaboração: é complexidade sem retorno |

## Decisão

**Opção A**, construída **no mesmo modelo da opção B**. Se a manutenção ficar cara, a troca para o LiveStore é uma migração de biblioteca, não de arquitetura.

### Como funciona

```mermaid
sequenceDiagram
    participant UI as App (celular/web)
    participant L as SQLite local
    participant W as Worker (API)
    participant DO as Durable Object do usuário

    UI->>L: comando "registrar série" → evento (id UUIDv7) gravado como PENDENTE
    L-->>UI: estado atualizado na hora (otimista, < 100 ms)
    Note over UI,L: offline: os eventos se acumulam como pendentes
    UI->>W: PUSH [eventos pendentes] + último seq conhecido
    W->>DO: encaminha
    DO->>DO: valida schema; ignora event_id repetido (idempotência); atribui seq
    DO-->>UI: seqs atribuídos + eventos de outros aparelhos desde o último seq
    UI->>L: rebase: estado confirmado + eventos remotos + pendentes reaplicados
```

### Regras do mecanismo

1. **Identificadores gerados no cliente** (UUIDv7). Fichas, sessões e séries nascem offline com ID definitivo.
2. **Um log de eventos por usuário**, num Durable Object com SQLite (`seq` crescente, `event_id` único, tipo, payload, versão de schema, horário do aparelho, horário do servidor). O isolamento por usuário vem da topologia, não de um filtro `WHERE user_id = ?`.
3. **Ordem total definida pelo servidor (`seq`).** **Nunca** ordenar pelo relógio do aparelho, que pode estar errado. O horário do aparelho é dado de domínio ("quando a série aconteceu"), não critério de ordem.
4. **Idempotência:** reenviar o mesmo evento não tem efeito (restrição única em `event_id`). Uma rede instável pode repetir o push sem medo.
5. **Estado = redução dos eventos** por funções puras (*reducers*) no pacote de domínio compartilhado. O mesmo código roda no cliente e no servidor.
6. **Rebase no cliente:** estado confirmado (eventos com `seq`) mais eventos pendentes aplicados por cima. Quando chegam eventos remotos, os pendentes são reaplicados depois deles.
7. **Resolução de conflitos é determinística, pela ordem do servidor:**
   - O mesmo campo alterado em dois aparelhos: **vence o último na ordem do servidor**.
   - Evento sobre uma entidade removida ou arquivada (ex.: `PrescriçãoAlterada` depois de `ItemRemovido`): vira um **no-op**.
   - Evento sobre uma sessão já encerrada: no-op (imutabilidade).
   - Duas sessões em andamento iniciadas offline em aparelhos diferentes: **as duas são mantidas** e a interface alerta. Nenhum dado se perde.
8. **Encerramento por inatividade sem coordenação:** qualquer aparelho que perceber 3 h sem série nova emite `SessãoEncerradaPorInatividade` com `event_id` **derivado do ID da sessão** e horário de fim = última série. Se dois aparelhos emitirem, o segundo é descartado pela idempotência e os dois chegam ao mesmo resultado.
9. **Versionamento de eventos:** eventos são permanentes. Cada um carrega `schemaVersion`, e mudanças de formato são tratadas por *upcasters* (funções que convertem a versão antiga para a nova durante a leitura). **Renomear ou mudar o significado de um evento publicado é proibido.**
10. **Transporte:** HTTP para push e pull no MVP (ao abrir o app, ao voltar para o primeiro plano, depois de cada push). Um WebSocket com a API de hibernação do Durable Object para atualização em tempo real fica como evolução, sem mudar o modelo.

### Fora do log de eventos

- **Catálogo de exercícios:** é global e somente leitura. É distribuído como um *snapshot* versionado (a origem fica em D1, a cópia em cache no cliente). As animações vêm do R2 via CDN, e o app baixa para uso offline as dos exercícios das fichas ativas.
- **Projeções do Progresso:** derivadas dos eventos, no cliente (e opcionalmente no servidor). Sempre descartáveis e recalculáveis.

## Consequências

- ✅ **Offline por construção:** o app nunca espera a rede para gravar.
- ✅ **Auditoria e histórico completos**, de graça: o log é a fonte da verdade.
- ✅ **LGPD:** "excluir todos os meus dados" = apagar o Durable Object do usuário. "Exportar" = devolver o log de eventos.
- ✅ **Custo:** um Durable Object por usuário hiberna quando ocioso; 20 usuários ficam muito abaixo dos limites gratuitos.
- ✅ A imutabilidade das sessões (decisão de produto) elimina conflitos na entidade mais escrita.
- ⚠️ **O schema de eventos é um contrato eterno:** exige disciplina de versionamento desde o primeiro evento.
- ⚠️ **"Vence o último" pode descartar uma edição** de ficha feita em outro aparelho. Aceitável para um único usuário; a interface pode mostrar "esta ficha foi alterada em outro dispositivo".
- ⚠️ **Código de sincronização próprio:** risco de bugs sutis. Mitigação: o mecanismo fica num pacote isolado, com testes de propriedade (gerar sequências aleatórias de eventos e verificar que todos os aparelhos convergem para o mesmo estado).
- ⚠️ **O web também precisa de SQLite no navegador** (WASM + OPFS). Isso restringe a escolha do frontend (próximo ADR).
- 🔁 **Gatilhos de revisão:** o mecanismo consumir mais tempo que as funcionalidades (migrar para o LiveStore se já estiver na 1.0); necessidade de colaboração entre usuários (reavaliar CRDTs); log de um usuário grande o bastante para a repetição ficar lenta (introduzir snapshots).

## Referências

- [LiveStore: guia Cloudflare (Alchemy)](https://alchemy.run/guides/cloudflare-livestore)
- [`@livestore/sync-cf` README](https://cdn.jsdelivr.net/npm/@livestore/sync-cf@0.4.0/README.md)
- [Expo: guia local-first](https://docs.expo.dev/guides/local-first/)
- [Expo + TinyBase com Durable Objects](https://expo.dev/blog/how-to-synchronize-reactive-local-first-apps-with-tinybase)
