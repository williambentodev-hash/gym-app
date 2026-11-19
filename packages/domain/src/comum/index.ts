// Objetos de valor compartilhados entre contextos (04-modelo-de-eventos §2).
import { z } from 'zod';

export const Id = z.string().min(1).max(64);

export const Modalidade = z.enum(['carga_repeticoes', 'peso_corporal', 'tempo', 'cardio']);
export type Modalidade = z.infer<typeof Modalidade>;

export const Tecnica = z.enum(['normal', 'drop_set', 'rest_pause']);
export type Tecnica = z.infer<typeof Tecnica>;

/** ADR-0012: drop-set e rest-pause registram cada etapa como série própria do tipo 'drop'. */
export const TipoSerie = z.enum(['aquecimento', 'trabalho', 'drop']);
export type TipoSerie = z.infer<typeof TipoSerie>;

const kg = z.number().min(-500).max(1000); // negativo só para assistência em peso corporal
const naoNeg = z.number().min(0);

export const Prescricao = z
  .object({
    series: z.number().int().min(1).max(20),
    repeticoes: z.object({ min: z.number().int().min(1).max(100), max: z.number().int().min(1).max(100) }).optional(),
    cargaKg: naoNeg.max(1000).optional(),
    duracaoSeg: naoNeg.max(24 * 3600).optional(),
    distanciaM: naoNeg.max(1_000_000).optional(),
    rir: z.number().int().min(0).max(5).optional(),
    descansoSeg: naoNeg.max(3600).optional(),
    tecnica: Tecnica,
  })
  .refine((p) => !p.repeticoes || p.repeticoes.min <= p.repeticoes.max, { message: 'faixa de repetições inválida (mín > máx)' });
export type Prescricao = z.infer<typeof Prescricao>;

export const Medidas = z.discriminatedUnion('modalidade', [
  z.object({ modalidade: z.literal('carga_repeticoes'), cargaKg: naoNeg.max(1000), reps: z.number().int().min(0).max(1000), rir: z.number().int().min(0).max(10).optional() }),
  z.object({ modalidade: z.literal('peso_corporal'), reps: z.number().int().min(0).max(1000), cargaAdicionalKg: kg.optional(), rir: z.number().int().min(0).max(10).optional() }),
  z.object({ modalidade: z.literal('tempo'), duracaoSeg: naoNeg.max(24 * 3600), cargaAdicionalKg: kg.optional() }),
  z.object({ modalidade: z.literal('cardio'), duracaoSeg: naoNeg.max(24 * 3600), distanciaM: naoNeg.max(1_000_000).optional(), intensidade: z.number().min(0).max(10).optional() }),
]);
export type Medidas = z.infer<typeof Medidas>;

/** Invariante entre prescrição e modalidade (01-dominio §8): técnicas de carga não se aplicam a tempo/cardio. */
export function prescricaoCompativel(modalidade: Modalidade, p: Prescricao): boolean {
  if (p.tecnica !== 'normal' && (modalidade === 'tempo' || modalidade === 'cardio')) return false;
  return true;
}

/** Metadados do envelope que os reducers podem usar (nunca para ordenar: ADR-0006, regra 3). */
export type Meta = { ocorridoEm: string };

/** Reordena por uma lista explícita de IDs (04-modelo-de-eventos, D2): IDs desconhecidos são ignorados,
 *  itens existentes ausentes da lista vão para o fim, mantendo a ordem anterior (estável). */
export function reordenar<T>(itens: readonly T[], ordem: readonly string[], id: (t: T) => string): T[] {
  const porId = new Map(itens.map((t) => [id(t), t]));
  const vistos = new Set<string>();
  const primeiro: T[] = [];
  for (const k of ordem) {
    const t = porId.get(k);
    if (t && !vistos.has(k)) {
      primeiro.push(t);
      vistos.add(k);
    }
  }
  return [...primeiro, ...itens.filter((t) => !vistos.has(id(t)))];
}
