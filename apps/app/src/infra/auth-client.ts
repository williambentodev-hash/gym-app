// ⚠️ Código de spike (Fase 3). Cliente de autenticação (ADR-0008).
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_URL = 'https://gym-api.gym-api.workers.dev';

// Nativo: sessão guardada no SecureStore e enviada como header Cookie manualmente.
// Web: a web será servida pelo próprio Worker (mesma origem), então o cookie do navegador basta.
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins:
    Platform.OS === 'web'
      ? []
      : [expoClient({ scheme: 'gymapp', storagePrefix: 'gymapp', storage: SecureStore })],
});

/** fetch autenticado para rotas fora de /api/auth (ex.: /api/sync no futuro). */
export async function fetchAutenticado(caminho: string, init: RequestInit = {}): Promise<Response> {
  if (Platform.OS === 'web') {
    return fetch(`${API_URL}${caminho}`, { ...init, credentials: 'include' });
  }
  const cookie = await authClient.getCookie();
  return fetch(`${API_URL}${caminho}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), Cookie: cookie },
    credentials: 'omit', // 'include' interfere no Cookie definido manualmente
  });
}
