import { describe, expect, it } from 'vitest';
import {
  adicionarItem, adicionarTreino, agruparItens, aposSerie, ativarFicha, avaliarVolume, concluirSessao, criarExercicioPersonalizado,
  criarFicha, descansoSeg, e1rm, estadoInicialDominio, iniciarSessao, progressoPorExercicio, rampaAquecimento, reduzirDominio,
  registrarSerie, removerItem, semanaIso, sugerirCarga, superaRecorde, verificarInatividade, volumeSemanal,
  type Decisao, type EstadoDominio, type Medidas, type Prescricao,
} from './index';

let relogio = Date.parse('2026-11-18T10:00:00Z');
/** Aplica os eventos de uma decisão aceita, como o motor faria. Falha o teste se recusada. */
function gravar(e: EstadoDominio, d: Decisao<{ type: string; payload: unknown }>): EstadoDominio {
  if (!d.ok) throw new Error(`recusado: ${d.erro}`);
  return d.eventos.reduce((s, ev) => reduzirDominio(s, { type: ev.type, payload: ev.payload, schemaVersion: 1, ocorridoEm: new Date((relogio += 60_000)).toISOString() }), e);
}

const p812: Prescricao = { series: 3, repeticoes: { min: 8, max: 12 }, tecnica: 'normal' };
const cr = (cargaKg: number, reps: number, rir?: number): Medidas => ({ modalidade: 'carga_repeticoes', cargaKg, reps, ...(rir !== undefined ? { rir } : {}) });

function fichaPronta(): EstadoDominio {
  let e = estadoInicialDominio;
  e = gravar(e, criarFicha(e.planejamento, { fichaId: 'f1', nome: 'ABC' }));
  e = gravar(e, adicionarTreino(e.planejamento, { fichaId: 'f1', treinoId: 'tA', nome: 'A' }));
  e = gravar(e, adicionarItem(e.planejamento, { fichaId: 'f1', treinoId: 'tA', blocoId: 'b1', itemId: 'i1', exercicioId: 'supino', modalidade: 'carga_repeticoes', prescricao: p812 }));
  return e;
}

describe('comandos: invariantes de escrita', () => {
  it('não ativa ficha sem exercícios; ativa quando há', () => {
    let e = estadoInicialDominio;
    e = gravar(e, criarFicha(e.planejamento, { fichaId: 'f1', nome: 'ABC' }));
    expect(ativarFicha(e.planejamento, 'f1')).toMatchObject({ ok: false });
    e = fichaPronta();
    expect(ativarFicha(e.planejamento, 'f1')).toMatchObject({ ok: true });
  });

  it('ficha ativa não pode perder o último exercício', () => {
    let e = fichaPronta();
    e = gravar(e, ativarFicha(e.planejamento, 'f1'));
    expect(removerItem(e.planejamento, { fichaId: 'f1', itemId: 'i1' })).toMatchObject({ ok: false });
  });

  it('agrupar exige ≥ 2 itens distintos do mesmo treino (e deduplica)', () => {
    const e = fichaPronta();
    expect(agruparItens(e.planejamento, { fichaId: 'f1', treinoId: 'tA', blocoId: 'bs', itemIds: ['i1', 'i1'] })).toMatchObject({ ok: false });
  });

  it('nome de exercício personalizado é único por usuário', () => {
    let e = estadoInicialDominio;
    e = gravar(e, criarExercicioPersonalizado(e.catalogo, { exercicioId: 'x1', nome: 'Remada Pendlay', modalidade: 'carga_repeticoes', gruposMusculares: ['costas'] }));
    expect(criarExercicioPersonalizado(e.catalogo, { exercicioId: 'x2', nome: ' remada pendlay ', modalidade: 'carga_repeticoes', gruposMusculares: [] })).toMatchObject({ ok: false });
  });

  it('uma sessão em andamento por vez; concluir exige série de trabalho; exercicioId vem do estado', () => {
    let e = fichaPronta();
    const snapshot = { blocos: [{ blocoId: 'b1', itens: [{ itemId: 'i1', exercicioId: 'supino', modalidade: 'carga_repeticoes' as const, prescricao: p812 }] }] };
    e = gravar(e, iniciarSessao(e.execucao, { sessaoId: 's1', fichaId: 'f1', treinoId: 'tA', snapshot }));
    expect(iniciarSessao(e.execucao, { sessaoId: 's2', fichaId: 'f1', treinoId: 'tA', snapshot })).toMatchObject({ ok: false });
    expect(concluirSessao(e.execucao, 's1')).toMatchObject({ ok: false });
    const d = registrarSerie(e.execucao, { sessaoId: 's1', serieId: 'x1', itemId: 'i1', tipo: 'trabalho', medidas: cr(60, 10) });
    expect(d.ok && d.eventos[0]!.payload).toMatchObject({ exercicioId: 'supino' });
    e = gravar(e, d);
    expect(concluirSessao(e.execucao, 's1')).toMatchObject({ ok: true });
  });

  it('inatividade: encerra após 3 h com fim = última série e eventId determinístico', () => {
    let e = fichaPronta();
    const snapshot = { blocos: [{ blocoId: 'b1', itens: [{ itemId: 'i1', exercicioId: 'supino', modalidade: 'carga_repeticoes' as const, prescricao: p812 }] }] };
    e = gravar(e, iniciarSessao(e.execucao, { sessaoId: 's1', fichaId: 'f1', treinoId: 'tA', snapshot }));
    e = gravar(e, registrarSerie(e.execucao, { sessaoId: 's1', serieId: 'x1', itemId: 'i1', tipo: 'trabalho', medidas: cr(60, 10) }));
    const ultima = e.execucao.sessoes['s1']!.series[0]!.registradaEm;
    expect(verificarInatividade(e.execucao, new Date(Date.parse(ultima) + 2 * 3600_000))).toHaveLength(0);
    const [ev] = verificarInatividade(e.execucao, new Date(Date.parse(ultima) + 3 * 3600_000 + 1));
    expect(ev).toMatchObject({ type: 'SessaoEncerradaPorInatividade', payload: { sessaoId: 's1', encerradaEm: ultima } });
    expect(ev!.eventId).toBe(verificarInatividade(e.execucao, new Date(Date.parse(ultima) + 5 * 3600_000))[0]!.eventId);
  });
});

describe('progresso', () => {
  function comSessao(series: Array<[string, Medidas]>): EstadoDominio {
    let e = fichaPronta();
    const snapshot = { blocos: [{ blocoId: 'b1', itens: [{ itemId: 'i1', exercicioId: 'supino', modalidade: 'carga_repeticoes' as const, prescricao: p812 }] }] };
    e = gravar(e, iniciarSessao(e.execucao, { sessaoId: 's1', fichaId: 'f1', treinoId: 'tA', snapshot }));
    series.forEach(([tipo, m], k) => (e = gravar(e, registrarSerie(e.execucao, { sessaoId: 's1', serieId: `x${k}`, itemId: 'i1', tipo: tipo as 'trabalho', medidas: m }))));
    return gravar(e, concluirSessao(e.execucao, 's1'));
  }

  it('aquecimento fora; drop conta no volume e tonelagem, mas não no recorde (ADR-0012)', () => {
    const e = comSessao([['aquecimento', cr(30, 8)], ['trabalho', cr(60, 10)], ['trabalho', cr(62.5, 8)], ['drop', cr(80, 3)]]);
    const p = progressoPorExercicio(e.execucao)['supino']!;
    expect(p.series).toBe(3);
    expect(p.tonelagemKg).toBe(600 + 500 + 240);
    expect(p.recorde.cargaKg).toBe(62.5); // o drop de 80 kg (hipotético) não vira recorde
    expect(p.ultimaSessao?.seriesTrabalho).toHaveLength(2);
  });

  it('e1RM (Epley) e detecção de recorde', () => {
    expect(e1rm(100, 10)).toBe(133.3);
    expect(e1rm(100, 20)).toBeUndefined();
    expect(superaRecorde({ cargaKg: 60, e1rmKg: 80 }, cr(60, 12))).toBe(true); // mais reps na mesma carga = e1RM maior
    expect(superaRecorde({ cargaKg: 60, e1rmKg: 80 }, cr(50, 8))).toBe(false);
  });

  it('volume semanal: séries efetivas (RIR ≤ 3 ou não informado) por grupo muscular', () => {
    const e = comSessao([['trabalho', cr(60, 10, 2)], ['trabalho', cr(60, 10, 5)], ['trabalho', cr(60, 10)]]);
    const semana = semanaIso(e.execucao.sessoes['s1']!.iniciadaEm);
    expect(volumeSemanal(e.execucao, () => ['peito', 'triceps'], semana)).toEqual({ peito: 2, triceps: 2 });
  });

  it('semana ISO correta na virada de ano', () => {
    expect(semanaIso('2026-11-18T12:00:00Z')).toBe('2026-W47');
    expect(semanaIso('2027-01-01T12:00:00Z')).toBe('2026-W53');
  });
});

describe('orientação', () => {
  it('dupla progressão: sobe quando todas as séries chegam ao topo com RIR ≥ 1', () => {
    const s = sugerirCarga(p812, [cr(60, 12, 2), cr(60, 12, 1), cr(60, 12, 1)], true);
    expect(s).toMatchObject({ tipo: 'subir', cargaKg: 62.5 });
    expect(sugerirCarga(p812, [cr(20, 12, 2), cr(20, 12, 2)], false)).toMatchObject({ tipo: 'subir', cargaKg: 21 });
  });

  it('não sobe se alguma série falhou no topo com RIR 0 ou não chegou', () => {
    expect(sugerirCarga(p812, [cr(60, 12, 0), cr(60, 12, 1)], true)).toMatchObject({ tipo: 'manter', cargaKg: 60 });
    expect(sugerirCarga(p812, [cr(60, 12), cr(60, 10)], true)).toMatchObject({ tipo: 'manter' });
  });

  it('reduz ~5% quando metade ou mais das séries fica abaixo do mínimo', () => {
    expect(sugerirCarga(p812, [cr(80, 6), cr(80, 5), cr(80, 9)], true)).toMatchObject({ tipo: 'reduzir', cargaKg: 76 });
  });

  it('sem histórico usa a carga da ficha; tempo/cardio não se aplica', () => {
    expect(sugerirCarga({ ...p812, cargaKg: 40 }, undefined, true)).toMatchObject({ tipo: 'sem_historico', cargaKg: 40 });
    expect(sugerirCarga({ series: 3, duracaoSeg: 60, tecnica: 'normal' }, [{ modalidade: 'tempo', duracaoSeg: 60 }], false)).toMatchObject({ tipo: 'nao_aplicavel' });
  });

  it('peso corporal: sugere carga adicional quando todas as séries chegam ao topo', () => {
    expect(sugerirCarga({ series: 3, repeticoes: { min: 6, max: 10 }, tecnica: 'normal' }, [{ modalidade: 'peso_corporal', reps: 10 }, { modalidade: 'peso_corporal', reps: 10 }], true))
      .toMatchObject({ tipo: 'subir', cargaKg: 2.5 });
  });

  it('descanso, bi-set e rampa de aquecimento', () => {
    expect(descansoSeg(p812, true)).toBe(150);
    expect(descansoSeg({ ...p812, descansoSeg: 90 }, true)).toBe(90);
    expect(aposSerie(['a', 'b'], 'a')).toEqual({ descansar: false, proximoItemId: 'b' }); // bi-set: segue sem descanso
    expect(aposSerie(['a', 'b'], 'b')).toEqual({ descansar: true, proximoItemId: 'a' }); // fim da volta: descansa
    expect(rampaAquecimento(100)).toEqual([{ cargaKg: 50, reps: 8 }, { cargaKg: 70, reps: 5 }, { cargaKg: 85, reps: 2 }]);
    expect(rampaAquecimento(30)).toEqual([]);
  });

  it('avalia volume semanal contra a faixa', () => {
    expect(avaliarVolume({ peito: 6, costas: 14, quadriceps: 24 })).toEqual({
      peito: { series: 6, status: 'abaixo' }, costas: { series: 14, status: 'dentro' }, quadriceps: { series: 24, status: 'acima' },
    });
  });
});
