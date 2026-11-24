import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/animais-ccz`;
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

const corpo = () => page.locator("body").innerText();
const linhas = () => page.locator("[class*=\"_galeria\"] > button");

await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);

passo("1. Abas e ordem");
const abas = await page.locator(".paginaAbas .paginaAba").allInnerTexts();
log.push(`   abas: ${JSON.stringify(abas.map((a) => a.trim()))}`);
log.push(`   aba ativa: ${(await page.locator(".paginaAbas .paginaAbaAtiva").innerText()).trim()}`);
log.push(`   formulário de cadastro presente: ${(await corpo()).includes("IDENTIFICAÇÃO")}`);
await page.screenshot({ path: `${OUT}/1-novo-registro-1440.png` });

await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(1200);

passo("2. Estado inicial com lupa");
let txt = await corpo();
log.push(`   "Nenhuma consulta realizada": ${txt.includes("Nenhuma consulta realizada")}`);
log.push(`   tabela ausente: ${(await linhas().count()) === 0}`);
await page.screenshot({ path: `${OUT}/2-estado-inicial-1440.png` });

passo("3. Filtrar sem critérios (todos)");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1600);
txt = await corpo();
log.push(`   resumo: ${txt.split("\n").find((l) => l.includes("registro")) || "-"}`);
log.push(`   linhas: ${await linhas().count()}`);
log.push(`   cabeçalhos: ${JSON.stringify(await page.locator("thead th").allInnerTexts())}`);
await page.screenshot({ path: `${OUT}/3-todos-1440.png` });

passo("4. Badges de situação (cores originais da Lista)");
const badges = await page.evaluate(() =>
  [...document.querySelectorAll("tbody tr td:last-child span")].map((s) => {
    const cs = getComputedStyle(s);
    return { texto: s.innerText, bg: cs.backgroundColor, cor: cs.color, borda: cs.borderColor };
  }),
);
log.push(`   badges: ${JSON.stringify(badges)}`);

passo("5. Filtro por espécie (Felina)");
await page.locator("select").filter({ hasText: "Todas" }).first().selectOption({ label: "Felina" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   linhas Felina: ${await linhas().count()}`);

passo("6. Filtro por situação (Devolvido)");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(700);
await page.locator("select").nth(3).selectOption({ label: "Devolvido" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
txt = await corpo();
log.push(`   linhas Devolvido: ${await linhas().count()} | badges: ${(txt.match(/Devolvido/g) || []).length}`);

passo("7. Filtro sem tutor");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(700);
await page.locator("select").nth(3).selectOption({ label: "Sem tutor" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   linhas sem tutor: ${await linhas().count()}`);

passo("8. Busca por nome, ID e CPF do tutor");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(700);
const busca = page.getByPlaceholder("Digite o nome ou ID do animal, nome ou CPF do tutor...");
await busca.fill("ZZTESTE Rex");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   por nome: ${await linhas().count()}`);
await busca.fill("ANM-MW0VGH4F");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
const colIds = await page.locator('[class*="_galeria"] [class*="_card"] [class*="_cardId"]').allInnerTexts();
log.push(`   por ID: ${await linhas().count()} | IDs: ${JSON.stringify(colIds)}`);
await busca.fill("12545934623");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   por CPF do tutor: ${await linhas().count()}`);

passo("9. Bairro e período do cadastro");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(700);
const selectBairro = page.locator("select").nth(4);
log.push(`   opções de bairro: ${JSON.stringify(await selectBairro.locator("option").allInnerTexts())}`);
await selectBairro.selectOption({ label: "São Cristovão" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   linhas no bairro: ${await linhas().count()}`);
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(600);
await page.getByLabel("Data inicial do cadastro").fill("2026-11-20");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   linhas a partir de 20/11: ${await linhas().count()}`);

passo("10. Card clicável abre a ficha completa");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1800);
await page.locator('[class*="_galeria"] > button').first().click();
await page.waitForTimeout(2200);
txt = await corpo();
log.push(`   ficha aberta: ${txt.includes("Ficha do Animal")}`);
log.push(`   histórico presente: ${txt.includes("HISTÓRICO DO ANIMAL") || txt.toLowerCase().includes("histórico do animal")}`);
log.push(`   cards são botões (sem ações extras): ${(await page.locator('[class*="_galeria"] > button').first().evaluate((e) => e.tagName)) === "BUTTON"}`);
await page.screenshot({ path: `${OUT}/4-ficha-1440.png` });
await page.locator('[class*="_fichaTopoAcoes"] button').last().click();
await page.waitForTimeout(900);

passo("11. Paginação no backend");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
txt = await corpo();
log.push(`   resumo: ${txt.split("\n").find((l) => l.includes("Página")) || "-"}`);

passo("12. Mobile 390px");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
const overflow = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
}));
log.push(`   overflow: ${JSON.stringify(overflow)}`);
await page.screenshot({ path: `${OUT}/5-mobile-390.png`, fullPage: true });

log.push(`\nErros de console/página: ${erros.length}`);
if (erros.length) log.push(erros.slice(0, 5).join("\n"));
fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n"), "utf8");
console.log(`\nErros de console: ${erros.length}`);
await browser.close();
await db.end();
