# ADR-0011: Fonte do conteúdo do catálogo — ExerciseGymGifsDB, só para uso pessoal, referenciado e não redistribuído

- **Status:** Aceito
- **Data:** 2026-11-18
- **Fase:** 3
- **Relacionado:** [ADR-0010](0010-midias-do-catalogo-como-assets-estaticos.md)

## Contexto

O catálogo precisa de exercícios com metadados (grupo muscular, equipamento, categoria) e animações de execução. O dono do produto encontrou o repositório [JahelCuadrado/ExerciseGymGifsDB](https://github.com/JahelCuadrado/ExerciseGymGifsDB): 1.323 exercícios, 19 grupos musculares, nomes e instruções em português e espanhol, com GIFs.

Avaliação do repositório (2026-11-18):

- **Sem licença declarada** (sem LICENSE e sem campo `license`). O padrão legal é "todos os direitos reservados".
- O README declara que os GIFs foram **"extraídos de Internet"**, que **"pertencem a seus respectivos autores"**, e que o mantenedor não detém nem pode conceder direitos.
- Último commit em jul/2026, justamente a adição desse aviso de isenção.

**Decisão de produto (dono do produto):** o app será, por ora, de **uso pessoal**, sem comercialização.

## Opções consideradas

| Opção | Licença | Avaliação |
|---|---|---|
| **ExerciseGymGifsDB** | Nenhuma; GIFs de terceiros | Melhor conteúdo (animações, PT/ES). Risco jurídico: baixo no uso pessoal, **alto** em qualquer distribuição |
| free-exercise-db (yuhonas) | Domínio público (a confirmar) | Seguro; imagens estáticas (início e fim), sem animação, só em inglês |
| wger | CC-BY-SA, com licença por imagem | Exige atribuição e controle por imagem |
| Produção própria | Nossa | Seguro e com identidade visual, mas exige esforço de produção |

## Decisão

Usar o **ExerciseGymGifsDB** com três salvaguardas:

1. **Não redistribuir.** Os GIFs **não** são copiados para o nosso repositório git nem servidos pelo nosso Worker/CDN. O catálogo guarda apenas **referências** (URL de origem). O app baixa de lá direto para a pasta local do aparelho (mecanismo do ADR-0010 / spike S6) para uso offline.
2. **Fonte isolada atrás de um adaptador.** O domínio conhece um `exercicioId` e uma "mídia do exercício", nunca a origem. Trocar a fonte (free-exercise-db, produção própria) é mudar um adaptador e um mapeamento, não o modelo.
3. **Os metadados são insumo, não cópia cega.** A taxonomia (grupos musculares, equipamentos, categorias) inspira o nosso modelo de Catálogo (01-dominio §2). A `modalidade de registro` é nossa e precisa ser atribuída por exercício.

**Isto altera o ADR-0010 só para o conteúdo de terceiros.** O mecanismo de download explícito continua o mesmo. Static Assets continuam valendo para conteúdo **próprio** (como a animação de teste do spike).

## Consequências

- ✅ Catálogo rico desde o início, com animações e nomes em português.
- ✅ Nada de terceiros no nosso repositório ou na nossa CDN: o repositório pode ficar público no GitHub sem expor esse conteúdo.
- ⚠️ **Dependência de disponibilidade externa:** se o repositório de origem sair do ar ou mudar caminhos, mídias **ainda não baixadas** ficam indisponíveis (as já baixadas continuam no aparelho). Aceitável para uso pessoal.
- ⚠️ **Risco jurídico residual aceito pelo dono do produto**, restrito ao uso pessoal.
- 🔁 **Gatilhos de revisão obrigatória:** distribuir o app a outras pessoas além do dono; qualquer forma de comercialização; publicação em loja; o repositório de origem receber uma licença (reavaliar) ou ser removido. Em qualquer desses casos, **substituir a fonte** antes de seguir.
