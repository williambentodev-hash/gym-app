// Montar ficha com a IA especialista (ADR-0015): perfil → proposta (prévia + análise) → você decide.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PerfilTreino, PropostaFicha } from '@gym/contracts';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NOMES_GRUPOS } from '../aplicacao/catalogo';
import { resumoPrescricao } from '../aplicacao/consultas';
import { useApp } from '../aplicacao/contexto';
import { decisaoDaProposta, pedirProposta } from '../aplicacao/ia';
import { novoId } from '../aplicacao/motor';
import { Ajustador, Aviso, avisar, Botao, Campo, Cartao, Chip, Secao, Tela } from '../ui/componentes';
import { cores, espaco, tipo } from '../ui/tema';

const OBJETIVOS: Array<[PerfilTreino['objetivo'], string]> = [['hipertrofia', 'Hipertrofia'], ['forca', 'Força'], ['condicionamento', 'Condicionamento'], ['emagrecimento', 'Emagrecimento'], ['saude', 'Saúde']];
const NIVEIS: Array<[PerfilTreino['nivel'], string]> = [['iniciante', 'Iniciante'], ['intermediario', 'Intermediário'], ['avancado', 'Avançado']];
const LOCAIS: Array<[PerfilTreino['local'], string]> = [['academia_completa', 'Academia completa'], ['academia_basica', 'Academia básica'], ['casa_halteres', 'Casa com halteres'], ['peso_corporal', 'Só peso corporal']];
const GRUPOS = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'abdomen'];

type Etapa = { tipo: 'perfil' } | { tipo: 'gerando' } | { tipo: 'proposta'; proposta: PropostaFicha } | { tipo: 'erro'; mensagem: string };

export default function MontarComIA() {
  const { estado, executar } = useApp();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'perfil' });
  const [perfil, setPerfil] = useState<PerfilTreino>({ objetivo: 'hipertrofia', nivel: 'intermediario', diasPorSemana: 4, minutosPorTreino: 60, local: 'academia_completa', prioridades: [] });
  const set = (p: Partial<PerfilTreino>) => setPerfil((x) => ({ ...x, ...p }));

  async function gerar() {
    setEtapa({ tipo: 'gerando' });
    try {
      const limpo: PerfilTreino = { ...perfil, ...(perfil.limitacoes?.trim() ? {} : { limitacoes: undefined }), ...(perfil.observacoes?.trim() ? {} : { observacoes: undefined }) };
      setEtapa({ tipo: 'proposta', proposta: await pedirProposta(limpo) });
    } catch (e) {
      setEtapa({ tipo: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
    }
  }

  async function criar(proposta: PropostaFicha) {
    const fichaId = novoId();
    const erro = await executar(decisaoDaProposta(estado.planejamento, proposta, novoId, fichaId));
    if (erro) return avisar('Não foi possível criar a ficha', erro);
    router.replace({ pathname: '/ficha/[fichaId]', params: { fichaId } });
  }

  if (etapa.tipo === 'gerando') {
    return (
      <Tela rolar={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaco.l }}>
          <ActivityIndicator size="large" color={cores.acento} />
          <Text style={tipo.destaque}>A especialista está montando sua ficha…</Text>
          <Text style={[tipo.apoio, { textAlign: 'center' }]}>Ela pensa na divisão, no volume por grupo muscular e no tempo de cada treino. Pode levar até 1 minuto.</Text>
        </View>
      </Tela>
    );
  }

  if (etapa.tipo === 'proposta') return <Proposta proposta={etapa.proposta} onCriar={() => criar(etapa.proposta)} onRefazer={() => setEtapa({ tipo: 'perfil' })} />;

  return (
    <Tela titulo="Montar com IA" subtitulo="Uma especialista em treino monta a ficha; você revisa antes de salvar.">
      {etapa.tipo === 'erro' ? <Aviso texto={etapa.mensagem} /> : null}

      <Secao titulo="Objetivo">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          {OBJETIVOS.map(([v, rot]) => <Chip key={v} texto={rot} ativo={perfil.objetivo === v} onPress={() => set({ objetivo: v })} />)}
        </View>
      </Secao>

      <Secao titulo="Experiência">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          {NIVEIS.map(([v, rot]) => <Chip key={v} texto={rot} ativo={perfil.nivel === v} onPress={() => set({ nivel: v })} />)}
        </View>
      </Secao>

      <Cartao style={{ flexDirection: 'row' }}>
        <Ajustador rotulo="Dias/semana" valor={perfil.diasPorSemana} passo={1} min={1} max={7} onChange={(v) => set({ diasPorSemana: v })} />
        <Ajustador rotulo="Minutos" valor={perfil.minutosPorTreino} passo={5} min={20} max={180} onChange={(v) => set({ minutosPorTreino: v })} />
      </Cartao>

      <Secao titulo="Onde você treina">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          {LOCAIS.map(([v, rot]) => <Chip key={v} texto={rot} ativo={perfil.local === v} onPress={() => set({ local: v })} />)}
        </View>
      </Secao>

      <Secao titulo="Prioridades (opcional, até 3)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          {GRUPOS.map((g) => {
            const ativo = perfil.prioridades.includes(g);
            return <Chip key={g} texto={NOMES_GRUPOS[g] ?? g} ativo={ativo} onPress={() => set({ prioridades: ativo ? perfil.prioridades.filter((x) => x !== g) : perfil.prioridades.length < 3 ? [...perfil.prioridades, g] : perfil.prioridades })} />;
          })}
        </View>
      </Secao>

      <Secao titulo="Limitações e observações (opcional)">
        <Campo value={perfil.limitacoes ?? ''} onChangeText={(t) => set({ limitacoes: t })} placeholder="Ex.: desconforto no ombro direito" maxLength={300} />
        <Campo value={perfil.observacoes ?? ''} onChangeText={(t) => set({ observacoes: t })} placeholder="Ex.: prefiro máquinas; treino de manhã" maxLength={300} />
        <Text style={tipo.nota}>Enviamos só estes dados de treino para a IA (Anthropic), sem nome nem e-mail. Não inclua informações que identifiquem você. A IA não substitui orientação de um profissional de saúde.</Text>
      </Secao>

      <Botao titulo="Gerar ficha com IA" icone="sparkles" onPress={gerar} />
    </Tela>
  );
}

function Proposta({ proposta, onCriar, onRefazer }: { proposta: PropostaFicha; onCriar: () => void; onRefazer: () => void }) {
  const volume = Object.entries(proposta.analise.volumeSemanal).sort((a, b) => b[1].series - a[1].series);
  return (
    <Tela titulo={proposta.nome}>
      <Cartao style={{ borderLeftWidth: 3, borderLeftColor: cores.acento }}>
        <View style={{ flexDirection: 'row', gap: espaco.s, alignItems: 'center' }}>
          <Ionicons name="sparkles" size={18} color={cores.acento} />
          <Text style={tipo.rotulo}>Proposta da especialista</Text>
        </View>
        <Text style={[tipo.apoio, { lineHeight: 22 }]}>{proposta.resumo}</Text>
      </Cartao>

      {proposta.analise.avisos.map((a) => <Aviso key={a} tom="alerta" texto={a} />)}

      {proposta.treinos.map((t, k) => (
        <Cartao key={t.nome}>
          <View>
            <Text style={tipo.titulo}>{t.nome}</Text>
            <Text style={tipo.nota}>{t.foco} · ~{proposta.analise.minutosEstimadosPorTreino[k]} min</Text>
          </View>
          {t.blocos.map((b, j) => (
            <View key={j} style={b.itens.length > 1 ? { borderLeftWidth: 3, borderLeftColor: cores.acento, paddingLeft: espaco.m, gap: espaco.s } : { gap: espaco.s }}>
              {b.itens.length > 1 ? <Text style={[tipo.rotulo, { color: cores.acento }]}>{b.itens.length === 2 ? 'Bi-set' : 'Circuito'}</Text> : null}
              {b.itens.map((i) => (
                <View key={i.exercicioId} style={{ gap: 2 }}>
                  <Text style={tipo.corpo}>{i.nome}</Text>
                  <Text style={tipo.nota}>{resumoPrescricao(i.prescricao, i.modalidade)} · descanso {i.prescricao.descansoSeg}s</Text>
                  {i.observacao ? <Text style={[tipo.nota, { color: cores.alerta }]}>{i.observacao}</Text> : null}
                </View>
              ))}
            </View>
          ))}
        </Cartao>
      ))}

      <Secao titulo="Volume semanal estimado (séries por grupo)">
        <Cartao>
          <Text style={tipo.nota}>Calculado pelas regras do app, não pela IA. Faixa de referência: 10–20.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
            {volume.map(([g, a]) => (
              <Chip key={g} texto={`${NOMES_GRUPOS[g] ?? g} ${a.series.toLocaleString('pt-BR')}`} cor={a.status === 'dentro' ? cores.sucesso : a.status === 'acima' ? cores.alerta : cores.textoSecundario} />
            ))}
          </View>
        </Cartao>
      </Secao>

      {proposta.recomendacoes.length ? (
        <Secao titulo="Recomendações">
          <Cartao>
            {proposta.recomendacoes.map((r) => <Text key={r} style={[tipo.apoio, { lineHeight: 22 }]}>• {r}</Text>)}
          </Cartao>
        </Secao>
      ) : null}

      <Botao titulo="Criar esta ficha" icone="checkmark" onPress={onCriar} />
      <Botao titulo="Ajustar o pedido e gerar outra" variante="secundario" icone="refresh" onPress={onRefazer} />
    </Tela>
  );
}
