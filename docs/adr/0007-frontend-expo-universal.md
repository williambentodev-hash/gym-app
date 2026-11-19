# ADR-0007: Frontend universal com Expo (React Native + web)

- **Status:** Aceito
- **Data:** 2026-11-18
- **Fase:** 2
- **Relacionado:** [ADR-0004](0004-typescript-como-linguagem-do-backend.md), [ADR-0006](0006-estrategia-de-sincronizacao-offline.md)

## Contexto

Drivers:

- **Clientes iOS, Android e web**, com 1 desenvolvedor em tempo parcial.
- **Uso principal: celular na academia, offline (QA-1).** A web é secundária: planejar fichas e ver a evolução no computador.
- **SQLite no cliente nas duas plataformas** (ADR-0006): o log de eventos e o estado materializado ficam no aparelho.
- **Pacote de domínio em TypeScript compartilhado** (ADR-0004): reducers, regras de Orientação e validação precisam rodar no cliente.
- **Visual caprichado:** animações de execução dos exercícios em loop, timers, gráficos.

## Opções consideradas

| # | Opção | Prós | Contras |
|---|---|---|---|
| A | **Expo (React Native) com suporte web**: uma base para iOS, Android e web | Uma base de código; nativo de verdade no celular; TypeScript compartilha o domínio; ecossistema maduro (Expo Router, `expo-sqlite`, `expo-video`, builds na nuvem com EAS) | A experiência web é "app no navegador", não um site tradicional; SQLite na web via WASM exige cuidado |
| B | **Flutter** | Excelente desempenho e consistência visual | **Dart quebra o domínio compartilhado**, que é a principal justificativa do ADR-0004; teríamos as regras duplicadas em duas linguagens |
| C | **Duas bases**: Expo no celular + React (Vite) na web | A melhor experiência em cada plataforma | Duas interfaces para manter, com uma pessoa só; ganho pequeno, porque a web é secundária |
| D | **Só PWA** (web instalável) | Uma base, sem lojas de aplicativos | **No iOS, o Safari pode apagar o armazenamento de sites pouco usados.** Num app local-first isso pode **perder eventos ainda não sincronizados**, o que viola QA-1. Também tem acesso limitado a notificações e recursos em segundo plano |
| E | **Capacitor** (app web dentro de uma casca nativa) | Uma base web, SQLite nativo via plugin | Interface em WebView, menos fluida em listas e animações; ecossistema menor que o do React Native |

## Decisão

**Opção A: Expo universal.** Uma base de código com **Expo Router** para iOS, Android e web.

### Pontos de arquitetura no cliente

1. **Porta de armazenamento local.** O app depende de uma interface (`EventStore` / `LocalDb`), não de uma biblioteca. Há duas implementações:
   - **Nativa:** `expo-sqlite`.
   - **Web:** SQLite em WASM persistido em **OPFS** (Origin Private File System), seja via `expo-sqlite` web se estiver estável, seja via `wa-sqlite` / `@sqlite.org/sqlite-wasm`.
   Assim o restante do app não sabe em que plataforma está.
2. **Domínio fora do app.** O app importa `@gym/domain` (reducers, Orientação, schemas) e `@gym/sync` (motor de sincronização). Nenhum desses pacotes importa React ou Expo. A fronteira será verificada automaticamente (ADR do monorepo).
3. **A interface lê do SQLite local, nunca da API.** As telas são *consultas reativas* sobre o estado materializado. A API só é chamada pelo motor de sincronização.
4. **Mídias:** loops curtos em MP4/WebP tocados com `expo-video`. As animações dos exercícios das fichas ativas ficam em cache local para uso offline.
5. **Persistência na web:** pedir `navigator.storage.persist()` e sincronizar de forma agressiva (a web costuma estar online). O risco de o navegador apagar dados é aceito para a web, que é secundária. O celular é a plataforma confiável para uso offline.

### Validação obrigatória: spike na Fase 3

A decisão depende de uma **prova técnica** no início da Fase 3, antes de qualquer funcionalidade:

- [ ] SQLite funcionando no iOS, no Android e na web (OPFS) com a mesma porta `LocalDb`
- [ ] Gravar 1.000 eventos e reconstruir o estado em menos de 1 s num celular intermediário
- [ ] Web servida pela Cloudflare com os cabeçalhos COOP/COEP, se a implementação WASM exigir `SharedArrayBuffer`
- [ ] Animação em loop tocando offline a partir do cache
- [ ] APK instalado direto num Android físico, funcionando offline
- [ ] (se houver iPhone) web instalada na tela inicial do iOS: dados persistem após dias sem uso

Se a web falhar, cai-se para a **opção C só na web** (Vite + a mesma porta). O domínio e o motor de sincronização não mudam.

## Consequências

- ✅ Uma base de código e uma linguagem do domínio até a interface: o máximo de reaproveitamento para uma pessoa só.
- ✅ Experiência nativa onde ela mais importa: na academia.
- ✅ A porta `LocalDb` isola a parte mais arriscada (SQLite na web).
- ⚠️ A web não é ótima para SEO nem parece um "site". Irrelevante: é um app autenticado, sem páginas públicas no MVP.
- ⚠️ **Distribuição sem lojas e sem custo** (restrição do dono do produto, 2026-11-18). Ver a seção abaixo.

## Distribuição sem lojas e sem custo

| Plataforma | Caminho gratuito | Limitações |
|---|---|---|
| **Android** | **APK instalado direto no celular** (*sideload*: o Android permite instalar apps de fora da loja). Build na nuvem com EAS (plano gratuito, com fila) ou local (Android SDK no Windows) | Precisa liberar "instalar apps desconhecidos"; atualizações de JavaScript podem vir por EAS Update (gratuito com limites), sem reinstalar |
| **iPhone** | **Não há caminho nativo prático no Windows.** Instalar fora da App Store sem pagar exige Xcode (Mac) com Apple ID gratuito, e o app **expira a cada 7 dias** | Alternativas: (1) **web instalada na tela inicial** (PWA), a partir da mesma base Expo web; (2) Expo Go apenas para desenvolvimento |
| **Web** | Cloudflare (gratuito) | — |

**Nota sobre o PWA no iPhone:** a opção D foi descartada porque o Safari pode apagar dados de sites pouco usados. O WebKit, porém, isenta desse limite de 7 dias os web apps **adicionados à tela inicial**. Como a base Expo já gera a versão web, um iPhone pode usá-la instalada na tela inicial **sem nenhum código extra**. É uma rota de contingência razoável, mas a confiabilidade offline no iOS é menor que a do app nativo e precisa ser validada no spike.

Publicação nas lojas (Apple US$ 99/ano; Google US$ 25 uma vez) fica para quando houver usuários além do círculo próximo.
- 🔁 **Gatilhos de revisão:** falha no spike da web; necessidade de páginas públicas com SEO; desempenho de animações ou listas insuficiente.
