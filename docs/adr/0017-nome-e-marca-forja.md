# ADR-0017: Nome e marca "Forja", com os identificadores técnicos preservados

- **Status:** Aceito
- **Data:** 2026-11-22
- **Fase:** 6

## Contexto

"gym.app" era um nome provisório, e o ícone ainda era o padrão do Expo (um "A" azul em fundo claro), em conflito com a [identidade visual](../design/identidade-visual.md): grafite + laranja, clean e premium. O dono do produto escolheu o nome **Forja** e pediu um símbolo "tipo um peso de academia".

Trocar o nome levanta uma questão de arquitetura: o nome aparece tanto em **textos para o usuário** quanto em **identificadores técnicos** que outros sistemas guardam.

## Decisão

1. **Nome de exibição: Forja.** O metal grafite com o laranja incandescente reproduz a paleta, e "forjar" cobre o treino hoje e a dieta depois: construir o corpo aos poucos.
2. **Símbolo:** um **kettlebell** laranja (degradê sutil de `#FF9A4D` para `#E8650A`, o metal "em brasa") com uma **seta para cima vazada** no corpo. É o peso da academia somado à progressão de carga, o diferencial do produto. O kettlebell foi preferido ao halter porque é compacto e quase quadrado, então continua legível em 48 px. Um halter na horizontal fica fino demais.
3. **Fonte única e versionada:** o desenho é SVG gerado por código em `scripts/marca/gerar-icones.mjs` (`pnpm marca:gerar`), que produz todos os PNGs (iOS/web, favicon, splash, Android adaptativo com o primeiro plano dentro do círculo seguro de 66/108 e a versão monocromática para ícones temáticos).
4. **Muda só o que o usuário vê:** nome do app, textos da interface e da política de privacidade, título da página web, nome do arquivo exportado (`forja-dados-AAAA-MM-DD.json`) e o prompt da IA.
5. **Ficam como estão os identificadores técnicos:**

| Identificador | Valor mantido | Custo de trocar |
|---|---|---|
| Pacote Android | `com.williambento.gymapp` | O Android trata como **outro app**: o APK novo não atualiza o instalado e o banco local offline (com séries talvez ainda não sincronizadas) fica para trás |
| Scheme do deep link | `gymapp://` | Quebra o retorno do login Google no APK (origem confiável no Better Auth) |
| Prefixo do SecureStore | `gymapp` | Desloga todo mundo |
| `slug` / projeto EAS | `gym-app` | Desvincula os builds do projeto EAS existente |
| Workers, D1, pacotes `@gym/*` | `gym-api`, `gym-identity`… | Só renomeação interna, com risco de migração e nenhum ganho para o usuário |

## Consequências

- ✅ O usuário vê "Forja" na tela inicial, nas abas do navegador e nos textos, sem perder dados nem sessão.
- ✅ Mudar o ícone vira editar um arquivo e rodar um comando, e o resultado é reproduzível.
- ⚠️ Fica uma diferença entre o nome da marca e os nomes internos. É aceitável: **nome de exibição e identificador são conceitos diferentes**. O identificador deve ser estável, e o nome pode evoluir. Se um dia houver publicação em loja com outro pacote, essa migração vira um ADR próprio.
- ⚠️ `sharp` passa a ser devDependency da raiz (só para o script da marca, sem impacto no app).
