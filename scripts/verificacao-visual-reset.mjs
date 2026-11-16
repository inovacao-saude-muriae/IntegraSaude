/**
 * Verificação visual em navegador real (Chromium via Playwright) do fluxo
 * Resetar senha → login com a temporária → troca obrigatória → Início.
 * Não faz parte do build; roda com `node scripts/verificacao-visual-reset.mjs`.
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = process.env.TEMP || process.env.TMPDIR || ".";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const segredo = new TextEncoder().encode(env.JWT_SECRET);
const GESTOR = "91000000901";
const ALVO = "91000000904";

async function limpar(cpf) {
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
  await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
}
async function criar(cpf, nome, acessos, primeiro = false) {
  await limpar(cpf);
  const h = await bcrypt.hash("Antig@12345", 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,$2,$3,true,$4,now())`, [cpf, nome, h, primeiro]);
  for (const a of acessos) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,$3,'ADMIN','TODOS','{}','{}','{}',true)`, [cpf, a.modulo, a.perfil]);
  }
}
const tokenGestor = await new SignJWT({ userId: GESTOR, nome: "TESTE Gestor Reset" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(segredo);
await criar(GESTOR, "TESTE Gestor Reset", [{ modulo: "GESTAO", perfil: "ADMINISTRADOR" }]);
await db.query(
  `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
   VALUES (gen_random_uuid(),$1,$2,now()+interval '1 hour',now())`, [GESTOR, tokenGestor]);
await criar(ALVO, "TESTE Alvo Regulacao", [{ modulo: "REGULACAO", perfil: "OPERADOR" }]);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "session_token", value: tokenGestor, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });

await page.goto(`${BASE}/gerenciamento/usuarios`, { waitUntil: "networkidle" });
// A lista de contas fica na aba "Contas".
await page.getByRole("tab", { name: "Contas" }).click();
await page.waitForTimeout(1200);
console.log("linhas na tabela:", await page.locator("tbody tr").count());
await page.screenshot({ path: `${OUT}/reset-0-abertura.png` });
const linha = page.locator("tr", { hasText: "TESTE Alvo Regulacao" });
await linha.waitFor({ timeout: 20000 });
console.log("linha encontrada na lista");
const btn = linha.getByRole("button", { name: /Resetar senha/ });
console.log("botão visível:", await btn.isVisible(), "| habilitado:", await btn.isEnabled());
await page.screenshot({ path: `${OUT}/reset-1-lista.png` });

// Confirmação
await btn.click();
await page.waitForTimeout(600);
const dialogo = page.getByText("Resetar a senha de", { exact: false });
console.log("modal de confirmação:", await dialogo.isVisible().catch(() => false));
await page.screenshot({ path: `${OUT}/reset-2-confirmacao.png` });
await page.getByRole("button", { name: /^Resetar senha$/ }).last().click();

// Cartão com a senha temporária
await page.getByText("Senha temporária de", { exact: false }).waitFor({ timeout: 20000 });
const senha = (await page.locator("code").first().innerText()).trim();
console.log("senha temporária exibida:", senha.length, "caracteres |", senha);
await page.screenshot({ path: `${OUT}/reset-3-senha-temporaria.png` });

// Login com a temporária em um contexto limpo
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await ctx2.newPage();
p2.on("pageerror", (e) => erros.push(String(e)));
await p2.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p2.fill('input[name="cpf"]', ALVO);
await p2.fill('input[name="senha"]', senha);
await p2.screenshot({ path: `${OUT}/reset-4-login.png` });
await p2.getByRole("button", { name: /Entrar/ }).click();
await p2.waitForTimeout(3500);
console.log("após o login, URL:", p2.url());
await p2.screenshot({ path: `${OUT}/reset-5-troca-obrigatoria.png` });

// Tenta abrir um módulo por URL antes da troca
await p2.goto(`${BASE}/regulacao`, { waitUntil: "networkidle" });
console.log("módulo antes da troca → URL:", p2.url());
await p2.screenshot({ path: `${OUT}/reset-6-modulo-bloqueado.png` });

// Nova senha
await p2.goto(`${BASE}/trocar-senha`, { waitUntil: "networkidle" });
const campos = p2.locator('input[type="password"]');
await campos.nth(0).fill(senha);
await campos.nth(1).fill("Nov@Senha2026");
await campos.nth(2).fill("Nov@Senha2026");
await p2.getByRole("button", { name: /Alterar Senha|Salvar|Trocar/ }).first().click();
await p2.waitForTimeout(4000);
console.log("após a troca, URL:", p2.url());
await p2.screenshot({ path: `${OUT}/reset-7-inicio.png` });

// Nova senha abre a Início e um módulo
await p2.goto(`${BASE}/regulacao`, { waitUntil: "networkidle" });
console.log("módulo com a nova senha → URL:", p2.url());

// Sessão antiga (do gestor) continua válida; a do alvo não existe mais
const sessoesAlvo = (await db.query("SELECT count(*)::int c FROM user_sessions WHERE user_id=$1", [ALVO])).rows[0].c;
console.log("sessões do alvo no banco:", sessoesAlvo);

await browser.close();
for (const cpf of [GESTOR, ALVO]) await limpar(cpf);
await db.end();
console.log("erros de página:", erros.length ? erros.join(" | ") : "nenhum");
