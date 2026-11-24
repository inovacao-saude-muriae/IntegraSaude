// Validação dos TERMOS do CCZ (Esporotricose, Procedimentos, Denúncias).
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

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

const outDir = path.join(process.env.TEMP, "ccz-termos");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
page.on("pageerror", (e) => erros.push(String(e)));

const linhas = [];
const log = (t) => { linhas.push(t); console.log(t); };

const abrirConsulta = async (rota) => {
  await page.goto("http://localhost:3000" + rota, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /Consultar Registros/ }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Filtrar/ }).click();
  await page.waitForTimeout(1800);
};

const baixar = async (nome, botao) => {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 25000 }),
    page.locator('[role="dialog"] button', { hasText: botao }).first().click(),
  ]);
  const destino = path.join(outDir, nome);
  await dl.saveAs(destino);
  const kb = Math.round(fs.statSync(destino).size / 1024);
  log(`  ${nome} — ${kb} KB`);
  return destino;
};

// ── ESPOROTRICOSE ──────────────────────────────────────────────────────────
log("== ESPOROTRICOSE ==");
await abrirConsulta("/ccz?tab=ESPOROTRICOSE");
await page.locator("tbody tr").first().click();
await page.waitForTimeout(1600);
log("  botões: " + JSON.stringify(await page.locator('[role="dialog"] button').allInnerTexts()));
await baixar("termo-esporotricose.pdf", /Gerar Termo/);

// ── PROCEDIMENTOS ──────────────────────────────────────────────────────────
log("== PROCEDIMENTOS ==");
await abrirConsulta("/ccz?tab=PROCEDIMENTOS");
await page.locator("tbody tr").first().click();
await page.waitForTimeout(1600);
log("  botões: " + JSON.stringify(await page.locator('[role="dialog"] button').allInnerTexts()));
await baixar("termo-procedimento.pdf", /Gerar Termo/);

// ── DENÚNCIAS (ficha da lista, que mantém as ações) ────────────────────────
log("== DENÚNCIAS ==");
await abrirConsulta("/ccz?tab=DENUNCIA_AGRESSIVO");
await page.locator("tbody tr").first().click();
await page.waitForTimeout(1600);
log("  ficha: " + JSON.stringify(await page.locator("[class*='_modalFooter'] button").allInnerTexts()));
await page.locator("[class*='_modalFooter'] button", { hasText: /Gerar Termo/ }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, "1-termo-denuncia-1440.png") });
const [dlD] = await Promise.all([
  page.waitForEvent("download", { timeout: 25000 }),
  page.locator("button", { hasText: /Baixar PDF/ }).last().click(),
]);
await dlD.saveAs(path.join(outDir, "termo-denuncia.pdf"));
log(`  termo-denuncia.pdf — ${Math.round(fs.statSync(path.join(outDir, "termo-denuncia.pdf")).size / 1024)} KB`);

log("erros de console: " + erros.length);
erros.slice(0, 6).forEach((e) => log("  ! " + e));
fs.writeFileSync(path.join(outDir, "relatorio.txt"), linhas.join("\n"), "utf8");
await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
await db.end();
await browser.close();
