// Autenticação (ADR-0008): Better Auth no Worker, identidade no D1, login Google.
import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';

/** Segredos definidos via `wrangler secret put` (não aparecem no wrangler.jsonc). */
export type AuthEnv = Env & {
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

/**
 * Fábrica por requisição: no Worker, `env` (bindings e segredos) chega a cada request.
 * Criar a instância é barato (não abre conexões; o D1 é um binding).
 */
export function createAuth(env: AuthEnv) {
  return betterAuth({
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: '/api/auth',
    trustedOrigins: [
      'gymapp://', // deep link do app Android (scheme em app.json)
      env.BETTER_AUTH_URL, // web servida pelo próprio Worker (mesma origem)
    ],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
      },
    },
    session: {
      // ADR-0008: sessão longa, renovada com o uso. Offline nunca depende dela para escrever localmente.
      expiresIn: 60 * 60 * 24 * 60, // 60 dias
      updateAge: 60 * 60 * 24, // renova no máximo 1x por dia
    },
    plugins: [expo()],
    // Minimização (LGPD art. 6, III; ADR-0014): o Google serve só para LOGIN, não chamamos APIs dele.
    // Não há opção para "não guardar" os tokens OAuth; o caminho documentado é descartá-los num hook.
    databaseHooks: {
      account: {
        create: { before: async (conta) => ({ data: semTokens(conta) }) },
        update: { before: async (conta) => ({ data: semTokens(conta) }) },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Remove tokens OAuth do registro da conta antes da gravação. */
function semTokens<T extends Record<string, unknown>>(conta: T): T {
  return { ...conta, accessToken: null, refreshToken: null, idToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null };
}
