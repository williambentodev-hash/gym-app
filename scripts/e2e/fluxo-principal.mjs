// E2E do fluxo principal (Fase 4): build web servida localmente com COOP/COEP, como o Worker.
// Uso: pnpm e2e:web  (exporta a web, monta os assets, sobe o servidor e roda este script)
// Args: <url> <pasta para screenshots>
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
// Navegador local (Chromium/Edge/Chrome). Defina NAVEGADOR para outro caminho.
const edge = process.env.NAVEGADOR ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({ executablePath: edge, headless: true, defaultViewport: { width: 420, height: 900 } });
const page = await browser.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept()); // confirmações (window.confirm)

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
const clicar = async (texto, timeout = 15000) => {
  for (let i = 0; ; i++) {
    try { const el = await page.waitForSelector(`::-p-text(${texto})`, { timeout, visible: true }); await el.click(); return; }
    catch (e) { if (i >= 3 || !/detached|not clickable/i.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 300)); }
  }
};
const aba = async (nome) => { const el = await page.waitForSelector('a[role=tab][href="/' + nome.toLowerCase() + '"]', { timeout: 10000 }); await el.click(); };
const ver = (texto, timeout = 15000) => page.waitForSelector(`::-p-text(${texto})`, { timeout, visible: true });

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
await passo('dados persistem após recarregar', async () => {
  await page.reload({ waitUntil: 'networkidle0' });
  await aba('Progresso');
  await ver('Treino A');
});
console.log('erros de página:', erros.length ? erros.slice(0, 5) : 'nenhum');
await page.screenshot({ path: process.argv[3] + '/progresso.png' });
await browser.close();
