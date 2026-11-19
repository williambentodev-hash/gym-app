// Composição do motor de sync com o domínio v1 (ADR-0012). A época v1 usa um banco local novo.
import * as Crypto from 'expo-crypto';
import { estadoInicialDominio, reduzirDominio, type EstadoDominio } from '@gym/domain';
import { criarMotorSync, type MotorSync } from '@gym/sync';
import { abrirSyncStore, apagarBancosLegados, type SyncStoreSqlite } from '../infra/sync-store-sqlite';
import { transporteHttp } from '../infra/transporte-http';

export type Nucleo = { motor: MotorSync<EstadoDominio>; store: SyncStoreSqlite };

export async function iniciarNucleo(): Promise<Nucleo> {
  apagarBancosLegados().catch(() => undefined); // minimização: dados de teste das épocas anteriores
  const store = await abrirSyncStore('gym-v1.db'); // época v1 (ADR-0012)
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
