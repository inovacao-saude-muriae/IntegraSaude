import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = `${process.env.TEMP}/animais-galeria`;
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
const cards = () => page.locator('[class*="_card"]').filter({ has: page.locator('[class*="_cardFoto"]') });

await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);

passo("1. Abas e aba padrão");
log.push(`   abas: ${JSON.stringify((await page.locator(".paginaAbas .paginaAba").allInnerTexts()).map((a) => a.trim()))}`);
log.push(`   aba ativa: ${(await page.locator(".paginaAbas .paginaAbaAtiva").innerText()).trim()}`);
await page.screenshot({ path: `${OUT}/1-novo-registro-1440.png` });

await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(1200);

passo("2. Estado inicial");
let txt = await corpo();
log.push(`   "Nenhuma consulta realizada": ${txt.includes("Nenhuma consulta realizada")}`);
await page.screenshot({ path: `${OUT}/2-estado-inicial-1440.png` });

passo("3. Galeria de cards (Filtrar sem critérios)");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1800);
const total = await cards().count();
log.push(`   cards: ${total}`);
const info = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_cardFoto"]')].map((f) => ({
    temImg: Boolean(f.querySelector("img")),
    objectFit: f.querySelector("img") ? getComputedStyle(f.querySelector("img")).objectFit : null,
    razao: (f.getBoundingClientRect().width / f.getBoundingClientRect().height).toFixed(2),
  })),
);
log.push(`   fotos: ${JSON.stringify(info)}`);
const dados = await page.evaluate(() =>
  [...document.querySelectorAll("button[class*='_card_']")].map((c) => ({
    nome: c.querySelector('[class*="_cardNome"]')?.innerText,
    id: c.querySelector('[class*="_cardId"]')?.innerText,
    tags: [...c.querySelectorAll('[class*="_tag"], [class*="_badge"]')].map((t) => t.innerText),
    tutor: c.querySelector('[class*="_cardTutor"]')?.innerText,
  })),
);
log.push(`   cards: ${JSON.stringify(dados, null, 0)}`);
await page.screenshot({ path: `${OUT}/3-galeria-1440.png` });

passo("4. Filtros Sexo / Porte / Espécie / Situação");
const selects = page.locator("form select");
log.push(`   selects no form: ${await selects.count()}`);
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(600);
await selects.nth(0).selectOption({ label: "Canina" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   Canina: ${await cards().count()}`);
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(600);
await selects.nth(1).selectOption({ label: "Fêmea" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   Fêmea: ${await cards().count()}`);
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(600);
await selects.nth(2).selectOption({ label: "Pequeno" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   Pequeno: ${await cards().count()}`);
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(600);
await selects.nth(3).selectOption({ label: "Adotado" });
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   Adotado: ${await cards().count()}`);

passo("5. Busca por nome / ID");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.waitForTimeout(600);
const busca = page.getByPlaceholder("Digite o nome ou ID do animal, nome ou CPF do tutor...");
await busca.fill("Luna");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   por nome: ${await cards().count()}`);
await busca.fill("161/26");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
log.push(`   por ID: ${await cards().count()}`);

passo("6. Paginação");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1600);
txt = await corpo();
log.push(`   ${txt.split("\n").find((l) => l.includes("Página")) || "-"}`);

passo("7. Clique no card abre a ficha");
await cards().first().click();
await page.waitForTimeout(2200);
txt = await corpo();
log.push(`   "Ficha do Animal": ${txt.includes("Ficha do Animal")}`);
log.push(`   blocos: ${["Identificação do Animal", "Informações do Tutor", "Histórico do Animal"].map((b) => `${b}=${txt.includes(b.toUpperCase()) || txt.includes(b)}`).join(" | ")}`);
log.push(`   botão Editar presente: ${txt.includes("Editar")}`);
log.push(`   botão Gerar PDF presente: ${txt.includes("Gerar PDF")}`);
await page.screenshot({ path: `${OUT}/4-ficha-1440.png` });

passo("8. Tutor correto e histórico");
const campos = await page.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] [class*="_campo_"]')].map((c) => ({
    rotulo: c.querySelector("label")?.innerText,
    valor: c.querySelector('[class*="_campoValor"]')?.innerText,
  })),
);
log.push(`   campos da ficha: ${JSON.stringify(campos)}`);
const hist = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="_itemHistorico"]')].map((i) => i.innerText.replace(/\n/g, " | ")),
);
log.push(`   registros do histórico: ${JSON.stringify(hist)}`);
await page.evaluate(() => {
  const corpo = document.querySelector('[class*="_fichaCorpo"]');
  if (corpo) corpo.scrollTop = corpo.scrollHeight;
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/5-ficha-historico-1440.png` });

passo("9. Detalhe de um registro do histórico");
if (hist.length) {
  await page.locator('[class*="_itemHistorico"]').first().click();
  await page.waitForTimeout(1200);
  txt = await corpo();
  const det = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="_detalheCorpo"] [class*="_campo_"]')].map(
      (c) => `${c.querySelector("label")?.innerText}: ${c.querySelector('[class*="_campoValor"]')?.innerText}`,
    ),
  );
  log.push(`   detalhe aberto: ${det.length} campos`);
  log.push(`   ${JSON.stringify(det)}`);
  await page.screenshot({ path: `${OUT}/6-detalhe-registro-1440.png` });
  await page.locator('[class*="_detalheTopo"] button').click();
  await page.waitForTimeout(600);
}

passo("10. Ficha de animal sem tutor e sem foto");
await page.locator('[class*="_fichaTopo"] [class*="_btnFechar"]').click();
await page.waitForTimeout(900);
await busca.fill("ZZTESTE Animal Raca");
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
await cards().first().click();
await page.waitForTimeout(2000);
txt = await corpo();
log.push(`   aviso sem tutor: ${txt.includes("Animal sem tutor vinculado")}`);
log.push(`   sem foto (imagem padrão): ${txt.includes("SEM FOTO") || txt.includes("Sem foto")}`);
await page.screenshot({ path: `${OUT}/7-ficha-sem-tutor-1440.png` });
await page.locator('[class*="_fichaTopo"] [class*="_btnFechar"]').click();
await page.waitForTimeout(800);

passo("11. Botão Editar leva ao formulário");
await page.getByRole("button", { name: /Limpar filtros/ }).click();
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1500);
await cards().first().click();
await page.waitForTimeout(2000);
await page.getByRole("button", { name: /^Editar$/ }).click();
await page.waitForTimeout(2500);
txt = await corpo();
log.push(`   formulário de edição aberto: ${txt.includes("Editar animal")}`);
await page.screenshot({ path: `${OUT}/8-edicao-1440.png` });
log.push(`   URL após Editar: ${page.url()}`);

passo("12. Mobile 390px (galeria e ficha)");
await page.goto("http://localhost:3000/ccz?tab=ANIMAIS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(1800);
let ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
log.push(`   galeria overflow: ${ov}`);
await page.screenshot({ path: `${OUT}/9-galeria-390.png`, fullPage: true });
await cards().first().click();
await page.waitForTimeout(2500);
ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
log.push(`   ficha overflow: ${ov}`);
await page.screenshot({ path: `${OUT}/10-ficha-390.png` });
await page.evaluate(() => {
  const corpo = document.querySelector('[class*="_fichaCorpo"]');
  if (corpo) corpo.scrollTop = corpo.scrollHeight;
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/11-ficha-390-historico.png` });

log.push(`\nErros de console/página: ${erros.length}`);
if (erros.length) log.push(erros.slice(0, 6).join("\n"));
fs.writeFileSync(`${OUT}/relatorio.txt`, log.join("\n"), "utf8");
console.log(`\nErros de console: ${erros.length}`);
await browser.close();
await db.end();
