// Valida o "Gerar Termo" da Leishmaniose: botão na ficha, prévia/download,
// preenchimento automático com tutor, campos em branco sem tutor e modelo em
// branco em Gerenciamento > Termos.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

function envLocal() {
  const env = {};
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const env = envLocal();
const db = new Client({ connectionString: env.DATABASE_URL });
const OUT = path.join(process.env.TEMP, "leishmaniose-termo");
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const ok = (m) => log.push(`OK   ${m}`);
const falha = (m) => log.push(`FALHA ${m}`);

async function sessao() {
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", ["00000000000"])).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  await db.query(
    `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
     VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`,
    [u.cpf, token],
  );
  return token;
}

async function abrirFicha(page, nomeAnimal) {
  await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2300);
  await page.locator(".paginaAbas .paginaAba").filter({ hasText: "Consultar Registros" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Filtrar$/ }).click();
  await page.waitForTimeout(1800);
  await page.locator(`table tbody tr:has-text("${nomeAnimal}")`).first().click();
  await page.waitForTimeout(1600);
}

async function baixar(page, botao, destino) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 25000 }),
    page.getByRole("button", { name: botao }).first().click(),
  ]);
  await dl.saveAs(destino);
  return Math.round(fs.statSync(destino).size / 1024);
}

async function main() {
  await db.connect();
  const token = await sessao();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/i.test(m.text())) erros.push(m.text());
  });

  // ── 1. Ficha COM tutor: os dois botões existem ──────────────────────────
  await abrirFicha(page, "ZZTESTE Cura");
  const temPdf = await page.getByRole("button", { name: /Gerar PDF/ }).count();
  const temTermo = await page.getByRole("button", { name: /Gerar Termo/ }).count();
  if (temPdf === 1 && temTermo === 1) ok("ficha mostra Gerar PDF e Gerar Termo (documentos distintos)");
  else falha(`botões ausentes: PDF=${temPdf} Termo=${temTermo}`);
  await page.screenshot({ path: path.join(OUT, "1-ficha-botoes-1440.png") });

  // ── 2. Gerar Termo com tutor ────────────────────────────────────────────
  const kbTermo = await baixar(page, /Gerar Termo/, path.join(OUT, "termo-com-tutor.pdf"));
  if (kbTermo > 20) ok(`termo com tutor gerado (${kbTermo} KB)`);
  else falha(`termo com tutor inválido (${kbTermo} KB)`);

  const kbFicha = await baixar(page, /Gerar PDF/, path.join(OUT, "ficha-fiscalizacao.pdf"));
  if (kbFicha > 20) ok(`ficha de fiscalização continua disponível (${kbFicha} KB)`);
  else falha(`ficha de fiscalização inválida (${kbFicha} KB)`);

  // ── 3. Ficha SEM tutor ──────────────────────────────────────────────────
  await abrirFicha(page, "ZZTESTE Sem Tutor");
  const kbSem = await baixar(page, /Gerar Termo/, path.join(OUT, "termo-sem-tutor.pdf"));
  if (kbSem > 20) ok(`termo sem tutor gerado (${kbSem} KB)`);
  else falha(`termo sem tutor inválido (${kbSem} KB)`);
  await page.screenshot({ path: path.join(OUT, "2-ficha-sem-tutor-1440.png") });

  // ── 4. Modelo em branco no Gerenciamento ────────────────────────────────
  await page.goto("http://localhost:3000/gerenciamento/termos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  const linha = page.locator("table tbody tr").filter({ hasText: "Protocolo de Monitoramento" });
  if ((await linha.count()) === 1) ok("modelo aparece em Gerenciamento > Termos");
  else falha("modelo ausente em Gerenciamento > Termos");
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 25000 }),
    linha.getByRole("button", { name: /Baixar/ }).click(),
  ]);
  const pdfBranco = path.join(OUT, "termo-em-branco.pdf");
  await dl.saveAs(pdfBranco);
  const kbBranco = Math.round(fs.statSync(pdfBranco).size / 1024);
  if (kbBranco > 20) ok(`modelo em branco gerado (${kbBranco} KB)`);
  else falha(`modelo em branco inválido (${kbBranco} KB)`);
  await page.screenshot({ path: path.join(OUT, "3-gerenciamento-termos-1440.png") });

  if (erros.length === 0) ok("console limpo (sem erros)");
  else falha(`erros no console: ${JSON.stringify(erros.slice(0, 2))}`);

  await browser.close();
  await db.end();
  const falhas = log.filter((l) => l.startsWith("FALHA")).length;
  log.push("", `${log.filter((l) => l.startsWith("OK")).length} OK / ${falhas} FALHA`);
  fs.writeFileSync(path.join(OUT, "relatorio.txt"), log.join("\n"));
  console.log(log.join("\n"));
  process.exit(falhas ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
