import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const seg = new TextEncoder().encode(env.JWT_SECRET);
const G = "91000000994";
const SAIDA = "C:/Users/Jefinny/AppData/Local/Temp/escopo-visual";
fs.mkdirSync(SAIDA, { recursive: true });

await db.connect();
await db.query("DELETE FROM user_sessions WHERE user_id=$1", [G]);
await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [G]);
await db.query("DELETE FROM users WHERE cpf=$1", [G]);
const h = await bcrypt.hash("Fixture@2026", 10);
await db.query(
  `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
   VALUES ($1,'TESTE Visual Escopo',$2,true,false,now())`, [G, h]);
for (const m of ["GESTAO", "JUNTA", "REGULACAO", "CCZ"]) {
  await db.query(
    `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
     VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`, [G, m]);
}
// serviço de demonstração para mostrar inativo na lista
await db.query("DELETE FROM junta_servicos WHERE nome='SERVICO DEMO INATIVO'");
const demo = (await db.query(
  "INSERT INTO junta_servicos (nome, ativo, created_at) VALUES ('SERVICO DEMO INATIVO', false, now()) RETURNING id"
)).rows[0];
const token = await new SignJWT({ userId: G, nome: "TESTE Visual Escopo" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(seg);
await db.query(
  `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
   VALUES (gen_random_uuid(), $1, $2, now() + interval '2 hours', now())`, [G, token]);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();
const url = `${BASE}/gerenciamento/usuarios`;

async function abrirAcessos() {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  const btn = p.locator('button:has-text("Acessos")').first();
  await btn.click();
  await p.waitForTimeout(2000);
}

await abrirAcessos();
await p.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 20000 });
await p.waitForTimeout(1200);
// A lista de módulos fica no painel lateral do modal: usa os botões do bloco.
const botaoModulo = (nome) =>
  p.locator('[role="dialog"] button').filter({ hasText: nome }).first();
// Módulo Regulação: não deve haver "Escopo de acesso"
await botaoModulo("Regulação").click();
await p.waitForTimeout(1200);
const temEscopoRegulacao = await p.locator("text=Escopo de acesso").count();
await p.screenshot({ path: `${SAIDA}/01-regulacao-sem-escopo-1440.png`, fullPage: false });

// Módulo Junta: deve haver "Escopo de acesso" + serviços do banco
await botaoModulo("Junta Reguladora").click();
await p.waitForTimeout(1200);
const temEscopoJunta = await p.locator("text=Escopo de acesso").count();
await p.screenshot({ path: `${SAIDA}/02-junta-com-escopo-1440.png`, fullPage: false });

// Escopo Serviços específicos: mostra os serviços cadastrados
await p.locator('label:has-text("Serviços específicos")').first().click();
await p.waitForTimeout(1200);
const botoes = await p.locator('button:has-text("inativo"), button').allTextContents();
const nomes = botoes.filter((t) => /CAEE|DEMO/i.test(t));
await p.screenshot({ path: `${SAIDA}/03-junta-especificos-1440.png`, fullPage: false });

// mobile
await p.setViewportSize({ width: 390, height: 900 });
await p.waitForTimeout(800);
await p.screenshot({ path: `${SAIDA}/04-mobile-390.png`, fullPage: false });

console.log(JSON.stringify({
  escopoOcultoNaRegulacao: temEscopoRegulacao === 0,
  escopoVisivelNaJunta: temEscopoJunta > 0,
  servicosNoSeletor: nomes,
}, null, 1));

await b.close();
await db.query("DELETE FROM junta_servicos WHERE id=$1", [demo.id]);
await db.query("DELETE FROM user_sessions WHERE user_id=$1", [G]);
await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [G]);
await db.query("DELETE FROM users WHERE cpf=$1", [G]);
await db.end();
