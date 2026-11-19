# ADR-0001: Registrar decisões arquiteturais com ADRs

- **Status:** Aceito
- **Data:** 2026-11-18
- **Fase:** 0

## Contexto

O projeto tem dois objetivos: virar um produto real e servir de laboratório de estudo de arquitetura. Decisões tomadas sem registro perdem o contexto em semanas — e o contexto é justamente o que se quer estudar.

## Opções consideradas

1. **Sem registro formal** — rápido, mas o raciocínio se perde.
2. **Wiki/Confluence externo** — rico, mas descola da evolução do código.
3. **ADRs em Markdown no repositório** (formato Nygard, adaptado) — versionados junto ao código, revisáveis em PR.

## Decisão

Usar ADRs em `docs/adr/`, numerados sequencialmente, imutáveis após aceitos (mudanças geram um novo ADR que *substitui* o anterior).

## Consequências

- ✅ Histórico auditável do raciocínio; material de estudo em si.
- ⚠️ Disciplina: decisão relevante sem ADR é dívida.
- 🔁 Revisar o template se ficar burocrático demais.
