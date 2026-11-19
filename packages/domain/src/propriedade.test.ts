// Teste de propriedade (P8): sequências aleatórias de eventos — válidos, inválidos, duplicados e fora de ordem,
// como chegam de vários aparelhos — nunca quebram o reducer e sempre produzem um estado que respeita as invariantes.
import { describe, expect, it } from 'vitest';
import { estadoInicialDominio, reduzirDominio, type EstadoDominio } from './index';

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gerador(seed: number) {
  const r = prng(seed);
  const de = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const fichas = ['f1', 'f2'], treinos = ['t1', 't2', 't3'], blocos = ['b1', 'b2', 'b3', 'b4', 'b5'], itens = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'];
  const sessoes = ['s1', 's2'], series = ['x1', 'x2', 'x3', 'x4'];
  const modalidades = ['carga_repeticoes', 'peso_corporal', 'tempo', 'cardio'] as const;
  const prescricao = () => ({ series: 1 + Math.floor(r() * 5), repeticoes: { min: 6, max: de([5, 8, 12]) }, tecnica: de(['normal', 'drop_set', 'rest_pause']) });
  const medidas = (m: string) =>
    m === 'carga_repeticoes' ? { modalidade: m, cargaKg: 40, reps: 10 } : m === 'peso_corporal' ? { modalidade: m, reps: 8 } : m === 'tempo' ? { modalidade: m, duracaoSeg: 30 } : { modalidade: m, duracaoSeg: 600 };
  let t = Date.parse('2026-11-18T10:00:00Z');

  return () => {
    const m = de(modalidades);
    const tipos: Array<[string, () => unknown]> = [
      ['FichaCriada', () => ({ fichaId: de(fichas), nome: 'F' })],
      ['FichaAtivada', () => ({ fichaId: de(fichas) })],
      ['FichaArquivada', () => ({ fichaId: de(fichas) })],
      ['TreinoAdicionado', () => ({ fichaId: de(fichas), treinoId: de(treinos), nome: 'T' })],
      ['TreinoRemovido', () => ({ fichaId: de(fichas), treinoId: de(treinos) })],
      ['TreinosReordenados', () => ({ fichaId: de(fichas), ordem: [de(treinos), de(treinos)] })],
      ['ItemAdicionado', () => ({ fichaId: de(fichas), treinoId: de(treinos), blocoId: de(blocos), itemId: de(itens), exercicioId: 'e', modalidade: m, prescricao: prescricao() })],
      ['PrescricaoAlterada', () => ({ fichaId: de(fichas), itemId: de(itens), prescricao: prescricao() })],
      ['ItemRemovido', () => ({ fichaId: de(fichas), itemId: de(itens) })],
      ['ItensAgrupados', () => ({ fichaId: de(fichas), treinoId: de(treinos), blocoId: de(blocos), itemIds: [de(itens), de(itens), de(itens)] })],
      ['ItemDesagrupado', () => ({ fichaId: de(fichas), itemId: de(itens), novoBlocoId: de(blocos) })],
      ['BlocosReordenados', () => ({ fichaId: de(fichas), treinoId: de(treinos), ordem: [de(blocos), de(blocos), de(blocos)] })],
      ['SessaoIniciada', () => ({ sessaoId: de(sessoes), fichaId: 'f1', treinoId: 't1', snapshot: { blocos: [{ blocoId: 'b1', itens: [{ itemId: 'i1', exercicioId: 'e', modalidade: m, prescricao: prescricao() }] }] } })],
      ['SerieRegistrada', () => ({ sessaoId: de(sessoes), serieId: de(series), itemId: de(['i1', 'i2']), exercicioId: 'e', tipo: de(['aquecimento', 'trabalho', 'drop']), medidas: medidas(de(modalidades)) })],
      ['SerieRemovida', () => ({ sessaoId: de(sessoes), serieId: de(series) })],
      ['ExercicioSubstituido', () => ({ sessaoId: de(sessoes), itemId: 'i1', exercicioId: 'e2', modalidade: de(modalidades) })],
      ['SessaoConcluida', () => ({ sessaoId: de(sessoes) })],
      ['SessaoDescartada', () => ({ sessaoId: de(sessoes) })],
      ['Lixo', () => ({ qualquer: r() })], // tipo desconhecido
    ];
    const [type, payload] = de(tipos);
    return { type, payload: r() < 0.05 ? {} : payload(), schemaVersion: r() < 0.03 ? 2 : 1, ocorridoEm: new Date((t += 1000)).toISOString() };
  };
}

function verificarInvariantes(e: EstadoDominio) {
  for (const f of Object.values(e.planejamento.fichas)) {
    if (f.arquivada) expect(f.ativa).toBe(false);
    const treinoIds = f.treinos.map((t) => t.treinoId);
    expect(new Set(treinoIds).size).toBe(treinoIds.length);
    const blocoIds = f.treinos.flatMap((t) => t.blocos.map((b) => b.blocoId));
    expect(new Set(blocoIds).size).toBe(blocoIds.length); // bloco pertence a um único treino
    const itemIds = f.treinos.flatMap((t) => t.blocos.flatMap((b) => b.itens.map((i) => i.itemId)));
    expect(new Set(itemIds).size).toBe(itemIds.length); // item aparece uma única vez na ficha
    for (const t of f.treinos) for (const b of t.blocos) {
      expect(b.itens.length).toBeGreaterThan(0); // sem blocos vazios
      for (const i of b.itens) {
        expect(i.prescricao.repeticoes ? i.prescricao.repeticoes.min <= i.prescricao.repeticoes.max : true).toBe(true);
        if (i.modalidade === 'tempo' || i.modalidade === 'cardio') expect(i.prescricao.tecnica).toBe('normal');
      }
    }
  }
  for (const s of Object.values(e.execucao.sessoes)) {
    const ids = s.series.map((x) => x.serieId);
    expect(new Set(ids).size).toBe(ids.length);
    if (s.status !== 'em_andamento') expect(s.encerradaEm).toBeDefined();
  }
}

describe('propriedade: reducer total e invariantes preservadas', () => {
  it.each(Array.from({ length: 200 }, (_, i) => i + 1))('seed %i', (seed) => {
    const proximo = gerador(seed);
    let estado = estadoInicialDominio;
    for (let i = 0; i < 300; i++) estado = reduzirDominio(estado, proximo());
    verificarInvariantes(estado);
  });

  it('sessão encerrada nunca muda depois (imutabilidade sob eventos aleatórios)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const proximo = gerador(seed * 7919);
      let estado = estadoInicialDominio;
      const congeladas = new Map<string, string>();
      for (let i = 0; i < 300; i++) {
        estado = reduzirDominio(estado, proximo());
        for (const s of Object.values(estado.execucao.sessoes)) {
          const json = JSON.stringify(s);
          if (s.status !== 'em_andamento') {
            if (congeladas.has(s.sessaoId)) expect(json).toBe(congeladas.get(s.sessaoId));
            else congeladas.set(s.sessaoId, json);
          }
        }
      }
    }
  });
});
