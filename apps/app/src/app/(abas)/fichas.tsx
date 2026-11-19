// Fichas: lista e criação (Planejamento).
import { adicionarTreino, criarFicha } from '@gym/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { encadear } from '../../aplicacao/consultas';
import { useApp } from '../../aplicacao/contexto';
import { novoId } from '../../aplicacao/motor';
import { avisar, Botao, Campo, Cartao, Chip, Linha, Secao, Separador, Tela, Vazio } from '../../ui/componentes';
import { espaco } from '../../ui/tema';

export default function Fichas() {
  const { estado, executar } = useApp();
  const [nome, setNome] = useState('');
  const fichas = Object.values(estado.planejamento.fichas).filter((f) => !f.arquivada);
  const ativas = fichas.filter((f) => f.ativa);
  const inativas = fichas.filter((f) => !f.ativa);

  async function criar() {
    const fichaId = novoId();
    // Já cria o "Treino A" (o caminho mais comum é começar a montar os exercícios), encadeando os dois comandos.
    const erro = await executar(
      encadear(
        estado.planejamento,
        (e) => criarFicha(e, { fichaId, nome: nome.trim() || 'Nova ficha' }),
        (e) => adicionarTreino(e, { fichaId, treinoId: novoId(), nome: 'Treino A' }),
      ),
    );
    if (erro) return avisar('Não foi possível criar', erro);
    setNome('');
    router.push({ pathname: '/ficha/[fichaId]', params: { fichaId } });
  }

  const resumo = (fichaId: string) => {
    const f = estado.planejamento.fichas[fichaId]!;
    const n = f.treinos.reduce((s, t) => s + t.blocos.reduce((m, b) => m + b.itens.length, 0), 0);
    return `${f.treinos.length} treino${f.treinos.length === 1 ? '' : 's'} · ${n} exercício${n === 1 ? '' : 's'}`;
  };

  return (
    <Tela titulo="Fichas">
      <Cartao>
        <Campo value={nome} onChangeText={setNome} placeholder="Nome da ficha (ex.: Hipertrofia ABC)" returnKeyType="done" onSubmitEditing={criar} />
        <Botao titulo="Criar ficha" icone="add" onPress={criar} />
      </Cartao>

      {fichas.length === 0 ? <Vazio icone="list" titulo="Nenhuma ficha ainda" texto="Crie uma ficha, adicione treinos (A, B, C…) e escolha os exercícios do catálogo." /> : null}

      {[['Ativas', ativas], ['Inativas', inativas]].map(([titulo, lista]) =>
        (lista as typeof fichas).length ? (
          <Secao key={titulo as string} titulo={titulo as string}>
            <Cartao style={{ paddingVertical: espaco.xs, gap: 0 }}>
              {(lista as typeof fichas).map((f, i) => (
                <View key={f.fichaId}>
                  {i > 0 ? <Separador /> : null}
                  <Linha titulo={f.nome} detalhe={resumo(f.fichaId)} direita={f.ativa ? <Chip texto="Ativa" ativo /> : undefined} onPress={() => router.push({ pathname: '/ficha/[fichaId]', params: { fichaId: f.fichaId } })} />
                </View>
              ))}
            </Cartao>
          </Secao>
        ) : null,
      )}
    </Tela>
  );
}
