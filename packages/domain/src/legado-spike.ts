// ⚠️ LEGADO do spike/walking skeleton (época anterior ao ADR-0012). Removido quando o app migrar para o modelo v1.

export const DOMAIN_SPIKE_OK = 'domain conectado';

export type TipoSerie = 'aquecimento' | 'trabalho';

/** Tonelagem: Σ (repetições × carga) das séries de trabalho. */
export function tonelagem(series: ReadonlyArray<{ reps: number; cargaKg: number; tipo: TipoSerie }>): number {
  return series
    .filter((s) => s.tipo === 'trabalho')
    .reduce((total, s) => total + s.reps * s.cargaKg, 0);
}

// --- Spike S4: reducer puro sobre eventos ---

export type SerieRegistrada = {
  type: 'SerieRegistrada';
  exercicioId: string;
  reps: number;
  cargaKg: number;
  tipo: TipoSerie;
};

export type EstadoProgresso = Record<string, { series: number; tonelagem: number; recordeKg: number }>;

export const estadoInicial: EstadoProgresso = {};

/** Reducer puro: (estado, evento) → novo estado. Roda igual no app e no Worker. */
export function reduzir(estado: EstadoProgresso, evento: SerieRegistrada): EstadoProgresso {
  if (evento.tipo === 'aquecimento') return estado; // aquecimento não conta (01-dominio §4)
  const atual = estado[evento.exercicioId] ?? { series: 0, tonelagem: 0, recordeKg: 0 };
  return {
    ...estado,
    [evento.exercicioId]: {
      series: atual.series + 1,
      tonelagem: atual.tonelagem + evento.reps * evento.cargaKg,
      recordeKg: Math.max(atual.recordeKg, evento.cargaKg),
    },
  };
}
