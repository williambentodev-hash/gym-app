# ADR-0016: IA gratuita (Workers AI) com provedor por configuração, crítico determinístico e avaliação

- **Status:** Aceito
- **Data:** 2026-11-19
- **Fase:** 6
- **Altera:** [ADR-0015](0015-ia-especialista-em-treino.md) (o provedor padrão deixa de ser o Claude)

## Contexto

O dono do produto tem assinatura **Claude Pro**, que é de uso pessoal e **não** dá acesso à API. A API da Anthropic exige uma conta e créditos à parte. Ele optou por **IA gratuita**. O princípio do ADR-0015 ("a IA propõe, o domínio decide") continua valendo.

Pesquisa na documentação do Workers AI (2026-11-19):
- franquia gratuita de **10.000 neurônios/dia** no plano Free;
- *JSON mode* documentado só para alguns modelos; o melhor de propósito geral é **`@cf/meta/llama-3.3-70b-instruct-fp8-fast`** (24k tokens de contexto);
- a Cloudflare **não garante** o schema e **não documenta** `enum`.

## Decisão

1. **Provedor escolhido por configuração:** com `ANTHROPIC_API_KEY`, Claude Opus 5.5 (ADR-0015); sem ela, **Workers AI** (padrão). O núcleo (formato, normalização, análise, crítica) é comum aos dois.
2. **Três mecanismos para compensar o modelo mais fraco**, cada um justificado por uma avaliação:
   - **Códigos curtos** (`E001`…) no lugar dos IDs do catálogo, convertidos de volta no servidor. O modelo inventava IDs plausíveis a partir do nome (`glutes/barbell-stiff`).
   - **Crítico determinístico** (`problemasDaProposta`): volume mínimo e máximo por objetivo e nível, frequência ≥ 2x por semana para hipertrofia e força, treinos ≤ dias, ordem composto → isolado, tempo e limitações. Com problemas, há **uma rodada de reparo** com a lista exata, e fica a versão com menos problemas.
   - **Rede de segurança para limitações:** palavras como ombro, joelho, lombar e punho mapeiam para padrões de exercícios de risco, sem depender da IA.
3. **O que sobra de problema vira aviso explícito na prévia.** O usuário decide com informação, e a ficha continua editável.
4. **Orçamento:** no máximo 2 chamadas por ficha (~1.000 neurônios), ou seja, ~9 fichas/dia na franquia gratuita, somando todos os usuários. Ao estourar, a resposta é "limite de hoje atingido".
5. **Avaliação versionada** (`apps/api/scripts/avaliar-ia.ts`): perfis variados × critérios objetivos, rodando **o mesmo código de produção**.

## Resultados da avaliação (mesmos 5 perfis)

| | Antes (só prompt) | Depois (códigos + crítico + reparo) |
|---|---|---|
| Critérios atendidos | 33/41 (80%) | **35/41 (85%)** |
| Exercícios inventados | 2 perfis | 0 |
| Limitação no ombro respeitada | não | sim |
| Tempo por geração | 35–166 s | 68–148 s |

Falhas restantes: o modelo perde a mão ao equilibrar várias restrições (ex.: tirou todo o peito para evitar o ombro; 6 treinos para 5 dias, regra adicionada ao crítico depois da medição). **Uma falha da 1ª rodada era do critério, não da IA** (pular corda em casa), e o critério foi corrigido.

## Consequências

- ✅ Custo zero, sem cartão, e o princípio de segurança do ADR-0015 continua intacto.
- ✅ A qualidade passou a ser **medida**, e cada mudança de prompt ou mecanismo pode ser comparada.
- ✅ Migrar para o Claude é configuração (gravar a chave), não código.
- ⚠️ Qualidade inferior à esperada do Opus em casos com várias restrições; mitigada pelos avisos.
- ⚠️ Geração lenta (1–3 min) e franquia diária compartilhada (~9 fichas/dia).
- ⚠️ **Risco a observar:** o limite de CPU do plano Free (o tempo esperando a IA não conta, mas parsing, validação e crítica contam). Se aparecer "exceeded CPU" nos logs, otimizar (ex.: pré-calcular o JSON Schema) ou migrar para o plano pago.
- 🔁 **Gatilhos de revisão:** avaliação abaixo de 80%; uso acima da franquia; novo modelo com JSON mode no Workers AI (rodar a avaliação para comparar); decisão de usar a API do Claude.
