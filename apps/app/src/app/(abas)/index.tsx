// Hoje (01-dominio §6, "Hoje"): treino em andamento + próximo treino de cada ficha ativa (rotação).
import { iniciarSessao, sessaoEmAndamento, type Ficha, type Treino } from '@gym/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../aplicacao/contexto';
import { garantirMidia } from '../../infra/midias-offline';
import { dataCurta, duracaoSessao, nomeDoTreino, proximoTreino, snapshotDoTreino, tempo, ultimaSessaoDoTreino } from '../../aplicacao/consultas';
import { novoId } from '../../aplicacao/motor';
import { avisar, Botao, Cartao, Chip, Secao, Tela, Vazio } from '../../ui/componentes';
import { cores, espaco, tipo } from '../../ui/tema';

export default function Hoje() {
  const { estado, catalogo, executar, pronto } = useApp();
  const emAndamento = sessaoEmAndamento(estado.execucao);
  const ativas = Object.values(estado.planejamento.fichas).filter((f) => f.ativa && !f.arquivada);
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // QA-1 / ADR-0010: baixa antecipadamente as animações dos próximos treinos (ex.: em casa, no Wi-Fi).
  useEffect(() => {
    for (const f of ativas)
      for (const t of f.treinos)
        for (const b of t.blocos)
          for (const i of b.itens) {
            const url = catalogo.porId.get(i.exercicioId)?.animacaoUrl;
            if (url) garantirMidia(url).catch(() => undefined);
          }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativas.map((f) => f.fichaId).join(), catalogo.versao]);

  async function comecar(ficha: Ficha, treino: Treino) {
    const sessaoId = novoId();
    const erro = await executar(iniciarSessao(estado.execucao, { sessaoId, fichaId: ficha.fichaId, treinoId: treino.treinoId, snapshot: snapshotDoTreino(treino) }));
    if (erro) return avisar('Não foi possível começar', erro);
    router.push({ pathname: '/execucao/[sessaoId]', params: { sessaoId } });
  }

  return (
    <Tela titulo="Hoje" subtitulo={hoje.charAt(0).toUpperCase() + hoje.slice(1)}>
      {emAndamento ? (
        <Cartao destaque onPress={() => router.push({ pathname: '/execucao/[sessaoId]', params: { sessaoId: emAndamento.sessaoId } })}>
          <Text style={[tipo.rotulo, { color: cores.acento }]}>Em andamento · {tempo(duracaoSessao(emAndamento))}</Text>
          <Text style={tipo.titulo}>{nomeDoTreino(estado, emAndamento.fichaId, emAndamento.treinoId)}</Text>
          <Text style={tipo.apoio}>{emAndamento.series.length} séries registradas</Text>
          <Botao titulo="Continuar treino" icone="play" onPress={() => router.push({ pathname: '/execucao/[sessaoId]', params: { sessaoId: emAndamento.sessaoId } })} />
        </Cartao>
      ) : null}

      {pronto && ativas.length === 0 ? (
        <Vazio icone="barbell" titulo="Nenhuma ficha ativa" texto="Monte sua ficha com os treinos da semana e ative-a para ver aqui o treino do dia.">
          <Botao titulo="Criar ficha" icone="add" onPress={() => router.push('/fichas')} />
        </Vazio>
      ) : null}

      {ativas.map((ficha) => (
        <ProximoTreino key={ficha.fichaId} ficha={ficha} desabilitado={!!emAndamento} onComecar={comecar} nomeExercicio={(id) => catalogo.porId.get(id)?.nome ?? 'Exercício'} />
      ))}
    </Tela>
  );
}

function ProximoTreino({ ficha, desabilitado, onComecar, nomeExercicio }: { ficha: Ficha; desabilitado: boolean; onComecar: (f: Ficha, t: Treino) => void; nomeExercicio: (id: string) => string }) {
  const { estado } = useApp();
  const sugerido = proximoTreino(estado, ficha.fichaId);
  const [escolhidoId, setEscolhidoId] = useState<string | null>(null);
  const treinos = ficha.treinos.filter((t) => t.blocos.length > 0);
  const treino = treinos.find((t) => t.treinoId === escolhidoId) ?? sugerido;
  if (!treino) return null;
  const itens = treino.blocos.flatMap((b) => b.itens);
  const ultima = ultimaSessaoDoTreino(estado, treino.treinoId);

  return (
    <Secao titulo={ficha.nome}>
      <Cartao>
        {treinos.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
            {treinos.map((t) => (
              <Chip key={t.treinoId} texto={t.nome} ativo={t.treinoId === treino.treinoId} onPress={() => setEscolhidoId(t.treinoId)} />
            ))}
          </View>
        ) : null}
        <View style={{ gap: 2 }}>
          <Text style={tipo.titulo}>{treino.nome}</Text>
          <Text style={tipo.nota}>
            {itens.length} exercícios{treino.treinoId === sugerido?.treinoId ? ' · próximo da rotação' : ''}{ultima ? ` · último em ${dataCurta(ultima.iniciadaEm)}` : ''}
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          {treino.blocos.map((b) => (
            <Text key={b.blocoId} style={tipo.apoio} numberOfLines={1}>
              {b.itens.length > 1 ? '⇄ ' : '• '}
              {b.itens.map((i) => nomeExercicio(i.exercicioId)).join(' + ')}
            </Text>
          ))}
        </View>
        <Botao titulo="Começar treino" icone="play" desabilitado={desabilitado} onPress={() => onComecar(ficha, treino)} />
      </Cartao>
    </Secao>
  );
}
