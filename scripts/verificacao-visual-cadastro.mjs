/**
 * Navegador real: cadastro de usuário → cartão com a senha temporária →
 * copiar → login com a temporária → troca obrigatória → Início.
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
const NOVO = "91000000906";

async function limpar(cpf) {
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
  await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
}
await limpar(GESTOR); await limpar(NOVO);
const h = await bcrypt.hash("Fixture@2026", 10);
await db.query(
  `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
   VALUES ($1,'TESTE Gestor Cadastro',$2,true,false,now())`, [GESTOR, h]);
await db.query(
  `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
   VALUES ($1,'GESTAO','ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`, [GESTOR]);
const tg = await new SignJWT({ userId: GESTOR, nome: "TESTE Gestor Cadastro" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(segredo);
await db.query(
  `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
   VALUES (gen_random_uuid(),$1,$2,now()+interval '1 hour',now())`, [GESTOR, tg]);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "session_token", value: tg, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });

await page.goto(`${BASE}/gerenciamento/usuarios`, { waitUntil: "networkidle" });
await page.getByRole("tab", { name: "Contas" }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Novo Usuário/ }).click();
await page.waitForTimeout(600);

// Preenche o formulário de cadastro
await page.fill('input[placeholder*="CPF"]', NOVO);
await page.waitForTimeout(2000);
await page.fill('input[placeholder*="nome do operador"]', "TESTE Novo Cadastro");
await page.fill('input[placeholder*="cargo"], input[placeholder*="Regulação"]', "Operador de Teste");
await page.screenshot({ path: `${OUT}/cadastro-1-form.png` });

await page.getByRole("button", { name: /Concluir Cadastro de Usuário/ }).click();
await page.waitForTimeout(700);
// confirmação do cadastro
await page.getByRole("button", { name: /^Cadastrar$/ }).last().click().catch(() => {});

// Cartão de credencial
await page.getByText("Conta criada", { exact: false }).waitFor({ timeout: 20000 });
await page.waitForTimeout(2400); // o formulário fecha sozinho em 2s
await page.getByText("Conta criada", { exact: false }).scrollIntoViewIfNeeded();
const senha = (await page.locator("code").last().innerText()).trim();
const loginTxt = (await page.locator("dl code").first().innerText()).trim();
console.log("cartão exibido | login:", loginTxt, "| senha:", senha.length, "caracteres");
await page.screenshot({ path: `${OUT}/cadastro-2-credencial.png` });

// Copiar senha
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
await page.getByRole("button", { name: "Copiar senha" }).click();
await page.waitForTimeout(500);
const copiado = await page.evaluate(() => navigator.clipboard.readText());
console.log("copiar senha → área de transferência igual?", copiado === senha);
await page.screenshot({ path: `${OUT}/cadastro-3-copiado.png` });

// Copiar credenciais
await page.getByRole("button", { name: "Copiar credenciais" }).click();
await page.waitForTimeout(500);
const cred = await page.evaluate(() => navigator.clipboard.readText());
console.log("copiar credenciais contém login e senha?",
  cred.includes(loginTxt) && cred.includes(senha));

// Nada persistido no navegador
const storage = await page.evaluate(() => ({
  local: JSON.stringify(localStorage), sess: JSON.stringify(sessionStorage),
}));
console.log("senha em localStorage?", storage.local.includes(senha),
  "| em sessionStorage?", storage.sess.includes(senha));

await page.getByRole("button", { name: "Concluir", exact: true }).click();
await page.waitForTimeout(600);
console.log("cartão fechado?", !(await page.getByText("Conta criada", { exact: false }).isVisible().catch(() => false)));

// Login com a temporária
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await ctx2.newPage();
p2.on("pageerror", (e) => erros.push(String(e)));
await p2.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p2.fill('input[name="cpf"]', NOVO);
await p2.fill('input[name="senha"]', senha);
await p2.getByRole("button", { name: /Entrar/ }).click();
await p2.waitForTimeout(3500);
console.log("após o login com a temporária →", p2.url());
await p2.screenshot({ path: `${OUT}/cadastro-4-troca-obrigatoria.png` });

await p2.goto(`${BASE}/regulacao`, { waitUntil: "networkidle" });
console.log("módulo antes da troca →", p2.url());

await p2.goto(`${BASE}/trocar-senha`, { waitUntil: "networkidle" });
const cs = p2.locator('input[type="password"]');
await cs.nth(0).fill(senha);
await cs.nth(1).fill("Nov@Senha2026");
await cs.nth(2).fill("Nov@Senha2026");
await p2.getByRole("button", { name: /Alterar Senha/ }).first().click();
await p2.waitForTimeout(4000);
console.log("após a nova senha →", p2.url());
await p2.screenshot({ path: `${OUT}/cadastro-5-inicio.png` });

await browser.close();
await limpar(GESTOR); await limpar(NOVO);
await db.end();
console.log("erros de página:", erros.length ? erros.join(" | ") : "nenhum");
