// Gráfico de evolução (série única ao longo do tempo), conforme a skill de dataviz:
// barras finas ancoradas na base, topo arredondado (4 px), 2 px de espaço entre barras, uma só cor (acento),
// sem legenda (o título nomeia a série), rótulo direto só no recorde e na barra selecionada,
// grade/eixo recessivos, toque = "tooltip" (valor + data). A tabela abaixo do gráfico é a visão em texto.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { cores, espaco, tipo } from './tema';

export type PontoGrafico = { chave: string; valor: number; rotulo: string; detalhe: string };

const ALTURA = 160;

export function GraficoEvolucao({ pontos, formatar }: { pontos: PontoGrafico[]; formatar: (v: number) => string }) {
  const [selecionado, setSelecionado] = useState<string | null>(pontos.at(-1)?.chave ?? null);
  if (pontos.length === 0) return null;
  const max = Math.max(...pontos.map((p) => p.valor));
  const min = Math.min(...pontos.map((p) => p.valor));
  // Base não-zero quando a variação é pequena: evolução de carga é de poucos %. A linha de base fica rotulada.
  // Com 1 ponto (ou todos iguais) não há variação a ampliar: base zero.
  const base = pontos.length > 1 && max > min && min > 0 && (max - min) / max < 0.5 ? Math.max(0, min - (max - min)) : 0;
  const altura = (v: number) => Math.max(4, ((v - base) / (max - base || 1)) * ALTURA);
  const atual = pontos.find((p) => p.chave === selecionado) ?? pontos.at(-1)!;
  const recordeChave = pontos.reduce((a, b) => (b.valor >= a.valor ? b : a)).chave;

  return (
    <View style={{ gap: espaco.s }} accessibilityRole="image" accessibilityLabel={`Evolução: ${pontos.length} treinos, melhor ${formatar(max)}`}>
      <View style={{ minHeight: 40 }}>
        <Text style={[tipo.numeroGrande, { fontSize: 32 }]}>{formatar(atual.valor)}</Text>
        <Text style={tipo.nota}>{atual.rotulo} · {atual.detalhe}{atual.chave === recordeChave ? ' · recorde' : ''}</Text>
      </View>
      <View style={{ height: ALTURA, flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1, borderColor: cores.separador }}>
        {/* linha recessiva no valor máximo */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, borderTopWidth: 1, borderColor: cores.separador, borderStyle: 'dashed' }} />
        {pontos.map((p) => {
          const ativo = p.chave === atual.chave;
          return (
            <Pressable
              key={p.chave}
              accessibilityLabel={`${p.rotulo}: ${formatar(p.valor)}`}
              onPress={() => setSelecionado(p.chave)}
              hitSlop={{ top: 40, bottom: 8 }}
              style={{ flex: 1, maxWidth: 28, height: '100%', justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  height: altura(p.valor),
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: cores.acento,
                  opacity: ativo ? 1 : 0.45,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={tipo.nota}>{pontos[0]!.rotulo}</Text>
        <Text style={tipo.nota}>máx. {formatar(max)}{base > 0 ? ` · base ${formatar(base)}` : ''}</Text>
        <Text style={tipo.nota}>{pontos.at(-1)!.rotulo}</Text>
      </View>
    </View>
  );
}
