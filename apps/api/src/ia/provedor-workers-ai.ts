// Provedor Workers AI (ADR-0016): gratuito (franquia diária da Cloudflare), modelo aberto com "JSON mode".
// O modelo não garante schema nem enum e erra contas. Por isso, três mecanismos (medidos na avaliação):
//  1. CÓDIGOS CURTOS (E001…) no lugar dos IDs: o modelo não "deduz" IDs a partir do nome.
//  2. Validação de formato e de catálogo, com uma correção apontando o erro.
//  3. CRÍTICO DETERMINÍSTICO (volume, frequência, ordem, tempo, limitações) + uma rodada de reparo;
//     fica a versão com menos problemas.
import type { Catalogo, PerfilTreino } from '@gym/contracts';
import { z } from 'zod';
import { SISTEMA_ESPECIALISTA } from './prompt';
import { ErroIA, esquemaSaida, mensagemDoPerfil, type SaidaIA } from './proposta';

/** Único modelo de propósito geral com JSON mode documentado e qualidade adequada (24k tokens de contexto). */
export const MODELO_WORKERS_AI = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

type Mensagem = { role: 'system' | 'user' | 'assistant'; content: string };

const esquema = esquemaSaida(); // exercicioId como texto: aqui ele carrega o CÓDIGO curto
const jsonSchema = (() => {
  const { $schema: _ignorado, ...resto } = z.toJSONSchema(esquema) as Record<string, unknown>;
  return resto;
})();

const REFORCO_FORMATO =
  '\n\n## Resposta\nResponda SOMENTE com o JSON no formato pedido, sem texto antes ou depois. Em exercicioId use exatamente o código da primeira coluna do catálogo (ex.: "E007"). Nunca invente códigos.';

/** Catálogo com códigos curtos (E001…): menos chance de o modelo inventar um identificador plausível. */
function catalogoComCodigos(catalogo: Catalogo) {
  const codigoDe = new Map<string, string>();
  const idDe = new Map<string, string>();
  const linhas = catalogo.exercicios.map((e, k) => {
    const codigo = `E${String(k + 1).padStart(3, '0')}`;
    codigoDe.set(e.id, codigo);
    idDe.set(codigo, e.id);
    return `${codigo} | ${e.nome} | ${e.modalidade} | ${e.grupoPrincipal}${e.gruposSecundarios.length ? ` (+ ${e.gruposSecundarios.join(', ')})` : ''} | ${e.equipamento} | ${e.composto ? 'composto' : 'isolado'}`;
  });
  return { texto: linhas.join('\n'), idDe };
}

/** Função que aponta problemas objetivos numa saída já convertida para IDs reais. */
export type Critico = (saida: SaidaIA) => string[];

export async function gerarComWorkersAI(ai: Ai, perfil: PerfilTreino, catalogo: Catalogo, criticar: Critico = () => []): Promise<SaidaIA> {
  const { texto, idDe } = catalogoComCodigos(catalogo);
  const mensagens: Mensagem[] = [
    { role: 'system', content: `${SISTEMA_ESPECIALISTA}\n(id = código curto)\n${texto}${REFORCO_FORMATO}` },
    { role: 'user', content: mensagemDoPerfil(perfil) },
  ];

  let melhor: { saida: SaidaIA; problemas: string[] } | null = null;
  // No máximo 2 chamadas por ficha (~1.000 neurônios): mantém ~9 fichas/dia na franquia gratuita.
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const bruto = await chamar(ai, mensagens);
    const r = interpretar(bruto, idDe);
    let problemas: string[];
    if (!r.ok) problemas = [r.erro];
    else {
      problemas = criticar(r.saida);
      if (!melhor || problemas.length < melhor.problemas.length) melhor = { saida: r.saida, problemas };
      if (problemas.length === 0) break;
    }
    console.log(JSON.stringify({ evento: 'ia_critica', provedor: 'workers-ai', tentativa, problemas: problemas.length }));
    if (tentativa === 2) break;
    mensagens.push({ role: 'assistant', content: typeof bruto === 'string' ? bruto : JSON.stringify(bruto) });
    mensagens.push({
      role: 'user',
      content: `Revise a ficha: uma avaliação automática encontrou estes problemas:\n- ${problemas.join('\n- ')}\nCorrija TODOS, mantendo o que estava bom, e responda novamente apenas com o JSON completo.`,
    });
  }
  if (!melhor) throw new ErroIA('a IA não conseguiu montar a ficha no formato esperado; tente de novo', 502);
  return melhor.saida;
}

async function chamar(ai: Ai, mensagens: Mensagem[]): Promise<unknown> {
  try {
    const r = (await ai.run(MODELO_WORKERS_AI, {
      messages: mensagens,
      response_format: { type: 'json_schema', json_schema: jsonSchema },
      max_tokens: 4096, // o padrão do modelo é 256: pequeno demais para uma ficha
      temperature: 0.3, // mais consistente para um plano estruturado
    } as never)) as { response?: unknown; usage?: unknown };
    console.log(JSON.stringify({ evento: 'ia_ficha', provedor: 'workers-ai', modelo: MODELO_WORKERS_AI, uso: r.usage }));
    return r.response;
  } catch (e) {
    const msg = String(e);
    if (/neuron|daily|limit|4006|quota/i.test(msg)) throw new ErroIA('a IA gratuita atingiu o limite de uso de hoje; tente amanhã', 503);
    if (/JSON Mode couldn't be met/i.test(msg)) return ''; // tratado como formato inválido → tentativa de correção
    console.error(JSON.stringify({ evento: 'ia_erro', provedor: 'workers-ai', erro: msg.slice(0, 300) }));
    throw new ErroIA('falha ao consultar a IA; tente de novo em instantes', 502);
  }
}

/** Valida o formato e converte códigos → IDs reais; códigos desconhecidos são apontados como problema. */
function interpretar(bruto: unknown, idDe: Map<string, string>): { ok: true; saida: SaidaIA } | { ok: false; erro: string } {
  let json: unknown = bruto;
  if (typeof bruto === 'string') {
    try {
      json = JSON.parse(bruto);
    } catch {
      return { ok: false, erro: 'a resposta não é um JSON válido' };
    }
  }
  const r = esquema.safeParse(json);
  if (!r.success) return { ok: false, erro: `JSON fora do formato (${r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')})` };
  const desconhecidos = new Set<string>();
  const saida: SaidaIA = {
    ...r.data,
    treinos: r.data.treinos.map((t) => ({
      ...t,
      blocos: t.blocos.map((b) => ({
        itens: b.itens.map((i) => {
          const id = idDe.get(i.exercicioId.trim().toUpperCase());
          if (!id) desconhecidos.add(i.exercicioId);
          return { ...i, exercicioId: id ?? `desconhecido:${i.exercicioId}` };
        }),
      })),
    })),
  };
  if (desconhecidos.size) return { ok: false, erro: `códigos inexistentes no catálogo: ${[...desconhecidos].slice(0, 8).join(', ')}` };
  return { ok: true, saida };
}
