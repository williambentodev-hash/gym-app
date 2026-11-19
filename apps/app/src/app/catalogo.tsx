// Seletor de exercícios (Catálogo). Modos: "adicionar" a um treino da ficha, ou "substituir" na execução.
import { adicionarItem, criarExercicioPersonalizado, substituirExercicio, type Modalidade } from '@gym/domain';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { NOMES_EQUIPAMENTOS, NOMES_GRUPOS, type ExercicioApp } from '../aplicacao/catalogo';
import { prescricaoPadrao } from '../aplicacao/consultas';
import { useApp } from '../aplicacao/contexto';
import { novoId } from '../aplicacao/motor';
import { avisar, Botao, Campo, Cartao, Chip } from '../ui/componentes';
import { cores, espaco, margemTela, raio, tipo } from '../ui/tema';

type Params = { modo: 'adicionar' | 'substituir'; fichaId?: string; treinoId?: string; sessaoId?: string; itemId?: string };
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function SeletorExercicio() {
  const p = useLocalSearchParams<Params>();
  const { estado, catalogo, executar } = useApp();
  const itemAtual = p.modo === 'substituir' && p.sessaoId ? estado.execucao.sessoes[p.sessaoId]?.blocos.flatMap((b) => b.itens).find((i) => i.itemId === p.itemId) : undefined;
  const grupoInicial = itemAtual ? catalogo.porId.get(itemAtual.exercicioId)?.grupoPrincipal ?? null : null;
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState<string | null>(grupoInicial);
  const [modalidadeNovo, setModalidadeNovo] = useState<Modalidade>('carga_repeticoes');

  const grupos = useMemo(() => [...new Set(catalogo.lista.map((e) => e.grupoPrincipal))].sort((a, b) => (NOMES_GRUPOS[a] ?? a).localeCompare(NOMES_GRUPOS[b] ?? b)), [catalogo.lista]);
  const lista = useMemo(() => {
    const q = normalizar(busca.trim());
    return catalogo.lista.filter((e) => (!grupo || e.grupoPrincipal === grupo) && (!q || normalizar(e.nome).includes(q)) && e.id !== itemAtual?.exercicioId);
  }, [catalogo.lista, busca, grupo, itemAtual?.exercicioId]);

  async function escolher(e: ExercicioApp) {
    let erro: string | null;
    if (p.modo === 'substituir' && p.sessaoId && p.itemId) {
      erro = await executar(substituirExercicio(estado.execucao, { sessaoId: p.sessaoId, itemId: p.itemId, exercicioId: e.id, modalidade: e.modalidade }));
    } else if (p.fichaId && p.treinoId) {
      erro = await executar(
        adicionarItem(estado.planejamento, { fichaId: p.fichaId, treinoId: p.treinoId, blocoId: novoId(), itemId: novoId(), exercicioId: e.id, modalidade: e.modalidade, prescricao: prescricaoPadrao(e.modalidade) }),
      );
    } else erro = 'parâmetros inválidos';
    if (erro) return avisar('Não foi possível', erro);
    router.back();
  }

  async function criarPersonalizado() {
    const exercicioId = novoId();
    const nome = busca.trim();
    const erro = await executar(criarExercicioPersonalizado(estado.catalogo, { exercicioId, nome, modalidade: modalidadeNovo, gruposMusculares: grupo ? [grupo] : [] }));
    if (erro) return avisar('Não foi possível criar', erro);
    await escolher({ id: exercicioId, nome, modalidade: modalidadeNovo, composto: false, grupoPrincipal: grupo ?? 'outros', gruposSecundarios: [], equipamento: 'outro', personalizado: true });
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={{ padding: margemTela, gap: espaco.m }}>
        {itemAtual ? <Text style={tipo.apoio}>Substituir {catalogo.porId.get(itemAtual.exercicioId)?.nome} por:</Text> : null}
        <Campo value={busca} onChangeText={setBusca} placeholder="Buscar exercício" autoCorrect={false} clearButtonMode="while-editing" />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...grupos]}
          keyExtractor={(g) => g ?? 'todos'}
          contentContainerStyle={{ gap: espaco.s }}
          renderItem={({ item: g }) => <Chip texto={g ? (NOMES_GRUPOS[g] ?? g) : 'Todos'} ativo={grupo === g} onPress={() => setGrupo(g)} />}
        />
      </View>
      <FlatList
        data={lista}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: margemTela, paddingBottom: 60, gap: espaco.s }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          busca.trim() ? (
            <Cartao>
              <Text style={tipo.destaque}>Criar “{busca.trim()}”</Text>
              <Text style={tipo.nota}>Exercício personalizado, visível só para você.{grupo ? ` Grupo: ${NOMES_GRUPOS[grupo] ?? grupo}.` : ''}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
                {([['carga_repeticoes', 'Carga × reps'], ['peso_corporal', 'Peso corporal'], ['tempo', 'Tempo'], ['cardio', 'Cardio']] as const).map(([m, rot]) => (
                  <Chip key={m} texto={rot} ativo={modalidadeNovo === m} onPress={() => setModalidadeNovo(m)} />
                ))}
              </View>
              <Botao titulo="Criar e adicionar" icone="add" onPress={criarPersonalizado} />
            </Cartao>
          ) : (
            <Text style={tipo.apoio}>Nenhum exercício neste grupo.</Text>
          )
        }
        renderItem={({ item: e }) => (
          <Pressable onPress={() => escolher(e)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: espaco.m, backgroundColor: cores.superficie, borderRadius: raio.cartao, padding: espaco.s }, pressed && { opacity: 0.7 }]}>
            <View style={{ width: 56, height: 56, borderRadius: raio.botao, backgroundColor: cores.texto, overflow: 'hidden' }}>
              {e.miniaturaUrl ? <Image source={{ uri: e.miniaturaUrl }} style={{ width: 56, height: 56 }} contentFit="cover" cachePolicy="disk" transition={150} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={tipo.corpo} numberOfLines={2}>{e.nome}</Text>
              <Text style={tipo.nota}>
                {NOMES_GRUPOS[e.grupoPrincipal] ?? e.grupoPrincipal} · {NOMES_EQUIPAMENTOS[e.equipamento] ?? e.equipamento}{e.personalizado ? ' · personalizado' : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
