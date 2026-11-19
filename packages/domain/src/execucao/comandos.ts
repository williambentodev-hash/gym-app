// Comandos da Execução. R5: recebem o snapshot pronto (a tradução Ficha → Snapshot é da camada de aplicação).
import { aceitar, recusar, type Decisao, type Medidas, type Modalidade, type TipoSerie } from '../comum/index';
import {
  eventIdEncerramentoPorInatividade,
  LIMITE_INATIVIDADE_MS,
  type EstadoExecucao,
  type EventoExecucao,
  type Sessao,
} from './modelo';

type D = Decisao<EventoExecucao>;
type Snapshot = Extract<EventoExecucao, { type: 'SessaoIniciada' }>['payload']['snapshot'];

function sessaoAberta(e: EstadoExecucao, sessaoId: string): Sessao | string {
  const s = e.sessoes[sessaoId];
  if (!s) return 'sessão não encontrada';
  if (s.status !== 'em_andamento') return 'sessão encerrada não pode ser alterada'; // 01-dominio §8
  return s;
}

const itemDe = (s: Sessao, itemId: string) => s.blocos.flatMap((b) => b.itens).find((i) => i.itemId === itemId);

export function sessaoEmAndamento(e: EstadoExecucao): Sessao | undefined {
  return Object.values(e.sessoes).find((s) => s.status === 'em_andamento');
}

export function iniciarSessao(e: EstadoExecucao, i: { sessaoId: string; fichaId: string; treinoId: string; snapshot: Snapshot }): D {
  if (e.sessoes[i.sessaoId]) return recusar('sessão já existe');
  // Garantido localmente; entre aparelhos offline não há como garantir (ADR-0006, regra 7: as duas são mantidas).
  if (sessaoEmAndamento(e)) return recusar('já existe um treino em andamento: conclua ou descarte antes de iniciar outro');
  if (i.snapshot.blocos.length === 0) return recusar('o treino não tem exercícios');
  return aceitar({ type: 'SessaoIniciada', payload: i });
}

export function registrarSerie(
  e: EstadoExecucao,
  i: { sessaoId: string; serieId: string; itemId: string; tipo: TipoSerie; medidas: Medidas },
): D {
  const s = sessaoAberta(e, i.sessaoId);
  if (typeof s === 'string') return recusar(s);
  const item = itemDe(s, i.itemId);
  if (!item) return recusar('exercício não faz parte deste treino');
  if (s.series.some((x) => x.serieId === i.serieId)) return recusar('série já registrada');
  if (i.medidas.modalidade !== item.modalidade) return recusar('as medidas não correspondem ao tipo do exercício');
  // exercicioId vem do estado (considera substituição), não da interface.
  return aceitar({ type: 'SerieRegistrada', payload: { ...i, exercicioId: item.exercicioId } });
}

export function corrigirSerie(e: EstadoExecucao, i: { sessaoId: string; serieId: string; tipo: TipoSerie; medidas: Medidas }): D {
  const s = sessaoAberta(e, i.sessaoId);
  if (typeof s === 'string') return recusar(s);
  const serie = s.series.find((x) => x.serieId === i.serieId);
  if (!serie) return recusar('série não encontrada');
  if (serie.medidas.modalidade !== i.medidas.modalidade) return recusar('as medidas não correspondem ao tipo do exercício');
  return aceitar({ type: 'SerieCorrigida', payload: i });
}

export function removerSerie(e: EstadoExecucao, i: { sessaoId: string; serieId: string }): D {
  const s = sessaoAberta(e, i.sessaoId);
  if (typeof s === 'string') return recusar(s);
  if (!s.series.some((x) => x.serieId === i.serieId)) return recusar('série não encontrada');
  return aceitar({ type: 'SerieRemovida', payload: i });
}

export function substituirExercicio(e: EstadoExecucao, i: { sessaoId: string; itemId: string; exercicioId: string; modalidade: Modalidade }): D {
  const s = sessaoAberta(e, i.sessaoId);
  if (typeof s === 'string') return recusar(s);
  const item = itemDe(s, i.itemId);
  if (!item) return recusar('exercício não faz parte deste treino');
  if (item.exercicioId === i.exercicioId) return recusar('escolha um exercício diferente');
  return aceitar({ type: 'ExercicioSubstituido', payload: i });
}

export function pularExercicio(e: EstadoExecucao, i: { sessaoId: string; itemId: string }): D {
  const s = sessaoAberta(e, i.sessaoId);
  if (typeof s === 'string') return recusar(s);
  const item = itemDe(s, i.itemId);
  if (!item) return recusar('exercício não faz parte deste treino');
  if (item.pulado) return recusar('exercício já foi pulado');
  return aceitar({ type: 'ExercicioPulado', payload: i });
}

export function responderSugestao(
  e: EstadoExecucao,
  i: Extract<EventoExecucao, { type: 'SugestaoRespondida' }>['payload'],
): D {
  const s = sessaoAberta(e, i.sessaoId);
  if (typeof s === 'string') return recusar(s);
  if (!itemDe(s, i.itemId)) return recusar('exercício não faz parte deste treino');
  return aceitar({ type: 'SugestaoRespondida', payload: i });
}

export function concluirSessao(e: EstadoExecucao, sessaoId: string): D {
  const s = sessaoAberta(e, sessaoId);
  if (typeof s === 'string') return recusar(s);
  if (!s.series.some((x) => x.tipo !== 'aquecimento')) return recusar('registre ao menos uma série de trabalho, ou descarte o treino');
  return aceitar({ type: 'SessaoConcluida', payload: { sessaoId } });
}

export function descartarSessao(e: EstadoExecucao, sessaoId: string): D {
  const s = sessaoAberta(e, sessaoId);
  return typeof s === 'string' ? recusar(s) : aceitar({ type: 'SessaoDescartada', payload: { sessaoId } });
}

/**
 * Política de inatividade (01-dominio §6): sessões sem série nova há mais de 3 h são encerradas,
 * com fim = horário da última série (ou do início, se não houver série). O eventId é determinístico:
 * se dois aparelhos detectarem ao mesmo tempo, o segundo evento é descartado por idempotência (ADR-0006, regra 8).
 */
export function verificarInatividade(e: EstadoExecucao, agora: Date): Array<Extract<EventoExecucao, { type: 'SessaoEncerradaPorInatividade' }> & { eventId: string }> {
  return Object.values(e.sessoes)
    .filter((s) => s.status === 'em_andamento')
    .flatMap((s) => {
      const ultima = s.series.reduce((max, x) => (x.registradaEm > max ? x.registradaEm : max), s.iniciadaEm);
      if (agora.getTime() - Date.parse(ultima) <= LIMITE_INATIVIDADE_MS) return [];
      return [{ type: 'SessaoEncerradaPorInatividade' as const, payload: { sessaoId: s.sessaoId, encerradaEm: ultima }, eventId: eventIdEncerramentoPorInatividade(s.sessaoId) }];
    });
}
