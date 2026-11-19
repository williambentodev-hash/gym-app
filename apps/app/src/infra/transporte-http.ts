// Adaptador da porta Transporte (@gym/sync) sobre HTTP autenticado. Valida as respostas com os contratos.
import { PullResponse, PushResponse } from '@gym/contracts';
import type { Transporte } from '@gym/sync';
import { fetchAutenticado } from './auth-client';

export class ErroHttp extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? 'não autenticado: faça login para sincronizar' : `HTTP ${status}`);
  }
}

export const transporteHttp: Transporte = {
  async push(req) {
    const r = await fetchAutenticado('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!r.ok) throw new ErroHttp(r.status);
    return PushResponse.parse(await r.json());
  },

  async pull(desde, limite) {
    const r = await fetchAutenticado(`/api/sync/pull?desde=${desde}&limite=${limite}`);
    if (!r.ok) throw new ErroHttp(r.status);
    return PullResponse.parse(await r.json());
  },
};
