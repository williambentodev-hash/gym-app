# Forja

Aplicativo de treino e dieta (web + mobile), construído também como laboratório de arquitetura de soluções.

## Estrutura

```
docs/
  adr/            Architecture Decision Records — o "porquê" de cada decisão
  architecture/   Visão, requisitos, atributos de qualidade, diagramas C4
```

## Roteiro

| Fase | Tema | Status |
|---|---|---|
| 0 | Descoberta: visão, requisitos, atributos de qualidade | ✅ [visão](docs/architecture/00-visao-do-produto.md) |
| 1 | Domínio: bounded contexts, event storming | ✅ [domínio](docs/architecture/01-dominio.md) |
| 2 | Visão arquitetural: estilo, C4, ADRs | ✅ [visão arquitetural](docs/architecture/02-visao-arquitetural.md) |
| 3 | Spike técnico + walking skeleton: repo, CI/CD, IaC | ✅ [spike + walking skeleton](docs/architecture/03-spike.md) |
| 4 | Modelagem: DDD tático, dados, APIs + telas | ✅ [eventos](docs/architecture/04-modelo-de-eventos.md) · [interface](docs/architecture/05-interface.md) |
| 5 | Segurança e LGPD | ✅ [segurança e LGPD](docs/architecture/06-seguranca-lgpd.md) |
| 6 | Features incrementais | ⚪ |
| 7 | Operação: observabilidade, SLOs, resiliência | ⚪ |
| 8 | Evolução: eventos, extração de serviços, offline, integrações, IA | ⚪ |

## Stack atual

- **Backend:** TypeScript no Cloudflare Workers ([ADR-0004](docs/adr/0004-typescript-como-linguagem-do-backend.md), [ADR-0005](docs/adr/0005-cloudflare-como-plataforma-de-nuvem.md))
- **Clientes:** Expo — Android (APK, sem loja) + web/PWA ([ADR-0007](docs/adr/0007-frontend-expo-universal.md))
- **Sincronização:** local-first, log de eventos por usuário em Durable Objects ([ADR-0006](docs/adr/0006-estrategia-de-sincronizacao-offline.md))
- **Autenticação:** Better Auth + Google ([ADR-0008](docs/adr/0008-autenticacao.md))

## Decisões registradas

| ADR | Decisão | Status |
|---|---|---|
| [0001](docs/adr/0001-registrar-decisoes-com-adr.md) | Registrar decisões com ADRs | Aceito |
| [0002](docs/adr/0002-go-como-linguagem-do-backend.md) | Go no backend | Substituído por 0004 |
| [0003](docs/adr/0003-aws-como-provedor-de-nuvem.md) | AWS como nuvem | Substituído por 0005 |
| [0004](docs/adr/0004-typescript-como-linguagem-do-backend.md) | TypeScript no backend | Aceito |
| [0005](docs/adr/0005-cloudflare-como-plataforma-de-nuvem.md) | Cloudflare como plataforma | Aceito |
| [0006](docs/adr/0006-estrategia-de-sincronizacao-offline.md) | Sincronização local-first com log de eventos por usuário | Aceito |
| [0007](docs/adr/0007-frontend-expo-universal.md) | Frontend universal com Expo (iOS, Android, web); distribuição sem lojas | Aceito |
| [0008](docs/adr/0008-autenticacao.md) | Autenticação: Better Auth no Worker + login Google | Aceito |
| [0009](docs/adr/0009-estrutura-do-monorepo.md) | Monorepo pnpm + Turborepo, fronteiras verificadas com dependency-cruiser | Aceito |
| [0010](docs/adr/0010-midias-do-catalogo-como-assets-estaticos.md) | Mídias do catálogo como Static Assets + download explícito para offline | Aceito |
| [0011](docs/adr/0011-fonte-do-conteudo-do-catalogo.md) | Fonte do catálogo: ExerciseGymGifsDB, uso pessoal, referenciado (não redistribuído) | Aceito |
| [0012](docs/adr/0012-catalogo-de-eventos-v1.md) | Catálogo de eventos de domínio v1 (drop = série própria; época v1 do log) | Aceito |
| [0013](docs/adr/0013-catalogo-curado-como-snapshot-estatico.md) | Catálogo curado (100 exercícios em PT) como snapshot estático versionado | Aceito |
| [0014](docs/adr/0014-seguranca-e-direitos-do-titular.md) | Segurança e direitos do titular (exportar, excluir, minimização, limites) | Aceito |
| [0015](docs/adr/0015-ia-especialista-em-treino.md) | IA especialista em treino (Claude Opus 5.5): a IA propõe, o domínio decide | Aceito (provedor alterado pelo 0016) |
| [0016](docs/adr/0016-ia-gratuita-workers-ai.md) | IA gratuita (Workers AI) com provedor por configuração, crítico determinístico e avaliação | Aceito |
| [0017](docs/adr/0017-nome-e-marca-forja.md) | Nome e marca "Forja", com os identificadores técnicos preservados | Aceito |
