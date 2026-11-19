# ADR-0013: Catálogo curado de 100 exercícios, publicado como snapshot estático versionado

- **Status:** Aceito
- **Data:** 2026-11-19
- **Fase:** 4
- **Relacionado:** [ADR-0006](0006-estrategia-de-sincronizacao-offline.md), [ADR-0010](0010-midias-do-catalogo-como-assets-estaticos.md), [ADR-0011](0011-fonte-do-conteudo-do-catalogo.md)

## Contexto

- A origem (ExerciseGymGifsDB, ADR-0011) tem 1.323 exercícios com nomes em **espanhol e inglês**, e não em português como havia sido informado inicialmente (correção registrada).
- O dono do produto quer **tudo em português** e **só os ~100 exercícios mais comuns** em treinos.
- O domínio precisa de dados que a origem não tem: **modalidade de registro** (01-dominio §2) e **composto/isolado** (incremento de carga e descanso da Orientação).
- O ADR-0006 previa o catálogo como snapshot com origem no D1.

## Opções consideradas

| Tema | Opções | Escolha |
|---|---|---|
| Escopo | 1.323 exercícios · **100 curados** | 100: cobrem os padrões clássicos (empurrar, puxar, agachar, levantar, core, cardio) com qualidade de produto |
| Nomes em português | Tradução por glossário automático · **Curadoria manual** | Manual: com 100 itens é viável e evita traduções estranhas ("press con barra, tumbado" → "Supino reto com barra") |
| Modalidade e composto | Heurística por categoria/equipamento · **Definição manual** | Manual, na mesma curadoria |
| Armazenamento | Tabela no D1 · **JSON estático versionado** | Estático: o catálogo é o mesmo para todos, muda raramente e o app precisa dele offline. Um arquivo servido pela CDN é mais simples, mais barato e fica em cache. O D1 seria só mais uma peça |
| Mídias | URL `@main` da origem · **URL fixada num commit** | Commit fixo (`f6d16e9`): imutável, e uma mudança na origem não altera o nosso app sem uma decisão |
| Instruções de execução | Copiar da origem · **Não copiar** | Não copiar: são texto de terceiros (ADR-0011). No MVP mostramos nome e animação |

## Decisão

1. A **curadoria** fica em `scripts/catalogo/curadoria.ts`: para cada exercício, o ID estável da origem, o nome em português, a modalidade, composto/isolado, os grupos musculares e o equipamento. É **código revisável em PR**.
2. O **gerador** `scripts/catalogo/gerar.ts` cruza a curadoria com a origem fixada num commit. Ele **falha** se algum ID não existir ou se houver ID ou nome duplicado, e grava `apps/api/public/catalogo/catalogo.v1.json`.
3. O arquivo gerado é **commitado** e servido pelo Worker como asset estático (ADR-0010), validado pelo contrato `Catalogo` de `@gym/contracts`, com teste na CI.
4. O app baixa o catálogo, guarda localmente e só baixa de novo quando a `versao` muda.
5. Os eventos referenciam exercícios **pelo ID da origem** (ex.: `pectorals/barbell-bench-press`). Esse ID passa a fazer parte do contrato: **nunca** remover nem reaproveitar um ID publicado. Exercícios saem do catálogo apenas como "descontinuados", e sessões antigas precisam continuar legíveis.

Este ADR **substitui** a menção ao D1 como origem do catálogo no ADR-0006 e na visão arquitetural.

## Consequências

- ✅ Catálogo em português, revisado, com os dados de que o domínio precisa.
- ✅ Nenhum texto ou mídia de terceiros no nosso repositório: só IDs e URLs de referência.
- ✅ Um asset estático a menos para operar do que uma tabela no D1, e offline por construção.
- ⚠️ Ampliar o catálogo é trabalho manual (curadoria). Aceitável: os exercícios personalizados (eventos `ExercicioPersonalizado*`) cobrem o que faltar.
- ⚠️ Os GIFs têm ~300 KB cada. Converter para formatos mais leves fica para quando houver conteúdo próprio (ADR-0010).
- 🔁 **Gatilhos de revisão:** necessidade de mais de ~200 exercícios; troca de fonte (gatilhos do ADR-0011); necessidade de instruções de execução (produção própria).
