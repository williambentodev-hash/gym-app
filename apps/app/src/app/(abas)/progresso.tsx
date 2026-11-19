// Progresso (01-dominio §6–7): volume semanal por grupo, recordes e histórico — tudo projetado dos eventos.
import { avaliarVolume, PESO_PRINCIPAL, PESO_SECUNDARIO, progressoPorExercicio, semanaIso, volumeSemanal } from '@gym/domain';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { NOMES_GRUPOS } from '../../aplicacao/catalogo';
import { dataCurta, duracaoSessao, kg, nomeDoTreino, tempo } from '../../aplicacao/consultas';
import { useApp } from '../../aplicacao/contexto';
import { Cartao, Chip, Linha, Secao, Separador, Tela, Vazio } from '../../ui/componentes';
import { cores, espaco, raio, tipo } from '../../ui/tema';

const FAIXA = { min: 10, max: 20 };

export default function Progresso() {
  const { estado, catalogo } = useApp();
  const [semanasAtras, setSemanasAtras] = useState(0);
  const semana = semanaIso(new Date(Date.now() - semanasAtras * 7 * 86_400_000).toISOString());

  // Contagem fracionada: grupo principal = 1 série, cada secundário = 0,5.
  const volume = useMemo(() => volumeSemanal(estado.execucao, (id) => {
    const e = catalogo.porId.get(id);
    if (!e) return [];
    return [{ grupo: e.grupoPrincipal, peso: PESO_PRINCIPAL }, ...e.gruposSecundarios.map((g) => ({ grupo: g, peso: PESO_SECUNDARIO }))].filter((x) => x.grupo !== 'cardio');
  }, semana), [estado.execucao, catalogo.porId, semana]);
  const avaliacao = avaliarVolume(volume);
  const progresso = useMemo(() => progressoPorExercicio(estado.execucao), [estado.execucao]);
  const encerradas = Object.values(estado.execucao.sessoes)
    .filter((s) => s.status === 'concluida' || s.status === 'encerrada_inatividade')
    .sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm));
  const destaques = Object.values(progresso)
    .filter((p) => p.recorde.cargaKg !== undefined || p.recorde.reps !== undefined || p.recorde.duracaoSeg !== undefined)
    .sort((a, b) => b.sessoes - a.sessoes)
    .slice(0, 12);

  if (encerradas.length === 0 && Object.keys(progresso).length === 0) {
    return <Tela titulo="Progresso"><Vazio icone="trending-up" titulo="Seu progresso aparece aqui" texto="Conclua o primeiro treino para ver volume semanal, recordes e histórico." /></Tela>;
  }

  const maxBarra = Math.max(FAIXA.max, ...Object.values(volume));

  return (
    <Tela titulo="Progresso">
      <Secao titulo={`Volume semanal · ${semana.replace('-W', ' · semana ')}`} acao={
        <View style={{ flexDirection: 'row', gap: espaco.xs }}>
          <Chip texto="‹" onPress={() => setSemanasAtras((s) => s + 1)} />
          <Chip texto="›" onPress={semanasAtras > 0 ? () => setSemanasAtras((s) => s - 1) : undefined} />
        </View>
      }>
        <Cartao>
          <Text style={tipo.nota}>Séries efetivas por grupo muscular (principal = 1, secundário = 0,5). Faixa de referência: {FAIXA.min}–{FAIXA.max} por semana.</Text>
          {Object.keys(avaliacao).length === 0 ? <Text style={tipo.apoio}>Nenhuma série nesta semana.</Text> : null}
          {Object.entries(avaliacao).sort((a, b) => b[1].series - a[1].series).map(([g, a]) => {
            const cor = a.status === 'dentro' ? cores.sucesso : a.status === 'abaixo' ? cores.textoSecundario : cores.alerta;
            return (
              <View key={g} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={tipo.corpo}>{NOMES_GRUPOS[g] ?? g}</Text>
                  <Text style={[tipo.numero, { color: cor }]}>{a.series.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</Text>
                </View>
                <View style={{ height: 6, borderRadius: raio.pilula, backgroundColor: cores.superficieElevada, overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', left: `${(FAIXA.min / maxBarra) * 100}%`, width: `${((FAIXA.max - FAIXA.min) / maxBarra) * 100}%`, top: 0, bottom: 0, backgroundColor: cores.acentoSuave }} />
                  <View style={{ width: `${Math.min(100, (a.series / maxBarra) * 100)}%`, height: 6, borderRadius: raio.pilula, backgroundColor: a.status === 'dentro' ? cores.acento : cor }} />
                </View>
              </View>
            );
          })}
        </Cartao>
      </Secao>

      {destaques.length ? (
        <Secao titulo="Recordes">
          <Cartao style={{ paddingVertical: espaco.xs, gap: 0 }}>
            {destaques.map((p, i) => {
              const r = p.recorde;
              const valor = r.cargaKg !== undefined ? `${kg(r.cargaKg)} kg${r.e1rmKg ? ` · 1RM ~${kg(r.e1rmKg)}` : ''}` : r.reps !== undefined ? `${r.reps} reps` : r.duracaoSeg !== undefined ? tempo(r.duracaoSeg) : '—';
              return (
                <View key={p.exercicioId}>
                  {i > 0 ? <Separador /> : null}
                  <Linha onPress={() => router.push({ pathname: '/exercicio', params: { id: p.exercicioId } })} titulo={catalogo.porId.get(p.exercicioId)?.nome ?? 'Exercício'} detalhe={`${p.sessoes} treino${p.sessoes === 1 ? '' : 's'} · ${p.series} série${p.series === 1 ? '' : 's'}${p.tonelagemKg ? ` · ${kg(Math.round(p.tonelagemKg))} kg movidos` : ''}`} direita={<Text style={[tipo.numero, { color: cores.acento }]}>{valor}</Text>} />
                </View>
              );
            })}
          </Cartao>
        </Secao>
      ) : null}

      {encerradas.length ? (
        <Secao titulo="Histórico">
          <Cartao style={{ paddingVertical: espaco.xs, gap: 0 }}>
            {encerradas.slice(0, 30).map((s, i) => (
              <View key={s.sessaoId}>
                {i > 0 ? <Separador /> : null}
                <Linha
                  onPress={() => router.push({ pathname: '/sessao/[sessaoId]', params: { sessaoId: s.sessaoId } })}
                  titulo={nomeDoTreino(estado, s.fichaId, s.treinoId)}
                  detalhe={`${dataCurta(s.iniciadaEm)} · ${tempo(duracaoSessao(s))} · ${s.series.filter((x) => x.tipo !== 'aquecimento').length} séries${s.status === 'encerrada_inatividade' ? ' · encerrado por inatividade' : ''}`}
                />
              </View>
            ))}
          </Cartao>
        </Secao>
      ) : null}
    </Tela>
  );
}
