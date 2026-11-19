// Comandos do Catálogo: validam invariantes ANTES de gerar eventos (o reducer só aplica fatos).
import { aceitar, recusar, type Decisao, type Modalidade } from '../comum/index';
import type { EstadoCatalogo, EventoCatalogo } from './modelo';

type D = Decisao<EventoCatalogo>;

const nomeEmUso = (e: EstadoCatalogo, nome: string, exceto?: string) =>
  Object.values(e.personalizados).some((x) => !x.arquivado && x.exercicioId !== exceto && x.nome.trim().toLowerCase() === nome.trim().toLowerCase());

export function criarExercicioPersonalizado(
  e: EstadoCatalogo,
  i: { exercicioId: string; nome: string; modalidade: Modalidade; gruposMusculares: string[]; equipamento?: string },
): D {
  if (e.personalizados[i.exercicioId]) return recusar('exercício já existe');
  if (nomeEmUso(e, i.nome)) return recusar(`já existe um exercício chamado "${i.nome.trim()}"`); // nome único por usuário (01-dominio §8)
  return aceitar({ type: 'ExercicioPersonalizadoCriado', payload: i });
}

export function editarExercicioPersonalizado(e: EstadoCatalogo, i: { exercicioId: string; nome: string; gruposMusculares: string[]; equipamento?: string }): D {
  const x = e.personalizados[i.exercicioId];
  if (!x || x.arquivado) return recusar('exercício não encontrado');
  if (nomeEmUso(e, i.nome, i.exercicioId)) return recusar(`já existe um exercício chamado "${i.nome.trim()}"`);
  return aceitar({ type: 'ExercicioPersonalizadoEditado', payload: i });
}

export function arquivarExercicioPersonalizado(e: EstadoCatalogo, exercicioId: string): D {
  const x = e.personalizados[exercicioId];
  if (!x || x.arquivado) return recusar('exercício não encontrado');
  return aceitar({ type: 'ExercicioPersonalizadoArquivado', payload: { exercicioId } });
}
