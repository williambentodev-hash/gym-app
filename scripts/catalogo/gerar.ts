// Gera o snapshot do catálogo (ADR-0013) a partir da curadoria + metadados da origem (ADR-0011).
// Uso: node scripts/catalogo/gerar.ts
// - Fixa as mídias num commit da origem (URL imutável), em vez de @main.
// - Falha se algum ID da curadoria não existir na origem, ou se houver duplicatas.
// - Grava apps/api/public/catalogo/catalogo.v1.json (servido como arquivo estático pelo Worker).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURADORIA } from './curadoria.ts';

const REPOSITORIO = 'JahelCuadrado/ExerciseGymGifsDB';
const COMMIT = 'f6d16e977fbee3c04295311c44cb8374ca8ff182'; // 2026-07-12; atualizar = decisão consciente
const CDN = `https://cdn.jsdelivr.net/gh/${REPOSITORIO}@${COMMIT}`;

type Origem = { id: string; file: string; gifUrl: string; thumbUrl?: string };

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const saida = join(raiz, 'apps', 'api', 'public', 'catalogo', 'catalogo.v1.json');

const resp = await fetch(`${CDN}/api/en/exercises.json`);
if (!resp.ok) throw new Error(`falha ao baixar a origem: HTTP ${resp.status}`);
const origem = ((await resp.json()) as { exercises: Origem[] }).exercises;
const porId = new Map(origem.map((x) => [x.id, x]));

const ids = CURADORIA.map((l) => l[0]);
const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicados.length) throw new Error(`IDs duplicados na curadoria: ${duplicados.join(', ')}`);
const ausentes = ids.filter((id) => !porId.has(id));
if (ausentes.length) throw new Error(`IDs da curadoria inexistentes na origem: ${ausentes.join(', ')}`);
const nomes = CURADORIA.map((l) => l[1].toLowerCase());
const nomesDup = nomes.filter((n, i) => nomes.indexOf(n) !== i);
if (nomesDup.length) throw new Error(`nomes duplicados: ${nomesDup.join(', ')}`);

const exercicios = CURADORIA.map(([id, nome, modalidade, composto, grupoPrincipal, gruposSecundarios, equipamento]) => {
  const o = porId.get(id)!;
  const base = o.file.replace(/\.gif$/, '');
  return {
    id,
    nome,
    modalidade,
    composto,
    grupoPrincipal,
    gruposSecundarios,
    equipamento,
    midia: { animacaoUrl: `${CDN}/${base}.gif`, miniaturaUrl: `${CDN}/${base}.thumb.webp` },
  };
}).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

const catalogo = {
  versao: `v1-${COMMIT.slice(0, 7)}-${exercicios.length}`,
  fonte: { repositorio: REPOSITORIO, commit: COMMIT },
  exercicios,
};

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify(catalogo, null, 1) + '\n');
console.log(`catálogo ${catalogo.versao}: ${exercicios.length} exercícios → ${saida}`);
