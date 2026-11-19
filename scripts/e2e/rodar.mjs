// Sobe o servidor local (imita o Worker: COOP/COEP + SPA) e roda o E2E do fluxo principal.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const aqui = (p) => fileURLToPath(new URL(p, import.meta.url));
const porta = 8890;
const saida = aqui('../../.e2e');
mkdirSync(saida, { recursive: true });
const servidor = spawn(process.execPath, [aqui('./servidor-local.mjs'), aqui('../../apps/api/static'), String(porta)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const teste = spawn(process.execPath, [aqui('./fluxo-principal.mjs'), `http://localhost:${porta}/`, saida], { stdio: 'inherit' });
const codigo = await new Promise((r) => teste.on('exit', r));
servidor.kill();
process.exit(codigo ?? 1);
