// Adaptador da porta SyncStore (@gym/sync) sobre expo-sqlite: mesmo código no Android e na web (spike S1).
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { EventoConfirmado, EventoEnvelope, EventoLocal, SyncStore } from '@gym/sync';

const MIGRACOES = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS eventos (
    local_seq      INTEGER PRIMARY KEY AUTOINCREMENT, -- ordem de criação no aparelho
    event_id       TEXT NOT NULL UNIQUE,              -- idempotência (ADR-0006, regra 4)
    type           TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    payload        TEXT NOT NULL,
    device_id      TEXT NOT NULL,
    ocorrido_em    TEXT NOT NULL,
    seq            INTEGER                            -- NULL = pendente; preenchido = confirmado pelo servidor
  );
  CREATE INDEX IF NOT EXISTS eventos_pendentes ON eventos (local_seq) WHERE seq IS NULL;
  CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
`;

type Linha = {
  event_id: string;
  type: string;
  schema_version: number;
  payload: string;
  device_id: string;
  ocorrido_em: string;
  seq: number | null;
};

const paraEvento = (l: Linha): EventoLocal => ({
  eventId: l.event_id,
  type: l.type,
  schemaVersion: l.schema_version,
  payload: JSON.parse(l.payload),
  deviceId: l.device_id,
  ocorridoEm: l.ocorrido_em,
  ...(l.seq !== null ? { seq: l.seq } : {}),
});

export type SyncStoreSqlite = SyncStore & {
  deviceId: string;
  contagens(): Promise<{ pendentes: number; confirmados: number }>;
  /** Chave-valor local (ex.: cache do catálogo). */
  meta: { ler(chave: string): Promise<string | undefined>; gravar(chave: string, valor: string): Promise<void> };
  /** LGPD: fecha e apaga o banco local inteiro (eventos, cursor, cache). */
  apagarBanco(): Promise<void>;
};

/** Bancos locais de épocas anteriores (spike e walking skeleton): dados de teste, apagados ao iniciar (ADR-0012/0014). */
export async function apagarBancosLegados(): Promise<void> {
  for (const nome of ['gym.db', 'gym-spike.db']) await SQLite.deleteDatabaseAsync(nome).catch(() => undefined);
}

/**
 * Na web, o SQLite usa OPFS com acesso EXCLUSIVO ao arquivo. Ao recarregar a página, o worker anterior pode
 * ainda não ter liberado o arquivo ("Access Handles cannot be created…"). Tenta de novo com espera crescente.
 * (Achado no E2E da Fase 4; o spike S1 não pegou porque abria um navegador novo a cada execução.)
 */
async function abrirComRetentativa(nome: string): Promise<SQLite.SQLiteDatabase> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    try {
      return await SQLite.openDatabaseAsync(nome);
    } catch (e) {
      ultimoErro = e;
      if (!/access handle|lock|busy/i.test(String(e))) throw e;
      await new Promise((r) => setTimeout(r, 150 * 2 ** tentativa)); // 150 ms … ~19 s no total
    }
  }
  throw new ErroBancoOcupado(String(ultimoErro));
}

export class ErroBancoOcupado extends Error {
  constructor(detalhe: string) {
    super(`O banco local está em uso por outra aba ou janela do app. Feche-a e recarregue esta página. (${detalhe})`);
  }
}

export async function abrirSyncStore(nome: string): Promise<SyncStoreSqlite> {
  const db = await abrirComRetentativa(nome);
  await db.execAsync(MIGRACOES);

  const lerMeta = async (chave: string) =>
    (await db.getFirstAsync<{ valor: string }>('SELECT valor FROM meta WHERE chave = ?', chave))?.valor;
  const gravarMeta = (chave: string, valor: string) =>
    db.runAsync('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', chave, valor);

  // Identidade do aparelho: gerada uma vez e persistida.
  let deviceId = await lerMeta('device_id');
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await gravarMeta('device_id', deviceId);
  }

  return {
    deviceId,
    async apagarBanco() {
      await db.closeAsync();
      await SQLite.deleteDatabaseAsync(nome);
    },
    meta: {
      ler: lerMeta,
      gravar: async (chave, valor) => {
        await gravarMeta(chave, valor);
      },
    },

    async anexarPendente(e: EventoEnvelope) {
      await db.runAsync(
        `INSERT OR IGNORE INTO eventos (event_id, type, schema_version, payload, device_id, ocorrido_em)
         VALUES (?, ?, ?, ?, ?, ?)`,
        e.eventId, e.type, e.schemaVersion, JSON.stringify(e.payload ?? null), e.deviceId, e.ocorridoEm,
      );
    },

    async pendentes(limite) {
      const linhas = await db.getAllAsync<Linha>('SELECT * FROM eventos WHERE seq IS NULL ORDER BY local_seq LIMIT ?', limite);
      return linhas.map((l) => {
        const { seq: _s, ...e } = paraEvento(l);
        return e;
      });
    },

    async confirmar(aceitos) {
      await db.withTransactionAsync(async () => {
        for (const a of aceitos) await db.runAsync('UPDATE eventos SET seq = ? WHERE event_id = ?', a.seq, a.eventId);
      });
    },

    async aplicarRemotos(eventos: ReadonlyArray<EventoConfirmado>) {
      await db.withTransactionAsync(async () => {
        for (const e of eventos) {
          await db.runAsync(
            `INSERT INTO eventos (event_id, type, schema_version, payload, device_id, ocorrido_em, seq)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(event_id) DO UPDATE SET seq = excluded.seq`,
            e.eventId, e.type, e.schemaVersion, JSON.stringify(e.payload ?? null), e.deviceId, e.ocorridoEm, e.seq,
          );
        }
      });
    },

    async lerCursor() {
      return Number((await lerMeta('cursor_pull')) ?? 0);
    },

    async gravarCursor(seq) {
      await gravarMeta('cursor_pull', String(seq));
    },

    async todosOrdenados() {
      // Confirmados por seq, depois pendentes por ordem local: base do rebase implícito.
      const linhas = await db.getAllAsync<Linha>(
        'SELECT * FROM eventos ORDER BY (seq IS NULL), seq, local_seq',
      );
      return linhas.map(paraEvento);
    },

    async contagens() {
      const r = await db.getFirstAsync<{ p: number; c: number }>(
        'SELECT SUM(seq IS NULL) AS p, SUM(seq IS NOT NULL) AS c FROM eventos',
      );
      return { pendentes: r?.p ?? 0, confirmados: r?.c ?? 0 };
    },
  };
}
