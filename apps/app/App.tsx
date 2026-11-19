// Walking skeleton (Fase 3): registrar série → SQLite local → sync com o UserStore → outros aparelhos.
// A interface lê sempre o estado local (ADR-0007, ponto 3); a rede nunca bloqueia o registro (QA-1).
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Button, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EstadoProgresso } from '@gym/domain';
import { iniciarApp, registrarSerie, type App as AppCtx } from './src/aplicacao/motor';
import { API_URL, authClient } from './src/infra/auth-client';
import { garantirMidia, type MidiaLocal } from './src/infra/midias-offline';

const EXERCICIOS = ['supino', 'agachamento', 'remada'] as const;

export default function App() {
  const [app, setApp] = useState<AppCtx | null>(null);
  const [estado, setEstado] = useState<EstadoProgresso>({});
  const [contagens, setContagens] = useState({ pendentes: 0, confirmados: 0 });
  const [statusSync, setStatusSync] = useState('—');
  const { data: sessao, isPending } = authClient.useSession();

  const atualizarTela = useCallback(async (a: AppCtx) => {
    setEstado(await a.motor.estado());
    setContagens(await a.store.contagens());
  }, []);

  const sincronizar = useCallback(
    async (a: AppCtx) => {
      setStatusSync('sincronizando…');
      try {
        const r = await a.motor.sincronizar();
        setStatusSync(`ok · enviados ${r.enviados} · recebidos ${r.recebidos} · cursor ${r.cursor} · ${new Date().toLocaleTimeString()}`);
      } catch (e) {
        setStatusSync(`não sincronizou (${e instanceof Error ? e.message : String(e)}) · dados seguros no aparelho`);
      }
      await atualizarTela(a);
    },
    [atualizarTela],
  );

  useEffect(() => {
    iniciarApp().then(async (a) => {
      setApp(a);
      await atualizarTela(a);
    });
  }, [atualizarTela]);

  // Sincroniza ao abrir e sempre que a sessão ficar disponível.
  useEffect(() => {
    if (app && sessao) sincronizar(app);
  }, [app, sessao, sincronizar]);

  async function registrar() {
    if (!app) return;
    const exercicioId = EXERCICIOS[Math.floor(Math.random() * EXERCICIOS.length)]!;
    await registrarSerie(app, { exercicioId, reps: 8 + Math.floor(Math.random() * 5), cargaKg: 40 + 2.5 * Math.floor(Math.random() * 16), tipo: 'trabalho' });
    await atualizarTela(app); // aparece na hora, com ou sem rede
    if (sessao) sincronizar(app); // tenta sincronizar em segundo plano
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>gym.app — walking skeleton ({Platform.OS})</Text>

      <View style={styles.painel}>
        <Text style={styles.sub}>
          {isPending ? 'verificando sessão…' : sessao ? `👤 ${sessao.user.name}` : '👤 não logado (os registros ficam no aparelho)'}
        </Text>
        <View style={styles.botoes}>
          {sessao ? (
            <Button title="Sair" color="#555" onPress={() => authClient.signOut()} />
          ) : (
            <Button title="Entrar com Google" onPress={() => authClient.signIn.social({ provider: 'google', callbackURL: '/' })} />
          )}
        </View>
      </View>

      <View style={styles.painel}>
        <View style={styles.botoes}>
          <Button title="Registrar série" onPress={registrar} disabled={!app} />
          <Button title="Sincronizar" onPress={() => app && sincronizar(app)} disabled={!app || !sessao} />
        </View>
        <Text>
          Eventos: {contagens.confirmados} confirmados · <Text style={contagens.pendentes ? styles.pendente : undefined}>{contagens.pendentes} pendentes</Text>
        </Text>
        <Text style={styles.sub}>Sync: {statusSync}</Text>
        {app ? <Text style={styles.sub}>Aparelho: {app.store.deviceId.slice(0, 8)}</Text> : null}
      </View>

      <View style={styles.painel}>
        <Text style={styles.secao}>Progresso (projeção local dos eventos)</Text>
        {Object.keys(estado).length === 0 ? <Text style={styles.sub}>nenhuma série ainda</Text> : null}
        {Object.entries(estado).map(([ex, p]) => (
          <Text key={ex}>
            {ex}: {p.series} séries · {p.tonelagem} kg de tonelagem · recorde {p.recordeKg} kg
          </Text>
        ))}
      </View>

      <PainelMidia />
      <StatusBar style="auto" />
    </ScrollView>
  );
}

// Mantido do spike S6: animação disponível offline (ADR-0010).
function PainelMidia() {
  const [midia, setMidia] = useState<MidiaLocal | null>(null);
  useEffect(() => {
    garantirMidia(`${API_URL}/media/exercicios/agachamento-livre.v1.gif`).then(setMidia).catch(() => setMidia(null));
  }, []);
  return (
    <View style={[styles.painel, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      {midia ? <Image source={{ uri: midia.uri }} style={{ width: 80, height: 80 }} cachePolicy="none" contentFit="contain" /> : null}
      <Text style={styles.sub}>Agachamento livre · {midia ? midia.origem : 'indisponível'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 12, backgroundColor: '#fff' },
  titulo: { fontSize: 20, fontWeight: '600' },
  secao: { fontWeight: '600' },
  sub: { color: '#555' },
  pendente: { color: '#b45309', fontWeight: '600' },
  painel: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#ddd' },
  botoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
