// Gera todos os ícones do app a partir de um único desenho vetorial (a marca Forja).
// Uso: pnpm marca:gerar
//
// O símbolo é um kettlebell de "ferro forjado" em laranja com uma seta para cima
// vazada no corpo: o peso da academia + a progressão de carga, diferencial do produto.
// Cores e regras em docs/design/identidade-visual.md.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const assets = join(raiz, 'apps', 'app', 'assets');

const cor = {
  fundo: '#121214',
  superficie: '#1C1C1F',
  acentoClaro: '#FF9A4D',
  acento: '#FF7A1A',
  acentoPressionado: '#E8650A',
};

// Desenho num quadro de 1000×1000 unidades. Caixa útil do símbolo: x 200–800, y 146–880.
// Centro visual em (500, 513); raio que contém o desenho inteiro: ~405 unidades.
const CENTRO = { x: 500, y: 513 };
const RAIO = 405;

/**
 * O símbolo, posicionado para que seu centro visual caia em (cx, cy) e o raio
 * que o contém meça `raio` px. `preenchimento` é uma cor ou url(#gradiente).
 */
function simbolo({ cx, cy, raio, preenchimento, id }) {
  const s = raio / RAIO;
  const tx = cx - CENTRO.x * s;
  const ty = cy - CENTRO.y * s;
  return `
  <defs>
    <clipPath id="base-${id}"><rect x="0" y="0" width="1000" height="880"/></clipPath>
    <mask id="seta-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
      <rect width="1000" height="1000" fill="#fff"/>
      <polyline points="396,668 500,568 604,668" fill="none" stroke="#000"
        stroke-width="66" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>
  <g transform="translate(${tx} ${ty}) scale(${s})" fill="${preenchimento}">
    <g mask="url(#seta-${id})">
      <path d="M300 470 V330 Q300 190 440 190 H560 Q700 190 700 330 V470"
        fill="none" stroke="${preenchimento}" stroke-width="88"/>
      <circle cx="500" cy="600" r="300" clip-path="url(#base-${id})"/>
    </g>
  </g>`;
}

const gradienteLaranja = (id, y0, y1) => `
  <defs>
    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y0}" x2="0" y2="${y1}">
      <stop offset="0" stop-color="${cor.acentoClaro}"/>
      <stop offset="0.55" stop-color="${cor.acento}"/>
      <stop offset="1" stop-color="${cor.acentoPressionado}"/>
    </linearGradient>
  </defs>`;

const fundoGrafite = (lado) => `
  <defs>
    <radialGradient id="luz" cx="0.5" cy="0.32" r="0.75">
      <stop offset="0" stop-color="${cor.superficie}"/>
      <stop offset="1" stop-color="${cor.fundo}"/>
    </radialGradient>
  </defs>
  <rect width="${lado}" height="${lado}" fill="url(#luz)"/>`;

const svg = (lado, corpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">${corpo}\n</svg>\n`;

// Ícone completo (iOS, web/PWA, favicon): o sistema aplica a máscara de cantos.
const icone = svg(
  1024,
  fundoGrafite(1024) +
    gradienteLaranja('laranja', 146, 880) +
    simbolo({ cx: 512, cy: 512, raio: 330, preenchimento: 'url(#laranja)', id: 'i' }),
);

// Android adaptativo: o primeiro plano precisa caber no círculo seguro (66/108 do lado).
const LADO_ANDROID = 512;
const raioSeguro = (LADO_ANDROID * 66) / 108 / 2 - 6;
const androidFrente = svg(
  LADO_ANDROID,
  gradienteLaranja('laranja', 146, 880) +
    simbolo({ cx: 256, cy: 256, raio: raioSeguro, preenchimento: 'url(#laranja)', id: 'a' }),
);
const androidFundo = svg(LADO_ANDROID, `<rect width="${LADO_ANDROID}" height="${LADO_ANDROID}" fill="${cor.fundo}"/>`);
// Monocromático (ícones temáticos do Android 13+): silhueta branca, o sistema recolore.
const androidMono = svg(
  432,
  simbolo({ cx: 216, cy: 216, raio: (432 * 66) / 108 / 2 - 6, preenchimento: '#FFFFFF', id: 'm' }),
);
// Splash: só o símbolo, sobre o fundo grafite definido no app.json.
const splash = svg(
  1024,
  gradienteLaranja('laranja', 146, 880) +
    simbolo({ cx: 512, cy: 512, raio: 300, preenchimento: 'url(#laranja)', id: 's' }),
);

const saidas = [
  ['icon.png', icone, 1024],
  ['favicon.png', icone, 48],
  ['splash-icon.png', splash, 1024],
  ['android-icon-foreground.png', androidFrente, 512],
  ['android-icon-background.png', androidFundo, 512],
  ['android-icon-monochrome.png', androidMono, 432],
];

await mkdir(join(assets, 'marca'), { recursive: true });
await writeFile(join(assets, 'marca', 'forja-icone.svg'), icone);
await writeFile(join(assets, 'marca', 'forja-simbolo.svg'), splash);
for (const [nome, fonte, lado] of saidas) {
  await sharp(Buffer.from(fonte), { density: 72 * (lado / 1024) * 4 })
    .resize(lado, lado)
    .png({ compressionLevel: 9 })
    .toFile(join(assets, nome));
  console.log(`✓ ${nome} (${lado}×${lado})`);
}
