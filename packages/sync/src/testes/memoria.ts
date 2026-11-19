// Implementações em memória das portas, para testes. Espelham a semântica do SQLite local e do Durable Object.
import type { EventoConfirmado, EventoEnvelope, PullResponse, PushRequest, PushResponse } from '@gym/contracts';
import type { EventoLocal, SyncStore, Transporte } from '../index';

export class StoreMemoria implements SyncStore {
  private eventos: EventoLocal[] = []; // ordem de inserção local
  private cursor = 0;

  async anexarPendente(e: EventoEnvelope) {
    this.eventos.push({ ...e });
  }
  async pendentes(limite: number) {
    return this.eventos.filter((e) => e.seq === undefined).slice(0, limite).map(({ seq: _s, ...e }) => e);
  }
  async confirmar(aceitos: ReadonlyArray<{ eventId: string; seq: number }>) {
    for (const a of aceitos) {
      const e = this.eventos.find((x) => x.eventId === a.eventId);
      if (e) e.seq = a.seq;
    }
  }
  async aplicarRemotos(remotos: ReadonlyArray<EventoConfirmado>) {
    for (const r of remotos) {
      const existente = this.eventos.find((x) => x.eventId === r.eventId);
      if (existente) existente.seq = r.seq;
      else {
        const { recebidoEm: _r, ...e } = r;
        this.eventos.push(e);
      }
    }
  }
  async lerCursor() {
    return this.cursor;
  }
  async gravarCursor(seq: number) {
    this.cursor = seq;
  }
  async todosOrdenados() {
    const confirmados = this.eventos.filter((e) => e.seq !== undefined).sort((a, b) => a.seq! - b.seq!);
    const pendentes = this.eventos.filter((e) => e.seq === undefined);
    return [...confirmados, ...pendentes];
  }
}

/** Servidor falso com a mesma semântica do UserStore (Durable Object): ordem total + idempotência. */
export class ServidorMemoria {
  readonly log: EventoConfirmado[] = [];

  push(req: PushRequest): PushResponse {
    const aceitos = req.eventos.map((e) => {
      const existente = this.log.find((x) => x.eventId === e.eventId);
      if (existente) return { eventId: e.eventId, seq: existente.seq };
      const confirmado: EventoConfirmado = { ...e, seq: this.log.length + 1, recebidoEm: new Date(0).toISOString() };
      this.log.push(confirmado);
      return { eventId: e.eventId, seq: confirmado.seq };
    });
    return { aceitos, headSeq: this.log.length };
  }

  pull(desde: number, limite: number): PullResponse {
    const eventos = this.log.filter((e) => e.seq > desde).slice(0, limite);
    const ultimo = eventos.at(-1)?.seq ?? desde;
    return { eventos, headSeq: this.log.length, temMais: ultimo < this.log.length };
  }
}

/** Transporte que pode simular rede offline e "resposta perdida" (servidor grava, cliente não fica sabendo). */
export class TransporteMemoria implements Transporte {
  online = true;
  perderProximaRespostaDePush = false;

  constructor(private readonly servidor: ServidorMemoria) {}

  async push(req: PushRequest) {
    if (!this.online) throw new Error('offline');
    const resp = this.servidor.push(structuredCloneJson(req));
    if (this.perderProximaRespostaDePush) {
      this.perderProximaRespostaDePush = false;
      throw new Error('timeout: resposta perdida');
    }
    return resp;
  }

  async pull(desde: number, limite: number) {
    if (!this.online) throw new Error('offline');
    return structuredCloneJson(this.servidor.pull(desde, limite));
  }
}

function structuredCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** PRNG determinístico (mulberry32): testes aleatórios mas reproduzíveis pela seed. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
