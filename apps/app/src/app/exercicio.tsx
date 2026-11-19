// Evolução de um exercício (Progresso): gráfico da melhor marca por treino + tabela (visão em texto do gráfico).
// O ID vai como query (?id=): IDs do catálogo contêm "/" (ex.: pectorals/barbell-bench-press), o que quebraria
// um segmento dinâmico de rota (/exercicio/[id]): achado pelo E2E.
import { historicoDoExercicio, progressoPorExercicio, valorDaSerie } from '@gym/domain';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { NOMES_GRUPOS } from '../aplicacao/catalogo';
import { kg, resumoMedidas, tempo } from '../aplicacao/consultas';
import { useApp } from '../aplicacao/contexto';
import { Cartao, Linha, Secao, Separador, Tela, Vazio } from '../ui/componentes';
import { GraficoEvolucao } from '../ui/grafico-evolucao';
import { cores, espaco, raio, tipo } from '../ui/tema';

export default function EvolucaoExercicio() {
  const { id: exercicioId = '' } = useLocalSearchParams<{ id: string }>();
  const { estado, catalogo } = useApp();
  const ex = catalogo.porId.get(exercicioId);
  const historico = useMemo(() => historicoDoExercicio(estado.execucao, exercicioId), [estado.execucao, exercicioId]);
  const recorde = useMemo(() => progressoPorExercicio(estado.execucao)[exercicioId]?.recorde, [estado.execucao, exercicioId]);

  if (historico.length === 0) return <Tela><Stack.Screen options={{ title: ex?.nome ?? '' }} /><Vazio icone="trending-up" titulo="Sem histórico ainda" texto="Conclua um treino com este exercício para ver a evolução." /></Tela>;

  const modalidade = historico[0]!.melhor.modalidade;
  const porCarga = modalidade === 'carga_repeticoes';
  const pontos = historico.slice(-16).map((p) => ({
    chave: p.sessaoId,
    valor: porCarga ? (p.e1rmKg ?? valorDaSerie(p.melhor)) : valorDaSerie(p.melhor),
    rotulo: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    detalhe: resumoMedidas(p.melhor),
  }));
  const cardioComDistancia = historico.some((h) => h.melhor.modalidade === 'cardio' && h.melhor.distanciaM);
  const formatar = (v: number): string => {
    if (porCarga) return `${kg(Math.round(v * 10) / 10)} kg`;
    if (modalidade === 'peso_corporal') return `${Math.round(v)} reps`;
    if (modalidade === 'cardio' && cardioComDistancia) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
    return tempo(v);
  };

  return (
    <Tela>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ flexDirection: 'row', gap: espaco.m, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: raio.botao, backgroundColor: cores.texto, overflow: 'hidden' }}>
          {ex?.miniaturaUrl ? <Image source={{ uri: ex.miniaturaUrl }} style={{ width: 64, height: 64 }} contentFit="cover" cachePolicy="disk" /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo}>{ex?.nome ?? 'Exercício'}</Text>
          {ex ? <Text style={tipo.nota}>{NOMES_GRUPOS[ex.grupoPrincipal] ?? ex.grupoPrincipal}{ex.composto ? ' · composto' : ' · isolado'}</Text> : null}
        </View>
      </View>

      <Cartao>
        <Text style={tipo.rotulo}>{porCarga ? '1RM estimado por treino' : 'Melhor marca por treino'}</Text>
        <GraficoEvolucao pontos={pontos} formatar={formatar} />
      </Cartao>

      {recorde ? (
        <Cartao style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {recorde.cargaKg !== undefined ? <Destaque titulo="Maior carga" valor={`${kg(recorde.cargaKg)} kg`} /> : null}
          {recorde.e1rmKg !== undefined ? <Destaque titulo="1RM estimado" valor={`${kg(recorde.e1rmKg)} kg`} /> : null}
          {recorde.reps !== undefined ? <Destaque titulo="Mais reps" valor={String(recorde.reps)} /> : null}
          {recorde.duracaoSeg !== undefined ? <Destaque titulo="Maior tempo" valor={tempo(recorde.duracaoSeg)} /> : null}
          <Destaque titulo="Treinos" valor={String(historico.length)} />
        </Cartao>
      ) : null}

      <Secao titulo="Treinos">
        <Cartao style={{ paddingVertical: espaco.xs, gap: 0 }}>
          {[...historico].reverse().map((p, i) => (
            <View key={p.sessaoId}>
              {i > 0 ? <Separador /> : null}
              <Linha
                titulo={resumoMedidas(p.melhor)}
                detalhe={`${new Date(p.data).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} · ${p.series} série${p.series === 1 ? '' : 's'}${p.tonelagemKg ? ` · ${kg(p.tonelagemKg)} kg movidos` : ''}`}
                direita={p.e1rmKg ? <Text style={tipo.numero}>~{kg(p.e1rmKg)}</Text> : undefined}
              />
            </View>
          ))}
        </Cartao>
      </Secao>
    </Tela>
  );
}

function Destaque({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={[tipo.numero, { color: cores.acento }]}>{valor}</Text>
      <Text style={tipo.nota}>{titulo}</Text>
    </View>
  );
}
