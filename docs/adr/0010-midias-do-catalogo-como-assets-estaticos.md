# ADR-0010: Mídias do catálogo como assets estáticos do Worker, com download explícito para offline

- **Status:** Aceito
- **Data:** 2026-11-18
- **Fase:** 3
- **Altera:** [ADR-0005](0005-cloudflare-como-plataforma-de-nuvem.md) e [ADR-0006](0006-estrategia-de-sincronizacao-offline.md) no ponto "animações no R2"

## Contexto

- As animações de execução precisam estar disponíveis **offline** para os exercícios das fichas ativas (QA-1).
- **Custo zero** e, por decisão do dono do produto, **nenhum cadastro de meio de pagamento**. A ativação do R2 exige cartão, mesmo dentro da faixa gratuita (a confirmar no painel; de qualquer forma, é atrito desnecessário).
- O catálogo é **curado pela equipe**, muda pouco e é igual para todos os usuários.

## Opções consideradas

**Onde hospedar:**

| Opção | Prós | Contras |
|---|---|---|
| R2 | Feito para objetos; uploads dinâmicos | Exige cartão para ativar; mais uma peça de infraestrutura |
| **Workers Static Assets** | Gratuito, sem cartão; CDN; requisições a assets **não executam o Worker** (não consomem a cota); versionado junto com o deploy | Limites por arquivo (25 MB) e por quantidade (~20 mil); conteúdo muda só com deploy |

**Como garantir offline no app:**

| Opção | Prós | Contras |
|---|---|---|
| Cache de disco do `expo-image` | Zero código | **Melhor esforço:** LRU de 250 MB no Android, e o sistema pode limpar a pasta de cache. Não há garantia |
| **Download explícito para `Paths.document`** | Pasta que o sistema não apaga; controle de quais mídias manter (fichas ativas); falha visível | Código próprio (pequeno) |

## Decisão

1. **Mídias do catálogo servidas como Static Assets do Worker**, em `apps/api/public/media/`.
2. **O nome do arquivo carrega a versão** (`agachamento-livre.v1.gif`) e é servido com `Cache-Control: immutable`. Uma animação nova significa um nome novo. Isso simplifica o cache em todos os níveis: CDN, navegador e app, onde "o arquivo existe" significa "o arquivo está correto".
3. **No app, as mídias das fichas ativas são baixadas explicitamente** para `Paths.document/midias`, num arquivo `.part` que só é renomeado no fim, de modo que um download interrompido nunca parece completo. O cache do `expo-image` fica desligado para essas mídias.
4. **Na web**, onde o `expo-file-system` não existe, vale o cache HTTP do navegador com `immutable`. Isso é aceitável porque a web é secundária e costuma estar online (ADR-0007).
5. **O R2 fica reservado para conteúdo gerado pelo usuário** (ex.: a foto do prato, depois do MVP), quando houver necessidade de upload dinâmico.

## Consequências

- ✅ Custo zero sem cartão; mídias pela CDN sem consumir a cota de requisições do Worker.
- ✅ Garantia de offline explícita e testável, em vez de depender do comportamento de um cache.
- ✅ Catálogo e mídias evoluem juntos, versionados no git e no deploy.
- ⚠️ Mídias ficam no repositório git. Com ~300 exercícios × ~100–300 KB ≈ 30–90 MB, isso é aceitável. Acima disso, avaliar Git LFS ou voltar ao R2.
- ⚠️ É preciso **política de limpeza**: apagar mídias de exercícios que saíram de todas as fichas ativas. Fica para a implementação real.
- ⚠️ **Formato:** o spike usa GIF (gerado por nós). Para o conteúdo real, comparar **WebP animado** (o `expo-image` suporta) e MP4 em loop. O pipeline (download → arquivo local → exibição) é o mesmo.
- ⚠️ **Licença do conteúdo** continua em aberto: fonte licenciada ou produção própria (ADR futuro).
- 🔁 **Gatilhos de revisão:** catálogo acima de ~100 MB; necessidade de atualizar mídias sem deploy; upload de mídia pelo usuário.
