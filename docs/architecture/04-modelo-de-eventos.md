# Fase 4 — Modelo de eventos de domínio (v1, aceito no [ADR-0012](../adr/0012-catalogo-de-eventos-v1.md))

> Eventos são **contratos permanentes** ([ADR-0006](../adr/0006-estrategia-de-sincronizacao-offline.md), regra 9): depois de gravados em algum aparelho, não podem ser renomeados nem mudar de significado. Este documento é revisado **antes** de qualquer código. Itens 🔥 aguardam decisão.

## 1. Princípios de desenho

| # | Princípio | Por quê |
|---|---|---|
| P1 | **Um evento é um fato de negócio no passado**, com nome da linguagem ubíqua (`SerieRegistrada`, não `SerieInserida` nem `UpdateSerie`) | Os eventos *são* o modelo (event sourcing): precisam fazer sentido para quem entende de treino |
| P2 | **Toda entidade é referenciada por ID gerado no cliente**, nunca por posição ou índice | Offline e multi-aparelho: "o 3º exercício" muda de significado quando outro aparelho insere um item |
| P3 | **Ordem é um dado explícito** (lista de IDs no evento de reordenação) | Ver §4, decisão D2 |
| P4 | **Alterações substituem o valor inteiro** do objeto de valor (ex.: a prescrição inteira), não campos soltos | Semântica simples de "vence o último" no nível do objeto; nunca uma prescrição "meio de um aparelho, meio do outro". Ver D3 |
| P5 | **O evento carrega o que é necessário para ser interpretado sozinho**, inclusive no futuro | Ex.: `SessaoIniciada` leva o snapshot da prescrição (01-dominio §8), e a série leva a `modalidade` |
| P6 | **Sem dados derivados** (tonelagem, recordes, volume) | São projeções: recalculáveis e mutáveis quando a regra muda. O evento guarda só o fato bruto |
| P7 | **Tipos em português sem acento**, camelCase nos campos, unidades no nome (`cargaKg`, `duracaoSeg`, `distanciaM`) | Código ASCII; a unidade no nome elimina ambiguidade para sempre |
| P8 | **Evento sobre entidade inexistente, removida ou fora de estado é no-op** no reducer, nunca um erro | Eventos chegam fora de ordem entre aparelhos (ADR-0006, regra 7); o reducer precisa ser total |

## 2. Objetos de valor compartilhados

```ts
type Modalidade = 'carga_repeticoes' | 'peso_corporal' | 'tempo' | 'cardio';   // 01-dominio §2
type Tecnica    = 'normal' | 'drop_set' | 'rest_pause';                        // 01-dominio §3
type TipoSerie  = 'aquecimento' | 'trabalho' | 'drop';                          // ADR-0012: drop = série própria

type Prescricao = {
  series: number;                              // ≥ 1
  repeticoes?: { min: number; max: number };   // carga_repeticoes / peso_corporal (ex.: 8–12)
  cargaKg?: number;                            // carga-alvo (opcional: a Orientação sugere)
  duracaoSeg?: number;                         // tempo / cardio
  distanciaM?: number;                         // cardio
  rir?: number;                                // esforço-alvo (0–5)
  descansoSeg?: number;                        // se ausente, padrão da Orientação
  tecnica: Tecnica;
};

// Medidas de uma série realizada: discriminated union pela modalidade.
type Medidas =
  | { modalidade: 'carga_repeticoes'; cargaKg: number; reps: number; rir?: number }
  | { modalidade: 'peso_corporal'; reps: number; cargaAdicionalKg?: number; rir?: number }  // negativa = assistência
  | { modalidade: 'tempo'; duracaoSeg: number; cargaAdicionalKg?: number }
  | { modalidade: 'cardio'; duracaoSeg: number; distanciaM?: number; intensidade?: number };
```

## 3. Catálogo de eventos v1

Todos com `schemaVersion: 1`. O envelope (`eventId`, `deviceId`, `ocorridoEm`, `seq`) já é do contrato de sync e não se repete aqui.

### Catálogo (exercícios personalizados)

| Evento | Payload | Invariantes no reducer |
|---|---|---|
| `ExercicioPersonalizadoCriado` | `exercicioId, nome, modalidade, gruposMusculares[], equipamento?` | id novo |
| `ExercicioPersonalizadoEditado` | `exercicioId, nome, gruposMusculares[], equipamento?` (valor inteiro, P4) | **modalidade não muda** (não está no payload) |
| `ExercicioPersonalizadoArquivado` | `exercicioId` | arquivar ≠ apagar: o histórico continua apontando para ele |

### Planejamento (fichas)

| Evento | Payload |
|---|---|
| `FichaCriada` | `fichaId, nome` |
| `FichaRenomeada` | `fichaId, nome` |
| `FichaAtivada` / `FichaDesativada` | `fichaId` (várias podem estar ativas) |
| `FichaArquivada` | `fichaId` |
| `TreinoAdicionado` | `fichaId, treinoId, nome` (entra no fim da ordem) |
| `TreinoRenomeado` | `fichaId, treinoId, nome` |
| `TreinoRemovido` | `fichaId, treinoId` |
| `TreinosReordenados` | `fichaId, ordem: treinoId[]` |
| `ItemAdicionado` | `fichaId, treinoId, blocoId, itemId, exercicioId, modalidade, prescricao` (bloco novo ou existente: bi-set = bloco com 2+ itens) |
| `PrescricaoAlterada` | `fichaId, itemId, prescricao` (inteira, P4) |
| `ItemRemovido` | `fichaId, itemId` (bloco que fica vazio desaparece) |
| `ItensAgrupados` | `fichaId, treinoId, blocoId, itemIds[]` (move os itens para o bloco: forma bi-set/circuito) |
| `ItemDesagrupado` | `fichaId, itemId, novoBlocoId` |
| `BlocosReordenados` | `fichaId, treinoId, ordem: blocoId[]` |

### Execução (sessões)

| Evento | Payload | Observação |
|---|---|---|
| `SessaoIniciada` | `sessaoId, fichaId, treinoId, snapshot` | `snapshot = { blocos: [{ blocoId, itens: [{ itemId, exercicioId, modalidade, prescricao }] }] }`: cópia da prescrição (01-dominio §8) |
| `SerieRegistrada` | `sessaoId, serieId, itemId, exercicioId, tipo, medidas` | `exercicioId` explícito: pode diferir do snapshot se houve substituição |
| `SerieCorrigida` | `sessaoId, serieId, tipo, medidas` | só com sessão em andamento |
| `SerieRemovida` | `sessaoId, serieId` | só com sessão em andamento |
| `ExercicioSubstituido` | `sessaoId, itemId, exercicioId, modalidade` | aparelho ocupado: troca na hora |
| `ExercicioPulado` | `sessaoId, itemId` | |
| `SugestaoRespondida` | `sessaoId, itemId, sugestao, resposta: 'aceita' \| 'ajustada' \| 'ignorada'` | alimenta a análise da Orientação (fora do MVP, mas o dado já nasce) |
| `SessaoConcluida` | `sessaoId` | |
| `SessaoEncerradaPorInatividade` | `sessaoId, encerradaEm` | `eventId` **derivado** do `sessaoId` (ADR-0006, regra 8); `encerradaEm` = horário da última série |
| `SessaoDescartada` | `sessaoId` | só com sessão em andamento |

**Regra de imutabilidade da sessão** (01-dominio §8), aplicada no reducer: depois de `SessaoConcluida`, `SessaoEncerradaPorInatividade` ou `SessaoDescartada`, **qualquer** evento daquela sessão é no-op (P8).

## 4. Decisões de modelagem

### D1: um log por usuário, com eventos de todos os contextos

**Decisão:** um único log (o UserStore) com eventos de Catálogo, Planejamento e Execução, distinguidos pelo `type`.
**Alternativa:** um log por contexto.
**Por quê:** a ordem total entre contextos importa. Exemplo: `ExercicioPersonalizadoArquivado` antes ou depois de `ItemAdicionado` com aquele exercício muda o resultado. Com um único usuário e o volume do MVP, separar não traz ganho, e os contextos continuam separados **no código** (reducers por pasta, fronteiras R4/R5).

### D2: ordenação por lista explícita de IDs

**Decisão:** `TreinosReordenados { ordem: treinoId[] }` substitui a ordem inteira; item novo entra no fim.
**Alternativa:** *fractional indexing* (cada item com uma posição entre 0 e 1, ex.: "a0", "a0V"). Permite reordenar um item sem tocar nos outros e mescla reordenações concorrentes.
**Por quê:** um usuário raramente reordena a mesma ficha em dois aparelhos ao mesmo tempo, offline. "Vence o último" na lista inteira é previsível. O reducer trata IDs da lista que não existem (ignora) e IDs existentes que faltam na lista (mantém no fim, em ordem estável).
**Gatilho de revisão:** se a reordenação concorrente virar problema real.

### D3: substituição do valor inteiro vs. patch por campo

**Decisão:** `PrescricaoAlterada` carrega a prescrição completa.
**Alternativa:** `PrescricaoAlterada { campo: 'cargaKg', valor: 62.5 }`, com mescla por campo.
**Por quê:** a prescrição é um **objeto de valor**: seus campos têm coerência entre si (técnica × modalidade, faixa de repetições). A mescla por campo pode produzir combinações que nenhum aparelho criou. O custo é perder uma edição concorrente de *outro* campo, aceitável para um único usuário.

### D4: `modalidade` repetida nos eventos

**Decisão:** `ItemAdicionado`, `ExercicioSubstituido` e cada `medidas` carregam a modalidade.
**Por quê:** P5. O reducer da Execução **não pode** depender do Catálogo para interpretar uma série (fronteira R5 e eventos fora de ordem). A redundância é intencional.

### D5: versionamento

- Mudança **compatível** (campo opcional novo): mesma versão; reducers antigos ignoram o campo.
- Mudança **incompatível**: `schemaVersion: 2` e um **upcaster** `v1 → v2` no domínio, aplicado na leitura. O log nunca é reescrito.
- **Proibido:** reutilizar um `type` com outro significado. Se o conceito mudar, nasce um evento novo.

## 5. Decisões de produto (padrão de mercado, ADR-0012)

1. **Drop-set / rest-pause:** cada etapa é uma série própria com `tipo: 'drop'`. Conta no volume e na tonelagem; não conta para recorde nem progressão. (Substitui a ideia de "segmentos" e o trecho correspondente de 01-dominio §3.)
2. **Bi-set:** o app sugere a alternância sem bloquear outra ordem; o descanso só dispara no fim da volta.
3. **`SugestaoRespondida`:** entra no MVP.

## 6. Próximos passos da Fase 4

1. Revisão deste documento → ADR-0012 ("catálogo de eventos v1").
2. Schemas zod dos eventos em `@gym/domain` (validados na borda do Worker e no reducer).
3. Reducers por contexto com testes, incluindo propriedade: eventos embaralhados entre aparelhos sempre resultam em estado válido (P8).
4. Importação do catálogo (ADR-0011): mapear os 1.323 exercícios para o nosso modelo, inclusive a `modalidade`, que não existe na origem.
5. Telas reais com Expo Router: Hoje, Fichas, Execução, Progresso.
