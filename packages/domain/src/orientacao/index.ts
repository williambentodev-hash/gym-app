// Contexto Orientação (01-dominio §5): regras determinísticas do "treino eficiente". Funções puras, sem estado (R6).
// Roda no cliente, offline (a sugestão aparece na academia sem sinal). Princípios: sugerir, nunca impor; sempre explicar.
import type { Medidas, Prescricao } from '../comum/index';

/** Parâmetros, não constantes: as faixas vêm da literatura e vão mudar (01-dominio §5). */
export type ParametrosOrientacao = {
  incrementoCompostoKg: number;
  incrementoIsoladoKg: number;
  descansoCompostoSeg: number;
  descansoIsoladoSeg: number;
  rirMinimoParaProgredir: number;
  reducaoPercentual: number;
  faixaVolumeSemanal: { min: number; max: number };
};

export const PARAMETROS_PADRAO: ParametrosOrientacao = {
  incrementoCompostoKg: 2.5,
  incrementoIsoladoKg: 1,
  descansoCompostoSeg: 150, // 2–3 min
  descansoIsoladoSeg: 75, // 60–90 s
  rirMinimoParaProgredir: 1,
  reducaoPercentual: 0.05,
  faixaVolumeSemanal: { min: 10, max: 20 }, // séries efetivas por grupo/semana (ponto de partida)
};

export type SugestaoCarga =
  | { tipo: 'subir' | 'manter' | 'reduzir'; cargaKg: number; motivo: string }
  | { tipo: 'sem_historico' | 'nao_aplicavel'; cargaKg?: number; motivo: string };

const arred = (kg: number, passo = 0.5) => Math.round(kg / passo) * passo;
const fmt = (kg: number) => `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

/**
 * Dupla progressão (01-dominio §5): com faixa 8–12, se TODAS as séries de trabalho atingiram o topo
 * com RIR ≥ 1 (ou RIR não informado), sobe a carga. Se metade ou mais ficou abaixo do mínimo, reduz ~5%.
 */
export function sugerirCarga(
  prescricao: Prescricao,
  ultimasSeriesTrabalho: readonly Medidas[] | undefined,
  composto: boolean,
  p: ParametrosOrientacao = PARAMETROS_PADRAO,
): SugestaoCarga {
  const faixa = prescricao.repeticoes;
  const series = (ultimasSeriesTrabalho ?? []).filter((m): m is Extract<Medidas, { modalidade: 'carga_repeticoes' }> => m.modalidade === 'carga_repeticoes');
  if (!faixa || (ultimasSeriesTrabalho?.length && series.length === 0 && ultimasSeriesTrabalho.every((m) => m.modalidade !== 'peso_corporal')))
    return { tipo: 'nao_aplicavel', motivo: 'progressão de carga não se aplica a este exercício' };

  // Peso corporal: progride adicionando carga quando todas as séries chegam ao topo da faixa.
  const pc = (ultimasSeriesTrabalho ?? []).filter((m): m is Extract<Medidas, { modalidade: 'peso_corporal' }> => m.modalidade === 'peso_corporal');
  if (pc.length > 0) {
    const atual = Math.max(...pc.map((m) => m.cargaAdicionalKg ?? 0));
    if (pc.every((m) => m.reps >= faixa.max && (m.rir === undefined || m.rir >= p.rirMinimoParaProgredir)))
      return { tipo: 'subir', cargaKg: atual + p.incrementoCompostoKg, motivo: `${faixa.max} repetições em todas as séries: experimente ${fmt(p.incrementoCompostoKg)} de carga adicional` };
    return { tipo: 'manter', cargaKg: atual, motivo: `continue até fazer ${faixa.max} repetições em todas as séries` };
  }

  if (series.length === 0) {
    return prescricao.cargaKg !== undefined
      ? { tipo: 'sem_historico', cargaKg: prescricao.cargaKg, motivo: 'primeira vez: use a carga planejada na ficha' }
      : { tipo: 'sem_historico', motivo: 'primeira vez: escolha uma carga em que consiga a faixa com 1–2 repetições sobrando' };
  }

  const base = Math.max(...series.map((m) => m.cargaKg));
  const noTopo = series.filter((m) => m.cargaKg === base);
  const todasNoTopo = noTopo.length === series.length && series.every((m) => m.reps >= faixa.max && (m.rir === undefined || m.rir >= p.rirMinimoParaProgredir));
  if (todasNoTopo) {
    const inc = composto ? p.incrementoCompostoKg : p.incrementoIsoladoKg;
    const semRir = series.some((m) => m.rir === undefined) ? ' (informe o RIR para sugestões mais precisas)' : '';
    return { tipo: 'subir', cargaKg: base + inc, motivo: `${faixa.max} repetições em todas as séries com ${fmt(base)}: experimente ${fmt(base + inc)}${semRir}` };
  }
  const abaixo = series.filter((m) => m.reps < faixa.min).length;
  if (abaixo >= Math.ceil(series.length / 2)) {
    const nova = arred(base * (1 - p.reducaoPercentual));
    return { tipo: 'reduzir', cargaKg: nova, motivo: `${abaixo} de ${series.length} séries abaixo de ${faixa.min} repetições: reduza para ${fmt(nova)} e reconstrua` };
  }
  return { tipo: 'manter', cargaKg: base, motivo: `mantenha ${fmt(base)} até fazer ${faixa.max} repetições em todas as séries` };
}

/** Descanso: o da prescrição; se ausente, padrão por tipo de exercício. */
export function descansoSeg(prescricao: Prescricao, composto: boolean, p: ParametrosOrientacao = PARAMETROS_PADRAO): number {
  return prescricao.descansoSeg ?? (composto ? p.descansoCompostoSeg : p.descansoIsoladoSeg);
}

/**
 * Bi-set/circuito (ADR-0012, padrão de mercado): depois de uma série, se o exercício não é o último do bloco,
 * segue direto para o próximo (sem descanso); se é o último, descansa e volta ao primeiro (próxima volta).
 */
export function aposSerie(itensDoBloco: readonly string[], itemId: string): { descansar: boolean; proximoItemId: string | undefined } {
  const i = itensDoBloco.indexOf(itemId);
  if (i === -1) return { descansar: true, proximoItemId: undefined };
  if (i < itensDoBloco.length - 1) return { descansar: false, proximoItemId: itensDoBloco[i + 1] };
  return { descansar: true, proximoItemId: itensDoBloco.length > 1 ? itensDoBloco[0] : itemId };
}

/** Rampa de aquecimento (01-dominio §4): 50% × 8, 70% × 5, 85% × 2 da carga de trabalho, múltiplos de 2,5 kg, mín. 20 kg (barra). */
export function rampaAquecimento(cargaTrabalhoKg: number): Array<{ cargaKg: number; reps: number }> {
  if (cargaTrabalhoKg < 40) return []; // carga leve: aquecimento específico não compensa
  const passos: Array<[number, number]> = [[0.5, 8], [0.7, 5], [0.85, 2]];
  const out: Array<{ cargaKg: number; reps: number }> = [];
  for (const [pct, reps] of passos) {
    const kg = Math.max(20, arred(cargaTrabalhoKg * pct, 2.5));
    if (kg < cargaTrabalhoKg && !out.some((x) => x.cargaKg === kg)) out.push({ cargaKg: kg, reps });
  }
  return out;
}

export type AvaliacaoVolume = { series: number; status: 'abaixo' | 'dentro' | 'acima' };

/** Compara o volume semanal de cada grupo com a faixa de referência. */
export function avaliarVolume(seriesPorGrupo: Record<string, number>, p: ParametrosOrientacao = PARAMETROS_PADRAO): Record<string, AvaliacaoVolume> {
  const { min, max } = p.faixaVolumeSemanal;
  return Object.fromEntries(
    Object.entries(seriesPorGrupo).map(([g, n]) => [g, { series: n, status: n < min ? 'abaixo' : n > max ? 'acima' : 'dentro' }]),
  );
}
