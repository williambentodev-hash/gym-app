// Editor de ficha (Planejamento): treinos, blocos (bi-set), itens e ativação. Toda escrita passa por comandos.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  adicionarTreino, agruparItens, arquivarFicha, ativarFicha, desagruparItem, desativarFicha, removerItem, removerTreino,
  renomearFicha, renomearTreino, reordenarBlocos, type Decisao, type Ficha, type Treino,
} from '@gym/domain';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../../aplicacao/contexto';
import { resumoPrescricao } from '../../aplicacao/consultas';
import { novoId } from '../../aplicacao/motor';
import { avisar, Botao, BotaoIcone, Campo, Cartao, Chip, confirmar, Separador, Tela, Vazio } from '../../ui/componentes';
import { cores, espaco, raio, tipo } from '../../ui/tema';

type Rodar = (d: Decisao<{ type: string; payload: unknown }>) => Promise<void>;

export default function EditorFicha() {
  const { fichaId } = useLocalSearchParams<{ fichaId: string }>();
  const { estado, executar } = useApp();
  const ficha = estado.planejamento.fichas[fichaId];
  const [nome, setNome] = useState(ficha?.nome ?? '');
  useEffect(() => setNome(ficha?.nome ?? ''), [ficha?.nome]);

  if (!ficha || ficha.arquivada) return <Tela><Vazio icone="alert-circle" titulo="Ficha não encontrada" texto="Ela pode ter sido arquivada em outro aparelho." /></Tela>;

  const rodar: Rodar = async (d) => {
    const erro = await executar(d);
    if (erro) avisar('Não foi possível', erro);
  };

  const proximaLetra = String.fromCharCode(65 + ficha.treinos.length); // A, B, C…

  return (
    <Tela>
      <Stack.Screen options={{ title: ficha.nome }} />
      <Cartao>
        <Text style={tipo.rotulo}>Nome</Text>
        <Campo value={nome} onChangeText={setNome} onEndEditing={() => nome.trim() && nome.trim() !== ficha.nome && rodar(renomearFicha(estado.planejamento, { fichaId, nome }))} onBlur={() => nome.trim() && nome.trim() !== ficha.nome && rodar(renomearFicha(estado.planejamento, { fichaId, nome }))} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={tipo.destaque}>{ficha.ativa ? 'Ficha ativa' : 'Ficha inativa'}</Text>
            <Text style={tipo.nota}>{ficha.ativa ? 'Aparece na aba Hoje.' : 'Ative para treinar com ela.'}</Text>
          </View>
          <Botao compacto variante={ficha.ativa ? 'secundario' : 'primario'} titulo={ficha.ativa ? 'Desativar' : 'Ativar'} onPress={() => rodar(ficha.ativa ? desativarFicha(estado.planejamento, fichaId) : ativarFicha(estado.planejamento, fichaId))} />
        </View>
      </Cartao>

      {ficha.treinos.map((t) => (
        <EditorTreino key={t.treinoId} ficha={ficha} treino={t} rodar={rodar} />
      ))}

      <Botao variante="secundario" icone="add" titulo={`Adicionar Treino ${proximaLetra}`} onPress={() => rodar(adicionarTreino(estado.planejamento, { fichaId, treinoId: novoId(), nome: `Treino ${proximaLetra}` }))} />
      <Botao
        variante="perigo"
        icone="archive-outline"
        titulo="Arquivar ficha"
        onPress={async () => {
          if (!(await confirmar('Arquivar ficha?', 'Ela sai da lista, mas o histórico de treinos continua.', 'Arquivar'))) return;
          const erro = await executar(arquivarFicha(estado.planejamento, fichaId));
          if (erro) avisar('Não foi possível', erro);
          else router.back();
        }}
      />
    </Tela>
  );
}

function EditorTreino({ ficha, treino, rodar: exec }: { ficha: Ficha; treino: Treino; rodar: Rodar }) {
  const { estado, catalogo } = useApp();
  const [editandoNome, setEditandoNome] = useState(false);
  const [nome, setNome] = useState(treino.nome);
  const fichaId = ficha.fichaId;

  const mover = (idx: number, delta: number) => {
    const ordem = treino.blocos.map((b) => b.blocoId);
    const j = idx + delta;
    if (j < 0 || j >= ordem.length) return;
    [ordem[idx], ordem[j]] = [ordem[j]!, ordem[idx]!];
    exec(reordenarBlocos(estado.planejamento, { fichaId, treinoId: treino.treinoId, ordem }));
  };

  return (
    <Cartao>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
        {editandoNome ? (
          <Campo style={{ flex: 1 }} autoFocus value={nome} onChangeText={setNome} onBlur={() => { setEditandoNome(false); if (nome.trim() && nome !== treino.nome) exec(renomearTreino(estado.planejamento, { fichaId, treinoId: treino.treinoId, nome })); }} />
        ) : (
          <Pressable style={{ flex: 1 }} onPress={() => setEditandoNome(true)}>
            <Text style={tipo.titulo}>{treino.nome}</Text>
          </Pressable>
        )}
        <BotaoIcone
          icone="trash-outline"
          rotulo="Remover treino"
          onPress={async () => {
            if (await confirmar(`Remover ${treino.nome}?`, 'Os exercícios deste treino serão removidos da ficha.', 'Remover')) exec(removerTreino(estado.planejamento, { fichaId, treinoId: treino.treinoId }));
          }}
        />
      </View>

      {treino.blocos.length === 0 ? <Text style={tipo.apoio}>Nenhum exercício ainda.</Text> : null}

      {treino.blocos.map((bloco, idx) => {
        const biset = bloco.itens.length > 1;
        const proximo = treino.blocos[idx + 1];
        return (
          <View key={bloco.blocoId} style={[{ gap: 0 }, biset && { borderLeftWidth: 3, borderLeftColor: cores.acento, paddingLeft: espaco.m, borderRadius: raio.botao }]}>
            {biset ? <Text style={[tipo.rotulo, { color: cores.acento, marginBottom: 4 }]}>{bloco.itens.length === 2 ? 'Bi-set' : bloco.itens.length === 3 ? 'Tri-set' : 'Circuito'}</Text> : null}
            {bloco.itens.map((item, k) => {
              const ex = catalogo.porId.get(item.exercicioId);
              return (
                <View key={item.itemId}>
                  {k > 0 ? <Separador /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s, paddingVertical: espaco.s }}>
                    <Pressable style={{ flex: 1, gap: 2 }} onPress={() => router.push({ pathname: '/prescricao', params: { fichaId, itemId: item.itemId } })}>
                      <Text style={tipo.corpo} numberOfLines={2}>{ex?.nome ?? 'Exercício'}</Text>
                      <Text style={tipo.nota}>{resumoPrescricao(item.prescricao, item.modalidade)}</Text>
                    </Pressable>
                    {biset ? <BotaoIcone icone="unlink-outline" rotulo="Desagrupar" onPress={() => exec(desagruparItem(estado.planejamento, { fichaId, itemId: item.itemId, novoBlocoId: novoId() }))} /> : null}
                    <BotaoIcone
                      icone="close"
                      rotulo="Remover exercício"
                      onPress={async () => {
                        if (await confirmar('Remover exercício?', ex?.nome ?? '', 'Remover')) exec(removerItem(estado.planejamento, { fichaId, itemId: item.itemId }));
                      }}
                    />
                  </View>
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', gap: espaco.s, flexWrap: 'wrap', marginTop: 2 }}>
              <Chip texto="↑" onPress={idx > 0 ? () => mover(idx, -1) : undefined} />
              <Chip texto="↓" onPress={proximo ? () => mover(idx, 1) : undefined} />
              {proximo ? (
                <Chip
                  texto="⇄ Bi-set com o próximo"
                  onPress={() => exec(agruparItens(estado.planejamento, { fichaId, treinoId: treino.treinoId, blocoId: bloco.blocoId, itemIds: [...bloco.itens, ...proximo.itens].map((i) => i.itemId) }))}
                />
              ) : null}
            </View>
          </View>
        );
      })}

      <Pressable onPress={() => router.push({ pathname: '/catalogo', params: { modo: 'adicionar', fichaId, treinoId: treino.treinoId } })} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: espaco.s, paddingVertical: espaco.s }, pressed && { opacity: 0.6 }]}>
        <Ionicons name="add-circle" size={22} color={cores.acento} />
        <Text style={[tipo.destaque, { color: cores.acento }]}>Adicionar exercício</Text>
      </Pressable>
    </Cartao>
  );
}
