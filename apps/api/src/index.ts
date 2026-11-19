// Worker da API (ADR-0005 / ADR-0009).
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { PullQuery, PushRequest } from '@gym/contracts';
import { createAuth, type AuthEnv } from './auth';

export { UserStore } from './infra/user-store';

type AppEnv = { Bindings: AuthEnv; Variables: { userId: string } };
const app = new Hono<AppEnv>();

const autenticar = createMiddleware<AppEnv>(async (c, next) => {
  const sessao = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!sessao) return c.json({ erro: 'não autenticado' }, 401);
  c.set('userId', sessao.user.id);
  await next();
});

app.get('/api/health', (c) => c.json({ ok: true, servico: 'gym-api', em: new Date().toISOString() }));

// Better Auth: login, callback OAuth, sessão, logout.
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

// Rotas autenticadas: a sessão define o userId, que é a chave de roteamento para o Durable Object.
app.use('/api/me', autenticar);
app.use('/api/sync/*', autenticar);

app.get('/api/me', async (c) => {
  const sessao = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  return c.json({ userId: c.get('userId'), nome: sessao?.user.name, email: sessao?.user.email });
});

// Sync (ADR-0006). Validação na borda com os contratos; a lógica fica no UserStore do usuário.
app.post('/api/sync/push', async (c) => {
  const corpo = PushRequest.safeParse(await c.req.json().catch(() => null));
  if (!corpo.success) return c.json({ erro: 'requisição inválida', detalhes: corpo.error.issues }, 400);
  return c.json(await userStore(c.env, c.get('userId')).push(corpo.data.eventos));
});

app.get('/api/sync/pull', async (c) => {
  const q = PullQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ erro: 'parâmetros inválidos', detalhes: q.error.issues }, 400);
  return c.json(await userStore(c.env, c.get('userId')).pull(q.data.desde, q.data.limite));
});

function userStore(env: AuthEnv, userId: string) {
  return env.USER_STORE.get(env.USER_STORE.idFromName(userId));
}

export default app;
