// Spike S2: valida que o app Expo consome código TypeScript de um pacote do workspace sem build.
export const DOMAIN_SPIKE_OK = 'domain conectado';

/** Tonelagem: Σ (repetições × carga) das séries de trabalho. */
export function tonelagem(series: ReadonlyArray<{ reps: number; cargaKg: number; tipo: 'aquecimento' | 'trabalho' }>): number {
  return series
    .filter((s) => s.tipo === 'trabalho')
    .reduce((total, s) => total + s.reps * s.cargaKg, 0);
}
