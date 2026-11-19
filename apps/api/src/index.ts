// Worker da API (ADR-0005 / ADR-0009). Spike: rota de saúde para obter o endereço *.workers.dev.
import { Hono } from 'hono';

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, servico: 'gym-api', em: new Date().toISOString() }));

export default app;
