# Fase 0 — Visão do produto

> Documento vivo. Itens marcados com ❓ ainda aguardam decisão.

## 1. Declaração de visão

Para **praticantes autônomos de musculação**, que montam e conduzem o próprio treino, o gym.app é um aplicativo **web e mobile** que permite **planejar fichas, registrar a execução mesmo sem sinal na academia e acompanhar a evolução**. Em versões futuras, o app passa a cobrir também a **dieta**, inclusive com estimativa de calorias a partir de uma foto do prato.

## 2. Persona

| Persona | Descrição | Status |
|---|---|---|
| **Praticante autônomo** | Monta o próprio treino, registra cargas, quer ver evolução | ✅ única persona |
| Aluno com personal/nutricionista | Recebe plano pronto | ❌ fora de escopo |
| Profissional (personal/nutri) | Gerencia alunos | ❌ fora de escopo |

**Impacto arquitetural:** cada usuário só acessa os próprios dados. Isso descarta multi-tenancy B2B e compartilhamento entre usuários, e permite um modelo de **isolamento de dados por usuário**. Na plataforma escolhida, um banco por usuário (D1 ou Durable Objects) é uma opção viável, a avaliar na Fase 2.

## 3. Capacidades

### MVP: gestão do treino

| Capacidade | Observação |
|---|---|
| Cadastro / login | Necessário para sincronizar entre dispositivos |
| Biblioteca de exercícios | **Ambos:** catálogo pré-cadastrado + exercícios criados pelo usuário. Catálogo com **animação da execução** e visual caprichado |
| Montar fichas de treino (A/B/C, séries, reps, carga) | |
| Registrar execução do treino, inclusive sem sinal | **Requisito offline**, ver seção 4 |
| Histórico e gráficos de evolução | **Apenas cargas e volume.** Medidas corporais ficam para depois do MVP |
| **Orientação para um treino eficiente** | Sugestão de carga (progressão), timer de descanso, rampa de aquecimento, volume semanal por grupo muscular. Regras determinísticas, sem IA. **É o diferencial do produto**, detalhado em [01-dominio.md §5](01-dominio.md) |

**Riscos do catálogo com animações:**

- **Direitos autorais:** GIFs de exercício encontrados na internet quase sempre têm dono. Precisamos de uma fonte licenciada (dataset com licença aberta, API paga com licença de uso, ou produção própria). Isso vira um ADR.
- **Formato:** GIF é um formato pesado e antigo. Um loop curto em MP4 ou WebP animado fica de 5 a 10 vezes menor, o que pesa muito no cache offline.

### Depois do MVP

| Capacidade | Observação |
|---|---|
| Metas de calorias e macros | Módulo Nutrição |
| Registro de refeições com base de alimentos (ex.: TACO) | Módulo Nutrição |
| **Estimativa de calorias por foto do prato** | Modelo de visão com IA. É uma *estimativa*: o usuário revisa e corrige. Envolve upload de imagem (R2), processamento assíncrono (Queues) e custo por chamada |
| Lembretes / notificações | |
| Medidas corporais (peso, circunferências) | Dado de saúde: traz a LGPD com mais força |
| Integração Apple Health / Google Fit | |
| Monetização (assinatura) | Sem assinatura por ora |

## 4. Atributos de qualidade

Cenários no formato *estímulo → resposta → medida*, em ordem de prioridade:

| # | Atributo | Cenário | Prioridade |
|---|---|---|---|
| QA-1 | **Disponibilidade offline** | Usuário na academia, sem sinal, abre a ficha do dia (incluindo as animações dos exercícios dela) e registra todas as séries → o app funciona normalmente → 100% dos registros sincronizam ao voltar a conexão, **sem perda nem duplicação** | **alta** (driver principal) |
| QA-2 | **Privacidade / LGPD** | Dados pessoais do usuário (e, depois do MVP, medidas, dieta e fotos, que são dado sensível pelo art. 11) → o usuário pode exportar e excluir todos os seus dados → exclusão completa em até 15 dias | **alta** (obrigação legal) |
| QA-3 | **Custo** | Operação com **20 usuários ativos** no primeiro ano → dentro do plano gratuito da Cloudflare → custo de US$ 0/mês. Estimativa: 20 usuários × ~200 requisições/dia ≈ 4 mil req/dia, **~4% do limite** | **alta** (folga confortável) |
| QA-4 | **Desempenho percebido** | Usuário marca uma série como concluída → a interface confirma → em < 100 ms, por ser gravação local (a sincronização acontece depois) | média |
| QA-5 | **Evolutividade** | Adicionar o módulo Nutrição → sem alterar o código do módulo Treino, exceto pontos de integração explícitos | média |
| QA-6 | **Consistência entre dispositivos** | Usuário edita a mesma ficha no celular (offline) e na web → ao sincronizar → conflito resolvido por regra determinística e conhecida, sem corromper dados | média |

**Observação de estudo sobre escala:** com 20 usuários, escalabilidade **não** é um driver. Arquiteturas pensadas para milhões de usuários (microsserviços, sharding, cache distribuído) seriam excesso de engenharia. O que realmente exige arquitetura aqui é offline, sincronização, privacidade e evolutividade. Esse é um dos aprendizados mais valiosos: o que decide a arquitetura são os atributos de qualidade, não a moda.

**Observação de estudo:** QA-1 e QA-6 juntos tornam o sistema **local-first**. A fonte primária de escrita passa a ser o dispositivo, e o servidor deixa de ser o centro. Essa é a decisão estrutural mais importante da Fase 2: estratégia de sincronização, identificadores gerados no cliente, idempotência, e CRDT ou "a última escrita vence".

## 5. Restrições conhecidas

- Backend em TypeScript ([ADR-0004](../adr/0004-typescript-como-linguagem-do-backend.md)).
- Cloudflare Workers, plano gratuito ([ADR-0005](../adr/0005-cloudflare-como-plataforma-de-nuvem.md)).
- Clientes web **e** mobile.
- Equipe: 1 pessoa, tempo parcial e variável.
- LGPD: dados de saúde são dado pessoal sensível.
- Sem monetização: o custo precisa ficar em zero.
