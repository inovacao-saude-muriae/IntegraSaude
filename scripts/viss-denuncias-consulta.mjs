import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/denuncias-consulta`;
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

const totalReal = (await db.query("SELECT COUNT(*)::int AS t FROM public.ccz_denuncias")).rows[0].t;
const ativas = (
  await db.query("SELECT COUNT(*)::int AS t FROM public.ccz_denuncias WHERE situacao <> 'Arquivada'")
).rows[0].t;
const agressivo = (
  await db.query("SELECT COUNT(*)::int AS t FROM public.ccz_denuncias WHERE tipo = 'AGRESSIVO'")
).rows[0].t;

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
const select = (label) =>
  page.locator(`label:has-text("${label}")`).first().locator("xpath=following::select[1]");

await page.goto("http://localhost:3000/ccz?tab=DENUNCIA_AGRESSIVO", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2400);

passo("1. Abas e ordem (Animal agressivo)");
const abas = await page.locator(".paginaAbas .paginaAba").allInnerTexts();
marcar(`   abas: ${JSON.stringify(abas.map((a) => a.trim()))}`);
marcar(`   aba ativa: ${(await page.locator(".paginaAbas .paginaAbaAtiva").innerText()).trim()}`);
marcar(`   "Lista"/"Novo" ausentes: ${!abas.some((a) => /^(Lista|Novo)$/.test(a.trim()))}`);
marcar(`   formulário de denúncia presente: ${await page.locator('form').filter({ hasText: /Descrição|Relato/i }).count() > 0}`);
await page.screenshot({ path: `${OUT}/1-novo-registro-1440.png` });

passo("2. Aba Consultar Registros e estado inicial");
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(1200);
let txt = await corpo();
marcar(`   "Nenhuma consulta realizada": ${txt.includes("Nenhuma consulta realizada")}`);
marcar(`   lupa (SearchX) presente: ${await page.locator("svg.lucide-search-x, .lucide-search-x").count() > 0}`);
marcar(`   tabela ausente: ${(await page.locator("table").count()) === 0}`);
await page.screenshot({ path: `${OUT}/2-estado-inicial-1440.png` });

passo("3. Filtros do container");
const labels = await page.locator('[class*="_cardFiltros"] label').allInnerTexts();
marcar(`   campos: ${JSON.stringify(labels.map((l) => l.trim()))}`);
const pos = await page.evaluate(() => {
  const card = document.querySelector('[class*="_cardFiltros"]');
  const acoes = card?.querySelector('[class*="_filtrosAcoes"]');
  const botoes = acoes ? [...acoes.querySelectorAll("button")] : [];
  const r = (el) => el.getBoundingClientRect();
  const campos = [...card.querySelectorAll('[class*="_fieldGroup"]')];
  const periodo = card.querySelector('[class*="colDenPeriodo"]');
  const faixa = periodo ? r(periodo) : null;
  return {
    acoesNaFaixaDoPeriodo: faixa
      ? r(acoes).top >= faixa.top - 2 && r(acoes).bottom <= faixa.bottom + 2
      : false,
    acoesNoCantoDireito: Math.round(r(card).right - r(acoes).right) <= 24,
    botoes: botoes.map((b) => b.innerText.trim()),
    alturas: [...new Set(campos.map((c) => Math.round(r(c.querySelector("input,select")).height)))],
  };
});
marcar(`   12. botões na faixa do período: ${pos.acoesNaFaixaDoPeriodo} | no canto direito: ${pos.acoesNoCantoDireito}`);
marcar(`   botões: ${JSON.stringify(pos.botoes)} | alturas dos campos: ${JSON.stringify(pos.alturas)}`);
await page.screenshot({ path: `${OUT}/3-filtros-1440.png` });

passo("4. Filtrar sem critérios (todas as denúncias)");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1800);
txt = await corpo();
marcar(`   resumo: ${(txt.match(/\d+ denúncias? encontradas?/) || ["-"])[0]} | banco: ${totalReal}`);
marcar(`   linhas na tabela: ${await linhas().count()}`);
marcar(`   colunas: ${JSON.stringify((await page.locator("thead th").allInnerTexts()).map((t) => t.trim()))}`);
await page.screenshot({ path: `${OUT}/4-todos-1440.png` });

passo("5. Filtros individuais");
marcar(`   sem filtro "Tipo de Denúncia": ${(await page.locator('label:has-text("Tipo de Denúncia")').count()) === 0}`);
marcar(`   filtro "Causou Risco" presente (agressivo): ${(await page.locator('label:has-text("Causou Risco")').count()) === 1}`);
await select("Causou Risco").selectOption({ label: "Sim" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const riscos = await page.locator("tbody tr td:nth-child(4)").allInnerTexts();
marcar(`   Causou Risco=Sim: ${await linhas().count()} linha(s) | valores: ${JSON.stringify([...new Set(riscos.map((r) => r.trim()))])}`);
await select("Causou Risco").selectOption({ label: "Não" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
marcar(`   Causou Risco=Não: ${await linhas().count()} linha(s) | banco: 3`);
await select("Causou Risco").selectOption({ label: "Todos" });

await select("Bairro").selectOption({ index: 1 });
const bairroSel = await select("Bairro").inputValue();
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const bairros = await page.locator("tbody tr td:nth-child(3)").allInnerTexts();
marcar(`   Bairro="${bairroSel}": ${await linhas().count()} linha(s) | ${JSON.stringify([...new Set(bairros.map((b) => b.trim()))])}`);
await select("Bairro").selectOption({ index: 0 });

await select("Situação da Denúncia").selectOption({ label: "Ativa" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
marcar(`   Situação=Ativa: ${await linhas().count()} linha(s) | banco: ${ativas}`);
await select("Situação da Denúncia").selectOption({ label: "Todas" });

passo("5b. Período da denúncia");
await page.getByLabel("Data inicial da denúncia").fill("2026-10-31");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const datas = (await page.locator("tbody tr td:nth-child(1)").allInnerTexts()).map((d) => d.trim());
const paraData = (d) => d.split("/").reverse().join("-");
marcar(`   a partir de 31/10/2026: ${await linhas().count()} linha(s) | datas: ${JSON.stringify(datas)} | todas >= 31/10: ${datas.every((d) => paraData(d) >= "2026-10-31")}`);
await page.getByLabel("Data inicial da denúncia").fill("");

passo("5c. Busca unificada (ID, animal, descrição e bairro)");
const busca = page.getByPlaceholder("Digite o ID, o animal, a descrição ou o bairro...");
await busca.fill("161/26");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
marcar(`   por ID do animal 161/26: ${await linhas().count()} linha(s)`);
await busca.fill("São Cristovão");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
marcar(`   por bairro "São Cristovão": ${await linhas().count()} linha(s)`);
await busca.fill("");

passo("6. Filtros em conjunto");
await select("Causou Risco").selectOption({ label: "Sim" });
await select("Situação da Denúncia").selectOption({ label: "Ativa" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1600);
marcar(`   Causou Risco=Sim + Ativa: ${await linhas().count()} linha(s)`);
await page.screenshot({ path: `${OUT}/5-filtros-combinados-1440.png` });

passo("7. Limpar filtros volta ao estado inicial");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(900);
txt = await corpo();
marcar(`   estado inicial: ${txt.includes("Nenhuma consulta realizada")} | tabela ausente: ${(await page.locator("table").count()) === 0}`);
const camposLimpos = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_cardFiltros"] input, [class*="_cardFiltros"] select')].map((c) => c.value),
);
marcar(`   campos: ${JSON.stringify(camposLimpos)}`);

passo("8. Linha inteira clicável abre a denúncia completa");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1800);
await linhas().first().click();
await page.waitForTimeout(2000);
const modal = page.locator('[class*="_modalFooter"]').filter({ hasText: /Termo/ }).last().locator("xpath=..");
marcar(`   ficha aberta: ${(await modal.count()) === 1}`);
const txtFicha = (await modal.innerText()).toUpperCase();
for (const bloco of ["Dados Gerais", "Localização", "Relato da Denúncia"]) {
  marcar(`   bloco "${bloco}": ${txtFicha.includes(bloco.toUpperCase())}`);
}
const botoesFicha = (await modal.locator("button").allInnerTexts()).map((t) => t.trim());
marcar(`   botões da ficha: ${JSON.stringify(botoesFicha)}`);
marcar(`   "Gerar Termo" disponível: ${await modal.locator("button", { hasText: /Gerar Termo/ }).count() > 0}`);
await page.screenshot({ path: `${OUT}/6-ficha-1440.png` });
await modal.locator("button", { hasText: /✕/ }).first().click();
await page.waitForTimeout(800);

passo("9. Paginação (100 por página, backend)");
txt = await corpo();
marcar(`   resumo: ${(txt.match(/Página \d+ de \d+ · 100 por página/) || ["-"])[0]}`);
const ordem = (await page.locator("tbody tr td:nth-child(1)").allInnerTexts()).map((d) => d.trim());
const ordenado = ordem.every((d, i) => i === 0 || paraData(ordem[i - 1]) >= paraData(d));
marcar(`   mais recente primeiro: ${ordenado}`);
marcar(`   botão Anterior desabilitado na página 1: ${await page.getByRole("button", { name: /Anterior/ }).isDisabled()}`);

passo("10. Aba Animal doente (sem o filtro Causou Risco)");
await page.goto("http://localhost:3000/ccz?tab=DENUNCIA_DOENTE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
const abasDoente = await page.locator(".paginaAbas .paginaAba").allInnerTexts();
marcar(`   abas: ${JSON.stringify(abasDoente.map((a) => a.trim()))} | ativa: ${(await page.locator(".paginaAbas .paginaAbaAtiva").innerText()).trim()}`);
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(1200);
marcar(`   filtro "Causou Risco" ausente: ${(await page.locator('label:has-text("Causou Risco")').count()) === 0}`);
marcar(`   filtros: ${JSON.stringify((await page.locator('[class*="_cardFiltros"] label').allInnerTexts()).map((l) => l.trim()))}`);
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1600);
txt = await corpo();
marcar(`   consulta: ${(txt.match(/\d+ denúncias? encontradas?/) || ["Nenhum registro encontrado"])[0]}`);

passo("11. Mobile 390px");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1300);
const overflow = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
}));
marcar(`   overflow: ${JSON.stringify(overflow)}`);
await page.screenshot({ path: `${OUT}/7-mobile-390.png`, fullPage: true });

marcar(`\nErros de console/página: ${erros.length}`);
if (erros.length) marcar(erros.slice(0, 5).join("\n"));

await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
await db.end();
await browser.close();
console.log("\nOK — relatório em " + OUT + "/relatorio.txt");
