// ⚠️ Código de spike (Fase 3). Mídias disponíveis offline (QA-1, ADR-0010).
//
// Decisão: download EXPLÍCITO para Paths.document, não o cache do expo-image.
// O cache do expo-image é "melhor esforço" (LRU de 250 MB no Android, e o SO pode limpar a pasta de cache).
// As mídias da ficha ativa precisam de garantia, então ficam numa pasta que o sistema não apaga.
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export type MidiaLocal = { uri: string; origem: 'arquivo-local' | 'baixada-agora' | 'rede (web)' };

const pasta = () => new Directory(Paths.document, 'midias');

/** Garante a mídia em disco e devolve a URI local. Idempotente: se já existe, não baixa de novo. */
export async function garantirMidia(url: string): Promise<MidiaLocal> {
  // Web: expo-file-system não existe; o navegador usa o cache HTTP (cabeçalho immutable).
  if (Platform.OS === 'web') return { uri: url, origem: 'rede (web)' };

  const dir = pasta();
  dir.create({ idempotent: true, intermediates: true });

  // O nome versionado (ex.: agachamento-livre.v1.gif) torna o arquivo imutável: existe = está correto.
  // Pasta + arquivo (ex.: "pectorals__barbell-bench-press.gif"): o mesmo nome pode existir em grupos diferentes.
  const nome = url.split('/').slice(-2).join('__');
  const destino = new File(dir, nome);
  if (destino.exists) return { uri: destino.uri, origem: 'arquivo-local' };

  // Baixa num arquivo temporário e só então move: uma queda de rede no meio do download
  // nunca deixa um arquivo pela metade com o nome "definitivo".
  const temporario = new File(dir, `${nome}.part`);
  if (temporario.exists) temporario.delete();
  await File.downloadFileAsync(url, temporario);
  temporario.move(destino);
  return { uri: destino.uri, origem: 'baixada-agora' };
}

/** Para o teste do spike: apaga as mídias baixadas. */
export function limparMidias(): void {
  if (Platform.OS === 'web') return;
  const dir = pasta();
  if (dir.exists) dir.delete();
}
