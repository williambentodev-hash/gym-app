import { describe, expect, it } from 'vitest';
import { estadoInicial, reduzir, tonelagem, type SerieRegistrada } from './index';

const serie = (p: Partial<SerieRegistrada> = {}): SerieRegistrada => ({
  type: 'SerieRegistrada',
  exercicioId: 'supino',
  reps: 10,
  cargaKg: 60,
  tipo: 'trabalho',
  ...p,
});

describe('tonelagem', () => {
  it('soma repetições × carga apenas das séries de trabalho', () => {
    expect(
      tonelagem([
        { reps: 8, cargaKg: 40, tipo: 'aquecimento' },
        { reps: 10, cargaKg: 60, tipo: 'trabalho' },
        { reps: 9, cargaKg: 60, tipo: 'trabalho' },
      ]),
    ).toBe(1140);
  });
});

describe('reduzir (progresso a partir de eventos)', () => {
  it('ignora aquecimento (01-dominio §4)', () => {
    expect(reduzir(estadoInicial, serie({ tipo: 'aquecimento' }))).toEqual({});
  });

  it('acumula séries, tonelagem e recorde por exercício', () => {
    const estado = [serie({ cargaKg: 60 }), serie({ cargaKg: 70, reps: 6 }), serie({ exercicioId: 'remada', cargaKg: 50 })]
      .reduce(reduzir, estadoInicial);
    expect(estado).toEqual({
      supino: { series: 2, tonelagem: 600 + 420, recordeKg: 70 },
      remada: { series: 1, tonelagem: 500, recordeKg: 50 },
    });
  });

  it('é puro: não altera o estado recebido', () => {
    const antes = reduzir(estadoInicial, serie());
    const copia = JSON.parse(JSON.stringify(antes));
    reduzir(antes, serie({ cargaKg: 100 }));
    expect(antes).toEqual(copia);
  });
});
