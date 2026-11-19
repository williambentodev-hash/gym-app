// Garante que o catálogo commitado (gerado por scripts/catalogo/gerar.ts) respeita o contrato (ADR-0013).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Catalogo } from './index';

const arquivo = new URL('../../../apps/api/public/catalogo/catalogo.v1.json', import.meta.url);

describe('catálogo publicado', () => {
  const catalogo = Catalogo.parse(JSON.parse(readFileSync(arquivo, 'utf8')));

  it('tem 100 exercícios com IDs e nomes únicos', () => {
    expect(catalogo.exercicios).toHaveLength(100);
    expect(new Set(catalogo.exercicios.map((e) => e.id)).size).toBe(100);
    expect(new Set(catalogo.exercicios.map((e) => e.nome.toLowerCase())).size).toBe(100);
  });

  it('mídias fixadas no commit da fonte (URL imutável), nunca @main', () => {
    for (const e of catalogo.exercicios) {
      expect(e.midia.animacaoUrl).toContain(`@${catalogo.fonte.commit}/`);
      expect(e.midia.animacaoUrl).not.toContain('@main');
    }
  });
});
