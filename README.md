# gym.app

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
| 2 | Visão arquitetural: estilo, C4, ADRs | 🟡 em andamento |
| 3 | Walking skeleton: repo, CI/CD, IaC | ⚪ |
| 4 | Modelagem: DDD tático, dados, APIs | ⚪ |
| 5 | Segurança e LGPD | ⚪ |
| 6 | Features incrementais | ⚪ |
| 7 | Operação: observabilidade, SLOs, resiliência | ⚪ |
| 8 | Evolução: eventos, extração de serviços, offline, integrações, IA | ⚪ |

## Stack atual

- **Backend:** TypeScript no Cloudflare Workers ([ADR-0004](docs/adr/0004-typescript-como-linguagem-do-backend.md), [ADR-0005](docs/adr/0005-cloudflare-como-plataforma-de-nuvem.md))
- **Clientes:** web + mobile (tecnologia a decidir na Fase 2)

## Decisões registradas

| ADR | Decisão | Status |
|---|---|---|
| [0001](docs/adr/0001-registrar-decisoes-com-adr.md) | Registrar decisões com ADRs | Aceito |
| [0002](docs/adr/0002-go-como-linguagem-do-backend.md) | Go no backend | Substituído por 0004 |
| [0003](docs/adr/0003-aws-como-provedor-de-nuvem.md) | AWS como nuvem | Substituído por 0005 |
| [0004](docs/adr/0004-typescript-como-linguagem-do-backend.md) | TypeScript no backend | Aceito |
| [0005](docs/adr/0005-cloudflare-como-plataforma-de-nuvem.md) | Cloudflare como plataforma | Aceito |
