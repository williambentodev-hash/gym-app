// IA especialista (ADR-0015) no cliente: pedir a proposta e convertê-la em COMANDOS do domínio.
// A IA nunca escreve no log: a ficha aceita entra pelos mesmos comandos (e invariantes) de uma ficha feita à mão.
import { PropostaFicha, type PerfilTreino } from '@gym/contracts';
import { adicionarItem, adicionarTreino, criarFicha, type EstadoPlanejamento } from '@gym/domain';
import { fetchAutenticado } from '../infra/auth-client';
import { encadear } from './consultas';

export async function pedirProposta(perfil: PerfilTreino): Promise<PropostaFicha> {
  const r = await fetchAutenticado('/api/ia/sugerir-ficha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(perfil),
  });
  if (r.status === 401) throw new Error('Entre com sua conta (aba Conta) para usar a IA.');
  if (r.status === 429) throw new Error('Muitos pedidos seguidos. Aguarde um minuto e tente de novo.');
  const corpo = (await r.json().catch(() => null)) as unknown;
  if (!r.ok) throw new Error((corpo as { erro?: string } | null)?.erro ?? `erro ${r.status}`);
  return PropostaFicha.parse(corpo); // valida a resposta do servidor contra o contrato
}

/** Proposta → decisão única (criar ficha + treinos + itens), com cada passo validado contra o estado anterior. */
export function decisaoDaProposta(estado: EstadoPlanejamento, proposta: PropostaFicha, novoId: () => string, fichaId: string) {
  const passos: Parameters<typeof encadear>[1][] = [(e) => criarFicha(e, { fichaId, nome: proposta.nome })];
  for (const t of proposta.treinos) {
    const treinoId = novoId();
    passos.push((e) => adicionarTreino(e, { fichaId, treinoId, nome: t.nome }));
    for (const b of t.blocos) {
      const blocoId = novoId(); // itens do mesmo bloco = bi-set/circuito
      for (const i of b.itens) {
        passos.push((e) =>
          adicionarItem(e, { fichaId, treinoId, blocoId, itemId: novoId(), exercicioId: i.exercicioId, modalidade: i.modalidade, prescricao: i.prescricao }),
        );
      }
    }
  }
  return encadear(estado, ...passos);
}
