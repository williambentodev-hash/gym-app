// E2E do fluxo principal (Fase 4): build web servida localmente com COOP/COEP, como o Worker.
// Uso: pnpm e2e:web  (exporta a web, monta os assets, sobe o servidor e roda este script)
// Args: <url> <pasta para screenshots>
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
// Navegador local (Chromium/Edge/Chrome). Defina NAVEGADOR para outro caminho.
const edge = process.env.NAVEGADOR ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
// Na CI (Linux) o Chrome roda sem sandbox de usuário.
const browser = await puppeteer.launch({ executablePath: edge, headless: true, defaultViewport: { width: 420, height: 900 }, args: process.env.CI ? ['--no-sandbox'] : [] });
const page = await browser.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept()); // confirmações (window.confirm)

// IA (ADR-0015): o E2E NÃO chama o modelo (custo e não determinismo). A rota é interceptada e devolve uma
// proposta fixa; o teste cobre prévia + criação via comandos e confere o que o app ENVIARIA à IA.
const CAMPOS_PERFIL = new Set(['objetivo', 'diasPorSemana', 'minutosPorTreino', 'nivel', 'local', 'prioridades', 'limitacoes', 'observacoes']);
let perfilEnviado = null;
const PROPOSTA_FIXA = {
  nome: 'Hipertrofia — Superior/Inferior 4x',
  resumo: 'Divisão superior/inferior repetida duas vezes por semana, com compostos primeiro.',
  treinos: [
    { nome: 'Treino A — Superior', foco: 'Peito, costas e ombros', blocos: [
      { itens: [{ exercicioId: 'pectorals/barbell-bench-press', nome: 'Supino reto com barra', modalidade: 'carga_repeticoes', prescricao: { series: 3, repeticoes: { min: 6, max: 10 }, rir: 2, descansoSeg: 150, tecnica: 'normal' } }] },
      { itens: [
        { exercicioId: 'biceps/barbell-curl', nome: 'Rosca direta com barra', modalidade: 'carga_repeticoes', prescricao: { series: 3, repeticoes: { min: 10, max: 15 }, descansoSeg: 60, tecnica: 'normal' } },
        { exercicioId: 'triceps/cable-pushdown', nome: 'Tríceps pulley (barra)', modalidade: 'carga_repeticoes', prescricao: { series: 3, repeticoes: { min: 10, max: 15 }, descansoSeg: 60, tecnica: 'normal' } },
      ] },
    ] },
    { nome: 'Treino B — Inferior', foco: 'Pernas e core', blocos: [
      { itens: [{ exercicioId: 'glutes/barbell-full-squat', nome: 'Agachamento livre com barra', modalidade: 'carga_repeticoes', prescricao: { series: 4, repeticoes: { min: 6, max: 10 }, descansoSeg: 180, tecnica: 'normal' } }] },
      { itens: [{ exercicioId: 'abs/weighted-front-plank', nome: 'Prancha', modalidade: 'tempo', prescricao: { series: 3, duracaoSeg: 45, descansoSeg: 60, tecnica: 'normal' }, observacao: 'Mantenha a lombar neutra.' }] },
    ] },
  ],
  recomendacoes: ['Suba a carga quando fizer o topo da faixa em todas as séries com RIR ≥ 1.'],
  analise: { volumeSemanal: { peito: { series: 6, status: 'abaixo' }, quadriceps: { series: 8, status: 'abaixo' } }, minutosEstimadosPorTreino: [22, 25], avisos: [] },
};
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().includes('/api/ia/sugerir-ficha')) {
    perfilEnviado = JSON.parse(req.postData() ?? '{}');
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(PROPOSTA_FIXA) });
  }
  return req.continue();
});

const passo = async (nome, fn) => {
  try { await fn(); console.log('✓', nome); }
  catch (e) {
    console.log('✗', nome, '→', String(e).slice(0, 200));
    console.log('  tela:', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 400));
    console.log('  erros:', erros.slice(0, 5));
    await page.screenshot({ path: process.argv[3] + '/falha.png' });
    await browser.close(); process.exit(1);
  }
};
// As abas mantêm telas montadas por trás da atual: o mesmo texto pode existir numa tela invisível.
// Por isso os ajudantes procuram, entre TODAS as ocorrências, a primeira realmente visível (checkVisibility).
const visivel = async (texto, timeout = 15000) => {
  const limite = Date.now() + timeout;
  while (Date.now() < limite) {
    for (const el of await page.$$(`::-p-text(${texto})`)) {
      // Visível E no topo: telas de abas inativas podem estar "visíveis" para o CSS, mas cobertas pela aba atual.
      const noTopo = await el
        .evaluate((e) => {
          if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
          e.scrollIntoView({ block: 'center' });
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const topo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return !!topo && (e.contains(topo) || topo.contains(e));
        })
        .catch(() => false);
      if (noTopo) return el;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`texto visível não encontrado: "${texto}"`);
};
const clicar = async (texto, timeout = 15000) => {
  for (let i = 0; ; i++) {
    try { await (await visivel(texto, timeout)).click(); return; }
    catch (e) { if (i >= 3 || !/detached|not clickable/i.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 300)); }
  }
};
const aba = async (nome) => { const el = await page.waitForSelector('a[role=tab][href="/' + nome.toLowerCase() + '"]', { timeout: 10000 }); await el.click(); };
const ver = (texto, timeout = 15000) => visivel(texto, timeout);

await passo('abre o app (Hoje, sem fichas)', async () => { await page.goto(url, { waitUntil: 'networkidle0' }); await ver('Nenhuma ficha ativa', 30000); });
await passo('vai para Fichas', async () => { await clicar('Criar ficha'); await ver('Nome da ficha', 10000).catch(() => page.waitForSelector('input')); });
await passo('cria ficha', async () => {
  await page.type('input', 'Hipertrofia ABC');
  const botoes = await page.$$('::-p-text(Criar ficha)');
  await botoes[botoes.length - 1].click();
  await ver('Treino A');
});
await passo('abre o catálogo e adiciona Supino reto com barra', async () => {
  await clicar('Adicionar exercício');
  await ver('Supino reto com barra', 30000);
  await clicar('Supino reto com barra');
  await ver('3 × 8–12');
});
await passo('adiciona Crucifixo e forma bi-set', async () => {
  await clicar('Adicionar exercício');
  await page.waitForSelector('input[placeholder="Buscar exercício"]', { visible: true, timeout: 15000 });
  await page.type('input[placeholder="Buscar exercício"]', 'crucifixo reto');
  await clicar('Crucifixo reto com halteres');
  await ver('Crucifixo reto com halteres');
  await clicar('⇄ Bi-set com o próximo');
  await ver('Bi-set');
});
await passo('ativa a ficha', async () => { await clicar('Ativar'); await ver('Ficha ativa'); });
await passo('vai para Hoje e começa o treino', async () => {
  await page.goto(url, { waitUntil: 'networkidle0' });
  await ver('Começar treino', 20000);
  await clicar('Começar treino');
  await ver('Registrar série 1', 20000);
});
await passo('registra série no supino e o bi-set leva ao crucifixo sem descanso', async () => {
  await clicar('Registrar série 1');
  await ver('1/3 ⇄ Supino reto com barra');
  await ver('Registrar série 1'); // já está no crucifixo (no supino seria "série 2")
  const texto = await page.evaluate(() => document.body.innerText);
  if (texto.includes('Descanso')) throw new Error('não deveria descansar no meio do bi-set');
});
await passo('registra série no crucifixo: fim da volta dispara descanso', async () => {
  await clicar('Registrar série 1');
  await ver('Descanso');
  await page.screenshot({ path: process.argv[3] + '/execucao.png' });
});
await passo('conclui o treino', async () => {
  await clicar('Concluir');
  await ver('Treino concluído');
  await clicar('Fechar');
  await ver('Começar treino', 20000);
});
await passo('Progresso mostra histórico e volume', async () => {
  await aba('Progresso');
  await ver('Histórico');
  await ver('Peito');
});
await passo('detalhe do treino a partir do histórico', async () => {
  await clicar('· 2 séries'); // texto exclusivo da linha do histórico ("Treino A" também existe na aba Hoje, montada por trás)
  await ver('Duração');
  await ver('Movidos'); // métricas exclusivas da tela de detalhe
  await page.goBack();
});
await passo('evolução do exercício a partir dos recordes', async () => {
  await aba('Progresso');
  await clicar('Supino reto com barra');
  await ver('1RM estimado por treino');
  await page.screenshot({ path: process.argv[3] + '/evolucao.png' });
  await page.goBack();
});
await passo('IA: gera proposta a partir do perfil e mostra prévia com análise', async () => {
  await aba('Fichas');
  await clicar('Montar com IA');
  await clicar('Gerar ficha com IA');
  await ver('Proposta da especialista');
  await ver('Volume semanal estimado');
  await page.screenshot({ path: process.argv[3] + '/ia-proposta.png' });
});
await passo('IA: o pedido leva só parâmetros de treino (nada de nome/e-mail)', async () => {
  const extras = Object.keys(perfilEnviado ?? {}).filter((k) => !CAMPOS_PERFIL.has(k));
  if (!perfilEnviado || extras.length) throw new Error(`campos inesperados enviados à IA: ${extras.join(', ') || '(nenhum pedido)'}`);
});
await passo('IA: "Criar esta ficha" grava pelos comandos e abre o editor', async () => {
  await clicar('Criar esta ficha');
  await ver('Treino A — Superior');
  await ver('Treino B — Inferior');
  await ver('Bi-set');
});
await passo('dados persistem após recarregar', async () => {
  // O SQLite da web usa OPFS com acesso exclusivo, e o passo anterior acabou de gravar uma ficha inteira.
  // Recarregar com gravações em curso deixava a página nova presa esperando o arquivo (visto só na CI, Linux).
  // Espera a página assentar e passa por about:blank para a página antiga e o worker dela serem descartados.
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 10_000 }).catch(() => undefined);
  await page.goto('about:blank');
  await page.goto(url, { waitUntil: 'networkidle0' }); // recarrega a partir da raiz (a URL atual pode ser um modal)
  await aba('Progresso');
  await ver('Treino A');
});
console.log('erros de página:', erros.length ? erros.slice(0, 5) : 'nenhum');
await page.screenshot({ path: process.argv[3] + '/progresso.png' });
await browser.close();
