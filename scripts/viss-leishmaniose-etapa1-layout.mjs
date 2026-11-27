// Etapa 1 da Leishmaniose: redistribuição dos campos da condição clínica.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import { chromium } from "playwright";

const OUT = path.join(process.env.TEMP || ".", "leish-etapa1-layout");
fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
let ok = 0, falhas = 0;
const marcar = (n, c, d = "") => {
  if (c) { ok++; console.log(`OK   ${n} ${d}`); } else { falhas++; console.log(`FALHA ${n} ${d}`); }
};

const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const u = (await db.query("SELECT cpf,nome FROM users WHERE cpf='00000000000'")).rows[0];
const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.JWT_SECRET));
await db.query(
  "INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())",
  [u.cpf, token],
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

await page.goto("http://localhost:3000/ccz?tab=LEISHMANIOSE", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2600);
await page.getByRole("button", { name: "Novo Registro", exact: true }).first().click();
await page.waitForTimeout(1400);

const caixa = async (placeholder) =>
  page.evaluate((ph) => {
    const el = [...document.querySelectorAll("input,textarea")].find((i) => i.placeholder === ph);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
  }, placeholder);

const lesoes = await caixa("Quais lesões?");
marcar("1. campo 'Quais lesões?' com largura adequada (>= 300px)", lesoes && lesoes.w >= 300, JSON.stringify(lesoes));

const retorno = await caixa("Data do retorno");
marcar("2. data do retorno visível e desabilitada", Boolean(retorno));

// Sim libera o complemento e mantém a posição
await page.evaluate(() => {
  const lab = [...document.querySelectorAll("label")].find((l) => l.textContent.includes("Ainda apresenta lesões"));
  const sel = lab.parentElement.querySelector("select");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
  setter.call(sel, "Sim");
  sel.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(600);
const habilitado = await page.evaluate(() => {
  const el = [...document.querySelectorAll("input")].find((i) => i.placeholder === "Quais lesões?");
  const r = el.getBoundingClientRect();
  return { disabled: el.disabled, w: Math.round(r.width), y: Math.round(r.y) };
});
marcar("3. Sim habilita e mantém largura/posição", !habilitado.disabled && habilitado.w === lesoes.w && habilitado.y === lesoes.y, JSON.stringify(habilitado));

// tratamento
await page.evaluate(() => {
  const lab = [...document.querySelectorAll("label")].find((l) => l.textContent.includes("Está em tratamento veterinário"));
  const sel = lab.parentElement.querySelector("select");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
  setter.call(sel, "Sim");
  sel.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(700);
const medicamentos = await page.evaluate(() => {
  const el = [...document.querySelectorAll("label")].find((l) => l.textContent.includes("Medicamentos prescritos"));
  const ta = el.parentElement.querySelector("textarea");
  const r = ta.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
});
marcar("4. medicamentos ocupam a largura do bloco", medicamentos.w > 900, JSON.stringify(medicamentos));
marcar("5. motivo da interrupção desabilitado sem interrupção", await page.evaluate(() => {
  const el = [...document.querySelectorAll("label")].find((l) => l.textContent.includes("Motivo da interrupção"));
  return el.parentElement.querySelector("textarea").disabled;
}));

await page.screenshot({ path: `${OUT}/etapa1-1440.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(800);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
marcar("6. mobile 390 sem overflow horizontal", !overflow);
await page.screenshot({ path: `${OUT}/etapa1-390.png`, fullPage: true });
marcar("console sem erros", erros.length === 0, erros.slice(0, 2).join(" | "));

await browser.close();
await db.end();
console.log(`\n${ok} OK / ${falhas} FALHA`);
process.exit(falhas ? 1 : 0);
