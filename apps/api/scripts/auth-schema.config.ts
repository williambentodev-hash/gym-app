// Usado SOMENTE pela CLI do Better Auth para gerar o SQL do schema de identidade.
// A CLI não acessa o D1; aqui ela introspecta um SQLite vazio em memória (mesmo dialeto do D1)
// e gera o CREATE TABLE completo, que vira uma migração versionada do Wrangler.
//   npx auth@latest generate --config scripts/auth-schema.config.ts --output migrations/0001_auth.sql
// Mantenha plugins/campos alinhados com src/auth.ts.
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';

export const auth = betterAuth({
  database: new DatabaseSync(':memory:'),
  socialProviders: { google: { clientId: 'x', clientSecret: 'x' } },
  plugins: [expo()],
});
