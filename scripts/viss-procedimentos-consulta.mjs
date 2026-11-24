import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/procedimentos-consulta`;
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const passo = (t) => {
  log.push(`\n${t}`);
  console.log(t);
};
const marcar = (t) => {
  log.push(t);
  fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n"));
};

function envLocal() {
  const e = {};
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
    if (m) e[m[1]] = m[2];
  }
  return e;
}

const env = envLocal();
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

// Total real de procedimentos (para conferir "Filtrar sem critérios").
const totalReal = (await db.query("SELECT COUNT(*)::int AS t FROM public.ccz_procedimentos")).rows[0].t;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text());
});
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const corpo = () => page.locator("body").innerText();
const linhas = () => page.locator("tbody tr");
const paraData = (d) => d.trim().split("/").reverse().join("-");

await page.goto("http://localhost:3000/ccz?tab=PROCEDIMENTOS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2400);

passo("1. Abas e ordem");
const abas = await page.locator(".paginaAbas .paginaAba").allInnerTexts();
marcar(`   abas: ${JSON.stringify(abas.map((a) => a.trim()))}`);
marcar(`   aba ativa: ${(await page.locator(".paginaAbas .paginaAbaAtiva").innerText()).trim()}`);
marcar(`   2. "Lista"/"Novo" ausentes: ${!abas.some((a) => /^(Lista|Novo)$/.test(a.trim()))}`);
marcar(`   formulário de procedimento presente: ${await page.locator('form').filter({ hasText: /Tipo de Procedimento|Animal/i }).count() > 0}`);

passo("3. Aba Consultar Registros e estado inicial");
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(1200);
let txt = await corpo();
marcar(`   "Nenhuma consulta realizada": ${txt.includes("Nenhuma consulta realizada")}`);
marcar(`   lupa (SearchX) presente: ${await page.locator("svg.lucide-search-x, .lucide-search-x").count() > 0}`);
marcar(`   tabela ausente: ${(await page.locator("table").count()) === 0}`);
await page.screenshot({ path: `${OUT}/1-estado-inicial-1440.png` });

passo("4. Filtros do container");
const labels = await page.locator('[class*="_cardFiltros"] label').allInnerTexts();
marcar(`   campos: ${JSON.stringify(labels.map((l) => l.trim()))}`);
const pos = await page.evaluate(() => {
  const card = document.querySelector('[class*="_cardFiltros"]');
  const acoes = card?.querySelector('[class*="_filtrosAcoes"]');
  const botoes = acoes ? [...acoes.querySelectorAll("button")] : [];
  const r = (el) => el.getBoundingClientRect();
  const campos = [...card.querySelectorAll('[class*="_fieldGroup"]')];
  // Mesma linha dos campos (padrão Esporotricose): os botões ficam na faixa
  // vertical do período, alinhados ao canto direito do container.
  const periodo = card.querySelector('[class*="colProcPeriodo"]');
  const faixa = periodo ? r(periodo) : null;
  const cardR = r(card);
  return {
    acoesNaFaixaDoPeriodo: faixa
      ? r(acoes).top >= faixa.top - 2 && r(acoes).bottom <= faixa.bottom + 2
      : false,
    acoesNoCantoDireito: Math.round(cardR.right - r(acoes).right) <= 24,
    distanciaDireita: Math.round(r(card).right - r(botoes[botoes.length - 1]).right),
    botoes: botoes.map((b) => b.innerText.trim()),
    alturas: [...new Set(campos.map((c) => Math.round(r(c.querySelector("input,select")).height)))],
  };
});
marcar(`   12. botões na faixa do período: ${pos.acoesNaFaixaDoPeriodo} | no canto direito: ${pos.acoesNoCantoDireito}`);
marcar(`   botões: ${JSON.stringify(pos.botoes)} | alturas dos campos: ${JSON.stringify(pos.alturas)}`);
await page.screenshot({ path: `${OUT}/2-filtros-1440.png` });

passo("7. Filtrar sem critérios");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1800);
txt = await corpo();
marcar(`   resumo: ${(txt.match(/\d+ registros? encontrados?/) || ["-"])[0]} | banco: ${totalReal}`);
marcar(`   linhas na tabela: ${await linhas().count()}`);
marcar(`   colunas: ${JSON.stringify((await page.locator("thead th").allInnerTexts()).map((t) => t.trim()))}`);
marcar(`   badges de situação: ${await page.locator('[class*="_status"]').count()}`);
await page.screenshot({ path: `${OUT}/3-todos-1440.png` });

passo("5. Filtros individuais");
const select = (label) =>
  page.locator(`label:has-text("${label}")`).first().locator("xpath=following::select[1]");
await select("Tipo de Procedimento").selectOption({ label: "Vacinação" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
marcar(`   Tipo=Vacinação: ${await linhas().count()} linha(s)`);
const tiposNaTabela = await page.locator("tbody tr td:nth-child(4)").allInnerTexts();
marcar(`   tipos exibidos: ${JSON.stringify([...new Set(tiposNaTabela.map((t) => t.trim()))])}`);

await select("Tipo de Procedimento").selectOption({ label: "Todos" });
await select("Situação").selectOption({ label: "Realizado" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const statusTabela = await page.locator("tbody tr td:nth-child(5)").allInnerTexts();
marcar(`   Situação=Realizado: ${await linhas().count()} linha(s) | ${JSON.stringify([...new Set(statusTabela.map((t) => t.trim()))])}`);

await select("Situação").selectOption({ label: "Todas" });
const opcoesResp = await select("Responsável").locator("option").allInnerTexts();
marcar(`   responsáveis disponíveis: ${JSON.stringify(opcoesResp.map((o) => o.trim()))}`);
if (opcoesResp.length > 1) {
  await select("Responsável").selectOption({ index: 1 });
  await page.getByRole("button", { name: /Filtrar/ }).click();
  await page.waitForTimeout(1500);
  marcar(`   Responsável="${opcoesResp[1].trim()}": ${await linhas().count()} linha(s)`);
  await select("Responsável").selectOption({ index: 0 });
}

passo("5b. Período do procedimento");
await page.getByLabel("Data inicial do procedimento").fill("2026-10-30");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const datas = await page.locator("tbody tr td:nth-child(1)").allInnerTexts();
marcar(`   a partir de 30/10/2026: ${await linhas().count()} linha(s) | datas: ${JSON.stringify(datas.map((d) => d.trim()))} | todas >= 30/10: ${datas.every((d) => paraData(d) >= "2026-10-30")}`);
await page.getByLabel("Data inicial do procedimento").fill("");

passo("5c. Busca unificada (nome, ID e CPF)");
const busca = page.getByPlaceholder("Digite o nome ou ID do animal, nome ou CPF do tutor...");
await busca.fill("161/26");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const ids = await page.locator("tbody tr td:nth-child(3)").allInnerTexts();
marcar(`   por ID 161/26: ${await linhas().count()} linha(s) | IDs: ${JSON.stringify([...new Set(ids.map((i) => i.trim()))])}`);
await busca.fill("Luna");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
marcar(`   por nome "Luna": ${await linhas().count()} linha(s)`);
await busca.fill("ZZTESTE Pedido Visual");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
marcar(`   por nome do tutor: ${await linhas().count()} linha(s)`);
await busca.fill("02404067028");

passo("6. Filtros em conjunto");
await busca.fill("");
await select("Tipo de Procedimento").selectOption({ label: "Vacinação" });
await select("Situação").selectOption({ label: "Realizado" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1600);
marcar(`   Vacinação + Realizado: ${await linhas().count()} linha(s)`);
await page.screenshot({ path: `${OUT}/4-filtros-combinados-1440.png` });

passo("8. Limpar filtros volta ao estado inicial");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(900);
txt = await corpo();
marcar(`   estado inicial: ${txt.includes("Nenhuma consulta realizada")} | tabela ausente: ${(await page.locator("table").count()) === 0}`);
const camposLimpos = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_cardFiltros"] input, [class*="_cardFiltros"] select')].map((c) => c.value),
);
marcar(`   campos: ${JSON.stringify(camposLimpos)}`);

passo("10. Linha clicável abre todos os dados");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1800);
await linhas().first().click();
await page.waitForTimeout(2000);
const painel = page.locator('[role="dialog"][aria-label="Detalhes do procedimento"]');
marcar(`   painel aberto: ${await painel.count() === 1}`);
const txtPainel = (await painel.innerText()).toUpperCase();
for (const bloco of ["Dados do Procedimento", "Identificação do Animal", "Responsável pelo Animal"]) {
  marcar(`   bloco "${bloco}": ${txtPainel.includes(bloco.toUpperCase())}`);
}
const geometria = await page.evaluate(() => {
  const header = document.querySelector("header");
  const painel = document.querySelector('[role="dialog"][aria-label="Detalhes do procedimento"]');
  const corpo = painel?.querySelector('[class*="_corpoDetalhe"]');
  const topo = painel?.querySelector('[class*="_painelTopo"]');
  const r = (el) => el?.getBoundingClientRect();
  return {
    headerBottom: Math.round(r(header).bottom),
    painelTop: Math.round(r(painel).top),
    topoVisivel: r(topo)?.top >= r(header).bottom - 1,
    corpoRolavel: corpo ? getComputedStyle(corpo).overflowY : "-",
    corpoAltura: Math.round(r(corpo).height),
  };
});
marcar(`   header/painel (sem sobreposição): ${JSON.stringify(geometria)}`);
marcar(`   sem Editar/Excluir no painel: ${!(await painel.locator("button", { hasText: /Editar|Excluir/ }).count())}`);
await page.screenshot({ path: `${OUT}/5-detalhe-1440.png` });
await painel.locator("button", { hasText: /Fechar/ }).click();
await page.waitForTimeout(800);

passo("9. Paginação (100 por página, backend)");
txt = await corpo();
marcar(`   resumo: ${(txt.match(/Página \d+ de \d+ · 100 por página/) || ["-"])[0]}`);
const ordem = await page.locator("tbody tr td:nth-child(1)").allInnerTexts();
const ordenado = ordem.every((d, i) => i === 0 || paraData(ordem[i - 1]) >= paraData(d));
marcar(`   mais recente primeiro: ${ordenado}`);
marcar(`   botão Anterior desabilitado na página 1: ${await page.getByRole("button", { name: /Anterior/ }).isDisabled()}`);

passo("12. Mobile 390px");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1300);
const overflow = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
}));
marcar(`   overflow: ${JSON.stringify(overflow)}`);
await page.screenshot({ path: `${OUT}/6-mobile-390.png`, fullPage: true });

marcar(`\nErros de console/página: ${erros.length}`);
if (erros.length) marcar(erros.slice(0, 5).join("\n"));

await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
await db.end();
await browser.close();
console.log("\nOK — relatório em " + OUT + "/relatorio.txt");
