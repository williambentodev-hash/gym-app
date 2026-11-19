// Servidor estático mínimo que simula os cabeçalhos que o Worker servirá em produção.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.argv[2];
const port = Number(process.argv[3] ?? 8787);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.ttf': 'font/ttf' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(normalize(root))) { res.writeHead(403).end(); return; }
  try {
    let body;
    try { body = await readFile(path); } catch { path = join(root, 'index.html'); body = await readFile(path); }
    res.writeHead(200, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    res.end(body);
  } catch { res.writeHead(404).end(); }
}).listen(port, () => console.log(`serving ${root} on ${port}`));
