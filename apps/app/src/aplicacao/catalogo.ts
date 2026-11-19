// Catálogo global (ADR-0013): snapshot estático, cache local e atualização por versão. Offline por construção.
import { Catalogo, type ExercicioCatalogo } from '@gym/contracts';
import type { EstadoCatalogo, Modalidade } from '@gym/domain';
import { API_URL } from '../infra/auth-client';
import type { SyncStoreSqlite } from '../infra/sync-store-sqlite';

const CHAVE = 'catalogo_v1';

export type ExercicioApp = {
  id: string;
  nome: string;
  modalidade: Modalidade;
  composto: boolean;
  grupoPrincipal: string;
  gruposSecundarios: string[];
  equipamento: string;
  animacaoUrl?: string;
  miniaturaUrl?: string;
  personalizado: boolean;
};

export type CatalogoApp = { versao: string; lista: ExercicioApp[]; porId: Map<string, ExercicioApp> };

const doCatalogo = (e: ExercicioCatalogo): ExercicioApp => ({
  id: e.id, nome: e.nome, modalidade: e.modalidade, composto: e.composto, grupoPrincipal: e.grupoPrincipal,
  gruposSecundarios: e.gruposSecundarios, equipamento: e.equipamento, animacaoUrl: e.midia.animacaoUrl, miniaturaUrl: e.midia.miniaturaUrl, personalizado: false,
});

/** Junta o catálogo global com os exercícios personalizados do usuário (eventos do log). */
export function montarCatalogo(global: Catalogo | null, personalizados: EstadoCatalogo): CatalogoApp {
  const lista: ExercicioApp[] = [
    ...(global?.exercicios.map(doCatalogo) ?? []),
    ...Object.values(personalizados.personalizados)
      .filter((p) => !p.arquivado)
      .map((p): ExercicioApp => ({
        id: p.exercicioId, nome: p.nome, modalidade: p.modalidade, composto: false,
        grupoPrincipal: p.gruposMusculares[0] ?? 'outros', gruposSecundarios: p.gruposMusculares.slice(1),
        equipamento: p.equipamento ?? 'outro', personalizado: true,
      })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  // porId inclui arquivados: o histórico continua mostrando o nome (01-dominio §8).
  const porId = new Map(lista.map((e) => [e.id, e]));
  for (const p of Object.values(personalizados.personalizados))
    if (!porId.has(p.exercicioId)) porId.set(p.exercicioId, { id: p.exercicioId, nome: p.nome, modalidade: p.modalidade, composto: false, grupoPrincipal: p.gruposMusculares[0] ?? 'outros', gruposSecundarios: [], equipamento: 'outro', personalizado: true });
  return { versao: global?.versao ?? '—', lista, porId };
}

/** Lê o catálogo do cache local (instantâneo e offline). */
export async function catalogoEmCache(store: SyncStoreSqlite): Promise<Catalogo | null> {
  const bruto = await store.meta.ler(CHAVE);
  if (!bruto) return null;
  const r = Catalogo.safeParse(JSON.parse(bruto));
  return r.success ? r.data : null;
}

/** Busca a versão publicada; grava no cache se mudou. Falha de rede não é erro (segue com o cache). */
export async function atualizarCatalogo(store: SyncStoreSqlite, atual: Catalogo | null): Promise<Catalogo | null> {
  try {
    const r = await fetch(`${API_URL}/catalogo/catalogo.v1.json`);
    if (!r.ok) return atual;
    const novo = Catalogo.parse(await r.json());
    if (novo.versao !== atual?.versao) await store.meta.gravar(CHAVE, JSON.stringify(novo));
    return novo;
  } catch {
    return atual;
  }
}

export const NOMES_GRUPOS: Record<string, string> = {
  peito: 'Peito', costas: 'Costas', lombar: 'Lombar', trapezio: 'Trapézio', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps',
  antebracos: 'Antebraços', quadriceps: 'Quadríceps', posteriores: 'Posteriores', gluteos: 'Glúteos', adutores: 'Adutores',
  abdutores: 'Abdutores', panturrilhas: 'Panturrilhas', abdomen: 'Abdômen', cardio: 'Cardio', outros: 'Outros',
};

export const NOMES_EQUIPAMENTOS: Record<string, string> = {
  barra: 'Barra', barra_w: 'Barra W', halteres: 'Halteres', polia: 'Polia', maquina: 'Máquina', smith: 'Smith',
  kettlebell: 'Kettlebell', peso_corporal: 'Peso corporal', cardio: 'Cardio', outro: 'Outro',
};
