// Direitos do titular no cliente (LGPD art. 18; ADR-0014): exportar, limpar dados de teste, excluir conta.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { fetchAutenticado } from '../infra/auth-client';

async function exigirOk(r: Response): Promise<Response> {
  if (!r.ok) throw new Error(r.status === 401 ? 'faça login novamente' : r.status === 429 ? 'muitas tentativas; aguarde um minuto' : `erro ${r.status}`);
  return r;
}

/** Baixa a exportação completa e entrega ao usuário (compartilhar no celular, download na web). */
export async function exportarDados(): Promise<void> {
  const texto = await (await exigirOk(await fetchAutenticado('/api/conta/exportar'))).text();
  const nome = `forja-dados-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nome });
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const arquivo = new File(Paths.cache, nome);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  arquivo.write(texto);
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/json', dialogTitle: 'Seus dados do Forja' });
}

export async function limparEpocaAnterior(): Promise<number> {
  const r = await exigirOk(await fetchAutenticado('/api/conta/limpar-epoca-anterior', { method: 'POST' }));
  return ((await r.json()) as { apagados: number }).apagados;
}

/** Exclui logs (todas as épocas) e identidade no servidor. Os dados locais são apagados pela tela, em seguida. */
export async function excluirContaNoServidor(): Promise<number> {
  const r = await exigirOk(
    await fetchAutenticado('/api/conta', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmacao: 'EXCLUIR MINHA CONTA' }),
    }),
  );
  return ((await r.json()) as { eventosApagados: number }).eventosApagados;
}
