import { describe, expect, it } from 'vitest';
import { criarMotorSync, type EventoLocal } from './index';
import { prng, ServidorMemoria, StoreMemoria, TransporteMemoria } from './testes/memoria';

// Reducer de teste NÃO comutativo: o estado é a sequência de eventos aplicados.
// Se dois aparelhos aplicarem os mesmos eventos em ordens diferentes, o teste detecta.
type Estado = string[];
const reducer = (s: Estado, e: EventoLocal): Estado => [...s, `${(e.payload as { n: number }).n}`];

function criarAparelho(servidor: ServidorMemoria, nome: string, seed = 1) {
  const store = new StoreMemoria();
  const transporte = new TransporteMemoria(servidor);
  const rand = prng(seed);
  let contador = 0;
  const motor = criarMotorSync<Estado>({
    store,
    transporte,
    reducer,
    estadoInicial: [],
    deviceId: nome,
    // UUID determinístico para o teste (formato válido para o schema do contrato).
    gerarId: () => {
      contador++;
      const hex = (n: number) => Math.floor(rand() * 16 ** n).toString(16).padStart(n, '0');
      return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${contador.toString(16).padStart(12, '0')}`;
    },
    agora: () => new Date('2026-11-18T12:00:00Z'),
  });
  return { motor, store, transporte, nome };
}

describe('motor de sincronização', () => {
  it('registra localmente sem rede e o estado já reflete o evento (QA-1)', async () => {
    const a = criarAparelho(new ServidorMemoria(), 'a');
    a.transporte.online = false;
    await a.motor.registrar('Teste', { n: 1 });
    expect(await a.motor.estado()).toEqual(['1']);
    await expect(a.motor.sincronizar()).rejects.toThrow('offline');
    expect(await a.store.pendentes(10)).toHaveLength(1); // continua pendente, nada perdido
  });

  it('é idempotente quando a resposta do push se perde (ADR-0006, regra 4)', async () => {
    const servidor = new ServidorMemoria();
    const a = criarAparelho(servidor, 'a');
    await a.motor.registrar('Teste', { n: 1 });
    a.transporte.perderProximaRespostaDePush = true;
    await expect(a.motor.sincronizar()).rejects.toThrow('resposta perdida');
    expect(servidor.log).toHaveLength(1); // o servidor gravou
    await a.motor.sincronizar(); // o cliente reenvia
    expect(servidor.log).toHaveLength(1); // e não duplicou
    expect(await a.store.pendentes(10)).toHaveLength(0);
  });

  it('cursor não pula eventos de outro aparelho quando o próprio push recebe seq alto', async () => {
    const servidor = new ServidorMemoria();
    const a = criarAparelho(servidor, 'a', 1);
    const b = criarAparelho(servidor, 'b', 2);
    await b.motor.registrar('Teste', { n: 1 });
    await b.motor.sincronizar(); // seq 1 (de b)
    await a.motor.registrar('Teste', { n: 2 });
    await a.motor.sincronizar(); // a recebe seq 2 no push; o pull desde 0 precisa trazer o seq 1
    expect(await a.motor.estado()).toEqual(['1', '2']);
  });

  it('rebase: pendentes locais são reaplicados depois dos eventos remotos', async () => {
    const servidor = new ServidorMemoria();
    const a = criarAparelho(servidor, 'a', 1);
    const b = criarAparelho(servidor, 'b', 2);
    await a.motor.registrar('Teste', { n: 1 });
    await a.motor.sincronizar();
    await b.motor.registrar('Teste', { n: 2 }); // pendente em b
    b.transporte.online = false;
    expect(await b.motor.estado()).toEqual(['2']);
    b.transporte.online = true;
    await b.motor.sincronizar();
    expect(await b.motor.estado()).toEqual(['1', '2']); // o remoto entra antes, o local é "rebaseado"
  });

  // Teste de propriedade: para várias seeds, sequências aleatórias de operações com falhas de rede
  // sempre convergem para o mesmo estado em todos os aparelhos, sem perda nem duplicação.
  it.each(Array.from({ length: 50 }, (_, i) => i + 1))('converge (seed %i)', async (seed) => {
    const rand = prng(seed);
    const servidor = new ServidorMemoria();
    const aparelhos = [1, 2, 3].map((i) => criarAparelho(servidor, `d${i}`, seed * 10 + i));
    let n = 0;

    for (let passo = 0; passo < 120; passo++) {
      const ap = aparelhos[Math.floor(rand() * aparelhos.length)]!;
      const r = rand();
      if (r < 0.5) await ap.motor.registrar('Teste', { n: ++n });
      else if (r < 0.6) ap.transporte.online = !ap.transporte.online;
      else if (r < 0.7) ap.transporte.perderProximaRespostaDePush = true;
      else await ap.motor.sincronizar().catch(() => undefined); // falhas são esperadas
    }

    // Fim: todos voltam a ficar online e sincronizam duas vezes (a segunda traz o que os outros enviaram).
    for (const ap of aparelhos) {
      ap.transporte.online = true;
      ap.transporte.perderProximaRespostaDePush = false; // desarma falhas injetadas na fase aleatória
    }
    for (const ap of aparelhos) await ap.motor.sincronizar();
    for (const ap of aparelhos) await ap.motor.sincronizar();

    const esperado = servidor.log.map((e) => `${(e.payload as { n: number }).n}`);
    expect(esperado).toHaveLength(n); // nenhum evento perdido
    expect(new Set(esperado).size).toBe(n); // nenhum duplicado
    for (const ap of aparelhos) {
      expect(await ap.motor.estado()).toEqual(esperado); // mesma ordem em todos
      expect(await ap.store.pendentes(1000)).toHaveLength(0);
    }
  });
});
