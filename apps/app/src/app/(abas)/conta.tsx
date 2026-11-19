// Conta: identidade (ADR-0008) e estado da sincronização (ADR-0006). Transparência sobre onde estão os dados.
import { Platform, Text, View } from 'react-native';
import { useApp } from '../../aplicacao/contexto';
import { authClient } from '../../infra/auth-client';
import { Botao, Cartao, confirmar, Linha, Secao, Separador, Tela } from '../../ui/componentes';
import { cores, espaco, tipo } from '../../ui/tema';

export default function Conta() {
  const { sync, sincronizar, logado, catalogo, deviceId } = useApp();
  const { data: sessao } = authClient.useSession();
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
