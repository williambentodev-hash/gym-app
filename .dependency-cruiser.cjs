/**
 * Fitness functions de arquitetura (ADR-0009).
 * Cada regra referencia a regra correspondente do ADR. Violação com severity "error" quebra o build.
 * Rodar: pnpm lint:arch
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'R1-dominio-puro',
      comment:
        'packages/domain não importa nada além de si mesmo e de zod: nem React, nem Expo, nem cloudflare:*, ' +
        'nem módulos do Node, nem outros pacotes do repo. Precisa rodar no celular offline, no Worker e nos testes.',
      severity: 'error',
      from: { path: '^packages/domain/', pathNot: '\\.test\\.ts$' }, // testes podem importar o vitest
      to: { pathNot: ['^packages/domain/', 'node_modules/zod/'] },
    },
    {
      name: 'R2-apps-isolados',
      comment: 'apps/app e apps/api nunca importam um ao outro: comunicam-se só via packages/contracts.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/([^/]+)/', pathNot: '^apps/$1/' },
    },
    {
      name: 'R3-sync-generico',
      comment: 'packages/sync não conhece o domínio: recebe o reducer por injeção (mantém o plano B LiveStore barato).',
      severity: 'error',
      from: { path: '^packages/sync/' },
      to: { path: '^packages/domain/' },
    },
    {
      name: 'R4-contextos-pelo-index',
      comment: 'Dentro do domínio, um bounded context só importa outro pelo index.ts público dele.',
      severity: 'error',
      from: { path: '^packages/domain/src/([^/]+)/' },
      to: {
        path: '^packages/domain/src/[^/]+/.+',
        pathNot: ['^packages/domain/src/$1/', '^packages/domain/src/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'R5-execucao-nao-conhece-planejamento',
      comment: 'Execução tem seu próprio snapshot de prescrição; a tradução acontece na camada de aplicação (ACL).',
      severity: 'error',
      from: { path: '^packages/domain/src/execucao/' },
      to: { path: '^packages/domain/src/planejamento/' },
    },
    {
      name: 'R7-sem-imports-profundos',
      comment: 'Nenhum pacote importa o src/ interno de outro pacote: só a API pública (exports → src/index.ts).',
      severity: 'error',
      from: { path: '^(apps|packages)/([^/]+)/' },
      to: { path: '^packages/[^/]+/src/.+', pathNot: ['^packages/$2/', '^packages/[^/]+/src/index\\.ts$'] },
    },
    {
      name: 'sem-ciclos',
      comment: 'Dependências circulares escondem acoplamento.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['node_modules', '\\.expo/', 'dist/', 'worker-configuration\\.d\\.ts$'] },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types', 'react-native'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)' },
    },
  },
};
