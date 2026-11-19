# ADR-0002: Go como linguagem do backend

- **Status:** Substituído por [ADR-0004](0004-typescript-como-linguagem-do-backend.md)
- **Data:** 2026-11-18
- **Fase:** 0

## Contexto

Precisamos de uma linguagem para o backend. Drivers, em ordem de peso:

1. **Aprendizado** — o projeto é laboratório; curiosidade pela linguagem é um driver legítimo e declarado.
2. **Custo operacional** — rodar barato (free tier) favorece binários pequenos, cold start rápido e baixo consumo de memória.
3. **Potencial de produto** — ecossistema maduro para APIs, observabilidade e cloud.

## Opções consideradas

1. **Go** — binário estático, cold start baixíssimo (ótimo para serverless), concorrência nativa, ecossistema cloud-native forte (OpenTelemetry, AWS SDK). Contra: menos "framework pronto"; DDD tático exige adaptar padrões a um estilo mais procedural/explícito; curva inicial.
2. **Node/TypeScript** — mesma linguagem do frontend, produtividade alta. Contra: menor ganho de aprendizado; runtime mais pesado.
3. **Java/.NET** — muito maduros para DDD. Contra: cold start/memória mais caros em serverless; menos novidade.

## Decisão

Backend em **Go**.

## Consequências

- ✅ Baixo custo de execução; casa bem com Lambda ou containers pequenos.
- ✅ Estudar como padrões (hexagonal, DDD) se traduzem para uma linguagem sem herança e com interfaces implícitas.
- ⚠️ Duas linguagens no projeto (Go + TypeScript/Dart no front) → contratos de API precisam ser a fonte da verdade (OpenAPI + geração de código).
- ⚠️ Curva de aprendizado vai desacelerar as primeiras fases — aceito.
- 🔁 Revisar se a produtividade travar a entrega de forma persistente.
