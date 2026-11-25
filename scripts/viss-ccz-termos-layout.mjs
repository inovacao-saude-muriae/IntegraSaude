// Validação dos termos do CCZ: modelo em branco (Gerenciamento) e termos
// preenchidos em Procedimentos, Esporotricose e Denúncias.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

const out = path.join(process.env.TEMP, "ccz-termos-layout");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const linhas = [];
const log = (t) => { linhas.push(t); console.log(t); };
const ok = (c, m) => log(`${c ? "OK  " : "FALHA"} ${m}`);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
let erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });

const baixar = async (nome) => {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.locator("[role='dialog'] button, button").filter({ hasText: /Baixar PDF|Gerar Termo|Baixar/ }).last().click(),
  ]);
  const arq = path.join(out, `${nome}.pdf`);
  await dl.saveAs(arq);
  const tam = fs.statSync(arq).size;
  ok(tam > 8000, `${nome}: PDF gerado (${Math.round(tam / 1024)} KB)`);
  return arq;
};

// ── 1. Modelos em branco (Gerenciamento > Termos) ──────────────────────────
await page.goto("http://localhost:3000/gerenciamento/termos", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const nomes = ["procedimento", "esporotricose", "denuncia"];
for (const [i, nome] of nomes.entries()) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.locator("table tbody tr").nth(i).locator("button").first().click(),
  ]);
  const arq = path.join(out, `branco-${nome}.pdf`);
  await dl.saveAs(arq);
  const tam = fs.statSync(arq).size;
  ok(tam > 8000, `branco-${nome}: PDF em branco gerado (${Math.round(tam / 1024)} KB)`);
  await page.waitForTimeout(600);
}
await page.screenshot({ path: path.join(out, "gerenciamento-termos-1440.png") });
ok(erros.length === 0, `Gerenciamento > Termos: console limpo (${erros.join(" | ") || "sem erros"})`);
erros = [];

// ── 2. Procedimentos ───────────────────────────────────────────────────────
await page.goto("http://localhost:3000/ccz?tab=PROCEDIMENTOS", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(2200);
// Escolhe o procedimento da Luna (animal COM tutor) para conferir o preenchimento.
const linhasProc = page.locator("table tbody tr");
const total = await linhasProc.count();
let alvo = 0;
for (let i = 0; i < total; i += 1) {
  const txt = await linhasProc.nth(i).innerText();
  if (/Luna/i.test(txt)) { alvo = i; break; }
}
await linhasProc.nth(alvo).click();
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(out, "procedimento-ficha-1440.png") });
await baixar("termo-procedimento");
await page.locator("[class*='_btnFechar'], [class*='_painel'] button[aria-label*='Fechar']").first().click({ force: true }).catch(() => {});
await page.waitForTimeout(800);
ok(erros.length === 0, `Procedimentos: console limpo (${erros.join(" | ") || "sem erros"})`);
erros = [];

// ── 3. Esporotricose ───────────────────────────────────────────────────────
await page.goto("http://localhost:3000/ccz?tab=ESPOROTRICOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(2200);
await page.locator("table tbody tr").first().click();
await page.waitForTimeout(1800);
await baixar("termo-esporotricose");
await page.locator("button").filter({ hasText: /Fechar/ }).last().click({ force: true }).catch(() => {});
await page.waitForTimeout(800);
ok(erros.length === 0, `Esporotricose: console limpo (${erros.join(" | ") || "sem erros"})`);
erros = [];

// ── 4. Denúncias ───────────────────────────────────────────────────────────
await page.goto("http://localhost:3000/ccz?tab=DENUNCIA_AGRESSIVO", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await page.getByRole("button", { name: /Consultar Registros/ }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Filtrar/ }).click();
await page.waitForTimeout(2200);
await page.locator("table tbody tr").first().click();
await page.waitForTimeout(1800);
await page.locator("button").filter({ hasText: /Gerar Termo/ }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, "denuncia-termo-previa-1440.png") });
await baixar("termo-denuncia");
ok(erros.length === 0, `Denúncias: console limpo (${erros.join(" | ") || "sem erros"})`);

fs.writeFileSync(path.join(out, "relatorio.txt"), linhas.join("\n"), "utf8");
await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
await db.end();
await b.close();
