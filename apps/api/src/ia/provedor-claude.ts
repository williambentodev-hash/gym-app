// Provedor Claude (ADR-0015): usado quando ANTHROPIC_API_KEY está configurada. Structured outputs com enum de IDs.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Catalogo, PerfilTreino } from '@gym/contracts';
import { catalogoParaPrompt, SISTEMA_ESPECIALISTA } from './prompt';
import { ErroIA, esquemaSaida, mensagemDoPerfil, type SaidaIA } from './proposta';

export const MODELO_CLAUDE = 'claude-opus-5-5';

export async function gerarComClaude(apiKey: string, perfil: PerfilTreino, catalogo: Catalogo): Promise<SaidaIA> {
  const ids = catalogo.exercicios.map((e) => e.id) as [string, ...string[]];
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  let resposta;
  try {
    resposta = await client.beta.messages.parse({
      model: MODELO_CLAUDE,
      max_tokens: 16000,
      // Planejamento é sensível à qualidade: effort "high" (o padrão do Opus 5.5 é "medium").
      output_config: { effort: 'high', format: betaZodOutputFormat(esquemaSaida(ids)) },
      // Recusa por classificador de segurança: o servidor tenta de novo com o modelo de fallback adequado.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        // Bloco estável (prompt + catálogo) com cache: chamadas seguintes pagam ~10% por esse trecho.
        { type: 'text', text: `${SISTEMA_ESPECIALISTA}\n${catalogoParaPrompt(catalogo)}`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: mensagemDoPerfil(perfil) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ErroIA('a IA está ocupada agora; tente em alguns instantes', 503);
    if (e instanceof Anthropic.AuthenticationError) throw new ErroIA('IA não configurada corretamente no servidor', 503);
    if (e instanceof Anthropic.APIError) throw new ErroIA(`falha ao consultar a IA (${e.status ?? 'rede'})`, 502);
    throw e;
  }

  console.log(JSON.stringify({ evento: 'ia_ficha', provedor: 'claude', modelo: resposta.model, stop: resposta.stop_reason, uso: resposta.usage }));
  if (resposta.stop_reason === 'refusal') throw new ErroIA('a IA não conseguiu montar esta ficha; ajuste o pedido e tente de novo', 422);
  if (resposta.stop_reason === 'max_tokens') throw new ErroIA('a resposta da IA ficou incompleta; tente de novo', 502);
  if (!resposta.parsed_output) throw new ErroIA('a IA devolveu um formato inválido; tente de novo', 502);
  return resposta.parsed_output;
}
