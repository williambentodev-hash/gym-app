// Monta a pasta de assets servida pelo Worker: build web do Expo (já exportada em static/) + mídias próprias (public/).
// Uso: pnpm --filter @gym/app export:web && node scripts/montar-assets.mjs
import { cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const destino = `${raiz}static`;
if (!existsSync(`${destino}/index.html`)) {
  console.error('static/index.html não encontrado: rode antes `pnpm --filter @gym/app export:web`.');
  process.exit(1);
}
cpSync(`${raiz}public`, destino, { recursive: true });
console.log('assets montados em static/ (web + public/)');
