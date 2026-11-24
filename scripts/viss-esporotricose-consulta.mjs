import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/esporotricose-consulta`;
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const passo = (t) => {
  log.push(`\n${t}`);
  console.log(t);
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

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text());
});
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const abrirConsulta = async () => {
  await page.goto("http://localhost:3000/ccz?tab=ESPOROTRICOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /Consultar Registros/ }).click();
  await page.waitForTimeout(1200);
};

const corpo = () => page.locator("body").innerText();
const linhas = () => page.locator("tbody tr");

await abrirConsulta();

passo("1. Abas e ordem");
const abas = await page.locator(".paginaAbas .paginaAba").allInnerTexts();
log.push(`   abas: ${JSON.stringify(abas.map((a) => a.trim()))}`);
const ativa = await page.locator(".paginaAbas .paginaAbaAtiva").innerText();
log.push(`   aba ativa após abrir a tela: ${ativa.trim()}`);
await page.getByRole("button", { name: /Novo Registro/ }).click();
await page.waitForTimeout(1000);
log.push(`   Novo Registro ativo por padrão: ${(await page.locator(".paginaAbas .paginaAbaAtiva").innerText()).trim() === "Novo Registro"}`);
log.push(`   formulário preservado (etapas): ${(await corpo()).includes("IDENTIFICAÇÃO")}`);
const etapas = await page.locator('[class*="_wizardStep"]').allInnerTexts();
log.push(`   etapas do cadastro: ${JSON.stringify(etapas.map((e) => e.replace(/\s+/g, " ").trim()))}`);
await page.screenshot({ path: `${OUT}/1-novo-registro-1440.png` });

await abrirConsulta();
passo("2. Estado inicial com lupa");
let txt = await corpo();
log.push(`   "Nenhuma consulta realizada": ${txt.includes("Nenhuma consulta realizada")}`);
log.push(`   descrição: ${txt.includes("Selecione os filtros ou clique em Filtrar para consultar todos os registros.")}`);
log.push(`   tabela ausente: ${(await linhas().count()) === 0}`);
await page.screenshot({ path: `${OUT}/2-estado-inicial-1440.png` });

passo("3. Filtrar sem critérios (todos)");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1600);
txt = await corpo();
log.push(`   resumo: ${txt.split("\n").find((l) => l.includes("registro")) || "-"}`);
log.push(`   linhas na tabela: ${await linhas().count()}`);
log.push(`   cabeçalhos: ${JSON.stringify(await page.locator("thead th").allInnerTexts())}`);
await page.screenshot({ path: `${OUT}/3-todos-1440.png` });

passo("4. Filtro de conclusão (Encerrado)");
await page.locator("select").filter({ hasText: "Todas" }).first().selectOption({ label: "Encerrado" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const encerrados = await linhas().count();
log.push(`   linhas com Encerrado: ${encerrados}`);
const conclusoes = await page.locator("tbody tr td:last-child").allInnerTexts();
log.push(`   coluna conclusão: ${JSON.stringify(conclusoes)}`);

passo("5. Filtro de conclusão (Em andamento) + período");
await page.locator("select").filter({ hasText: "Todas" }).first().selectOption({ label: "Em andamento" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   linhas em andamento: ${await linhas().count()}`);

await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(900);
txt = await corpo();
log.push(`   após limpar: estado inicial = ${txt.includes("Nenhuma consulta realizada")} | linhas = ${await linhas().count()}`);

passo("6. Busca por nome do animal");
await page.getByPlaceholder("Digite o nome ou ID do animal, nome ou CPF do tutor...").fill("ZZTESTE Esporto 161");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
txt = await corpo();
log.push(`   linhas: ${await linhas().count()} | contém o animal: ${txt.includes("ZZTESTE Esporto 161/26")}`);

passo("7. Busca por ID CCZ e por CPF do tutor");
await page.getByPlaceholder("Digite o nome ou ID do animal, nome ou CPF do tutor...").fill("161/26");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   por ID: ${await linhas().count()} linha(s)`);
await page.getByPlaceholder("Digite o nome ou ID do animal, nome ou CPF do tutor...").fill("02404067028");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   por CPF: ${await linhas().count()} linha(s)`);
await page.screenshot({ path: `${OUT}/4-busca-cpf-1440.png` });

passo("8. Filtro por período (data da visita)");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(700);
await page.getByLabel("Data inicial do registro").fill("2026-11-01");
await page.getByLabel("Data final do registro").fill("2026-11-04");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   linhas no período 01–04/11: ${await linhas().count()}`);

passo("9. Filtro por bairro");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(700);
const selectBairro = page.locator("select").filter({ hasText: "Todos" }).last();
log.push(`   opções de bairro: ${JSON.stringify(await selectBairro.locator("option").allInnerTexts())}`);
await selectBairro.selectOption({ label: "São Cristovão" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   linhas no bairro São Cristovão: ${await linhas().count()}`);

passo("9b. Filtros combinados (bairro + conclusão + período)");
await page.locator("select").filter({ hasText: "Todas" }).first().selectOption({ label: "Em andamento" });
await page.getByLabel("Data inicial do registro").fill("2026-10-01");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   linhas combinadas: ${await linhas().count()}`);

passo("10. Linha clicável abre a visualização completa");
await page.locator("tbody tr").first().click();
await page.waitForTimeout(1800);
txt = await corpo();
log.push(`   painel aberto: ${txt.includes("Registro de Esporotricose")}`);
const secoes = ["INFORMAÇÕES DA VISITA", "IDENTIFICAÇÃO DO ANIMAL", "CONDIÇÃO CLÍNICA", "CONCLUSÃO DA EQUIPE TÉCNICA"];
log.push(`   seções presentes: ${secoes.map((x) => `${x}=${txt.includes(x)}`).join(" | ")}`);
const rolagem = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-label^="Detalhes"]');
  if (!d) return null;
  const corpo = d.querySelector('[class*="corpoDetalhe"]');
  return {
    painel: { scrollH: d.scrollHeight, clientH: d.clientHeight },
    corpo: corpo ? { scrollH: corpo.scrollHeight, clientH: corpo.clientHeight, overflowY: getComputedStyle(corpo).overflowY } : null,
  };
});
log.push(`   painel de detalhe: ${JSON.stringify(rolagem)}`);
log.push(`   sem botões de editar/excluir na tabela: ${!(await page.locator("tbody button").count())}`);
await page.screenshot({ path: `${OUT}/5-detalhe-1440.png` });
await page.getByRole("button", { name: /Fechar/ }).last().click();
await page.waitForTimeout(600);

passo("11. Paginação de 100 no backend");
const total = Number((await db.query('SELECT COUNT(*)::int AS t FROM ccz_esporotricose')).rows[0].t);
log.push(`   total no banco: ${total}`);
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
txt = await corpo();
log.push(`   resumo da consulta: ${txt.split("\n").find((l) => l.includes("Página")) || "-"}`);

passo("12. Mobile 390px");
await page.getByRole("button", { name: /Limpar filtros/ }).click().catch(() => {});
await page.waitForTimeout(500);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
const overflow = await page.evaluate(() => {
  const largura = window.innerWidth;
  const culpados = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > largura + 1) {
      culpados.push(`${el.tagName}.${(el.className || "").toString().split(" ")[0]} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
    }
  });
  return { overflow: document.documentElement.scrollWidth > largura + 1, largura, scrollWidth: document.documentElement.scrollWidth, culpados: culpados.slice(0, 8) };
});
log.push(`   overflow horizontal: ${JSON.stringify(overflow)}`);
await page.screenshot({ path: `${OUT}/6-mobile-390.png`, fullPage: true });

log.push(`\nErros de console/página: ${erros.length}`);
if (erros.length) log.push(erros.slice(0, 5).join("\n"));
fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n"), "utf8");
console.log(`\nErros de console: ${erros.length}`);
await browser.close();
await db.end();
