// Worker da API (ADR-0005 / ADR-0009). Segurança e LGPD: ADR-0014.
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import { Catalogo, PerfilTreino, PullQuery, PushRequest } from '@gym/contracts';
import { createAuth, type AuthEnv } from './auth';
import { ErroIA, gerarProposta } from './ia/servico';

export { UserStore } from './infra/user-store';

type AppEnv = { Bindings: AuthEnv; Variables: { userId: string } };
const app = new Hono<AppEnv>();

/** Limites de tamanho (ADR-0014): protegem o Worker e o DO de payloads abusivos ou acidentais. */
const MAX_CORPO_BYTES = 1_000_000; // 500 eventos × ~2 KB
const MAX_PAYLOAD_EVENTO_BYTES = 16_000;

const autenticar = createMiddleware<AppEnv>(async (c, next) => {
  const sessao = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!sessao) return c.json({ erro: 'não autenticado' }, 401);
  c.set('userId', sessao.user.id);
  await next();
});

/**
 * Rate limiting por USUÁRIO (não por IP: recomendação da Cloudflare). Aproximado e por localidade:
 * é proteção contra abuso/bug em laço, não cota exata (ADR-0014).
 */
const limitar = (escolher: (env: AuthEnv) => RateLimit) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const { success } = await escolher(c.env).limit({ key: c.get('userId') });
    if (!success) return c.json({ erro: 'muitas requisições; tente em instantes' }, 429);
    await next();
  });

const limitarTamanho = createMiddleware<AppEnv>(async (c, next) => {
  const tamanho = Number(c.req.header('content-length') ?? 0);
  if (tamanho > MAX_CORPO_BYTES) return c.json({ erro: 'corpo da requisição grande demais' }, 413);
  await next();
});

// Cabeçalhos de segurança nas respostas da API (a web estática recebe os seus via public/_headers).
app.use('/api/*', secureHeaders({ crossOriginResourcePolicy: 'same-origin', referrerPolicy: 'strict-origin-when-cross-origin' }));
app.use('/api/*', async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store'); // dados pessoais não vão para caches
});

app.get('/api/health', (c) => c.json({ ok: true, servico: 'gym-api', em: new Date().toISOString() }));

// Better Auth: login, callback OAuth, sessão, logout.
app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

// Rotas autenticadas: a sessão define o userId, que é a chave de roteamento para o Durable Object.
app.use('/api/me', autenticar);
app.use('/api/sync/*', autenticar, limitar((e) => e.LIMITE_SYNC));
app.use('/api/conta', autenticar, limitar((e) => e.LIMITE_CONTA));
app.use('/api/conta/*', autenticar, limitar((e) => e.LIMITE_CONTA));

app.get('/api/me', async (c) => {
  const sessao = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  return c.json({ userId: c.get('userId'), nome: sessao?.user.name, email: sessao?.user.email });
});

// --- Sync (ADR-0006). Validação na borda com os contratos; a lógica fica no UserStore do usuário. ---

app.post('/api/sync/push', limitarTamanho, async (c) => {
  const corpo = PushRequest.safeParse(await c.req.json().catch(() => null));
  if (!corpo.success) return c.json({ erro: 'requisição inválida', detalhes: corpo.error.issues.slice(0, 5) }, 400);
  const grande = corpo.data.eventos.find((e) => JSON.stringify(e.payload ?? null).length > MAX_PAYLOAD_EVENTO_BYTES);
  if (grande) return c.json({ erro: `evento ${grande.eventId} excede ${MAX_PAYLOAD_EVENTO_BYTES} bytes` }, 413);
  return c.json(await userStore(c.env, c.get('userId')).push(corpo.data.eventos));
});

app.get('/api/sync/pull', async (c) => {
  const q = PullQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ erro: 'parâmetros inválidos', detalhes: q.error.issues }, 400);
  return c.json(await userStore(c.env, c.get('userId')).pull(q.data.desde, q.data.limite));
});

// --- Direitos do titular (LGPD art. 18; ADR-0014) ---

/** Portabilidade: tudo o que guardamos sobre o usuário, num JSON legível. */
app.get('/api/conta/exportar', async (c) => {
  const userId = c.get('userId');
  // O tipo do RPC do DO serializa `payload: unknown` como `never`; o formato real é declarado aqui.
  type Exportacao = { total: number; eventos: unknown[] };
  const [usuario, contas, v1, anterior] = await Promise.all([
    c.env.DB.prepare('SELECT id, name, email, emailVerified, image, createdAt, updatedAt FROM user WHERE id = ?').bind(userId).first(),
    c.env.DB.prepare('SELECT providerId, accountId, scope, createdAt, updatedAt FROM account WHERE userId = ?').bind(userId).all(),
    userStore(c.env, userId).exportar() as Promise<unknown> as Promise<Exportacao>,
    userStore(c.env, userId, 'anterior').exportar() as Promise<unknown> as Promise<Exportacao>,
  ]);
  const sessoes = await c.env.DB.prepare('SELECT createdAt, expiresAt, userAgent FROM session WHERE userId = ?').bind(userId).all();
  const dados = {
    geradoEm: new Date().toISOString(),
    descricao: 'Exportação completa dos seus dados no gym.app (LGPD, art. 18, V).',
    usuario,
    contasVinculadas: contas.results,
    sessoes: sessoes.results,
    treinos: { epoca: 'v1', ...v1 },
    dadosDeTesteAnteriores: anterior.total ? anterior : undefined,
  };
  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="gym-app-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});

/** Apaga os dados da época anterior ao ADR-0012 (testes do walking skeleton). Idempotente. */
app.post('/api/conta/limpar-epoca-anterior', async (c) => c.json(await userStore(c.env, c.get('userId'), 'anterior').apagarTudo()));

/**
 * Eliminação (art. 18, VI): apaga os logs (todas as épocas) e a identidade (usuário, contas, sessões).
 * Exige confirmação explícita no corpo, para não ser disparada por engano.
 */
app.delete('/api/conta', async (c) => {
  const corpo = (await c.req.json().catch(() => null)) as { confirmacao?: string } | null;
  if (corpo?.confirmacao !== 'EXCLUIR MINHA CONTA') return c.json({ erro: 'confirmação ausente ou incorreta' }, 400);
  const userId = c.get('userId');
  const [v1, anterior] = await Promise.all([userStore(c.env, userId).apagarTudo(), userStore(c.env, userId, 'anterior').apagarTudo()]);
  // Ordem explícita (não depende só do ON DELETE CASCADE): sessões e contas, depois o usuário.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM session WHERE userId = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM account WHERE userId = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM user WHERE id = ?').bind(userId),
  ]);
  return c.json({ ok: true, eventosApagados: v1.apagados + anterior.apagados });
});

// --- IA especialista em treino (ADR-0015/0016): só PROPÕE uma ficha; quem grava é o app, via comandos do domínio ---

app.use('/api/ia/*', autenticar, limitar((e) => e.LIMITE_IA));

app.post('/api/ia/sugerir-ficha', limitarTamanho, async (c) => {
  const perfil = PerfilTreino.safeParse(await c.req.json().catch(() => null));
  if (!perfil.success) return c.json({ erro: 'perfil inválido', detalhes: perfil.error.issues.slice(0, 5) }, 400);

  // O catálogo é um asset estático do próprio Worker (ADR-0013): a IA só pode escolher entre esses IDs.
  const resp = await c.env.ASSETS.fetch(new Request(new URL('/catalogo/catalogo.v1.json', c.req.url)));
  const catalogo = Catalogo.parse(await resp.json());

  try {
    return c.json(await gerarProposta(c.env, perfil.data, catalogo));
  } catch (e) {
    if (e instanceof ErroIA) return c.json({ erro: e.message }, e.status);
    console.error(JSON.stringify({ evento: 'ia_erro', erro: String(e) }));
    return c.json({ erro: 'erro inesperado ao gerar a ficha' }, 500);
  }
});

/** Época "v1" do log (ADR-0012); "anterior" = walking skeleton (sem prefixo). */
function userStore(env: AuthEnv, userId: string, epoca: 'v1' | 'anterior' = 'v1') {
  return env.USER_STORE.get(env.USER_STORE.idFromName(epoca === 'v1' ? `v1:${userId}` : userId));
}

export default app;
