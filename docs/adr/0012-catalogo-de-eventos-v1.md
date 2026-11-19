# ADR-0012: Catálogo de eventos de domínio v1

- **Status:** Aceito
- **Data:** 2026-11-18
- **Fase:** 4
- **Relacionado:** [ADR-0006](0006-estrategia-de-sincronizacao-offline.md), [04-modelo-de-eventos.md](../architecture/04-modelo-de-eventos.md), [01-dominio.md](../architecture/01-dominio.md)

## Contexto

No event sourcing por usuário (ADR-0006), os eventos **são** o banco de dados, e um evento gravado num aparelho é um contrato permanente. O documento [04-modelo-de-eventos.md](../architecture/04-modelo-de-eventos.md) propôs princípios (P1–P8), objetos de valor, 27 eventos e 5 decisões de modelagem (D1–D5). Restavam três decisões de produto, que o dono do produto delegou ao **padrão de mercado** (apps líderes de registro de treino, como Strong e Hevy).

## Decisão

1. **Adotar o catálogo de [04-modelo-de-eventos.md](../architecture/04-modelo-de-eventos.md) como v1**, com os princípios P1–P8 e as decisões D1–D5.
2. **Drop-set e rest-pause (padrão de mercado):** cada etapa é uma **série própria**, com `tipo: 'drop'`. Sai o conceito de *segmento*. `TipoSerie = 'aquecimento' | 'trabalho' | 'drop'`.
   - Volume semanal e tonelagem: séries `drop` **contam** (como nos apps de mercado). Só `aquecimento` fica de fora.
   - Recorde pessoal e progressão de carga consideram apenas séries de `trabalho`: um drop é por definição uma carga reduzida.
   - A `tecnica` da prescrição (`normal | drop_set | rest_pause`) continua a descrever o *plano*.
3. **Bi-set/circuito (padrão de mercado):** exercícios do mesmo bloco aparecem agrupados; o app **sugere** a alternância (A1 → B1 → A2 → B2) sem bloquear outra ordem; o **timer de descanso só dispara no fim da volta**. É regra de interface e de Orientação, sem impacto nos eventos.
4. **`SugestaoRespondida` entra no MVP:** registra se a carga sugerida foi aceita, ajustada ou ignorada.
5. **Congelamento do contrato e "época" do log:** os eventos gravados antes deste ADR (walking skeleton, com `SerieRegistrada` em outro formato e sem sessão) são **dados de teste do dono do produto**. Reaproveitar o mesmo `type` com outro formato violaria a regra 9 do ADR-0006. Por isso, ao ligar o app ao modelo v1, inicia-se uma **nova época**:
   - servidor: o UserStore passa a ser endereçado por `idFromName("v1:" + userId)`;
   - cliente: banco local com outro nome (`gym-v1.db`).
   A partir daqui, **nenhuma** quebra de contrato é aceitável: só mudanças compatíveis ou novas versões com upcaster (D5).

## Consequências

- ✅ O contrato nasce revisado, com modelagem alinhada ao que o usuário já conhece de outros apps.
- ✅ A remoção dos segmentos simplifica o modelo e a interface.
- ✅ A época dá uma forma explícita e documentada de partir do zero antes do primeiro uso real, sem exceções às regras do contrato.
- ⚠️ Os Durable Objects da época anterior ficam órfãos (só dados de teste do dono). **Pendência:** apagá-los (`storage.deleteAll()`) quando houver a rota de exclusão de dados (Fase 5, LGPD).
- ⚠️ A época só funciona *antes* de existirem dados reais. Depois do primeiro uso real, a única ferramenta é o versionamento (D5).
- 🔁 **Gatilhos de revisão:** um evento que precise mudar de significado (nasce um novo `type`); dor real com reordenação concorrente (D2) ou com a substituição do valor inteiro (D3).
