// Motor de sincronização do cliente (ADR-0006). Genérico: não conhece o domínio (regra R3 do ADR-0009).
// Recebe por injeção: armazenamento local, transporte, reducer, gerador de IDs e relógio.
import {
  LIMITE_LOTE,
  type EventoConfirmado,
  type EventoEnvelope,
  type PullResponse,
  type PushRequest,
  type PushResponse,
} from '@gym/contracts';

export type { EventoConfirmado, EventoEnvelope } from '@gym/contracts';

/** Evento na visão local: confirmado (com seq) ou pendente (sem seq). */
export type EventoLocal = EventoEnvelope & { seq?: number };

/** Porta de armazenamento local. Implementada no app (expo-sqlite) e em memória nos testes. */
export interface SyncStore {
  /** Grava um evento novo como pendente. */
  anexarPendente(evento: EventoEnvelope): Promise<void>;
  /** Pendentes na ordem em que foram criados no aparelho. */
  pendentes(limite: number): Promise<EventoEnvelope[]>;
  /** Marca pendentes como confirmados, gravando o seq atribuído pelo servidor. */
  confirmar(aceitos: ReadonlyArray<{ eventId: string; seq: number }>): Promise<void>;
  /** Grava eventos vindos do servidor. Idempotente: evento já conhecido (mesmo eventId) é ignorado ou só ganha o seq. */
  aplicarRemotos(eventos: ReadonlyArray<EventoConfirmado>): Promise<void>;
  /**
   * Cursor de pull: maior seq até o qual o aparelho tem TODOS os eventos.
   * Não é o maior seq conhecido: ao confirmar um push recebemos seqs altos,
   * mas pode haver buracos (eventos de outros aparelhos ainda não baixados).
   */
  lerCursor(): Promise<number>;
  gravarCursor(seq: number): Promise<void>;
  /** Confirmados em ordem de seq, seguidos dos pendentes em ordem local (base do rebase). */
  todosOrdenados(): Promise<EventoLocal[]>;
}

/** Porta de transporte. Implementada com fetch autenticado no app e com um servidor falso nos testes. */
export interface Transporte {
  push(req: PushRequest): Promise<PushResponse>;
  pull(desde: number, limite: number): Promise<PullResponse>;
}

export type Reducer<S> = (estado: S, evento: EventoLocal) => S;

export type OpcoesMotor<S> = {
  store: SyncStore;
  transporte: Transporte;
  reducer: Reducer<S>;
  estadoInicial: S;
  deviceId: string;
  gerarId: () => string;
  agora?: () => Date;
};

export type ResultadoSync = { enviados: number; recebidos: number; cursor: number };

export function criarMotorSync<S>(opcoes: OpcoesMotor<S>) {
  const { store, transporte, reducer, estadoInicial, deviceId, gerarId } = opcoes;
  const agora = opcoes.agora ?? (() => new Date());
  let emAndamento: Promise<ResultadoSync> | null = null;

  /** Registra um fato do domínio. Sempre local e imediato: nunca espera a rede (QA-1). */
  async function registrar(type: string, payload: unknown, schemaVersion = 1, opcoesEvento: { eventId?: string } = {}): Promise<EventoEnvelope> {
    const evento: EventoEnvelope = {
      // eventId explícito: eventos com ID determinístico (ADR-0006, regra 8). Duplicata = ignorada pelo store.
      eventId: opcoesEvento.eventId ?? gerarId(),
      type,
      schemaVersion,
      payload,
      deviceId,
      ocorridoEm: agora().toISOString(),
    };
    await store.anexarPendente(evento);
    return evento;
  }

  async function executarSync(): Promise<ResultadoSync> {
    // 1. PUSH: envia pendentes em lotes. Reenviar após falha é seguro (idempotência por eventId).
    let enviados = 0;
    for (;;) {
      const lote = await store.pendentes(LIMITE_LOTE);
      if (lote.length === 0) break;
      const resp = await transporte.push({ eventos: lote });
      await store.confirmar(resp.aceitos);
      enviados += lote.length;
      if (lote.length < LIMITE_LOTE) break;
    }

    // 2. PULL: baixa tudo desde o cursor, inclusive os próprios eventos (inofensivo: aplicarRemotos é idempotente).
    let recebidos = 0;
    let cursor = await store.lerCursor();
    for (;;) {
      const resp = await transporte.pull(cursor, LIMITE_LOTE);
      if (resp.eventos.length > 0) {
        await store.aplicarRemotos(resp.eventos);
        cursor = resp.eventos[resp.eventos.length - 1]!.seq;
        await store.gravarCursor(cursor);
        recebidos += resp.eventos.length;
      }
      if (!resp.temMais) break;
    }
    return { enviados, recebidos, cursor };
  }

  /** Sincroniza. Chamadas concorrentes compartilham a mesma execução (evita push duplicado em paralelo). */
  function sincronizar(): Promise<ResultadoSync> {
    if (!emAndamento) {
      emAndamento = executarSync().finally(() => {
        emAndamento = null;
      });
    }
    return emAndamento;
  }

  /**
   * Estado atual = redução de (confirmados por seq) + (pendentes por ordem local).
   * O rebase é implícito: quando chegam eventos remotos, os pendentes passam a ser aplicados depois deles.
   */
  async function estado(): Promise<S> {
    const eventos = await store.todosOrdenados();
    return eventos.reduce(reducer, estadoInicial);
  }

  return { registrar, sincronizar, estado };
}

export type MotorSync<S> = ReturnType<typeof criarMotorSync<S>>;
