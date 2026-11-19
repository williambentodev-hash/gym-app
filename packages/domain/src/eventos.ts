// Registro do catálogo de eventos v1 (ADR-0012) e interpretação de envelopes vindos do log.
import type { z } from 'zod';
import { EventosCatalogo, type EventoCatalogo } from './catalogo/index';
import { EventosExecucao, type EventoExecucao } from './execucao/index';
import { EventosPlanejamento, type EventoPlanejamento } from './planejamento/index';

export const ESQUEMAS_V1 = { ...EventosCatalogo, ...EventosPlanejamento, ...EventosExecucao } as const;
export type TipoEvento = keyof typeof ESQUEMAS_V1;
export type EventoDominio = EventoCatalogo | EventoPlanejamento | EventoExecucao;

export const TIPOS_CATALOGO = new Set<string>(Object.keys(EventosCatalogo));
export const TIPOS_PLANEJAMENTO = new Set<string>(Object.keys(EventosPlanejamento));
export const TIPOS_EXECUCAO = new Set<string>(Object.keys(EventosExecucao));

/** Upcasters (04-modelo-de-eventos, D5): convertem versões antigas para a atual na leitura. Vazio na v1. */
const UPCASTERS: Partial<Record<TipoEvento, Record<number, (payload: unknown) => unknown>>> = {};

/** Envelope mínimo que o domínio precisa (estruturalmente compatível com o de @gym/contracts). */
export type EnvelopeMinimo = { type: string; schemaVersion: number; payload: unknown; ocorridoEm: string };

/**
 * Interpreta um envelope do log como evento de domínio v1.
 * Devolve `null` para tipo desconhecido, versão futura ou payload inválido: o reducer ignora (P8),
 * o que também dá compatibilidade com aparelhos que rodam uma versão mais nova do app.
 */
export function interpretarEvento(env: EnvelopeMinimo): EventoDominio | null {
  if (!(env.type in ESQUEMAS_V1)) return null;
  const tipo = env.type as TipoEvento;
  let payload = env.payload;
  if (env.schemaVersion !== 1) {
    const up = UPCASTERS[tipo]?.[env.schemaVersion];
    if (!up) return null;
    payload = up(payload);
  }
  const r = (ESQUEMAS_V1[tipo] as z.ZodType).safeParse(payload);
  return r.success ? ({ type: tipo, payload: r.data } as EventoDominio) : null;
}

/** Valida um payload na criação (lado do comando), antes de ir para o log. Lança se inválido. */
export function criarEvento<T extends TipoEvento>(type: T, payload: z.input<(typeof ESQUEMAS_V1)[T]>): { type: T; payload: z.infer<(typeof ESQUEMAS_V1)[T]>; schemaVersion: 1 } {
  const data = (ESQUEMAS_V1[type] as z.ZodType).parse(payload) as z.infer<(typeof ESQUEMAS_V1)[T]>;
  return { type, payload: data, schemaVersion: 1 };
}
