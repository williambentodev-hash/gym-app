# ADR-0005: Cloudflare (Workers) como plataforma de nuvem

- **Status:** Aceito
- **Data:** 2026-11-18
- **Fase:** 0
- **Substitui:** [ADR-0003](0003-aws-como-provedor-de-nuvem.md)
- **Relacionado:** [ADR-0004](0004-typescript-como-linguagem-do-backend.md) (decisões acopladas)

## Contexto

Restrição principal: custo próximo de zero enquanto o projeto é laboratório, sem impedir que vire produto real. O plano gratuito da AWS (ADR-0003) é baseado em **créditos com prazo** (~6 meses); o da Cloudflare **não expira**.

Ofertas relevantes da Cloudflare (valores aproximados — confirmar na documentação oficial, mudam com frequência):

| Necessidade | Serviço | Free tier aproximado |
|---|---|---|
| Computação | Workers | ~100 mil req/dia, ~10 ms de CPU por requisição |
| Relacional | D1 (SQLite) | ~5 GB total |
| Chave-valor | KV | leituras generosas, escritas limitadas |
| Objetos/arquivos | R2 | ~10 GB, sem custo de egress |
| Filas | Queues | — |
| Estado coordenado | Durable Objects | backend SQLite disponível no free |
| Web estático | Workers static assets / Pages | — |

Plano pago (Workers Paid): ~US$ 5/mês, eleva limites e libera Containers.

## Opções consideradas

1. **AWS** (ADR-0003) — catálogo amplo, Go nativo; créditos expiram.
2. **Híbrido** (Cloudflare na borda + AWS no backend) — bom equilíbrio, mais complexidade operacional.
3. **Cloudflare full-stack** — free tier permanente, modelo de borda global, plataforma coesa; ecossistema menor e mais proprietário.

## Decisão

**Cloudflare full-stack**: Workers para a API, assets estáticos para o frontend web, e serviços de dados da própria plataforma (escolha específica entre D1, KV e Durable Objects fica para a Fase 2).

Guarda-corpos:

- Ficar no plano gratuito até haver usuários reais; o plano de US$ 5 é o primeiro degrau previsto.
- Infraestrutura declarada em código (`wrangler` config; avaliar Terraform em ADR futuro).
- Domínio isolado de APIs da plataforma (portas e adaptadores): D1, KV, R2 etc. acessados apenas via adaptadores.

## Consequências

- ✅ Custo zero sem prazo; latência baixa global; sem servidores ou VPC para gerenciar (e sem armadilhas tipo NAT Gateway).
- ⚠️ **Não há serviço de identidade de usuário final** (Cloudflare Access é para acesso corporativo, não para clientes). Autenticação exigirá ADR próprio: provedor externo (Clerk, Auth0, Supabase Auth…) vs. implementação própria.
- ⚠️ **D1 é SQLite**: um banco por instância com limite de tamanho, escrita serializada. Isso pode influenciar o modelo de dados (ex.: banco por usuário/tenant é um padrão viável aqui) — tema da Fase 2/4.
- ⚠️ Limites de CPU por requisição restringem processamento pesado → tarefas assíncronas via Queues.
- ⚠️ Lock-in: APIs proprietárias (o runtime `workerd` é open source, mas D1/KV/DO não têm equivalentes diretos fora da Cloudflare). Mitigado pelos adaptadores.
- ⚠️ Menor valor de mercado do aprendizado comparado à AWS — aceito.
- 🔁 Revisar ao estourar limites do plano pago, ou se um requisito exigir algo que a plataforma não oferece (ex.: banco relacional grande e compartilhado, cargas longas de CPU).
