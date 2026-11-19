// Tokens do tema (docs/design/identidade-visual.md). Nenhuma cor ou medida solta nos componentes.
import { Platform, type TextStyle } from 'react-native';

export const cores = {
  fundo: '#121214', // grafite: o "preto menos preto"
  superficie: '#1C1C1F',
  superficieElevada: '#26262A',
  separador: '#2E2E33',
  texto: '#F5F5F7',
  textoSecundario: '#A1A1A8',
  textoTerciario: '#6E6E76',
  acento: '#FF7A1A',
  acentoPressionado: '#E8650A',
  acentoSuave: 'rgba(255,122,26,0.14)',
  textoSobreAcento: '#121214', // contraste > 7:1 (branco sobre laranja reprova no WCAG AA)
  sucesso: '#30D158',
  alerta: '#FFD60A',
  erro: '#FF453A',
} as const;

export const espaco = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const raio = { cartao: 12, botao: 10, pilula: 999 } as const;
export const margemTela = 20;
export const alvoToque = 44;

const familia = Platform.select({ web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Inter, sans-serif', default: undefined });

const t = (fontSize: number, fontWeight: TextStyle['fontWeight'], extra: TextStyle = {}): TextStyle => ({
  fontSize,
  fontWeight,
  color: cores.texto,
  ...(familia ? { fontFamily: familia } : {}),
  ...extra,
});

export const tipo = {
  tituloGrande: t(34, '700', { letterSpacing: 0.37 }),
  titulo: t(22, '600'),
  destaque: t(17, '600'),
  corpo: t(17, '400'),
  apoio: t(15, '400', { color: cores.textoSecundario }),
  nota: t(13, '400', { color: cores.textoSecundario }),
  rotulo: t(13, '600', { color: cores.textoSecundario, textTransform: 'uppercase', letterSpacing: 0.6 }),
  numeroGrande: t(48, '600', { fontVariant: ['tabular-nums'] }),
  numero: t(17, '600', { fontVariant: ['tabular-nums'] }),
} as const;
