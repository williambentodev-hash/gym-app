// Contratos entre app e API (ADR-0006, ADR-0009). Fonte única da verdade do protocolo de sincronização.
// O conteúdo do `payload` pertence ao domínio; aqui só o envelope e o transporte.
import { z } from 'zod';

/** Evento como criado no aparelho (ainda sem ordem global). */
export const EventoEnvelope = z.object({
  /** Gerado no cliente; chave de idempotência (ADR-0006, regras 1 e 4). */
  eventId: z.uuid(),
  type: z.string().min(1).max(100),
  /** Versão do formato do payload; eventos antigos passam por upcasters (regra 9). */
  schemaVersion: z.number().int().positive(),
  payload: z.unknown(),
  deviceId: z.string().min(1).max(100),
  /** Quando aconteceu, pelo relógio do aparelho. Dado de domínio; NUNCA critério de ordem (regra 3). */
  ocorridoEm: z.iso.datetime(),
});
export type EventoEnvelope = z.infer<typeof EventoEnvelope>;

/** Evento com a ordem total atribuída pelo servidor. */
export const EventoConfirmado = EventoEnvelope.extend({
  seq: z.number().int().positive(),
  recebidoEm: z.iso.datetime(),
});
export type EventoConfirmado = z.infer<typeof EventoConfirmado>;

export const LIMITE_LOTE = 500;

export const PushRequest = z.object({
  eventos: z.array(EventoEnvelope).min(1).max(LIMITE_LOTE),
});
export type PushRequest = z.infer<typeof PushRequest>;

export const PushResponse = z.object({
  /** seq de cada evento enviado; para um evento repetido, devolve o seq original (idempotência). */
  aceitos: z.array(z.object({ eventId: z.uuid(), seq: z.number().int().positive() })),
  headSeq: z.number().int().nonnegative(),
});
export type PushResponse = z.infer<typeof PushResponse>;

export const PullQuery = z.object({
  desde: z.coerce.number().int().nonnegative(),
  limite: z.coerce.number().int().positive().max(LIMITE_LOTE).default(LIMITE_LOTE),
});
export type PullQuery = z.infer<typeof PullQuery>;

// --- Catálogo global de exercícios (ADR-0011, ADR-0013): snapshot versionado, servido como arquivo estático ---

export const ExercicioCatalogo = z.object({
  /** ID estável (o mesmo da origem, ex.: "pectorals/barbell-bench-press"). Referenciado pelos eventos. */
  id: z.string().min(1),
  nome: z.string().min(1),
  modalidade: z.enum(['carga_repeticoes', 'peso_corporal', 'tempo', 'cardio']),
  /** Composto (multiarticular) ou isolado: define o incremento de carga e o descanso padrão da Orientação. */
  composto: z.boolean(),
  grupoPrincipal: z.string().min(1),
  gruposSecundarios: z.array(z.string()),
  equipamento: z.string().min(1),
  /** Mídias REFERENCIADAS na origem (não redistribuídas: ADR-0011), fixadas num commit (URL imutável). */
  midia: z.object({ animacaoUrl: z.url(), miniaturaUrl: z.url() }),
});
export type ExercicioCatalogo = z.infer<typeof ExercicioCatalogo>;

export const Catalogo = z.object({
  versao: z.string().min(1),
  fonte: z.object({ repositorio: z.string(), commit: z.string() }),
  exercicios: z.array(ExercicioCatalogo).min(1),
});
export type Catalogo = z.infer<typeof Catalogo>;

// --- IA especialista em treino (ADR-0015): perfil enviado pelo app e proposta devolvida pela API ---

/** Só parâmetros de treino: nada de nome, e-mail ou identificadores (minimização, ADR-0014/0015). */
export const PerfilTreino = z.object({
  objetivo: z.enum(['hipertrofia', 'forca', 'condicionamento', 'emagrecimento', 'saude']),
  diasPorSemana: z.number().int().min(1).max(7),
  minutosPorTreino: z.number().int().min(20).max(180),
  nivel: z.enum(['iniciante', 'intermediario', 'avancado']),
  local: z.enum(['academia_completa', 'academia_basica', 'casa_halteres', 'peso_corporal']),
  /** Grupos musculares que a pessoa quer priorizar (chaves do catálogo, ex.: "gluteos"). */
  prioridades: z.array(z.string().min(1).max(30)).max(5).default([]),
  /** Texto livre opcional (ex.: "dor no ombro direito"). Pode ser dado de saúde: enviado só se preenchido. */
  limitacoes: z.string().trim().max(300).optional(),
  observacoes: z.string().trim().max(300).optional(),
});
export type PerfilTreino = z.infer<typeof PerfilTreino>;

export const PrescricaoProposta = z.object({
  series: z.number().int().min(1).max(10),
  repeticoes: z.object({ min: z.number().int().min(1).max(50), max: z.number().int().min(1).max(50) }).optional(),
  duracaoSeg: z.number().int().min(5).max(4 * 3600).optional(),
  rir: z.number().int().min(0).max(5).optional(),
  descansoSeg: z.number().int().min(0).max(600),
  tecnica: z.enum(['normal', 'drop_set', 'rest_pause']),
});
export type PrescricaoProposta = z.infer<typeof PrescricaoProposta>;

export const ItemProposto = z.object({
  exercicioId: z.string().min(1),
  nome: z.string(),
  modalidade: z.enum(['carga_repeticoes', 'peso_corporal', 'tempo', 'cardio']),
  prescricao: PrescricaoProposta,
  observacao: z.string().optional(),
});
export type ItemProposto = z.infer<typeof ItemProposto>;

export const PropostaFicha = z.object({
  nome: z.string().min(1),
  resumo: z.string(),
  treinos: z.array(z.object({
    nome: z.string().min(1),
    foco: z.string(),
    /** Bloco com 2+ itens = bi-set/circuito (mesmo conceito do domínio). */
    blocos: z.array(z.object({ itens: z.array(ItemProposto).min(1) })).min(1),
  })).min(1).max(7),
  recomendacoes: z.array(z.string()),
  /** Análise determinística da proposta pelas regras da Orientação (não é opinião da IA). */
  analise: z.object({
    volumeSemanal: z.record(z.string(), z.object({ series: z.number(), status: z.enum(['abaixo', 'dentro', 'acima']) })),
    minutosEstimadosPorTreino: z.array(z.number()),
    avisos: z.array(z.string()),
  }),
});
export type PropostaFicha = z.infer<typeof PropostaFicha>;

export const PullResponse = z.object({
  eventos: z.array(EventoConfirmado),
  headSeq: z.number().int().nonnegative(),
  temMais: z.boolean(),
});
export type PullResponse = z.infer<typeof PullResponse>;
