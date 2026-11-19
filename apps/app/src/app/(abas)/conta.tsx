// Conta: identidade (ADR-0008) e estado da sincronização (ADR-0006). Transparência sobre onde estão os dados.
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useApp } from '../../aplicacao/contexto';
import { excluirContaNoServidor, exportarDados, limparEpocaAnterior } from '../../aplicacao/privacidade';
import { authClient } from '../../infra/auth-client';
import { avisar, Botao, Cartao, confirmar, Linha, Secao, Separador, Tela } from '../../ui/componentes';
import { cores, espaco, tipo } from '../../ui/tema';

export default function Conta() {
  const { sync, sincronizar, logado, catalogo, deviceId, apagarDadosLocais } = useApp();
  const { data: sessao } = authClient.useSession();
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function acao(nome: string, fn: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(nome);
    try {
      await fn();
    } catch (e) {
      avisar('Não foi possível', e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  }

  async function apagarLocal() {
    const aviso = sync.pendentes ? `${sync.pendentes} registros ainda NÃO foram enviados e serão perdidos.` : 'Seus dados sincronizados continuam na nuvem e voltam no próximo login.';
    if (!(await confirmar('Apagar dados deste aparelho?', aviso, 'Apagar'))) return;
    await acao('local', apagarDadosLocais);
  }

  async function excluirConta() {
    if (!(await confirmar('Excluir sua conta?', 'Todos os seus treinos, fichas e dados de login serão apagados da nuvem e deste aparelho. Isso não pode ser desfeito. Se quiser, exporte seus dados antes.', 'Continuar'))) return;
    if (!(await confirmar('Tem certeza?', 'Última confirmação: excluir definitivamente a conta e todos os dados.', 'Excluir definitivamente'))) return;
    await acao('excluir', async () => {
      const n = await excluirContaNoServidor();
      await authClient.signOut().catch(() => undefined);
      await apagarDadosLocais();
      avisar('Conta excluída', `${n} registros apagados da nuvem. Os dados deste aparelho também foram removidos.`);
    });
  }
  const corSync = { ok: cores.sucesso, sincronizando: cores.acento, offline: cores.alerta, sem_login: cores.alerta, ocioso: cores.textoSecundario }[sync.estado];

  async function sair() {
    // ADR-0008: logout nunca apaga silenciosamente dados não enviados.
    if (sync.pendentes > 0 && !(await confirmar('Há treinos não sincronizados', `${sync.pendentes} registros ainda não foram enviados. Eles continuam salvos neste aparelho e serão enviados quando você entrar de novo.`, 'Sair mesmo assim'))) return;
    await authClient.signOut();
  }

  return (
    <Tela titulo="Conta">
      <Cartao>
        {logado && sessao ? (
          <>
            <Text style={tipo.titulo}>{sessao.user.name}</Text>
            <Text style={tipo.apoio}>{sessao.user.email}</Text>
            <Botao variante="secundario" titulo="Sair" icone="log-out-outline" onPress={sair} />
          </>
        ) : (
          <>
            <Text style={tipo.titulo}>Entre para sincronizar</Text>
            <Text style={tipo.apoio}>Sem login o app funciona normalmente: tudo fica salvo neste aparelho. Com login, seus treinos ficam disponíveis no celular e na web.</Text>
            <Botao titulo="Entrar com Google" icone="logo-google" onPress={() => authClient.signIn.social({ provider: 'google', callbackURL: '/' })} />
          </>
        )}
      </Cartao>

      <Secao titulo="Sincronização">
        <Cartao>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: corSync }} />
            <Text style={[tipo.corpo, { flex: 1 }]}>{sync.mensagem || '—'}</Text>
          </View>
          <Text style={tipo.nota}>
            {sync.confirmados} registros sincronizados · <Text style={{ color: sync.pendentes ? cores.alerta : cores.textoSecundario }}>{sync.pendentes} pendentes</Text>
            {sync.em ? ` · última em ${new Date(sync.em).toLocaleTimeString('pt-BR')}` : ''}
          </Text>
          <Botao variante="secundario" titulo="Sincronizar agora" icone="sync" desabilitado={!logado || sync.estado === 'sincronizando'} onPress={sincronizar} />
        </Cartao>
      </Secao>

      <Secao titulo="Privacidade e seus dados">
        <Cartao style={{ paddingVertical: espaco.xs, gap: 0 }}>
          <Linha icone="document-text-outline" titulo="Política de privacidade" onPress={() => router.push('/privacidade')} />
          {logado ? (
            <>
              <Separador />
              <Linha icone="download-outline" titulo={ocupado === 'exportar' ? 'Preparando…' : 'Exportar meus dados'} detalhe="Arquivo JSON com tudo o que guardamos sobre você" onPress={() => acao('exportar', async () => { await exportarDados(); })} />
              <Separador />
              <Linha icone="trash-bin-outline" titulo="Apagar dados de teste antigos" detalhe="Registros da fase de testes, anteriores à versão atual" onPress={() => acao('limpar', async () => { const n = await limparEpocaAnterior(); avisar('Pronto', n ? `${n} registros de teste apagados.` : 'Não havia dados de teste.'); })} />
            </>
          ) : null}
          <Separador />
          <Linha icone="phone-portrait-outline" titulo="Apagar dados deste aparelho" detalhe={sync.pendentes ? `Atenção: ${sync.pendentes} registros ainda não sincronizados` : 'Remove o banco local; o que está sincronizado continua na nuvem'} onPress={apagarLocal} />
        </Cartao>
        {logado ? <Botao variante="perigo" icone="warning-outline" titulo="Excluir minha conta" onPress={excluirConta} /> : null}
      </Secao>

      <Secao titulo="Sobre">
        <Cartao style={{ paddingVertical: espaco.xs, gap: 0 }}>
          <Linha titulo="Catálogo" detalhe={`${catalogo.lista.length} exercícios · versão ${catalogo.versao}`} />
          <Separador />
          <Linha titulo="Este aparelho" detalhe={`${Platform.OS} · ${deviceId.slice(0, 8)}`} />
          <Separador />
          <Linha titulo="Seus dados" detalhe="Salvos primeiro no aparelho e sincronizados com um armazenamento só seu na nuvem." />
        </Cartao>
      </Secao>
      <Text style={[tipo.nota, { textAlign: 'center' }]}>gym.app · não substitui orientação profissional de saúde</Text>
    </Tela>
  );
}
