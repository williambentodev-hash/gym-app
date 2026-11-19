import { describe, expect, it } from 'vitest';
import { criarEvento, estadoInicialDominio, eventIdEncerramentoPorInatividade, interpretarEvento, reduzirDominio, type EstadoDominio, type Prescricao, type TipoEvento } from './index';

let relogio = Date.parse('2026-11-18T10:00:00Z');
const env = <T extends TipoEvento>(type: T, payload: unknown, schemaVersion = 1) => ({
  type,
  payload,
  schemaVersion,
  ocorridoEm: new Date((relogio += 60_000)).toISOString(),
});
const aplicar = (eventos: ReturnType<typeof env>[], inicial: EstadoDominio = estadoInicialDominio) => eventos.reduce(reduzirDominio, inicial);

const p812: Prescricao = { series: 3, repeticoes: { min: 8, max: 12 }, cargaKg: 60, tecnica: 'normal' };
const fichaBase = [
  env('FichaCriada', { fichaId: 'f1', nome: 'Hipertrofia ABC' }),
  env('TreinoAdicionado', { fichaId: 'f1', treinoId: 'tA', nome: 'A – Peito' }),
  env('ItemAdicionado', { fichaId: 'f1', treinoId: 'tA', blocoId: 'b1', itemId: 'i1', exercicioId: 'supino', modalidade: 'carga_repeticoes', prescricao: p812 }),
  env('ItemAdicionado', { fichaId: 'f1', treinoId: 'tA', blocoId: 'b2', itemId: 'i2', exercicioId: 'crucifixo', modalidade: 'carga_repeticoes', prescricao: p812 }),
  env('ItemAdicionado', { fichaId: 'f1', treinoId: 'tA', blocoId: 'b3', itemId: 'i3', exercicioId: 'barra', modalidade: 'peso_corporal', prescricao: { series: 3, repeticoes: { min: 6, max: 10 }, tecnica: 'normal' } }),
];

describe('interpretarEvento', () => {
  it('ignora tipo desconhecido, versão futura e payload inválido (P8)', () => {
    expect(interpretarEvento(env('FichaCriada', { fichaId: 'f', nome: 'x' }, 2))).toBeNull();
    expect(interpretarEvento({ type: 'EventoDoFuturo', schemaVersion: 1, payload: {}, ocorridoEm: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(interpretarEvento(env('FichaCriada', { fichaId: 'f' }))).toBeNull();
    expect(interpretarEvento(env('ItemAdicionado', { ...fichaBase[2]!.payload as object, prescricao: { series: 3, repeticoes: { min: 12, max: 8 }, tecnica: 'normal' } }))).toBeNull();
  });

  it('criarEvento valida no lado do comando e lança se inválido', () => {
    expect(() => criarEvento('FichaCriada', { fichaId: 'f', nome: '' })).toThrow();
    expect(criarEvento('FichaCriada', { fichaId: 'f', nome: ' Treino ' }).payload.nome).toBe('Treino'); // trim
  });
});

describe('planejamento', () => {
  it('monta ficha, treino e blocos na ordem de inserção', () => {
    const t = aplicar(fichaBase).planejamento.fichas['f1']!.treinos[0]!;
    expect(t.blocos.map((b) => b.blocoId)).toEqual(['b1', 'b2', 'b3']);
  });

  it('agrupa itens em bi-set na posição do primeiro item e remove blocos vazios', () => {
    const e = aplicar([...fichaBase, env('ItensAgrupados', { fichaId: 'f1', treinoId: 'tA', blocoId: 'bs', itemIds: ['i2', 'i3'] })]);
    const blocos = e.planejamento.fichas['f1']!.treinos[0]!.blocos;
    expect(blocos.map((b) => [b.blocoId, b.itens.map((i) => i.itemId)])).toEqual([['b1', ['i1']], ['bs', ['i2', 'i3']]]);
  });

  it('regressão (propriedade, seed 170): itemIds repetidos no agrupamento não duplicam o item', () => {
    const e = aplicar([...fichaBase, env('ItensAgrupados', { fichaId: 'f1', treinoId: 'tA', blocoId: 'bs', itemIds: ['i2', 'i2', 'i3'] })]);
    const ids = e.planejamento.fichas['f1']!.treinos[0]!.blocos.flatMap((b) => b.itens.map((i) => i.itemId));
    expect(ids).toEqual(['i1', 'i2', 'i3']);
  });

  it('desagrupa colocando o item num bloco logo depois', () => {
    const e = aplicar([
      ...fichaBase,
      env('ItensAgrupados', { fichaId: 'f1', treinoId: 'tA', blocoId: 'bs', itemIds: ['i2', 'i3'] }),
      env('ItemDesagrupado', { fichaId: 'f1', itemId: 'i2', novoBlocoId: 'bn' }),
    ]);
    expect(e.planejamento.fichas['f1']!.treinos[0]!.blocos.map((b) => b.blocoId)).toEqual(['b1', 'bs', 'bn']);
  });

  it('reordenação: ids desconhecidos ignorados, ausentes vão para o fim (D2)', () => {
    const e = aplicar([...fichaBase, env('BlocosReordenados', { fichaId: 'f1', treinoId: 'tA', ordem: ['b3', 'xx', 'b1'] })]);
    expect(e.planejamento.fichas['f1']!.treinos[0]!.blocos.map((b) => b.blocoId)).toEqual(['b3', 'b1', 'b2']);
  });

  it('rejeita técnica incompatível com a modalidade (drop-set em cardio)', () => {
    const antes = aplicar(fichaBase);
    const depois = reduzirDominio(antes, env('ItemAdicionado', { fichaId: 'f1', treinoId: 'tA', blocoId: 'b9', itemId: 'i9', exercicioId: 'esteira', modalidade: 'cardio', prescricao: { series: 1, duracaoSeg: 600, tecnica: 'drop_set' } }));
    expect(depois).toBe(antes);
  });

  it('ficha arquivada ignora eventos posteriores; várias fichas ativas ao mesmo tempo', () => {
    const e = aplicar([
      ...fichaBase,
      env('FichaAtivada', { fichaId: 'f1' }),
      env('FichaCriada', { fichaId: 'f2', nome: 'Core' }),
      env('FichaAtivada', { fichaId: 'f2' }),
    ]);
    expect(Object.values(e.planejamento.fichas).filter((f) => f.ativa)).toHaveLength(2);
    const arq = aplicar([env('FichaArquivada', { fichaId: 'f1' }), env('FichaRenomeada', { fichaId: 'f1', nome: 'novo' })], e);
    expect(arq.planejamento.fichas['f1']).toMatchObject({ arquivada: true, ativa: false, nome: 'Hipertrofia ABC' });
  });
});

describe('execução', () => {
  const snapshot = { blocos: [{ blocoId: 'b1', itens: [{ itemId: 'i1', exercicioId: 'supino', modalidade: 'carga_repeticoes', prescricao: p812 }] }] };
  const inicio = [env('SessaoIniciada', { sessaoId: 's1', fichaId: 'f1', treinoId: 'tA', snapshot })];
  const serie = (serieId: string, tipo = 'trabalho', cargaKg = 60) =>
    env('SerieRegistrada', { sessaoId: 's1', serieId, itemId: 'i1', exercicioId: 'supino', tipo, medidas: { modalidade: 'carga_repeticoes', cargaKg, reps: 10 } });

  it('registra séries de trabalho, aquecimento e drop (ADR-0012)', () => {
    const s = aplicar([...inicio, serie('a', 'aquecimento', 30), serie('t1'), serie('d1', 'drop', 40)]).execucao.sessoes['s1']!;
    expect(s.series.map((x) => x.tipo)).toEqual(['aquecimento', 'trabalho', 'drop']);
  });

  it('rejeita medidas de modalidade diferente da do item', () => {
    const antes = aplicar(inicio);
    const depois = reduzirDominio(antes, env('SerieRegistrada', { sessaoId: 's1', serieId: 'x', itemId: 'i1', exercicioId: 'supino', tipo: 'trabalho', medidas: { modalidade: 'tempo', duracaoSeg: 30 } }));
    expect(depois).toBe(antes);
  });

  it('substituição de exercício troca a modalidade aceita e guarda o original', () => {
    const e = aplicar([...inicio, env('ExercicioSubstituido', { sessaoId: 's1', itemId: 'i1', exercicioId: 'flexao', modalidade: 'peso_corporal' })]);
    const item = e.execucao.sessoes['s1']!.blocos[0]!.itens[0]!;
    expect(item).toMatchObject({ exercicioId: 'flexao', modalidade: 'peso_corporal', exercicioOriginalId: 'supino' });
  });

  it('sessão encerrada é imutável (01-dominio §8)', () => {
    const fechada = aplicar([...inicio, serie('t1'), env('SessaoConcluida', { sessaoId: 's1' })]);
    const depois = aplicar([serie('t2'), env('SerieRemovida', { sessaoId: 's1', serieId: 't1' }), env('SessaoDescartada', { sessaoId: 's1' })], fechada);
    expect(depois).toBe(fechada);
  });

  it('encerramento por inatividade usa o horário informado e tem eventId determinístico', () => {
    const e = aplicar([...inicio, env('SessaoEncerradaPorInatividade', { sessaoId: 's1', encerradaEm: '2026-11-18T12:00:00.000Z' })]);
    expect(e.execucao.sessoes['s1']).toMatchObject({ status: 'encerrada_inatividade', encerradaEm: '2026-11-18T12:00:00.000Z' });
    expect(eventIdEncerramentoPorInatividade('s1')).toBe(eventIdEncerramentoPorInatividade('s1'));
    expect(eventIdEncerramentoPorInatividade('s1')).not.toBe(eventIdEncerramentoPorInatividade('s2'));
    expect(eventIdEncerramentoPorInatividade('s1')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
