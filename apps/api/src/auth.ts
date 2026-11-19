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
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
