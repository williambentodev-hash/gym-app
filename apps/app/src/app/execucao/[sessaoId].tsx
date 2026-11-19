// Execução (01-dominio §6): a tela da academia. Offline por construção: tudo é local e a rede nunca bloqueia.
// Orientação (01-dominio §5): carga sugerida com motivo, rampa de aquecimento, descanso e regra do bi-set.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  aposSerie, concluirSessao, descansoSeg, descartarSessao, progressoPorExercicio, pularExercicio, rampaAquecimento,
  registrarSerie, removerSerie, responderSugestao, sugerirCarga, superaRecorde,
  type ItemSessao, type Medidas, type Sessao, type SugestaoCarga, type TipoSerie,
} from '@gym/domain';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ExercicioApp } from '../../aplicacao/catalogo';
import { duracaoSessao, kg, nomeDoTreino, resumoMedidas, resumoPrescricao, tempo } from '../../aplicacao/consultas';
import { useApp } from '../../aplicacao/contexto';
import { novoId } from '../../aplicacao/motor';
import { garantirMidia } from '../../infra/midias-offline';
import { Ajustador, Aviso, avisar, Botao, BotaoIcone, Cartao, Chip, confirmar, vibrar } from '../../ui/componentes';
import { cores, espaco, margemTela, raio, tipo } from '../../ui/tema';

/** Volta para quem abriu a execução (abas); replace só se não houver histórico: replace empilharia abas duplicadas. */
const sairDaExecucao = () => (router.canGoBack() ? router.back() : router.replace('/'));

type Entrada = { cargaKg: number; reps: number; duracaoSeg: number; distanciaKm: number; rir?: number; tipo: TipoSerie };

const feitas = (s: Sessao, itemId: string) => s.series.filter((x) => x.itemId === itemId && x.tipo !== 'aquecimento').length;
const concluido = (s: Sessao, i: ItemSessao) => i.pulado || feitas(s, i.itemId) >= i.prescricao.series;

function useAgora(intervaloMs = 500) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

export default function Execucao() {
  const { sessaoId } = useLocalSearchParams<{ sessaoId: string }>();
  const { estado, catalogo, executar } = useApp();
  const sessao = estado.execucao.sessoes[sessaoId];
  const itens = useMemo(() => sessao?.blocos.flatMap((b) => b.itens.map((i) => ({ item: i, bloco: b }))) ?? [], [sessao?.blocos]);
  const [atualId, setAtualId] = useState<string | undefined>(() => (sessao ? itens.find(({ item }) => !concluido(sessao, item))?.item.itemId ?? itens[0]?.item.itemId : undefined));
  const [fimDescanso, setFimDescanso] = useState<number | null>(null);
  const [recorde, setRecorde] = useState<string | null>(null);
  const agora = useAgora();

  // Progresso das sessões ENCERRADAS: base da sugestão e dos recordes (01-dominio §5).
  const progresso = useMemo(() => progressoPorExercicio(estado.execucao), [estado.execucao]);

  // Garante as animações de todos os exercícios da sessão em disco (QA-1), em segundo plano.
  useEffect(() => {
    for (const { item } of itens) {
      const url = catalogo.porId.get(item.exercicioId)?.animacaoUrl;
      if (url) garantirMidia(url).catch(() => undefined);
    }
  }, [itens, catalogo.porId]);

  // Fim do descanso: vibra uma vez.
  const restante = fimDescanso ? Math.ceil((fimDescanso - agora) / 1000) : 0;
  useEffect(() => {
    if (fimDescanso && restante <= 0) {
      vibrar('sucesso');
      setFimDescanso(null);
    }
  }, [fimDescanso, restante]);

  if (!sessao) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo, padding: margemTela, gap: espaco.l }}>
        <Text style={tipo.titulo}>Treino não encontrado</Text>
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (sessao.status !== 'em_andamento') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo, padding: margemTela, gap: espaco.l, justifyContent: 'center' }}>
        <Ionicons name="checkmark-circle" size={56} color={cores.sucesso} style={{ alignSelf: 'center' }} />
        <Text style={[tipo.titulo, { textAlign: 'center' }]}>{sessao.status === 'descartada' ? 'Treino descartado' : 'Treino concluído'}</Text>
        <Text style={[tipo.apoio, { textAlign: 'center' }]}>
          {sessao.series.filter((s) => s.tipo !== 'aquecimento').length} séries · {tempo(duracaoSessao(sessao))}
          {sessao.status === 'encerrada_inatividade' ? ' · encerrado por inatividade' : ''}
        </Text>
        <Botao titulo="Fechar" onPress={() => sairDaExecucao()} />
      </SafeAreaView>
    );
  }

  const atual = itens.find(({ item }) => item.itemId === atualId) ?? itens[0]!;
  const ex = catalogo.porId.get(atual.item.exercicioId);
  const composto = ex?.composto ?? false;
  const prog = progresso[atual.item.exercicioId];
  const sugestao = sugerirCarga(atual.item.prescricao, prog?.ultimaSessao?.seriesTrabalho, composto);
  const seriesDoItem = sessao.series.filter((s) => s.itemId === atual.item.itemId);
  const totalFeitas = sessao.series.filter((s) => s.tipo !== 'aquecimento').length;

  async function concluir() {
    if (!(await confirmar('Concluir treino?', `${totalFeitas} séries registradas. Depois de concluído, o treino não pode mais ser alterado.`, 'Concluir'))) return;
    const erro = await executar(concluirSessao(estado.execucao, sessaoId));
    if (erro) avisar('Não foi possível concluir', erro);
    else vibrar('sucesso');
  }

  async function descartar() {
    if (!(await confirmar('Descartar treino?', 'As séries deste treino serão descartadas.', 'Descartar'))) return;
    const erro = await executar(descartarSessao(estado.execucao, sessaoId));
    if (erro) avisar('Não foi possível', erro);
    else sairDaExecucao();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }} edges={['top', 'bottom']}>
      {/* Cabeçalho */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: margemTela, paddingVertical: espaco.s, gap: espaco.s }}>
        <BotaoIcone icone="chevron-down" rotulo="Minimizar" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={tipo.destaque} numberOfLines={1}>{nomeDoTreino(estado, sessao.fichaId, sessao.treinoId)}</Text>
          <Text style={[tipo.nota, { fontVariant: ['tabular-nums'] }]}>{tempo(duracaoSessao(sessao))} · {totalFeitas} séries</Text>
        </View>
        <BotaoIcone icone="trash-outline" rotulo="Descartar treino" onPress={descartar} />
        <Botao compacto titulo="Concluir" onPress={concluir} />
      </View>

      {/* Navegação entre exercícios */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={itens}
        keyExtractor={({ item }) => item.itemId}
        style={{ flexGrow: 0, minHeight: 52 }}
        contentContainerStyle={{ paddingHorizontal: margemTela, gap: espaco.s, paddingVertical: espaco.s, alignItems: 'center' }}
        renderItem={({ item: { item, bloco } }) => {
          const ativo = item.itemId === atual.item.itemId;
          const ok = concluido(sessao, item);
          return (
            <Pressable onPress={() => setAtualId(item.itemId)} style={[{ paddingHorizontal: espaco.m, paddingVertical: espaco.s, borderRadius: raio.pilula, backgroundColor: ativo ? cores.acentoSuave : cores.superficie, borderWidth: 1, borderColor: ativo ? cores.acento : 'transparent', maxWidth: 200 }]}>
              <Text style={[tipo.nota, { color: ativo ? cores.acento : ok ? cores.sucesso : cores.textoSecundario, fontWeight: '600' }]} numberOfLines={1}>
                {item.pulado ? '⤼' : ok ? '✓' : `${feitas(sessao, item.itemId)}/${item.prescricao.series}`} {bloco.itens.length > 1 ? '⇄ ' : ''}{catalogo.porId.get(item.exercicioId)?.nome ?? 'Exercício'}
              </Text>
            </Pressable>
          );
        }}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: margemTela, paddingBottom: 140, gap: espaco.l }} keyboardShouldPersistTaps="handled">
        {recorde ? <Aviso tom="sucesso" texto={`Novo recorde! ${recorde}`} /> : null}
        {fimDescanso ? <Descanso restante={restante} onMais={() => setFimDescanso((f) => (f ?? Date.now()) + 15_000)} onPular={() => setFimDescanso(null)} /> : null}

        <CartaoExercicio
          key={atual.item.itemId}
          sessao={sessao}
          item={atual.item}
          blocoItens={atual.bloco.itens.map((i) => i.itemId)}
          exercicio={ex}
          sugestao={sugestao}
          series={seriesDoItem}
          onRegistrado={(r) => {
            if (r.recorde) {
              setRecorde(`${ex?.nome}: ${r.recorde}`);
              vibrar('sucesso');
              setTimeout(() => setRecorde(null), 6000);
            }
            if (r.descansoSeg) setFimDescanso(Date.now() + r.descansoSeg * 1000);
            if (r.proximoItemId) setAtualId(r.proximoItemId);
          }}
          proximoIncompleto={() => itens.find(({ item }) => item.itemId !== atual.item.itemId && !concluido(sessao, item))?.item.itemId}
          recordeAntes={prog?.recorde}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Descanso({ restante, onMais, onPular }: { restante: number; onMais: () => void; onPular: () => void }) {
  return (
    <Cartao destaque style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name="timer-outline" size={24} color={cores.acento} />
      <View style={{ flex: 1 }}>
        <Text style={tipo.rotulo}>Descanso</Text>
        <Text style={[tipo.numeroGrande, { fontSize: 36 }]}>{tempo(Math.max(0, restante))}</Text>
      </View>
      <Chip texto="+15 s" onPress={onMais} />
      <Chip texto="Pular" onPress={onPular} />
    </Cartao>
  );
}

type Registrado = { recorde?: string; descansoSeg?: number; proximoItemId?: string };

function CartaoExercicio({ sessao, item, blocoItens, exercicio, sugestao, series, onRegistrado, proximoIncompleto, recordeAntes }: {
  sessao: Sessao; item: ItemSessao; blocoItens: string[]; exercicio?: ExercicioApp; sugestao: SugestaoCarga;
  series: Sessao['series']; onRegistrado: (r: Registrado) => void; proximoIncompleto: () => string | undefined;
  recordeAntes?: Parameters<typeof superaRecorde>[0];
}) {
  const { estado, executar } = useApp();
  const [midiaUri, setMidiaUri] = useState<string | null>(null);
  const ultimaSerie = series[series.length - 1];
  const [entrada, setEntrada] = useState<Entrada>(() => valoresIniciais(item, sugestao, ultimaSerie?.medidas));
  const set = (p: Partial<Entrada>) => setEntrada((e) => ({ ...e, ...p }));
  const composto = exercicio?.composto ?? false;
  const m = item.modalidade;
  const rampa = m === 'carga_repeticoes' && composto && series.length === 0 && sugestao.cargaKg ? rampaAquecimento(sugestao.cargaKg) : [];
  const jaRespondeu = sessao.respostas.some((r) => r.itemId === item.itemId);

  useEffect(() => {
    if (exercicio?.animacaoUrl) garantirMidia(exercicio.animacaoUrl).then((r) => setMidiaUri(r.uri)).catch(() => setMidiaUri(exercicio.animacaoUrl ?? null));
  }, [exercicio?.animacaoUrl]);

  function medidas(): Medidas {
    switch (m) {
      case 'carga_repeticoes': return { modalidade: m, cargaKg: entrada.cargaKg, reps: entrada.reps, ...(entrada.rir !== undefined ? { rir: entrada.rir } : {}) };
      case 'peso_corporal': return { modalidade: m, reps: entrada.reps, ...(entrada.cargaKg ? { cargaAdicionalKg: entrada.cargaKg } : {}), ...(entrada.rir !== undefined ? { rir: entrada.rir } : {}) };
      case 'tempo': return { modalidade: m, duracaoSeg: entrada.duracaoSeg, ...(entrada.cargaKg ? { cargaAdicionalKg: entrada.cargaKg } : {}) };
      case 'cardio': return { modalidade: m, duracaoSeg: entrada.duracaoSeg, ...(entrada.distanciaKm ? { distanciaM: Math.round(entrada.distanciaKm * 1000) } : {}) };
    }
  }

  async function registrar() {
    const med = medidas();
    const erro = await executar(registrarSerie(estado.execucao, { sessaoId: sessao.sessaoId, serieId: novoId(), itemId: item.itemId, tipo: entrada.tipo, medidas: med }));
    if (erro) return avisar('Não foi possível registrar', erro);

    // Registra a resposta à sugestão na 1ª série de trabalho do exercício (ADR-0012: dado nasce no MVP).
    if (entrada.tipo === 'trabalho' && !jaRespondeu && (sugestao.tipo === 'subir' || sugestao.tipo === 'manter' || sugestao.tipo === 'reduzir') && med.modalidade === 'carga_repeticoes') {
      const resposta = med.cargaKg === sugestao.cargaKg ? 'aceita' : 'ajustada';
      await executar(responderSugestao(estado.execucao, { sessaoId: sessao.sessaoId, itemId: item.itemId, sugestao: { cargaKg: sugestao.cargaKg, motivo: sugestao.motivo.slice(0, 200) }, resposta }));
    }

    const ehRecorde = entrada.tipo === 'trabalho' && recordeAntes !== undefined && superaRecorde(recordeAntes, med);
    const feitasAgora = series.filter((s) => s.tipo !== 'aquecimento').length + (entrada.tipo === 'aquecimento' ? 0 : 1);
    const terminou = feitasAgora >= item.prescricao.series;
    const { descansar, proximoItemId } = aposSerie(blocoItens, item.itemId);
    const descanso = entrada.tipo === 'aquecimento' ? 60 : descansoSeg(item.prescricao, composto);
    onRegistrado({
      ...(ehRecorde ? { recorde: resumoMedidas(med) } : {}),
      ...(descansar && descanso > 0 ? { descansoSeg: descanso } : {}),
      // Bi-set: segue para o próximo do bloco; exercício simples concluído: vai para o próximo pendente.
      ...(blocoItens.length > 1 ? { proximoItemId } : terminou ? { proximoItemId: proximoIncompleto() } : {}),
    });
  }

  return (
    <View style={{ gap: espaco.l }}>
      <Cartao>
        <View style={{ flexDirection: 'row', gap: espaco.m }}>
          <View style={{ width: 96, height: 96, borderRadius: raio.botao, backgroundColor: cores.texto, overflow: 'hidden' }}>
            {midiaUri ? <Image source={{ uri: midiaUri }} style={{ width: 96, height: 96 }} contentFit="cover" cachePolicy="none" /> : null}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={tipo.titulo} numberOfLines={3}>{exercicio?.nome ?? 'Exercício'}</Text>
            <Text style={tipo.nota}>{resumoPrescricao(item.prescricao, m)}</Text>
            {item.exercicioOriginalId ? <Text style={tipo.nota}>Substituído na hora</Text> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: espaco.s, flexWrap: 'wrap' }}>
          <Chip texto="Substituir" onPress={() => router.push({ pathname: '/catalogo', params: { modo: 'substituir', sessaoId: sessao.sessaoId, itemId: item.itemId } })} />
          {!item.pulado ? (
            <Chip texto="Pular exercício" onPress={async () => { const e = await executar(pularExercicio(estado.execucao, { sessaoId: sessao.sessaoId, itemId: item.itemId })); if (e) avisar('Não foi possível', e); }} />
          ) : null}
        </View>
      </Cartao>

      {sugestao.tipo !== 'nao_aplicavel' ? (
        <Cartao style={{ borderLeftWidth: 3, borderLeftColor: cores.acento }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
            <Ionicons name={sugestao.tipo === 'subir' ? 'trending-up' : sugestao.tipo === 'reduzir' ? 'trending-down' : 'sparkles'} size={20} color={cores.acento} />
            <Text style={[tipo.destaque, { flex: 1 }]}>
              {sugestao.cargaKg !== undefined ? `Sugestão: ${m === 'peso_corporal' ? '+' : ''}${kg(sugestao.cargaKg)} kg` : 'Sugestão'}
            </Text>
            {sugestao.cargaKg !== undefined ? <Chip texto="Usar" ativo onPress={() => set({ cargaKg: sugestao.cargaKg!, tipo: 'trabalho' })} /> : null}
          </View>
          <Text style={tipo.apoio}>{sugestao.motivo.charAt(0).toUpperCase() + sugestao.motivo.slice(1)}</Text>
          {rampa.length ? <Text style={tipo.nota}>Aquecimento sugerido: {rampa.map((r) => `${kg(r.cargaKg)} kg × ${r.reps}`).join(' · ')}</Text> : null}
        </Cartao>
      ) : null}

      <Cartao>
        <View style={{ flexDirection: 'row', gap: espaco.s, justifyContent: 'center' }}>
          {([['trabalho', 'Trabalho'], ['aquecimento', 'Aquecimento'], ['drop', 'Drop']] as const).map(([t, rot]) => (
            <Chip key={t} texto={rot} ativo={entrada.tipo === t} onPress={() => set({ tipo: t })} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: espaco.s }}>
          {m === 'carga_repeticoes' ? (
            <>
              <Ajustador rotulo="Carga" sufixo="kg" valor={entrada.cargaKg} passo={2.5} min={0} max={500} formatar={kg} onChange={(v) => set({ cargaKg: v })} />
              <Ajustador rotulo="Reps" valor={entrada.reps} passo={1} min={0} max={100} onChange={(v) => set({ reps: v })} />
            </>
          ) : null}
          {m === 'peso_corporal' ? (
            <>
              <Ajustador rotulo="Reps" valor={entrada.reps} passo={1} min={0} max={200} onChange={(v) => set({ reps: v })} />
              <Ajustador rotulo="Carga extra" sufixo="kg (− = assistência)" valor={entrada.cargaKg} passo={2.5} min={-100} max={200} formatar={kg} onChange={(v) => set({ cargaKg: v })} />
            </>
          ) : null}
          {m === 'tempo' ? <Ajustador rotulo="Tempo" valor={entrada.duracaoSeg} passo={5} min={0} max={3600} formatar={tempo} onChange={(v) => set({ duracaoSeg: v })} /> : null}
          {m === 'cardio' ? (
            <>
              <Ajustador rotulo="Tempo" valor={entrada.duracaoSeg} passo={60} min={0} max={6 * 3600} formatar={tempo} onChange={(v) => set({ duracaoSeg: v })} />
              <Ajustador rotulo="Distância" sufixo="km" valor={entrada.distanciaKm} passo={0.1} min={0} max={200} formatar={(v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} onChange={(v) => set({ distanciaKm: v })} />
            </>
          ) : null}
        </View>
        {m === 'carga_repeticoes' || m === 'peso_corporal' ? (
          <View style={{ gap: espaco.xs, alignItems: 'center' }}>
            <Text style={tipo.rotulo}>Repetições na reserva (RIR)</Text>
            <View style={{ flexDirection: 'row', gap: espaco.s, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Chip texto="—" ativo={entrada.rir === undefined} onPress={() => set({ rir: undefined })} />
              {[0, 1, 2, 3, 4].map((r) => <Chip key={r} texto={r === 4 ? '4+' : String(r)} ativo={entrada.rir === r} onPress={() => set({ rir: r })} />)}
            </View>
          </View>
        ) : null}
        <Botao titulo={`Registrar série ${series.filter((s) => s.tipo !== 'aquecimento').length + (entrada.tipo === 'aquecimento' ? 0 : 1)}`} icone="checkmark" onPress={registrar} />
      </Cartao>

      {series.length ? (
        <Cartao style={{ gap: espaco.s }}>
          <Text style={tipo.rotulo}>Séries registradas</Text>
          {series.map((s, i) => (
            <View key={s.serieId} style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.m }}>
              <Text style={[tipo.numero, { width: 24, color: cores.textoTerciario }]}>{i + 1}</Text>
              <Text style={[tipo.nota, { width: 22, fontWeight: '700', color: s.tipo === 'trabalho' ? cores.sucesso : s.tipo === 'drop' ? cores.acento : cores.textoTerciario }]}>
                {s.tipo === 'trabalho' ? 'T' : s.tipo === 'drop' ? 'D' : 'A'}
              </Text>
              <Text style={[tipo.numero, { flex: 1 }]}>{resumoMedidas(s.medidas)}</Text>
              <BotaoIcone
                icone="close"
                rotulo="Remover série"
                onPress={async () => {
                  if (await confirmar('Remover série?', resumoMedidas(s.medidas), 'Remover')) {
                    const e = await executar(removerSerie(estado.execucao, { sessaoId: sessao.sessaoId, serieId: s.serieId }));
                    if (e) avisar('Não foi possível', e);
                  }
                }}
              />
            </View>
          ))}
        </Cartao>
      ) : null}
    </View>
  );
}

/** Valores iniciais: última série deste exercício na sessão → sugestão → carga da ficha → padrão. */
function valoresIniciais(item: ItemSessao, sugestao: SugestaoCarga, ultima?: Medidas): Entrada {
  const base: Entrada = { cargaKg: 20, reps: item.prescricao.repeticoes?.max ?? 10, duracaoSeg: item.prescricao.duracaoSeg ?? 30, distanciaKm: 0, tipo: 'trabalho' };
  if (item.modalidade === 'peso_corporal') base.cargaKg = 0;
  if (sugestao.cargaKg !== undefined) base.cargaKg = sugestao.cargaKg;
  else if (item.prescricao.cargaKg !== undefined) base.cargaKg = item.prescricao.cargaKg;
  if (ultima) {
    if (ultima.modalidade === 'carga_repeticoes') Object.assign(base, { cargaKg: ultima.cargaKg, reps: ultima.reps });
    if (ultima.modalidade === 'peso_corporal') Object.assign(base, { reps: ultima.reps, cargaKg: ultima.cargaAdicionalKg ?? 0 });
    if (ultima.modalidade === 'tempo' || ultima.modalidade === 'cardio') base.duracaoSeg = ultima.duracaoSeg;
  }
  return base;
}
