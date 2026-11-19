// Contexto Execução: sessões e séries realizadas (01-dominio §6, §8; 04-modelo-de-eventos §3).
// R5 (ADR-0009): NÃO importa planejamento. A sessão tem seu próprio snapshot da prescrição.
import { z } from 'zod';
import { Id, Medidas, Modalidade, Prescricao, TipoSerie, type Meta } from '../comum/index';

const ItemSnapshot = z.object({ itemId: Id, exercicioId: Id, modalidade: Modalidade, prescricao: Prescricao });
const Snapshot = z.object({
  blocos: z.array(z.object({ blocoId: Id, itens: z.array(ItemSnapshot).min(1).max(10) })).min(1).max(100),
});
const Sugestao = z.object({ cargaKg: z.number().min(0).max(1000).optional(), reps: z.number().int().min(0).max(1000).optional(), motivo: z.string().max(200).optional() });

export const EventosExecucao = {
  SessaoIniciada: z.object({ sessaoId: Id, fichaId: Id, treinoId: Id, snapshot: Snapshot }),
  SerieRegistrada: z.object({ sessaoId: Id, serieId: Id, itemId: Id, exercicioId: Id, tipo: TipoSerie, medidas: Medidas }),
  SerieCorrigida: z.object({ sessaoId: Id, serieId: Id, tipo: TipoSerie, medidas: Medidas }),
  SerieRemovida: z.object({ sessaoId: Id, serieId: Id }),
  ExercicioSubstituido: z.object({ sessaoId: Id, itemId: Id, exercicioId: Id, modalidade: Modalidade }),
  ExercicioPulado: z.object({ sessaoId: Id, itemId: Id }),
  SugestaoRespondida: z.object({ sessaoId: Id, itemId: Id, sugestao: Sugestao, resposta: z.enum(['aceita', 'ajustada', 'ignorada']) }),
  SessaoConcluida: z.object({ sessaoId: Id }),
  SessaoEncerradaPorInatividade: z.object({ sessaoId: Id, encerradaEm: z.iso.datetime() }),
  SessaoDescartada: z.object({ sessaoId: Id }),
} as const;

export type EventoExecucao = {
  [K in keyof typeof EventosExecucao]: { type: K; payload: z.infer<(typeof EventosExecucao)[K]> };
}[keyof typeof EventosExecucao];

export type ItemSessao = z.infer<typeof ItemSnapshot> & { pulado: boolean; exercicioOriginalId?: string };
export type SerieRealizada = { serieId: string; itemId: string; exercicioId: string; tipo: TipoSerie; medidas: Medidas; registradaEm: string };
export type StatusSessao = 'em_andamento' | 'concluida' | 'encerrada_inatividade' | 'descartada';
export type RespostaSugestao = z.infer<(typeof EventosExecucao)['SugestaoRespondida']>;

export type Sessao = {
  sessaoId: string;
  fichaId: string;
  treinoId: string;
  blocos: { blocoId: string; itens: ItemSessao[] }[];
  series: SerieRealizada[];
  respostas: RespostaSugestao[];
  status: StatusSessao;
  iniciadaEm: string;
  encerradaEm?: string;
};

export type EstadoExecucao = { sessoes: Readonly<Record<string, Sessao>> };
export const estadoInicialExecucao: EstadoExecucao = { sessoes: {} };

/** 01-dominio §6: sessão sem série nova há mais de 3 h é encerrada por inatividade. */
export const LIMITE_INATIVIDADE_MS = 3 * 60 * 60 * 1000;

const itemDaSessao = (s: Sessao, itemId: string) => s.blocos.flatMap((b) => b.itens).find((i) => i.itemId === itemId);
const mapItens = (s: Sessao, fn: (i: ItemSessao) => ItemSessao): Sessao => ({ ...s, blocos: s.blocos.map((b) => ({ ...b, itens: b.itens.map(fn) })) });

export function reduzirExecucao(estado: EstadoExecucao, e: EventoExecucao, meta: Meta): EstadoExecucao {
  const sessao = estado.sessoes[e.payload.sessaoId];
  const com = (s: Sessao): EstadoExecucao => ({ sessoes: { ...estado.sessoes, [s.sessaoId]: s } });

  if (e.type === 'SessaoIniciada') {
    if (sessao) return estado;
    const p = e.payload;
    const itens = p.snapshot.blocos.flatMap((b) => b.itens.map((i) => i.itemId));
    if (new Set(itens).size !== itens.length) return estado; // snapshot com itemId repetido é inválido
    return com({
      sessaoId: p.sessaoId,
      fichaId: p.fichaId,
      treinoId: p.treinoId,
      blocos: p.snapshot.blocos.map((b) => ({ blocoId: b.blocoId, itens: b.itens.map((i) => ({ ...i, pulado: false })) })),
      series: [],
      respostas: [],
      status: 'em_andamento',
      iniciadaEm: meta.ocorridoEm,
    });
  }
  // Imutabilidade (01-dominio §8): sessão inexistente ou já encerrada não aceita mais nada (P8: no-op).
  if (!sessao || sessao.status !== 'em_andamento') return estado;

  switch (e.type) {
    case 'SerieRegistrada': {
      const p = e.payload;
      const item = itemDaSessao(sessao, p.itemId);
      if (!item || sessao.series.some((s) => s.serieId === p.serieId) || p.medidas.modalidade !== item.modalidade) return estado;
      return com({ ...sessao, series: [...sessao.series, { serieId: p.serieId, itemId: p.itemId, exercicioId: p.exercicioId, tipo: p.tipo, medidas: p.medidas, registradaEm: meta.ocorridoEm }] });
    }
    case 'SerieCorrigida': {
      const p = e.payload;
      const serie = sessao.series.find((s) => s.serieId === p.serieId);
      if (!serie || p.medidas.modalidade !== serie.medidas.modalidade) return estado;
      return com({ ...sessao, series: sessao.series.map((s) => (s.serieId === p.serieId ? { ...s, tipo: p.tipo, medidas: p.medidas } : s)) });
    }
    case 'SerieRemovida':
      return com({ ...sessao, series: sessao.series.filter((s) => s.serieId !== e.payload.serieId) });
    case 'ExercicioSubstituido': {
      const p = e.payload;
      if (!itemDaSessao(sessao, p.itemId)) return estado;
      return com(
        mapItens(sessao, (i) =>
          i.itemId === p.itemId ? { ...i, exercicioId: p.exercicioId, modalidade: p.modalidade, exercicioOriginalId: i.exercicioOriginalId ?? i.exercicioId } : i,
        ),
      );
    }
    case 'ExercicioPulado':
      if (!itemDaSessao(sessao, e.payload.itemId)) return estado;
      return com(mapItens(sessao, (i) => (i.itemId === e.payload.itemId ? { ...i, pulado: true } : i)));
    case 'SugestaoRespondida':
      if (!itemDaSessao(sessao, e.payload.itemId)) return estado;
      return com({ ...sessao, respostas: [...sessao.respostas, e.payload] });
    case 'SessaoConcluida':
      return com({ ...sessao, status: 'concluida', encerradaEm: meta.ocorridoEm });
    case 'SessaoEncerradaPorInatividade':
      return com({ ...sessao, status: 'encerrada_inatividade', encerradaEm: e.payload.encerradaEm });
    case 'SessaoDescartada':
      return com({ ...sessao, status: 'descartada', encerradaEm: meta.ocorridoEm });
  }
}

/** ID determinístico do evento de inatividade (ADR-0006, regra 8): dois aparelhos convergem por idempotência. */
export function eventIdEncerramentoPorInatividade(sessaoId: string): string {
  // UUID "nome-baseado" simples e estável: prefixo fixo + hash FNV-1a do sessaoId, formatado como UUID.
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < sessaoId.length; i++) {
    h1 = Math.imul(h1 ^ sessaoId.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ sessaoId.charCodeAt(i), 0x811c9dc5) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  const a = hex(h1), b = hex(h2);
  return `${a}-${b.slice(0, 4)}-5${b.slice(5, 8)}-8${a.slice(1, 4)}-${b}${a.slice(4, 8)}`;
}
