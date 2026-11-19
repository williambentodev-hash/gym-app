// ⚠️ Código de spike (Fase 3).
// Porta LocalDb (ADR-0007): o resto do app depende desta interface, não do expo-sqlite.
import * as SQLite from 'expo-sqlite';

export type EventoArmazenado = {
  eventId: string;
  type: string;
  payload: string; // JSON
  pendente: boolean;
};

export interface LocalDb {
  anexar(eventos: ReadonlyArray<EventoArmazenado>): Promise<void>;
  lerTodos(): Promise<EventoArmazenado[]>;
  contar(): Promise<number>;
  limpar(): Promise<void>;
}

const MIGRACOES = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS eventos (
    local_seq INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id  TEXT NOT NULL UNIQUE,       -- idempotência (ADR-0006, regra 4)
    type      TEXT NOT NULL,
    payload   TEXT NOT NULL,
    pendente  INTEGER NOT NULL DEFAULT 1
  );
`;

export async function abrirLocalDb(nome = 'gym-spike.db'): Promise<LocalDb> {
  const db = await SQLite.openDatabaseAsync(nome);
  await db.execAsync(MIGRACOES);

  return {
    async anexar(eventos) {
      await db.withTransactionAsync(async () => {
        const stmt = await db.prepareAsync(
          'INSERT OR IGNORE INTO eventos (event_id, type, payload, pendente) VALUES (?, ?, ?, ?)',
        );
        try {
          for (const e of eventos) {
            await stmt.executeAsync(e.eventId, e.type, e.payload, e.pendente ? 1 : 0);
          }
        } finally {
          await stmt.finalizeAsync();
        }
      });
    },
    async lerTodos() {
      const rows = await db.getAllAsync<{ event_id: string; type: string; payload: string; pendente: number }>(
        'SELECT event_id, type, payload, pendente FROM eventos ORDER BY local_seq',
      );
      return rows.map((r) => ({ eventId: r.event_id, type: r.type, payload: r.payload, pendente: r.pendente === 1 }));
    },
    async contar() {
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM eventos');
      return row?.n ?? 0;
    },
    async limpar() {
      await db.execAsync('DELETE FROM eventos');
    },
  };
}
