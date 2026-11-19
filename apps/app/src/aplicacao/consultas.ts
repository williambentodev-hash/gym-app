// Consultas e traduções que cruzam contextos (camada de aplicação, ADR-0009 R5): o domínio não as conhece.
import { reduzirPlanejamento, type Decisao, type EstadoDominio, type EstadoPlanejamento, type EventoPlanejamento, type Medidas, type Modalidade, type Prescricao, type Sessao, type Treino } from '@gym/domain';

/**
 * Encadeia comandos do Planejamento: o 2º é validado contra o estado JÁ com os eventos do 1º.
 * Ex.: criar ficha + criar o "Treino A" numa única gravação, sem pular as invariantes de nenhum dos dois.
 */
export function encadear(
  estado: EstadoPlanejamento,
  ...passos: Array<(e: EstadoPlanejamento) => Decisao<EventoPlanejamento>>
): Decisao<EventoPlanejamento> {
  let atual = estado;
  const eventos: EventoPlanejamento[] = [];
  for (const passo of passos) {
    const d = passo(atual);
    if (!d.ok) return d;
    for (const ev of d.eventos) atual = reduzirPlanejamento(atual, ev);
    eventos.push(...d.eventos);
  }
  return { ok: true, eventos };
}

/** ACL Planejamento → Execução: a sessão recebe uma CÓPIA da prescrição (01-dominio §8). */
export function snapshotDoTreino(treino: Treino) {
  return {
    blocos: treino.blocos.map((b) => ({
      blocoId: b.blocoId,
      itens: b.itens.map((i) => ({ itemId: i.itemId, exercicioId: i.exercicioId, modalidade: i.modalidade, prescricao: i.prescricao })),
    })),
  };
}

/** Rotação da ficha (01-dominio §6): o treino seguinte ao da última sessão daquela ficha. */
export function proximoTreino(e: EstadoDominio, fichaId: string): Treino | undefined {
  const ficha = e.planejamento.fichas[fichaId];
  const treinos = ficha?.treinos.filter((t) => t.blocos.length > 0) ?? [];
  if (treinos.length === 0) return undefined;
  const ultima = Object.values(e.execucao.sessoes)
    .filter((s) => s.fichaId === fichaId && s.status !== 'descartada')
    .sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm))[0];
  const idx = ultima ? treinos.findIndex((t) => t.treinoId === ultima.treinoId) : -1;
  return treinos[(idx + 1) % treinos.length];
}

export function ultimaSessaoDoTreino(e: EstadoDominio, treinoId: string): Sessao | undefined {
  return Object.values(e.execucao.sessoes)
    .filter((s) => s.treinoId === treinoId && (s.status === 'concluida' || s.status === 'encerrada_inatividade'))
    .sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm))[0];
}

export function nomeDoTreino(e: EstadoDominio, fichaId: string, treinoId: string): string {
  return e.planejamento.fichas[fichaId]?.treinos.find((t) => t.treinoId === treinoId)?.nome ?? 'Treino';
}

export function prescricaoPadrao(modalidade: Modalidade): Prescricao {
  switch (modalidade) {
    case 'carga_repeticoes':
    case 'peso_corporal':
      return { series: 3, repeticoes: { min: 8, max: 12 }, tecnica: 'normal' };
    case 'tempo':
      return { series: 3, duracaoSeg: 30, tecnica: 'normal' };
    case 'cardio':
      return { series: 1, duracaoSeg: 20 * 60, tecnica: 'normal' };
  }
}

export const kg = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function tempo(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export function resumoPrescricao(p: Prescricao, modalidade: Modalidade): string {
  const partes: string[] = [];
  if (modalidade === 'tempo' || modalidade === 'cardio') partes.push(`${p.series} × ${tempo(p.duracaoSeg ?? 0)}`);
  else partes.push(`${p.series} × ${p.repeticoes ? (p.repeticoes.min === p.repeticoes.max ? p.repeticoes.min : `${p.repeticoes.min}–${p.repeticoes.max}`) : '—'}`);
  if (p.cargaKg !== undefined) partes.push(`${kg(p.cargaKg)} kg`);
  if (p.tecnica === 'drop_set') partes.push('drop-set');
  if (p.tecnica === 'rest_pause') partes.push('rest-pause');
  if (p.rir !== undefined) partes.push(`RIR ${p.rir}`);
  return partes.join(' · ');
}

export function resumoMedidas(m: Medidas): string {
  switch (m.modalidade) {
    case 'carga_repeticoes': return `${kg(m.cargaKg)} kg × ${m.reps}${m.rir !== undefined ? ` · RIR ${m.rir}` : ''}`;
    case 'peso_corporal': return `${m.reps} reps${m.cargaAdicionalKg ? ` · ${m.cargaAdicionalKg > 0 ? '+' : ''}${kg(m.cargaAdicionalKg)} kg` : ''}${m.rir !== undefined ? ` · RIR ${m.rir}` : ''}`;
    case 'tempo': return `${tempo(m.duracaoSeg)}${m.cargaAdicionalKg ? ` · +${kg(m.cargaAdicionalKg)} kg` : ''}`;
    case 'cardio': return `${tempo(m.duracaoSeg)}${m.distanciaM ? ` · ${(m.distanciaM / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km` : ''}`;
  }
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function duracaoSessao(s: Sessao): number {
  const fim = s.encerradaEm ?? new Date().toISOString();
  return (Date.parse(fim) - Date.parse(s.iniciadaEm)) / 1000;
}
