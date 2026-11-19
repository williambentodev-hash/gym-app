// Detalhe de um treino concluído (Execução, somente leitura: sessões encerradas são imutáveis — 01-dominio §8).
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { kg, nomeDoTreino, resumoMedidas, tempo, duracaoSessao } from '../../aplicacao/consultas';
import { useApp } from '../../aplicacao/contexto';
import { Cartao, Chip, Tela, Vazio } from '../../ui/componentes';
import { cores, espaco, tipo } from '../../ui/tema';

export default function DetalheSessao() {
  const { sessaoId } = useLocalSearchParams<{ sessaoId: string }>();
  const { estado, catalogo } = useApp();
  const s = estado.execucao.sessoes[sessaoId];
  if (!s) return <Tela><Vazio icone="alert-circle" titulo="Treino não encontrado" texto="Ele pode não ter sido sincronizado neste aparelho." /></Tela>;

  const itens = s.blocos.flatMap((b) => b.itens.map((i) => ({ item: i, biset: b.itens.length > 1 })));
  const trabalho = s.series.filter((x) => x.tipo !== 'aquecimento');
  const tonelagem = trabalho.reduce((t, x) => t + (x.medidas.modalidade === 'carga_repeticoes' ? x.medidas.cargaKg * x.medidas.reps : 0), 0);
  const data = new Date(s.iniciadaEm).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Tela titulo={nomeDoTreino(estado, s.fichaId, s.treinoId)} subtitulo={data.charAt(0).toUpperCase() + data.slice(1)}>
      <Stack.Screen options={{ title: '' }} />
      <Cartao style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Metrica titulo="Duração" valor={tempo(duracaoSessao(s))} />
        <Metrica titulo="Séries" valor={String(trabalho.length)} />
        {tonelagem ? <Metrica titulo="Movidos" valor={`${kg(Math.round(tonelagem))} kg`} /> : null}
      </Cartao>
      {s.status === 'encerrada_inatividade' ? <Text style={tipo.nota}>Encerrado automaticamente após 3 h sem novas séries.</Text> : null}

      {itens.map(({ item, biset }) => {
        const series = s.series.filter((x) => x.itemId === item.itemId);
        const ex = catalogo.porId.get(item.exercicioId);
        return (
          <Cartao key={item.itemId} onPress={() => router.push({ pathname: '/exercicio', params: { id: item.exercicioId } })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
              <Text style={[tipo.destaque, { flex: 1 }]}>{biset ? '⇄ ' : ''}{ex?.nome ?? 'Exercício'}</Text>
              {item.pulado ? <Chip texto="Pulado" /> : null}
              {item.exercicioOriginalId ? <Chip texto="Substituído" /> : null}
            </View>
            {series.length === 0 ? <Text style={tipo.apoio}>Nenhuma série registrada.</Text> : null}
            {series.map((x, i) => (
              <View key={x.serieId} style={{ flexDirection: 'row', gap: espaco.m }}>
                <Text style={[tipo.numero, { width: 22, color: cores.textoTerciario }]}>{i + 1}</Text>
                <Text style={[tipo.nota, { width: 18, fontWeight: '700', color: x.tipo === 'trabalho' ? cores.sucesso : x.tipo === 'drop' ? cores.acento : cores.textoTerciario }]}>
                  {x.tipo === 'trabalho' ? 'T' : x.tipo === 'drop' ? 'D' : 'A'}
                </Text>
                <Text style={tipo.numero}>{resumoMedidas(x.medidas)}</Text>
              </View>
            ))}
          </Cartao>
        );
      })}
    </Tela>
  );
}

function Metrica({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={tipo.numero}>{valor}</Text>
      <Text style={tipo.nota}>{titulo}</Text>
    </View>
  );
}
