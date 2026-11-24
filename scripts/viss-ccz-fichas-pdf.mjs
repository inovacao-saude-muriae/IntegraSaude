// Validação visual das fichas e dos PDFs do CCZ.
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

const outDir = path.join(process.env.TEMP, "ccz-fichas-pdf");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text());
});
page.on("pageerror", (e) => erros.push(String(e)));

const linhas = [];
const log = (t) => {
  linhas.push(t);
  console.log(t);
};

const medirModal = () =>
  page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const header = document.querySelector("header");
    const hr = header ? header.getBoundingClientRect() : null;
    const corpo = el.querySelector('[class*="corpoDetalhe"]');
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      altura: Math.round(r.height),
      headerBottom: hr ? Math.round(hr.bottom) : null,
      sobrepoeHeader: hr ? r.top < hr.bottom - 1 : false,
      dentroDaTela: r.bottom <= window.innerHeight + 1,
      rolagemInterna: corpo
        ? { clientHeight: corpo.clientHeight, scrollHeight: corpo.scrollHeight }
        : null,
    };
  });

const baixar = async (nome) => {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.locator('[role="dialog"] button', { hasText: /Gerar PDF/ }).first().click(),
  ]);
  const destino = path.join(outDir, nome);
  await dl.saveAs(destino);
  const tamanho = fs.statSync(destino).size;
  log(`PDF ${nome} — ${Math.round(tamanho / 1024)} KB`);
  return destino;
};

const abrirConsulta = async (rota) => {
  await page.goto("http://localhost:3000" + rota, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /Consultar Registros/ }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Filtrar/ }).click();
  await page.waitForTimeout(1800);
};

// ── 1. ANIMAIS ─────────────────────────────────────────────────────────────
log("== ANIMAIS ==");
await abrirConsulta("/ccz?tab=ANIMAIS");
const cardsAnimais = page.locator('[class*="_cardAnimal"], [class*="_card"]');
await page.screenshot({ path: path.join(outDir, "1-animais-galeria-1440.png") });
await page.locator('[class*="_cardAnimal"]').first().click().catch(async () => {
  await page.locator("button[class*='_card']").first().click();
});
await page.waitForTimeout(1800);
let m = await medirModal();
log("ficha animal: " + JSON.stringify(m));
await page.screenshot({ path: path.join(outDir, "2-ficha-animal-1440.png") });
await baixar("ficha-animal.pdf");

// ── 2. PROCEDIMENTOS ───────────────────────────────────────────────────────
log("== PROCEDIMENTOS ==");
await abrirConsulta("/ccz?tab=PROCEDIMENTOS");
await page.locator("tbody tr").first().click();
await page.waitForTimeout(1800);
m = await medirModal();
log("detalhe procedimento: " + JSON.stringify(m));
await page.screenshot({ path: path.join(outDir, "3-detalhe-procedimento-1440.png") });
await baixar("ficha-procedimento.pdf");

// ── 3. ESPOROTRICOSE ───────────────────────────────────────────────────────
log("== ESPOROTRICOSE ==");
await abrirConsulta("/ccz?tab=ESPOROTRICOSE");
await page.locator("tbody tr").first().click();
await page.waitForTimeout(1800);
m = await medirModal();
log("detalhe esporotricose: " + JSON.stringify(m));
await page.screenshot({ path: path.join(outDir, "4-detalhe-esporotricose-1440.png") });
await baixar("ficha-esporotricose.pdf");

// ── 4. LEISHMANIOSE ────────────────────────────────────────────────────────
log("== LEISHMANIOSE ==");
await abrirConsulta("/ccz?tab=LEISHMANIOSE");
await page.locator("tbody tr").first().click();
await page.waitForTimeout(1800);
m = await medirModal();
log("detalhe leishmaniose: " + JSON.stringify(m));
await page.screenshot({ path: path.join(outDir, "5-detalhe-leishmaniose-1440.png") });
await baixar("ficha-leishmaniose.pdf");

// ── 5. MOBILE ──────────────────────────────────────────────────────────────
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
m = await medirModal();
log("leishmaniose 390px: " + JSON.stringify(m));
await page.screenshot({ path: path.join(outDir, "6-detalhe-390.png") });

log("erros de console: " + erros.length);
erros.slice(0, 8).forEach((e) => log("  ! " + e));

fs.writeFileSync(path.join(outDir, "relatorio.txt"), linhas.join("\n"), "utf8");
await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
await db.end();
await browser.close();
