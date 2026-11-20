// Serviço da IA especialista (ADR-0015/0016): escolhe o provedor por CONFIGURAÇÃO e aplica o núcleo comum.
// - ANTHROPIC_API_KEY configurada → Claude Opus 5.5 (melhor qualidade, pago).
// - Caso contrário → Workers AI (gratuito, franquia diária da Cloudflare), com crítico + reparo.
// Em qualquer caso, a proposta passa pela mesma normalização, análise e crítica determinísticas.
import type { Catalogo, PerfilTreino, PropostaFicha } from '@gym/contracts';
import { normalizarEAnalisar, problemasDaProposta, type SaidaIA } from './proposta';
import { gerarComClaude } from './provedor-claude';
import { gerarComWorkersAI } from './provedor-workers-ai';

export { ErroIA } from './proposta';

export function criticoPara(perfil: PerfilTreino, catalogo: Catalogo) {
  return (saida: SaidaIA) => {
    try {
      return problemasDaProposta(normalizarEAnalisar(saida, perfil, catalogo), perfil, catalogo);
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  };
}

export async function gerarProposta(env: { ANTHROPIC_API_KEY?: string; AI: Ai }, perfil: PerfilTreino, catalogo: Catalogo): Promise<PropostaFicha> {
  const saida = env.ANTHROPIC_API_KEY
    ? await gerarComClaude(env.ANTHROPIC_API_KEY, perfil, catalogo)
    : await gerarComWorkersAI(env.AI, perfil, catalogo, criticoPara(perfil, catalogo));
  const proposta = normalizarEAnalisar(saida, perfil, catalogo);
  // O que sobrar de problema vira aviso explícito na prévia: o usuário decide com informação.
  const restantes = problemasDaProposta(proposta, perfil, catalogo);
  return { ...proposta, analise: { ...proposta.analise, avisos: [...proposta.analise.avisos, ...restantes.map((p) => p.charAt(0).toUpperCase() + p.slice(1) + '.')] } };
}
