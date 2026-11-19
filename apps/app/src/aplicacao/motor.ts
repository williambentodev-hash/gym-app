// Composição do motor de sync com o domínio v1 (ADR-0012). A época v1 usa um banco local novo.
import * as Crypto from 'expo-crypto';
import { estadoInicialDominio, reduzirDominio, type EstadoDominio } from '@gym/domain';
import { criarMotorSync, type MotorSync } from '@gym/sync';
import { abrirSyncStore, type SyncStoreSqlite } from '../infra/sync-store-sqlite';
import { transporteHttp } from '../infra/transporte-http';

export type Nucleo = { motor: MotorSync<EstadoDominio>; store: SyncStoreSqlite };

export async function iniciarNucleo(): Promise<Nucleo> {
  const store = await abrirSyncStore('gym-v1.db'); // época v1 (ADR-0012): o banco do walking skeleton fica para trás
  const motor = criarMotorSync<EstadoDominio>({
    store,
    transporte: transporteHttp,
    reducer: reduzirDominio, // o envelope local é estruturalmente compatível com o EnvelopeMinimo do domínio
    estadoInicial: estadoInicialDominio,
    deviceId: store.deviceId,
    gerarId: () => Crypto.randomUUID(),
  });
  return { motor, store };
}

export const novoId = () => Crypto.randomUUID();
