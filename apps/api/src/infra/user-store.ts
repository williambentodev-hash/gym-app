// UserStore (ADR-0006): um Durable Object por usuário, com o log de eventos num SQLite próprio.
// O isolamento entre usuários vem da topologia (idFromName), não de um WHERE user_id = ?.
// Um Durable Object processa uma requisição por vez: a atribuição de seq é naturalmente serializada.
import { DurableObject } from 'cloudflare:workers';
import type { EventoConfirmado, EventoEnvelope, PullResponse, PushResponse } from '@gym/contracts';

type Linha = {
  seq: number;
  event_id: string;
  type: string;
  schema_version: number;
  payload: string;
  device_id: string;
  ocorrido_em: string;
  recebido_em: string;
};

const paraEvento = (l: Linha): EventoConfirmado => ({
  seq: l.seq,
  eventId: l.event_id,
  type: l.type,
  schemaVersion: l.schema_version,
  payload: JSON.parse(l.payload),
  deviceId: l.device_id,
  ocorridoEm: l.ocorrido_em,
  recebidoEm: l.recebido_em,
});

export class UserStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.criarSchema());
  }

  private criarSchema() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS eventos (
        seq            INTEGER PRIMARY KEY AUTOINCREMENT, -- ordem total (regra 3)
        event_id       TEXT NOT NULL UNIQUE,              -- idempotência (regra 4)
        type           TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        payload        TEXT NOT NULL,
        device_id      TEXT NOT NULL,
        ocorrido_em    TEXT NOT NULL,                     -- relógio do aparelho (dado de domínio)
        recebido_em    TEXT NOT NULL                      -- relógio do servidor
      );
    `);
  }

  /** Anexa eventos ao log. Evento repetido devolve o seq original (idempotência). */
  push(eventos: EventoEnvelope[]): PushResponse {
    const sql = this.ctx.storage.sql;
    const recebidoEm = new Date().toISOString();
    const aceitos = this.ctx.storage.transactionSync(() =>
      eventos.map((e) => {
        sql.exec(
          `INSERT OR IGNORE INTO eventos (event_id, type, schema_version, payload, device_id, ocorrido_em, recebido_em)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          e.eventId, e.type, e.schemaVersion, JSON.stringify(e.payload ?? null), e.deviceId, e.ocorridoEm, recebidoEm,
        );
        const { seq } = sql.exec<{ seq: number }>('SELECT seq FROM eventos WHERE event_id = ?', e.eventId).one();
        return { eventId: e.eventId, seq };
      }),
    );
    return { aceitos, headSeq: this.headSeq() };
  }

  /** Eventos com seq > desde, em ordem. */
  pull(desde: number, limite: number): PullResponse {
    const eventos = this.ctx.storage.sql
      .exec<Linha>('SELECT * FROM eventos WHERE seq > ? ORDER BY seq LIMIT ?', desde, limite)
      .toArray()
      .map(paraEvento);
    const headSeq = this.headSeq();
    const ultimo = eventos.at(-1)?.seq ?? desde;
    return { eventos, headSeq, temMais: ultimo < headSeq };
  }

  /** LGPD — portabilidade (art. 18, V): o log completo É o dado do usuário (ADR-0006). */
  exportar(): { total: number; eventos: EventoConfirmado[] } {
    const eventos = this.ctx.storage.sql.exec<Linha>('SELECT * FROM eventos ORDER BY seq').toArray().map(paraEvento);
    return { total: eventos.length, eventos };
  }

  /** LGPD — eliminação (art. 18, VI): apaga TODO o armazenamento deste Durable Object. */
  async apagarTudo(): Promise<{ apagados: number }> {
    const apagados = this.headSeq() ? this.ctx.storage.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM eventos').one().n : 0;
    await this.ctx.storage.deleteAll();
    this.criarSchema(); // a mesma instância pode receber requisições depois (ex.: novo login)
    return { apagados };
  }

  private headSeq(): number {
    return this.ctx.storage.sql.exec<{ h: number | null }>('SELECT MAX(seq) AS h FROM eventos').one().h ?? 0;
  }
}
