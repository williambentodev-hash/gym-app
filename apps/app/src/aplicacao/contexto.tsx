// Contexto da aplicação: ÚNICO caminho de escrita das telas (comando → eventos → log local → sync).
// As telas leem só o estado local derivado dos eventos (ADR-0007, ponto 3); a rede nunca bloqueia (QA-1).
import type { Catalogo } from '@gym/contracts';
import { estadoInicialDominio, verificarInatividade, type Decisao, type EstadoDominio } from '@gym/domain';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Text, View } from 'react-native';
import { cores, tipo } from '../ui/tema';
import { authClient } from '../infra/auth-client';
import { atualizarCatalogo, catalogoEmCache, montarCatalogo, type CatalogoApp } from './catalogo';
import { iniciarNucleo, type Nucleo } from './motor';

type StatusSync = { estado: 'ocioso' | 'sincronizando' | 'ok' | 'offline' | 'sem_login'; mensagem: string; pendentes: number; confirmados: number; em?: string };

type Contexto = {
  pronto: boolean;
  estado: EstadoDominio;
  catalogo: CatalogoApp;
  sync: StatusSync;
  deviceId: string;
  logado: boolean;
  /** Executa a decisão de um comando. Devolve a mensagem de erro, ou null se gravou. */
  executar: (d: Decisao<{ type: string; payload: unknown }>) => Promise<string | null>;
  sincronizar: () => Promise<void>;
};

const Ctx = createContext<Contexto | null>(null);

export function useApp(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp fora do AppProvider');
  return c;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const nucleo = useRef<Nucleo | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erroFatal, setErroFatal] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDominio>(estadoInicialDominio);
  const [catalogoGlobal, setCatalogoGlobal] = useState<Catalogo | null>(null);
  const [sync, setSync] = useState<StatusSync>({ estado: 'ocioso', mensagem: '', pendentes: 0, confirmados: 0 });
  const { data: sessao } = authClient.useSession();
  const logado = !!sessao;
  const logadoRef = useRef(logado);
  logadoRef.current = logado;

  const recarregar = useCallback(async () => {
    const n = nucleo.current;
    if (!n) return;
    const [novo, contagens] = await Promise.all([n.motor.estado(), n.store.contagens()]);
    setEstado(novo);
    setSync((s) => ({ ...s, ...contagens }));
    return novo;
  }, []);

  const sincronizar = useCallback(async () => {
    const n = nucleo.current;
    if (!n) return;
    if (!logadoRef.current) {
      setSync((s) => ({ ...s, estado: 'sem_login', mensagem: 'Entre para sincronizar. Seus dados estão salvos no aparelho.' }));
      return;
    }
    setSync((s) => ({ ...s, estado: 'sincronizando', mensagem: 'Sincronizando…' }));
    try {
      const r = await n.motor.sincronizar();
      setSync((s) => ({ ...s, estado: 'ok', mensagem: r.recebidos || r.enviados ? `${r.enviados} enviados · ${r.recebidos} recebidos` : 'Tudo sincronizado', em: new Date().toISOString() }));
    } catch (e) {
      setSync((s) => ({ ...s, estado: 'offline', mensagem: `Sem conexão. Dados seguros no aparelho (${e instanceof Error ? e.message : String(e)}).` }));
    }
    await recarregar();
  }, [recarregar]);

  /** Política de inatividade (01-dominio §6): encerra sessões paradas há > 3 h, com eventId determinístico. */
  const checarInatividade = useCallback(async (atual: EstadoDominio) => {
    const n = nucleo.current;
    if (!n) return;
    const eventos = verificarInatividade(atual.execucao, new Date());
    for (const ev of eventos) await n.motor.registrar(ev.type, ev.payload, 1, { eventId: ev.eventId });
    if (eventos.length) await recarregar();
  }, [recarregar]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      let n: Nucleo;
      try {
        n = await iniciarNucleo();
      } catch (e) {
        // Nunca falhar em silêncio: sem banco local não há app (é a fonte primária de escrita).
        if (vivo) setErroFatal(e instanceof Error ? e.message : String(e));
        return;
      }
      if (!vivo) return;
      nucleo.current = n;
      const cache = await catalogoEmCache(n.store);
      setCatalogoGlobal(cache);
      const atual = await recarregar();
      setPronto(true);
      if (atual) await checarInatividade(atual);
      const novo = await atualizarCatalogo(n.store, cache);
      if (vivo && novo) setCatalogoGlobal(novo);
    })();
    return () => {
      vivo = false;
    };
  }, [recarregar, checarInatividade]);

  // Sincroniza quando a sessão fica disponível e sempre que o app volta ao primeiro plano.
  useEffect(() => {
    if (pronto && logado) sincronizar();
  }, [pronto, logado, sincronizar]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active') return;
      const atual = await recarregar();
      if (atual) await checarInatividade(atual);
      sincronizar();
    });
    return () => sub.remove();
  }, [recarregar, checarInatividade, sincronizar]);

  const syncAgendado = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executar = useCallback(
    async (d: Decisao<{ type: string; payload: unknown }>) => {
      if (!d.ok) return d.erro;
      const n = nucleo.current;
      if (!n) return 'aplicativo ainda carregando';
      for (const ev of d.eventos) await n.motor.registrar(ev.type, ev.payload, 1, ev.eventId ? { eventId: ev.eventId } : {});
      await recarregar();
      // Sync em segundo plano, agrupando rajadas de registros (ex.: várias séries seguidas).
      if (syncAgendado.current) clearTimeout(syncAgendado.current);
      syncAgendado.current = setTimeout(() => sincronizar(), 1500);
      return null;
    },
    [recarregar, sincronizar],
  );

  const catalogo = useMemo(() => montarCatalogo(catalogoGlobal, estado.catalogo), [catalogoGlobal, estado.catalogo]);

  const valor = useMemo<Contexto>(
    () => ({ pronto, estado, catalogo, sync, deviceId: nucleo.current?.store.deviceId ?? '', logado, executar, sincronizar }),
    [pronto, estado, catalogo, sync, logado, executar, sincronizar],
  );
  if (erroFatal) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={tipo.titulo}>Não foi possível abrir seus dados</Text>
        <Text style={tipo.apoio}>{erroFatal}</Text>
      </View>
    );
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
