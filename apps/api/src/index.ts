// Worker da API (ADR-0005 / ADR-0009).
import { Hono } from 'hono';
import { createAuth, type AuthEnv } from './auth';

const app = new Hono<{ Bindings: AuthEnv }>();

app.get('/api/health', (c) => c.json({ ok: true, servico: 'gym-api', em: new Date().toISOString() }));

// Better Auth: login, callback OAuth, sessão, logout.
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

// Spike S3: rota protegida. Prova que o app consegue se autenticar fora das rotas /api/auth.
// Em ADR-0006, é aqui que o userId vira a chave de roteamento para o Durable Object do usuário.
app.get('/api/me', async (c) => {
  const sessao = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!sessao) return c.json({ erro: 'não autenticado' }, 401);
  return c.json({ userId: sessao.user.id, nome: sessao.user.name, email: sessao.user.email });
});

export default app;
