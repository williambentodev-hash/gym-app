// Contexto Progresso (01-dominio §6, §7): projeções derivadas da Execução. Descartáveis e recalculáveis (P6).
// ADR-0012: 'aquecimento' fica fora de tudo; 'drop' conta em volume e tonelagem, mas não em recorde nem progressão.
import type { Medidas, Modalidade } from '../comum/index';
import type { EstadoExecucao, Sessao } from '../execucao/index';

export type Recorde = {
  cargaKg?: number; // carga_repeticoes: maior carga numa série de trabalho
  e1rmKg?: number; // carga_repeticoes: maior 1RM estimado (Epley)
  reps?: number; // peso_corporal: mais repetições
  cargaAdicionalKg?: number; // peso_corporal / tempo
  duracaoSeg?: number; // tempo / cardio
  distanciaM?: number; // cardio
};

export type ProgressoExercicio = {
  exercicioId: string;
  modalidade: Modalidade;
  series: number; // trabalho + drop
  tonelagemKg: number; // carga_repeticoes: Σ carga × reps (trabalho + drop)
  sessoes: number;
  recorde: Recorde;
  /** Séries de TRABALHO da sessão encerrada mais recente com este exercício: base da sugestão de carga. */
  ultimaSessao?: { sessaoId: string; data: string; seriesTrabalho: Medidas[] };
};

/** 1RM estimado (Epley). Só para 1–12 repetições, faixa em que a fórmula é razoável. */
export const e1rm = (cargaKg: number, reps: number): number | undefined =>
  reps >= 1 && reps <= 12 ? Math.round(cargaKg * (1 + reps / 30) * 10) / 10 : undefined;

const contaParaVolume = (tipo: string) => tipo === 'trabalho' || tipo === 'drop';
const sessoesValidas = (e: EstadoExecucao) =>
  Object.values(e.sessoes)
    .filter((s) => s.status !== 'descartada')
    .sort((a, b) => a.iniciadaEm.localeCompare(b.iniciadaEm));
const encerrada = (s: Sessao) => s.status === 'concluida' || s.status === 'encerrada_inatividade';

const maior = (a: number | undefined, b: number): number => (a === undefined ? b : Math.max(a, b));

function atualizarRecorde(r: Recorde, m: Medidas): Recorde {
  switch (m.modalidade) {
    case 'carga_repeticoes': {
      const est = e1rm(m.cargaKg, m.reps);
      return { ...r, ...(m.reps > 0 ? { cargaKg: maior(r.cargaKg, m.cargaKg) } : {}), ...(est !== undefined ? { e1rmKg: maior(r.e1rmKg, est) } : {}) };
    }
    case 'peso_corporal':
      return { ...r, reps: maior(r.reps, m.reps), ...(m.cargaAdicionalKg !== undefined ? { cargaAdicionalKg: maior(r.cargaAdicionalKg, m.cargaAdicionalKg) } : {}) };
    case 'tempo':
      return { ...r, duracaoSeg: maior(r.duracaoSeg, m.duracaoSeg) };
    case 'cardio':
      return { ...r, duracaoSeg: maior(r.duracaoSeg, m.duracaoSeg), ...(m.distanciaM !== undefined ? { distanciaM: maior(r.distanciaM, m.distanciaM) } : {}) };
  }
}

export function progressoPorExercicio(e: EstadoExecucao): Record<string, ProgressoExercicio> {
  const out: Record<string, ProgressoExercicio> = {};
  for (const s of sessoesValidas(e)) {
    const vistosNaSessao = new Set<string>();
    const trabalhoNaSessao = new Map<string, Medidas[]>();
    for (const serie of s.series) {
      if (serie.tipo === 'aquecimento') continue;
      const p = (out[serie.exercicioId] ??= { exercicioId: serie.exercicioId, modalidade: serie.medidas.modalidade, series: 0, tonelagemKg: 0, sessoes: 0, recorde: {} });
      p.modalidade = serie.medidas.modalidade;
      if (!vistosNaSessao.has(serie.exercicioId)) {
        p.sessoes++;
        vistosNaSessao.add(serie.exercicioId);
      }
      if (contaParaVolume(serie.tipo)) p.series++;
      if (serie.medidas.modalidade === 'carga_repeticoes') p.tonelagemKg += serie.medidas.cargaKg * serie.medidas.reps;
      if (serie.tipo === 'trabalho') {
        p.recorde = atualizarRecorde(p.recorde, serie.medidas);
        trabalhoNaSessao.set(serie.exercicioId, [...(trabalhoNaSessao.get(serie.exercicioId) ?? []), serie.medidas]);
      }
    }
    if (encerrada(s))
      for (const [ex, seriesTrabalho] of trabalhoNaSessao)
        out[ex]!.ultimaSessao = { sessaoId: s.sessaoId, data: s.encerradaEm ?? s.iniciadaEm, seriesTrabalho };
  }
  return out;
}

/** Semana ISO 8601 (ex.: "2026-W47") de uma data ISO, pelo calendário UTC. */
export function semanaIso(dataIso: string): string {
  const d = new Date(dataIso);
  const dia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = dia.getUTCDay() || 7;
  dia.setUTCDate(dia.getUTCDate() + 4 - dow); // quinta-feira da mesma semana define o ano ISO
  const inicioAno = new Date(Date.UTC(dia.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((dia.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7);
  return `${dia.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

/** Peso de uma série para um grupo muscular: contagem fracionada (principal = 1, secundário = 0,5). */
export type PesoGrupo = { grupo: string; peso: number };
export const PESO_PRINCIPAL = 1;
export const PESO_SECUNDARIO = 0.5;

/**
 * Volume semanal = séries EFETIVAS por grupo muscular (01-dominio §1): trabalho ou drop, perto da falha
 * (RIR ≤ 3, ou RIR não informado), excluindo cardio. Contagem FRACIONADA: o grupo principal recebe 1 série e
 * cada secundário 0,5 (prática comum na literatura de volume). `gruposDe` vem do catálogo (injetado).
 */
export function volumeSemanal(e: EstadoExecucao, gruposDe: (exercicioId: string) => readonly PesoGrupo[], semana: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessoesValidas(e))
    for (const serie of s.series) {
      if (!contaParaVolume(serie.tipo) || serie.medidas.modalidade === 'cardio' || semanaIso(serie.registradaEm) !== semana) continue;
      const rir = 'rir' in serie.medidas ? serie.medidas.rir : undefined;
      if (rir !== undefined && rir > 3) continue;
      for (const { grupo, peso } of gruposDe(serie.exercicioId)) out[grupo] = (out[grupo] ?? 0) + peso;
    }
  return out;
}

export type PontoHistorico = {
  sessaoId: string;
  data: string;
  /** Melhor série de TRABALHO da sessão para o exercício (base do gráfico de evolução). */
  melhor: Medidas;
  /** carga_repeticoes: maior 1RM estimado da sessão; demais modalidades: indefinido. */
  e1rmKg?: number;
  series: number;
  tonelagemKg: number;
};

/** Valor comparável de uma série, conforme a modalidade (maior = melhor). */
export function valorDaSerie(m: Medidas): number {
  switch (m.modalidade) {
    case 'carga_repeticoes': return e1rm(m.cargaKg, m.reps) ?? m.cargaKg;
    case 'peso_corporal': return m.reps + (m.cargaAdicionalKg ?? 0) / 2.5; // 2,5 kg extra ≈ 1 repetição
    case 'tempo': return m.duracaoSeg;
    case 'cardio': return m.distanciaM ?? m.duracaoSeg;
  }
}

/** Evolução de um exercício: uma linha por sessão ENCERRADA, em ordem cronológica. */
export function historicoDoExercicio(e: EstadoExecucao, exercicioId: string): PontoHistorico[] {
  const out: PontoHistorico[] = [];
  for (const s of sessoesValidas(e)) {
    if (!encerrada(s)) continue;
    const doEx = s.series.filter((x) => x.exercicioId === exercicioId && x.tipo !== 'aquecimento');
    const trabalho = doEx.filter((x) => x.tipo === 'trabalho');
    if (trabalho.length === 0) continue;
    const melhor = trabalho.reduce((a, b) => (valorDaSerie(b.medidas) > valorDaSerie(a.medidas) ? b : a)).medidas;
    const e1rms = trabalho.flatMap((x) => (x.medidas.modalidade === 'carga_repeticoes' ? [e1rm(x.medidas.cargaKg, x.medidas.reps)] : [])).filter((v): v is number => v !== undefined);
    out.push({
      sessaoId: s.sessaoId,
      data: s.encerradaEm ?? s.iniciadaEm,
      melhor,
      ...(e1rms.length ? { e1rmKg: Math.max(...e1rms) } : {}),
      series: doEx.length,
      tonelagemKg: doEx.reduce((t, x) => t + (x.medidas.modalidade === 'carga_repeticoes' ? x.medidas.cargaKg * x.medidas.reps : 0), 0),
    });
  }
  return out;
}

/** Verifica se uma série de trabalho supera o recorde atual (para celebrar na interface). */
export function superaRecorde(r: Recorde | undefined, m: Medidas): boolean {
  if (!r) return true;
  switch (m.modalidade) {
    case 'carga_repeticoes': {
      const est = e1rm(m.cargaKg, m.reps);
      return (m.reps > 0 && m.cargaKg > (r.cargaKg ?? 0)) || (est !== undefined && est > (r.e1rmKg ?? 0));
    }
    case 'peso_corporal':
      return m.reps > (r.reps ?? 0) || (m.cargaAdicionalKg ?? -Infinity) > (r.cargaAdicionalKg ?? Infinity);
    case 'tempo':
      return m.duracaoSeg > (r.duracaoSeg ?? 0);
    case 'cardio':
      return (m.distanciaM ?? 0) > (r.distanciaM ?? 0) || m.duracaoSeg > (r.duracaoSeg ?? 0);
  }
}
