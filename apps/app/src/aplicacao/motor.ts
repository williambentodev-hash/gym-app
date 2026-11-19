// Camada de aplicação: composição das portas (store, transporte) com o domínio, via o motor genérico de sync.
// É aqui, e não no domínio nem no motor, que "evento do log" vira "evento do domínio" (ADR-0009, R3).
import * as Crypto from 'expo-crypto';
import { estadoInicial, reduzir, type EstadoProgresso, type SerieRegistrada } from '@gym/domain';
import { criarMotorSync, type EventoLocal, type MotorSync } from '@gym/sync';
import { abrirSyncStore, type SyncStoreSqlite } from '../infra/sync-store-sqlite';
import { transporteHttp } from '../infra/transporte-http';

/** Adapta o reducer do domínio ao envelope do log. Tipos desconhecidos são ignorados (compatibilidade futura). */
function reducerDoApp(estado: EstadoProgresso, evento: EventoLocal): EstadoProgresso {
  switch (evento.type) {
    case 'SerieRegistrada':
      return reduzir(estado, { ...(evento.payload as Omit<SerieRegistrada, 'type'>), type: 'SerieRegistrada' });
    default:
      return estado;
  }
}

export type App = { motor: MotorSync<EstadoProgresso>; store: SyncStoreSqlite };

export async function iniciarApp(): Promise<App> {
  const store = await abrirSyncStore();
  const motor = criarMotorSync<EstadoProgresso>({
    store,
    transporte: transporteHttp,
    reducer: reducerDoApp,
    estadoInicial,
    deviceId: store.deviceId,
    gerarId: () => Crypto.randomUUID(), // TODO: UUIDv7 (ADR-0006, regra 1) quando houver índice por tempo
  });
  return { motor, store };
}

/** Caso de uso: registrar uma série realizada. Local e imediato; a sincronização vem depois. */
export function registrarSerie(app: App, serie: Omit<SerieRegistrada, 'type'>) {
  return app.motor.registrar('SerieRegistrada', serie, 1);
}
