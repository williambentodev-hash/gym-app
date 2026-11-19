// Comandos do Planejamento: invariantes de escrita (01-dominio §8). O reducer é permissivo (P8); aqui é estrito.
import { aceitar, prescricaoCompativel, recusar, type Decisao, type Modalidade, type Prescricao } from '../comum/index';
import { encontrarItem, type EstadoPlanejamento, type EventoPlanejamento, type Ficha } from './modelo';

type D = Decisao<EventoPlanejamento>;

function fichaEditavel(e: EstadoPlanejamento, fichaId: string): Ficha | string {
  const f = e.fichas[fichaId];
  if (!f) return 'ficha não encontrada';
  if (f.arquivada) return 'ficha arquivada não pode ser alterada';
  return f;
}

export function criarFicha(e: EstadoPlanejamento, i: { fichaId: string; nome: string }): D {
  if (e.fichas[i.fichaId]) return recusar('ficha já existe');
  return aceitar({ type: 'FichaCriada', payload: i });
}

export function renomearFicha(e: EstadoPlanejamento, i: { fichaId: string; nome: string }): D {
  const f = fichaEditavel(e, i.fichaId);
  return typeof f === 'string' ? recusar(f) : aceitar({ type: 'FichaRenomeada', payload: i });
}

/** Só ativa ficha com ao menos 1 treino que tenha ao menos 1 item (01-dominio §8). */
export function ativarFicha(e: EstadoPlanejamento, fichaId: string): D {
  const f = fichaEditavel(e, fichaId);
  if (typeof f === 'string') return recusar(f);
  if (f.ativa) return recusar('ficha já está ativa');
  if (!f.treinos.some((t) => t.blocos.length > 0)) return recusar('adicione ao menos um exercício a um treino antes de ativar a ficha');
  return aceitar({ type: 'FichaAtivada', payload: { fichaId } });
}

export function desativarFicha(e: EstadoPlanejamento, fichaId: string): D {
  const f = fichaEditavel(e, fichaId);
  if (typeof f === 'string') return recusar(f);
  if (!f.ativa) return recusar('ficha já está inativa');
  return aceitar({ type: 'FichaDesativada', payload: { fichaId } });
}

export function arquivarFicha(e: EstadoPlanejamento, fichaId: string): D {
  const f = fichaEditavel(e, fichaId);
  return typeof f === 'string' ? recusar(f) : aceitar({ type: 'FichaArquivada', payload: { fichaId } });
}

export function adicionarTreino(e: EstadoPlanejamento, i: { fichaId: string; treinoId: string; nome: string }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  if (f.treinos.some((t) => t.treinoId === i.treinoId)) return recusar('treino já existe');
  return aceitar({ type: 'TreinoAdicionado', payload: i });
}

export function renomearTreino(e: EstadoPlanejamento, i: { fichaId: string; treinoId: string; nome: string }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  if (!f.treinos.some((t) => t.treinoId === i.treinoId)) return recusar('treino não encontrado');
  return aceitar({ type: 'TreinoRenomeado', payload: i });
}

export function removerTreino(e: EstadoPlanejamento, i: { fichaId: string; treinoId: string }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  if (!f.treinos.some((t) => t.treinoId === i.treinoId)) return recusar('treino não encontrado');
  if (f.ativa && f.treinos.filter((t) => t.treinoId !== i.treinoId).every((t) => t.blocos.length === 0))
    return recusar('a ficha está ativa: ela precisa continuar com ao menos um treino com exercícios');
  return aceitar({ type: 'TreinoRemovido', payload: i });
}

export function reordenarTreinos(e: EstadoPlanejamento, i: { fichaId: string; ordem: string[] }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  const atuais = new Set(f.treinos.map((t) => t.treinoId));
  if (i.ordem.length !== atuais.size || !i.ordem.every((id) => atuais.has(id))) return recusar('a nova ordem precisa conter exatamente os treinos da ficha');
  return aceitar({ type: 'TreinosReordenados', payload: i });
}

/** Adiciona um exercício. `blocoId` existente = entra no bi-set daquele bloco; novo = bloco próprio no fim. */
export function adicionarItem(
  e: EstadoPlanejamento,
  i: { fichaId: string; treinoId: string; blocoId: string; itemId: string; exercicioId: string; modalidade: Modalidade; prescricao: Prescricao },
): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  const treino = f.treinos.find((t) => t.treinoId === i.treinoId);
  if (!treino) return recusar('treino não encontrado');
  if (encontrarItem(f, i.itemId)) return recusar('item já existe');
  const blocoAlheio = f.treinos.some((t) => t.treinoId !== i.treinoId && t.blocos.some((b) => b.blocoId === i.blocoId));
  if (blocoAlheio) return recusar('bloco pertence a outro treino');
  const bloco = treino.blocos.find((b) => b.blocoId === i.blocoId);
  if (bloco && bloco.itens.length >= 10) return recusar('um bloco aceita no máximo 10 exercícios');
  if (!prescricaoCompativel(i.modalidade, i.prescricao)) return recusar('drop-set e rest-pause não se aplicam a exercícios de tempo ou cardio');
  return aceitar({ type: 'ItemAdicionado', payload: i });
}

export function alterarPrescricao(e: EstadoPlanejamento, i: { fichaId: string; itemId: string; prescricao: Prescricao }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  const achado = encontrarItem(f, i.itemId);
  if (!achado) return recusar('item não encontrado');
  if (!prescricaoCompativel(achado.item.modalidade, i.prescricao)) return recusar('drop-set e rest-pause não se aplicam a exercícios de tempo ou cardio');
  return aceitar({ type: 'PrescricaoAlterada', payload: i });
}

export function removerItem(e: EstadoPlanejamento, i: { fichaId: string; itemId: string }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  if (!encontrarItem(f, i.itemId)) return recusar('item não encontrado');
  const restantes = f.treinos.reduce((n, t) => n + t.blocos.reduce((m, b) => m + b.itens.filter((x) => x.itemId !== i.itemId).length, 0), 0);
  if (f.ativa && restantes === 0) return recusar('a ficha está ativa: ela precisa continuar com ao menos um exercício');
  return aceitar({ type: 'ItemRemovido', payload: i });
}

/** Forma bi-set/tri-set/circuito com itens do mesmo treino. */
export function agruparItens(e: EstadoPlanejamento, i: { fichaId: string; treinoId: string; blocoId: string; itemIds: string[] }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  const treino = f.treinos.find((t) => t.treinoId === i.treinoId);
  if (!treino) return recusar('treino não encontrado');
  const unicos = [...new Set(i.itemIds)];
  if (unicos.length < 2) return recusar('selecione ao menos dois exercícios');
  const doTreino = new Set(treino.blocos.flatMap((b) => b.itens.map((x) => x.itemId)));
  if (!unicos.every((id) => doTreino.has(id))) return recusar('todos os exercícios precisam ser do mesmo treino');
  if (unicos.length > 10) return recusar('um bloco aceita no máximo 10 exercícios');
  return aceitar({ type: 'ItensAgrupados', payload: { ...i, itemIds: unicos } });
}

export function desagruparItem(e: EstadoPlanejamento, i: { fichaId: string; itemId: string; novoBlocoId: string }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  const achado = encontrarItem(f, i.itemId);
  if (!achado) return recusar('item não encontrado');
  if (achado.bloco.itens.length < 2) return recusar('o exercício não está agrupado');
  return aceitar({ type: 'ItemDesagrupado', payload: i });
}

export function reordenarBlocos(e: EstadoPlanejamento, i: { fichaId: string; treinoId: string; ordem: string[] }): D {
  const f = fichaEditavel(e, i.fichaId);
  if (typeof f === 'string') return recusar(f);
  const treino = f.treinos.find((t) => t.treinoId === i.treinoId);
  if (!treino) return recusar('treino não encontrado');
  const atuais = new Set(treino.blocos.map((b) => b.blocoId));
  if (i.ordem.length !== atuais.size || !i.ordem.every((id) => atuais.has(id))) return recusar('a nova ordem precisa conter exatamente os blocos do treino');
  return aceitar({ type: 'BlocosReordenados', payload: i });
}
