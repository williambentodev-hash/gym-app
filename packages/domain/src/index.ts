// API pública do domínio (ADR-0009, R7: só isto é importável de fora).
import { estadoInicialCatalogo, reduzirCatalogo, type EstadoCatalogo, type EventoCatalogo } from './catalogo/index';
import { estadoInicialExecucao, reduzirExecucao, type EstadoExecucao, type EventoExecucao } from './execucao/index';
import { estadoInicialPlanejamento, reduzirPlanejamento, type EstadoPlanejamento, type EventoPlanejamento } from './planejamento/index';
import { interpretarEvento, TIPOS_CATALOGO, TIPOS_PLANEJAMENTO, type EnvelopeMinimo } from './eventos';

export * from './comum/index';
export * from './catalogo/index';
export * from './planejamento/index';
export * from './execucao/index';
export { criarEvento, interpretarEvento, ESQUEMAS_V1, type EventoDominio, type TipoEvento, type EnvelopeMinimo } from './eventos';

/** Estado de todos os contextos, derivado do log de eventos do usuário. */
export type EstadoDominio = { catalogo: EstadoCatalogo; planejamento: EstadoPlanejamento; execucao: EstadoExecucao };
export const estadoInicialDominio: EstadoDominio = {
  catalogo: estadoInicialCatalogo,
  planejamento: estadoInicialPlanejamento,
  execucao: estadoInicialExecucao,
};

/**
 * Reducer raiz: interpreta o envelope e despacha para o contexto dono do evento.
 * Total por construção (P8): envelope desconhecido/inválido não altera o estado.
 */
export function reduzirDominio(estado: EstadoDominio, env: EnvelopeMinimo): EstadoDominio {
  const e = interpretarEvento(env);
  if (!e) return estado;
  if (TIPOS_CATALOGO.has(e.type)) {
    const catalogo = reduzirCatalogo(estado.catalogo, e as EventoCatalogo);
    return catalogo === estado.catalogo ? estado : { ...estado, catalogo };
  }
  if (TIPOS_PLANEJAMENTO.has(e.type)) {
    const planejamento = reduzirPlanejamento(estado.planejamento, e as EventoPlanejamento);
    return planejamento === estado.planejamento ? estado : { ...estado, planejamento };
  }
  const execucao = reduzirExecucao(estado.execucao, e as EventoExecucao, { ocorridoEm: env.ocorridoEm });
  return execucao === estado.execucao ? estado : { ...estado, execucao };
}

// ⚠️ Legado do walking skeleton (época anterior ao ADR-0012): usado pelo app até a migração para o modelo v1.
export { DOMAIN_SPIKE_OK, tonelagem, reduzir, estadoInicial, type EstadoProgresso, type SerieRegistrada } from './legado-spike';
