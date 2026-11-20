# ADR-0015: IA especialista em treino — a IA propõe, o domínio decide

- **Status:** Aceito
- **Data:** 2026-11-19
- **Fase:** 6 (evolução do produto)
- **Relacionado:** [ADR-0006](0006-estrategia-de-sincronizacao-offline.md), [ADR-0013](0013-catalogo-curado-como-snapshot-estatico.md), [ADR-0014](0014-seguranca-e-direitos-do-titular.md), [01-dominio.md §5](../architecture/01-dominio.md)

## Contexto

Usando o app, o dono do produto sentiu falta de ajuda para **montar a ficha**, e pediu que a IA seja **uma especialista em treino**. As regras determinísticas da Orientação (01-dominio §5) cobrem a *execução* (carga, descanso, volume), mas não o *planejamento* (divisão, escolha e ordem de exercícios, prescrição por objetivo e nível).

Forças em jogo:
- **Custo zero** como diretriz até aqui (ADR-0005), mas com abertura do dono do produto a um gasto pequeno e controlado.
- **Integridade dos dados:** os eventos são contratos permanentes (ADR-0006/0012). Nada pode entrar no log sem passar pelas invariantes.
- **Privacidade** (ADR-0014): até aqui, nenhum terceiro além do Google tinha acesso a dados.
- **Offline** (QA-1): o treino na academia não pode depender de rede.

## Opções consideradas

| Tema | Opções | Escolha |
|---|---|---|
| Modelo | Claude Opus 5.5 · Claude Haiku 5.5 · Workers AI (modelos abertos, grátis) | **Claude Opus 5.5**: um plano de treino ruim prejudica o resultado; o custo estimado é de centavos por mês |
| Papel da IA | Escrever no log · **Propor e o usuário aceitar** | Propor: a IA nunca grava; a ficha aceita entra pelos **mesmos comandos** de uma ficha manual |
| Formato da resposta | Texto livre + parsing · **Structured outputs (zod)** | Structured outputs com **enum dos 100 IDs do catálogo**: é impossível citar um exercício inexistente |
| Onde roda | No app · **No Worker** | Worker: a chave da API é um segredo do servidor e nunca vai para o APK |

## Decisão

1. **Fluxo:** perfil (objetivo, nível, dias, minutos, local, prioridades, limitações opcionais) → `POST /api/ia/sugerir-ficha` → Claude Opus 5.5 (`effort: high`, structured outputs) → **normalização e análise determinísticas** no Worker → prévia no app → o usuário aceita → **comandos do domínio encadeados** (`criarFicha`, `adicionarTreino`, `adicionarItem`).
2. **Especialista por prompt de sistema** alinhado às regras do app: divisão pelos dias, frequência ≥ 2x por grupo, volume de 10–20 séries com contagem fracionada, ordem compostos → isolados, faixas de repetições, RIR e descanso por objetivo, técnicas avançadas só para avançados, respeito a equipamentos e limitações, sem diagnóstico.
3. **"Confie, mas verifique":** a resposta passa por limites de valores, pela compatibilidade técnica × modalidade (`prescricaoCompativel`) e pela **análise da Orientação** (volume semanal por grupo e tempo estimado por treino), exibida na prévia como "calculado pelas regras do app, não pela IA".
4. **Robustez:** fallback do servidor em caso de recusa (`fallbacks: "default"`); tratamento explícito de `refusal`, `max_tokens` e erros tipados do SDK.
5. **Custo sob controle:** prompt + catálogo em **cache de prompt**; rate limit por usuário (3/min); **teto de gasto mensal** no painel da Anthropic; log só de tokens (sem dados pessoais).
6. **Privacidade:** o app envia **só parâmetros de treino**, sem nome, e-mail nem `userId`. As limitações (possível dado de saúde) só vão se o usuário as escrever, com aviso na tela. A Anthropic passa a ser **operadora**, e a política de privacidade foi atualizada.

## Consequências

- ✅ A IA aumenta o produto **sem afrouxar nenhuma garantia**: invariantes, imutabilidade, offline e isolamento continuam valendo.
- ✅ Testável sem custo: o E2E intercepta a rota e verifica prévia, criação e o **conteúdo enviado à IA** (só campos de perfil).
- ⚠️ **Quebra o "custo zero"** de forma controlada (estimativa ≈ US$ 0,10 por ficha gerada, limitada pelo teto mensal).
- ⚠️ **Novo operador de dados** (Anthropic): transferência internacional de dados de treino, declarada na política.
- ⚠️ A qualidade das propostas ainda **não é medida**: falta um conjunto de avaliação (próximo passo, com custo a aprovar).
- 🔁 **Gatilhos de revisão:** custo mensal acima do teto; propostas reprovadas com frequência pela análise; necessidade de a IA *ajustar* uma ficha existente ou analisar o progresso (nova rota, mesmo princípio).
