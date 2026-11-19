// Editor de prescrição (o que se PLANEJA: 01-dominio §1). Grava a prescrição inteira (04-modelo-de-eventos, D3).
import { alterarPrescricao, descansoSeg, encontrarItem, type Prescricao } from '@gym/domain';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { kg, tempo } from '../aplicacao/consultas';
import { useApp } from '../aplicacao/contexto';
import { Ajustador, avisar, Botao, Cartao, Chip, Tela, Vazio } from '../ui/componentes';
import { espaco, tipo } from '../ui/tema';

export default function EditorPrescricao() {
  const { fichaId, itemId } = useLocalSearchParams<{ fichaId: string; itemId: string }>();
  const { estado, catalogo, executar } = useApp();
  const ficha = estado.planejamento.fichas[fichaId];
  const achado = ficha ? encontrarItem(ficha, itemId) : undefined;
  const [p, setP] = useState<Prescricao | undefined>(achado?.item.prescricao);
  if (!achado || !p) return <Tela><Vazio icone="alert-circle" titulo="Exercício não encontrado" texto="Ele pode ter sido removido em outro aparelho." /></Tela>;

  const { item } = achado;
  const ex = catalogo.porId.get(item.exercicioId);
  const composto = ex?.composto ?? false;
  const deCarga = item.modalidade === 'carga_repeticoes' || item.modalidade === 'peso_corporal';
  const temporal = item.modalidade === 'tempo' || item.modalidade === 'cardio';
  const set = (parcial: Partial<Prescricao>) => setP({ ...p, ...parcial });
  const sem = (chave: keyof Prescricao) => {
    const { [chave]: _, ...resto } = p;
    setP(resto as Prescricao);
  };

  async function salvar() {
    const erro = await executar(alterarPrescricao(estado.planejamento, { fichaId, itemId, prescricao: p! }));
    if (erro) return avisar('Não foi possível salvar', erro);
    router.back();
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: ex?.nome ?? 'Prescrição' }} />
      <Cartao>
        <View style={{ flexDirection: 'row', gap: espaco.m }}>
          <Ajustador rotulo="Séries" valor={p.series} passo={1} min={1} max={10} onChange={(v) => set({ series: v })} />
          {temporal ? (
            <Ajustador rotulo="Duração" valor={p.duracaoSeg ?? 30} passo={item.modalidade === 'cardio' ? 60 : 15} min={5} max={4 * 3600} formatar={tempo} onChange={(v) => set({ duracaoSeg: v })} />
          ) : null}
        </View>
        {deCarga ? (
          <View style={{ flexDirection: 'row', gap: espaco.m }}>
            <Ajustador rotulo="Reps mín." valor={p.repeticoes?.min ?? 8} passo={1} min={1} max={p.repeticoes?.max ?? 100} onChange={(v) => set({ repeticoes: { min: v, max: Math.max(v, p.repeticoes?.max ?? v) } })} />
            <Ajustador rotulo="Reps máx." valor={p.repeticoes?.max ?? 12} passo={1} min={p.repeticoes?.min ?? 1} max={100} onChange={(v) => set({ repeticoes: { min: Math.min(v, p.repeticoes?.min ?? v), max: v } })} />
          </View>
        ) : null}
      </Cartao>

      {item.modalidade === 'carga_repeticoes' ? (
        <Cartao>
          <Text style={tipo.rotulo}>Carga-alvo</Text>
          {p.cargaKg === undefined ? (
            <>
              <Text style={tipo.apoio}>Sem carga fixa: o app sugere a carga a cada treino com base no seu histórico (dupla progressão).</Text>
              <Botao variante="secundario" compacto titulo="Definir carga inicial" onPress={() => set({ cargaKg: 20 })} />
            </>
          ) : (
            <>
              <Ajustador rotulo="kg" valor={p.cargaKg} passo={2.5} min={0} max={500} formatar={kg} onChange={(v) => set({ cargaKg: v })} />
              <Botao variante="fantasma" compacto titulo="Remover carga fixa" onPress={() => sem('cargaKg')} />
            </>
          )}
        </Cartao>
      ) : null}

      <Cartao>
        <Text style={tipo.rotulo}>Descanso</Text>
        <Ajustador rotulo="entre séries" valor={p.descansoSeg ?? descansoSeg(p, composto)} passo={15} min={0} max={600} formatar={tempo} onChange={(v) => set({ descansoSeg: v })} />
        {p.descansoSeg === undefined ? <Text style={[tipo.nota, { textAlign: 'center' }]}>Padrão para exercício {composto ? 'composto' : 'isolado'}</Text> : null}
      </Cartao>

      {deCarga ? (
        <Cartao>
          <Text style={tipo.rotulo}>Técnica</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
            {([['normal', 'Normal'], ['drop_set', 'Drop-set'], ['rest_pause', 'Rest-pause']] as const).map(([t, rot]) => (
              <Chip key={t} texto={rot} ativo={p.tecnica === t} onPress={() => set({ tecnica: t })} />
            ))}
          </View>
          <Text style={tipo.rotulo}>Esforço-alvo (RIR)</Text>
          <Text style={tipo.nota}>Repetições "na reserva" ao fim da série. RIR 0 = até a falha.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
            <Chip texto="Livre" ativo={p.rir === undefined} onPress={() => sem('rir')} />
            {[0, 1, 2, 3, 4].map((r) => <Chip key={r} texto={String(r)} ativo={p.rir === r} onPress={() => set({ rir: r })} />)}
          </View>
        </Cartao>
      ) : null}

      <Botao titulo="Salvar" icone="checkmark" onPress={salvar} />
    </Tela>
  );
}
