// Contexto Planejamento: fichas → treinos → blocos → itens (01-dominio §1, §8; 04-modelo-de-eventos §3).
// Reducer total (P8): evento sobre entidade inexistente/removida, ou inválido para o estado atual, é no-op.
import { z } from 'zod';
import { Id, Modalidade, Prescricao, prescricaoCompativel, reordenar } from '../comum/index';

const Nome = z.string().trim().min(1).max(80);

export const EventosPlanejamento = {
  FichaCriada: z.object({ fichaId: Id, nome: Nome }),
  FichaRenomeada: z.object({ fichaId: Id, nome: Nome }),
  FichaAtivada: z.object({ fichaId: Id }),
  FichaDesativada: z.object({ fichaId: Id }),
  FichaArquivada: z.object({ fichaId: Id }),
  TreinoAdicionado: z.object({ fichaId: Id, treinoId: Id, nome: Nome }),
  TreinoRenomeado: z.object({ fichaId: Id, treinoId: Id, nome: Nome }),
  TreinoRemovido: z.object({ fichaId: Id, treinoId: Id }),
  TreinosReordenados: z.object({ fichaId: Id, ordem: z.array(Id).max(50) }),
  ItemAdicionado: z.object({ fichaId: Id, treinoId: Id, blocoId: Id, itemId: Id, exercicioId: Id, modalidade: Modalidade, prescricao: Prescricao }),
  PrescricaoAlterada: z.object({ fichaId: Id, itemId: Id, prescricao: Prescricao }),
  ItemRemovido: z.object({ fichaId: Id, itemId: Id }),
  ItensAgrupados: z.object({ fichaId: Id, treinoId: Id, blocoId: Id, itemIds: z.array(Id).min(2).max(10) }),
  ItemDesagrupado: z.object({ fichaId: Id, itemId: Id, novoBlocoId: Id }),
  BlocosReordenados: z.object({ fichaId: Id, treinoId: Id, ordem: z.array(Id).max(100) }),
} as const;

export type EventoPlanejamento = {
  [K in keyof typeof EventosPlanejamento]: { type: K; payload: z.infer<(typeof EventosPlanejamento)[K]> };
}[keyof typeof EventosPlanejamento];

export type ItemFicha = { itemId: string; exercicioId: string; modalidade: Modalidade; prescricao: Prescricao };
/** Bloco com 1 item = exercício normal; 2+ itens = bi-set/tri-set/circuito. */
export type Bloco = { blocoId: string; itens: ItemFicha[] };
export type Treino = { treinoId: string; nome: string; blocos: Bloco[] };
export type Ficha = { fichaId: string; nome: string; ativa: boolean; arquivada: boolean; treinos: Treino[] };

export type EstadoPlanejamento = { fichas: Readonly<Record<string, Ficha>> };
export const estadoInicialPlanejamento: EstadoPlanejamento = { fichas: {} };

// --- helpers puros ---
const semBlocosVazios = (blocos: Bloco[]) => blocos.filter((b) => b.itens.length > 0);
const idsDeItens = (f: Ficha) => new Set(f.treinos.flatMap((t) => t.blocos.flatMap((b) => b.itens.map((i) => i.itemId))));
const idsDeBlocos = (f: Ficha) => new Set(f.treinos.flatMap((t) => t.blocos.map((b) => b.blocoId)));
const mapTreinos = (f: Ficha, fn: (t: Treino) => Treino): Ficha => ({ ...f, treinos: f.treinos.map(fn) });
const mapBlocosDaFicha = (f: Ficha, fn: (b: Bloco[]) => Bloco[]): Ficha => mapTreinos(f, (t) => ({ ...t, blocos: semBlocosVazios(fn(t.blocos)) }));

export function encontrarItem(f: Ficha, itemId: string): { treino: Treino; bloco: Bloco; item: ItemFicha } | undefined {
  for (const treino of f.treinos)
    for (const bloco of treino.blocos)
      for (const item of bloco.itens) if (item.itemId === itemId) return { treino, bloco, item };
  return undefined;
}

export function reduzirPlanejamento(estado: EstadoPlanejamento, e: EventoPlanejamento): EstadoPlanejamento {
  const ficha = estado.fichas[e.payload.fichaId];
  const com = (f: Ficha): EstadoPlanejamento => ({ fichas: { ...estado.fichas, [f.fichaId]: f } });

  if (e.type === 'FichaCriada') {
    if (ficha) return estado;
    return com({ fichaId: e.payload.fichaId, nome: e.payload.nome, ativa: false, arquivada: false, treinos: [] });
  }
  if (!ficha || ficha.arquivada) return estado; // P8: tudo o mais exige ficha existente e não arquivada

  switch (e.type) {
    case 'FichaRenomeada':
      return com({ ...ficha, nome: e.payload.nome });
    case 'FichaAtivada':
      return com({ ...ficha, ativa: true }); // várias fichas podem estar ativas (01-dominio §9)
    case 'FichaDesativada':
      return com({ ...ficha, ativa: false });
    case 'FichaArquivada':
      return com({ ...ficha, ativa: false, arquivada: true });

    case 'TreinoAdicionado': {
      if (ficha.treinos.some((t) => t.treinoId === e.payload.treinoId)) return estado;
      return com({ ...ficha, treinos: [...ficha.treinos, { treinoId: e.payload.treinoId, nome: e.payload.nome, blocos: [] }] });
    }
    case 'TreinoRenomeado':
      return com(mapTreinos(ficha, (t) => (t.treinoId === e.payload.treinoId ? { ...t, nome: e.payload.nome } : t)));
    case 'TreinoRemovido':
      return com({ ...ficha, treinos: ficha.treinos.filter((t) => t.treinoId !== e.payload.treinoId) });
    case 'TreinosReordenados':
      return com({ ...ficha, treinos: reordenar(ficha.treinos, e.payload.ordem, (t) => t.treinoId) });

    case 'ItemAdicionado': {
      const p = e.payload;
      const treino = ficha.treinos.find((t) => t.treinoId === p.treinoId);
      if (!treino || idsDeItens(ficha).has(p.itemId) || !prescricaoCompativel(p.modalidade, p.prescricao)) return estado;
      const blocoNoTreino = treino.blocos.some((b) => b.blocoId === p.blocoId);
      if (!blocoNoTreino && idsDeBlocos(ficha).has(p.blocoId)) return estado; // bloco pertence a outro treino
      const item: ItemFicha = { itemId: p.itemId, exercicioId: p.exercicioId, modalidade: p.modalidade, prescricao: p.prescricao };
      const blocos = blocoNoTreino
        ? treino.blocos.map((b) => (b.blocoId === p.blocoId ? { ...b, itens: [...b.itens, item] } : b))
        : [...treino.blocos, { blocoId: p.blocoId, itens: [item] }];
      return com(mapTreinos(ficha, (t) => (t.treinoId === p.treinoId ? { ...t, blocos } : t)));
    }
    case 'PrescricaoAlterada': {
      const achado = encontrarItem(ficha, e.payload.itemId);
      if (!achado || !prescricaoCompativel(achado.item.modalidade, e.payload.prescricao)) return estado;
      return com(
        mapBlocosDaFicha(ficha, (blocos) =>
          blocos.map((b) => ({ ...b, itens: b.itens.map((i) => (i.itemId === e.payload.itemId ? { ...i, prescricao: e.payload.prescricao } : i)) })),
        ),
      );
    }
    case 'ItemRemovido':
      return com(mapBlocosDaFicha(ficha, (blocos) => blocos.map((b) => ({ ...b, itens: b.itens.filter((i) => i.itemId !== e.payload.itemId) }))));

    case 'ItensAgrupados': {
      const p = e.payload;
      const treino = ficha.treinos.find((t) => t.treinoId === p.treinoId);
      if (!treino) return estado;
      const itensDoTreino = treino.blocos.flatMap((b) => b.itens);
      // Deduplica: um evento com itemIds repetidos não pode duplicar o item (achado pelo teste de propriedade, seed 170).
      const mover = [...new Set(p.itemIds)].map((id) => itensDoTreino.find((i) => i.itemId === id)).filter((i): i is ItemFicha => !!i);
      const destinoExiste = treino.blocos.some((b) => b.blocoId === p.blocoId);
      if (mover.length < 2 || (!destinoExiste && idsDeBlocos(ficha).has(p.blocoId))) return estado;
      const moverIds = new Set(mover.map((i) => i.itemId));
      // O bloco de destino fica na posição do bloco do primeiro item movido (ou mantém a sua, se já existir).
      const posicao = treino.blocos.findIndex((b) => (destinoExiste ? b.blocoId === p.blocoId : b.itens.some((i) => i.itemId === mover[0]!.itemId)));
      const blocosSem = treino.blocos.map((b, idx) => ({ b: { ...b, itens: b.itens.filter((i) => !moverIds.has(i.itemId)) }, idx }));
      const resultado: Bloco[] = [];
      for (const { b, idx } of blocosSem) {
        if (idx === posicao) {
          const base = destinoExiste ? b.itens : [];
          resultado.push({ blocoId: p.blocoId, itens: [...base, ...mover] });
          if (!destinoExiste) resultado.push(b);
        } else resultado.push(b);
      }
      return com(mapTreinos(ficha, (t) => (t.treinoId === p.treinoId ? { ...t, blocos: semBlocosVazios(resultado) } : t)));
    }
    case 'ItemDesagrupado': {
      const achado = encontrarItem(ficha, e.payload.itemId);
      if (!achado || achado.bloco.itens.length < 2 || idsDeBlocos(ficha).has(e.payload.novoBlocoId)) return estado;
      const { treino, bloco, item } = achado;
      const blocos = treino.blocos.flatMap((b) =>
        b.blocoId === bloco.blocoId
          ? [{ ...b, itens: b.itens.filter((i) => i.itemId !== item.itemId) }, { blocoId: e.payload.novoBlocoId, itens: [item] }]
          : [b],
      );
      return com(mapTreinos(ficha, (t) => (t.treinoId === treino.treinoId ? { ...t, blocos: semBlocosVazios(blocos) } : t)));
    }
    case 'BlocosReordenados':
      return com(mapTreinos(ficha, (t) => (t.treinoId === e.payload.treinoId ? { ...t, blocos: reordenar(t.blocos, e.payload.ordem, (b) => b.blocoId) } : t)));
  }
}
