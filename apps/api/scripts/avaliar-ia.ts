// Avaliação da IA especialista (ADR-0016): perfis variados × critérios OBJETIVOS e automáticos.
// Roda o MESMO código de produção (prompt, provedor, validação, análise); só troca o binding `env.AI`
// por chamadas à API REST da Cloudflare. Custo: neurônios da franquia gratuita diária (~500 por perfil).
//
// Uso (na pasta apps/api):
//   $env:CF_TOKEN = (npx wrangler auth token); $env:CF_ACCOUNT = "<account id>"; npx tsx scripts/avaliar-ia.ts
import { readFileSync } from 'node:fs';
import { Catalogo, type PerfilTreino, type PropostaFicha } from '@gym/contracts';
import { normalizarEAnalisar } from '../src/ia/proposta';
import { gerarComWorkersAI } from '../src/ia/provedor-workers-ai';
import { criticoPara } from '../src/ia/servico';

const { CF_TOKEN, CF_ACCOUNT } = process.env;
if (!CF_TOKEN || !CF_ACCOUNT) throw new Error('defina CF_TOKEN e CF_ACCOUNT');

const ai = {
  async run(modelo: string, entrada: unknown) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${modelo}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(entrada),
    });
    const j = (await r.json()) as { success: boolean; result?: unknown; errors?: unknown };
    if (!j.success) throw new Error(JSON.stringify(j.errors));
    return j.result;
  },
} as unknown as Ai;

const catalogo = Catalogo.parse(JSON.parse(readFileSync(new URL('../public/catalogo/catalogo.v1.json', import.meta.url), 'utf8')));
const porId = new Map(catalogo.exercicios.map((e) => [e.id, e]));

const PERFIS: Array<[string, PerfilTreino]> = [
  ['hipertrofia-intermediario-4x', { objetivo: 'hipertrofia', nivel: 'intermediario', diasPorSemana: 4, minutosPorTreino: 60, local: 'academia_completa', prioridades: [] }],
  ['saude-iniciante-3x-basica', { objetivo: 'saude', nivel: 'iniciante', diasPorSemana: 3, minutosPorTreino: 45, local: 'academia_basica', prioridades: [] }],
  ['forca-avancado-4x', { objetivo: 'forca', nivel: 'avancado', diasPorSemana: 4, minutosPorTreino: 75, local: 'academia_completa', prioridades: [] }],
  ['emagrecimento-casa-halteres-3x', { objetivo: 'emagrecimento', nivel: 'intermediario', diasPorSemana: 3, minutosPorTreino: 40, local: 'casa_halteres', prioridades: [] }],
  ['hipertrofia-avancado-5x-gluteos', { objetivo: 'hipertrofia', nivel: 'avancado', diasPorSemana: 5, minutosPorTreino: 70, local: 'academia_completa', prioridades: ['gluteos', 'posteriores'] }],
  ['hipertrofia-ombro-limitado-3x', { objetivo: 'hipertrofia', nivel: 'intermediario', diasPorSemana: 3, minutosPorTreino: 60, local: 'academia_completa', prioridades: [], limitacoes: 'desconforto no ombro direito ao levantar o braço acima da cabeça' }],
];

const EQUIP_PERMITIDO: Record<PerfilTreino['local'], Set<string> | null> = {
  academia_completa: null,
  academia_basica: null,
  // Pular corda é viável em casa (critério corrigido após a 1ª avaliação: o erro era do critério, não da IA).
  casa_halteres: new Set(['halteres', 'kettlebell', 'peso_corporal', 'cardio:jump-rope']),
  peso_corporal: new Set(['peso_corporal']),
};
const ACIMA_DA_CABECA = /overhead|shoulder-press|military|arnold|upright/;

type Criterio = [string, boolean, string?];

function avaliar(perfil: PerfilTreino, p: PropostaFicha): Criterio[] {
  const itens = p.treinos.flatMap((t) => t.blocos.flatMap((b) => b.itens));
  const permitido = EQUIP_PERMITIDO[perfil.local];
  const foraDoLocal = itens.filter((i) => permitido && !permitido.has(porId.get(i.exercicioId)!.equipamento) && !(i.exercicioId === 'cardio/jump-rope' && permitido.has('cardio:jump-rope')));
  const principais = ['peito', 'costas', 'quadriceps', 'ombros'];
  const vol = p.analise.volumeSemanal;
  const minVol = perfil.objetivo === 'saude' ? 4 : perfil.objetivo === 'hipertrofia' ? 8 : 6;
  const volBaixo = principais.filter((g) => (vol[g]?.series ?? 0) < minVol);
  const volAlto = Object.entries(vol).filter(([, a]) => a.series > 22).map(([g]) => g);
  const tempoEstourado = p.analise.minutosEstimadosPorTreino.filter((m) => m > perfil.minutosPorTreino * 1.15);
  const primeiroIsolado = p.treinos.filter((t) => {
    const primeiro = porId.get(t.blocos[0]!.itens[0]!.exercicioId)!;
    return primeiro.modalidade === 'carga_repeticoes' && !primeiro.composto;
  });
  const tecnicas = itens.filter((i) => i.prescricao.tecnica !== 'normal');
  const descartes = p.analise.avisos.some((a) => a.includes('fora do catálogo'));
  const criterios: Criterio[] = [
    ['sem exercícios fora do catálogo', !descartes],
    ['nº de treinos ≤ dias', p.treinos.length <= perfil.diasPorSemana, `${p.treinos.length} treinos`],
    ['equipamentos compatíveis com o local', foraDoLocal.length === 0, foraDoLocal.map((i) => i.nome).join(', ')],
    [`volume ≥ ${minVol} nos grupos principais`, volBaixo.length === 0, volBaixo.map((g) => `${g}=${vol[g]?.series ?? 0}`).join(', ')],
    ['nenhum grupo > 22 séries', volAlto.length === 0, volAlto.join(', ')],
    ['cabe no tempo (+15%)', tempoEstourado.length === 0, p.analise.minutosEstimadosPorTreino.join('/') + ' min'],
    ['treinos começam por composto', primeiroIsolado.length === 0, primeiroIsolado.map((t) => t.nome).join(', ')],
    ['técnicas avançadas só para avançado', perfil.nivel === 'avancado' || tecnicas.length === 0, tecnicas.map((i) => i.nome).join(', ')],
  ];
  if (perfil.limitacoes?.includes('ombro')) {
    const proibidos = itens.filter((i) => ACIMA_DA_CABECA.test(i.exercicioId));
    criterios.push(['respeita a limitação no ombro', proibidos.length === 0, proibidos.map((i) => i.nome).join(', ')]);
  }
  return criterios;
}

let aprovados = 0, total = 0;
// PERFIS=nome1,nome2 roda só um subconjunto (economiza a franquia diária de neurônios).
const filtro = process.env.PERFIS?.split(',');
for (const [nome, perfil] of PERFIS.filter(([n]) => !filtro || filtro.includes(n))) {
  const inicio = Date.now();
  try {
    const proposta = normalizarEAnalisar(await gerarComWorkersAI(ai, perfil, catalogo, criticoPara(perfil, catalogo)), perfil, catalogo);
    const criterios = avaliar(perfil, proposta);
    const ok = criterios.filter((c) => c[1]).length;
    aprovados += ok;
    total += criterios.length;
    console.log(`\n## ${nome} — ${ok}/${criterios.length} (${((Date.now() - inicio) / 1000).toFixed(0)} s) — "${proposta.nome}"`);
    for (const [c, passou, det] of criterios) console.log(`  ${passou ? '✓' : '✗'} ${c}${!passou && det ? ` → ${det}` : ''}`);
    console.log(`  treinos: ${proposta.treinos.map((t) => `${t.nome} (${t.blocos.reduce((n, b) => n + b.itens.length, 0)} ex.)`).join(' | ')}`);
  } catch (e) {
    total += 8;
    console.log(`\n## ${nome} — ERRO: ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log(`\n=== TOTAL: ${aprovados}/${total} critérios (${Math.round((aprovados / total) * 100)}%) ===`);
