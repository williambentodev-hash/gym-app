// Contexto Catálogo: exercícios personalizados do usuário (o catálogo global vem de fora do log: ADR-0011).
import { z } from 'zod';
import { Id, Modalidade } from '../comum/index';

const Nome = z.string().trim().min(1).max(80);
const Grupos = z.array(z.string().min(1).max(40)).max(10);

export const EventosCatalogo = {
  ExercicioPersonalizadoCriado: z.object({ exercicioId: Id, nome: Nome, modalidade: Modalidade, gruposMusculares: Grupos, equipamento: z.string().max(40).optional() }),
  ExercicioPersonalizadoEditado: z.object({ exercicioId: Id, nome: Nome, gruposMusculares: Grupos, equipamento: z.string().max(40).optional() }),
  ExercicioPersonalizadoArquivado: z.object({ exercicioId: Id }),
} as const;

export type EventoCatalogo = {
  [K in keyof typeof EventosCatalogo]: { type: K; payload: z.infer<(typeof EventosCatalogo)[K]> };
}[keyof typeof EventosCatalogo];

export type ExercicioPersonalizado = {
  exercicioId: string;
  nome: string;
  modalidade: Modalidade;
  gruposMusculares: string[];
  equipamento?: string;
  arquivado: boolean;
};

export type EstadoCatalogo = { personalizados: Readonly<Record<string, ExercicioPersonalizado>> };
export const estadoInicialCatalogo: EstadoCatalogo = { personalizados: {} };

export function reduzirCatalogo(estado: EstadoCatalogo, e: EventoCatalogo): EstadoCatalogo {
  const atual = (id: string) => estado.personalizados[id];
  const com = (x: ExercicioPersonalizado): EstadoCatalogo => ({ personalizados: { ...estado.personalizados, [x.exercicioId]: x } });

  switch (e.type) {
    case 'ExercicioPersonalizadoCriado': {
      if (atual(e.payload.exercicioId)) return estado; // P8: id repetido é no-op
      const { equipamento, ...resto } = e.payload;
      return com({ ...resto, ...(equipamento ? { equipamento } : {}), arquivado: false });
    }
    case 'ExercicioPersonalizadoEditado': {
      const x = atual(e.payload.exercicioId);
      if (!x || x.arquivado) return estado;
      const { equipamento, ...resto } = e.payload;
      // modalidade NÃO muda (não faz parte do payload): séries antigas continuam interpretáveis.
      const { equipamento: _antigo, ...semEquip } = x;
      return com({ ...semEquip, ...resto, ...(equipamento ? { equipamento } : {}) });
    }
    case 'ExercicioPersonalizadoArquivado': {
      const x = atual(e.payload.exercicioId);
      if (!x || x.arquivado) return estado;
      return com({ ...x, arquivado: true });
    }
  }
}
