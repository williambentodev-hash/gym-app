// ⚠️ Tela de spike (Fase 3): valida S1 (SQLite local, inclusive web) e S4 (rebuild de 1.000 eventos < 1 s).
import * as Crypto from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Button, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { estadoInicial, reduzir, type EstadoProgresso, type SerieRegistrada } from '@gym/domain';
import { abrirLocalDb, type EventoArmazenado, type LocalDb } from './src/infra/local-db';
import { authClient, fetchAutenticado } from './src/infra/auth-client';

// Spike S3: login Google + chamada a uma rota protegida.
function PainelLogin() {
  const { data: sessao, isPending } = authClient.useSession();
  const [resposta, setResposta] = useState('');

  async function testarApi() {
    try {
      const r = await fetchAutenticado('/api/me');
      setResposta(`[${r.status}] ${await r.text()}`);
    } catch (e) {
      setResposta(`erro: ${String(e)}`);
    }
  }

  return (
    <View style={styles.painel}>
      <Text style={styles.sub}>
        S3 — {isPending ? 'verificando sessão…' : sessao ? `logado: ${sessao.user.name} (${sessao.user.email})` : 'não logado'}
      </Text>
      <View style={styles.botoes}>
        {sessao ? (
          <Button title="Sair" onPress={() => authClient.signOut()} color="#555" />
        ) : (
          <Button title="Entrar com Google" onPress={() => authClient.signIn.social({ provider: 'google', callbackURL: '/' })} />
        )}
        <Button title="Testar /api/me" onPress={testarApi} />
      </View>
      {resposta ? <Text style={styles.linha}>{resposta}</Text> : null}
    </View>
  );
}

const EXERCICIOS = ['supino', 'agachamento', 'remada', 'desenvolvimento', 'terra', 'rosca', 'triceps', 'leg-press', 'barra', 'panturrilha'];

function gerarEventos(qtd: number): EventoArmazenado[] {
  return Array.from({ length: qtd }, (_, i) => {
    const evento: SerieRegistrada = {
      type: 'SerieRegistrada',
      exercicioId: EXERCICIOS[i % EXERCICIOS.length]!,
      reps: 6 + (i % 7),
      cargaKg: 20 + (i % 40) * 2.5,
      // i % 7 (e não i % 5): com 10 exercícios, i % 5 marcava TODA série de supino como aquecimento.
      tipo: i % 7 === 0 ? 'aquecimento' : 'trabalho',
    };
    return { eventId: Crypto.randomUUID(), type: evento.type, payload: JSON.stringify(evento), pendente: true };
  });
}

export default function App() {
  const [db, setDb] = useState<LocalDb | null>(null);
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [estado, setEstado] = useState<EstadoProgresso>(estadoInicial);

  const registrar = (linha: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${linha}`, ...l]);

  useEffect(() => {
    abrirLocalDb()
      .then(async (d) => {
        setDb(d);
        const n = await d.contar();
        setTotal(n);
        registrar(`Banco aberto (${Platform.OS}). Eventos persistidos: ${n}`);
        // Modo automático para teste headless na web: ?auto
        if (Platform.OS === 'web' && globalThis.location?.search.includes('auto')) {
          await gravar1000(d);
          const resumo = await reconstruir(d);
          document.title = `SPIKE_RESULT antes=${n} ${resumo}`;
        }
      })
      .catch((e) => {
        registrar(`ERRO ao abrir o banco: ${String(e)}`);
        if (Platform.OS === 'web') document.title = `SPIKE_RESULT ERRO ${String(e)}`;
      });
  }, []);

  async function gravar1000(d: LocalDb | null = db) {
    if (!d) return;
    const db = d;
    const t0 = performance.now();
    await db.anexar(gerarEventos(1000));
    const ms = performance.now() - t0;
    const n = await db.contar();
    setTotal(n);
    registrar(`Gravou 1.000 eventos em ${ms.toFixed(0)} ms. Total: ${n}`);
  }

  async function reconstruir(d: LocalDb | null = db): Promise<string> {
    if (!d) return '';
    const db = d;
    const t0 = performance.now();
    const eventos = await db.lerTodos();
    const t1 = performance.now();
    const novo = eventos.reduce((s, e) => reduzir(s, JSON.parse(e.payload) as SerieRegistrada), estadoInicial);
    const t2 = performance.now();
    setEstado(novo);
    const totalMs = t2 - t0;
    const resumo = `depois=${eventos.length} rebuild_ms=${totalMs.toFixed(0)} leitura_ms=${(t1 - t0).toFixed(0)} reducao_ms=${(t2 - t1).toFixed(0)}`;
    registrar(`Rebuild: ${resumo} ${totalMs < 1000 ? '✅' : '❌'}`);
    return resumo;
  }

  async function limpar() {
    if (!db) return;
    await db.limpar();
    setTotal(0);
    setEstado(estadoInicial);
    registrar('Banco limpo');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Spike — {Platform.OS}</Text>
      <PainelLogin />
      <Text>Eventos no SQLite local: {total}</Text>
      <View style={styles.botoes}>
        <Button title="Gravar 1.000" onPress={() => gravar1000()} disabled={!db} />
        <Button title="Reconstruir" onPress={() => reconstruir()} disabled={!db} />
        <Button title="Limpar" onPress={limpar} disabled={!db} color="#b00" />
      </View>
      <Text style={styles.sub}>Estado (supino): {JSON.stringify(estado['supino'] ?? {})}</Text>
      <ScrollView style={styles.log}>
        {log.map((l, i) => (
          <Text key={i} style={styles.linha}>{l}</Text>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 64, gap: 12 },
  titulo: { fontSize: 20, fontWeight: '600' },
  botoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sub: { color: '#555' },
  painel: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#ddd' },
  log: { flex: 1, borderTopWidth: 1, borderColor: '#ddd', paddingTop: 8 },
  linha: { fontFamily: Platform.select({ web: 'monospace', default: undefined }), fontSize: 12, marginBottom: 4 },
});
