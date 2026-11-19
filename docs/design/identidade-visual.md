# Identidade visual

> Direção do dono do produto (2026-11-19): **clean, premium, minimalista, padrão Apple**. Paleta de app de treino: **preto e laranja**, com um preto **"menos preto"**: grafite, nunca `#000` puro.

## Princípios

1. **Conteúdo primeiro.** Poucos elementos por tela, muito respiro. Durante a execução do treino, o número (carga, repetições, timer) é o protagonista.
2. **Profundidade por tom, não por sombra.** Superfícies sobem de nível clareando o grafite, como no modo escuro do iOS. Sombras quase inexistentes.
3. **Laranja é intenção.** O acento marca **a próxima ação** e o progresso (botão primário, série atual, recorde). Se tudo é laranja, nada é.
4. **Feito para a academia.** Alvos de toque ≥ 44 pt, contraste alto, leitura com o braço esticado e a mão suada.

## Paleta (tema escuro, padrão)

| Token | Valor | Uso |
|---|---|---|
| `fundo` | `#121214` | Fundo das telas: grafite, o "preto menos preto" |
| `superficie` | `#1C1C1F` | Cartões, listas |
| `superficieElevada` | `#26262A` | Folhas, campos, cartão em destaque |
| `separador` | `#2E2E33` | Linhas finas (hairline) |
| `texto` | `#F5F5F7` | Texto principal (branco "Apple", não puro) |
| `textoSecundario` | `#A1A1A8` | Rótulos, metadados |
| `textoTerciario` | `#6E6E76` | Placeholders, desabilitado |
| `acento` | `#FF7A1A` | Laranja principal: ação primária, série atual, progresso |
| `acentoPressionado` | `#E8650A` | Estado pressionado |
| `acentoSuave` | `rgba(255,122,26,0.14)` | Fundo de chips e realces discretos |
| `textoSobreAcento` | `#121214` | Texto em botões laranja |
| `sucesso` | `#30D158` | Série concluída, sincronizado |
| `alerta` | `#FFD60A` | Pendente de sincronização |
| `erro` | `#FF453A` | Erros, ações destrutivas |

**Decisão de acessibilidade:** texto **escuro** sobre o laranja, não branco. Branco sobre `#FF7A1A` tem contraste ~2,6:1 e reprova no WCAG AA. O grafite `#121214` sobre o laranja passa de 7:1. O laranja sobre o fundo grafite também passa de 7:1, então serve como cor de texto e ícone.

## Tipografia

Fonte do sistema: San Francisco no iOS e na web em Apple, Roboto no Android. Escala inspirada no HIG:

| Estilo | Tamanho / peso | Uso |
|---|---|---|
| `tituloGrande` | 34 / bold | Título da tela (ex.: "Hoje") |
| `titulo` | 22 / semibold | Seções |
| `destaque` | 17 / semibold | Nome do exercício |
| `corpo` | 17 / regular | Texto geral |
| `apoio` | 15 / regular | Rótulos |
| `nota` | 13 / regular | Metadados |
| `numeroGrande` | 48 / semibold, **algarismos tabulares** | Carga, repetições, timer na execução |

Números sempre com **algarismos tabulares** (`fontVariant: ['tabular-nums']`), para não "dançarem" quando o timer muda.

## Espaçamento e forma

- Grade de **4 pt**: 4, 8, 12, 16, 24, 32.
- Raios: **12** (cartões), **10** (botões e campos), **999** (pílulas e chips).
- Margem lateral das telas: **16** (compacto) / **20** (padrão).

## Movimento

Transições curtas e com mola suave (~250 ms). Respeitar o "reduzir movimento" do sistema. Feedback háptico leve ao concluir uma série ou bater um recorde (Android e iOS).

## Implementação

Os tokens viram um módulo de tema único no app (`apps/app/src/ui/tema.ts`), e **nenhuma cor ou tamanho solto** aparece nos componentes. O tema claro fica para depois do MVP: a estrutura de tokens já permite adicioná-lo sem mexer nos componentes.
