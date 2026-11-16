/**
 * Validação visual da área única de Gerenciar Usuários.
 * 1440×900 e 390×844: lista, cadastro (etapa 1), etapa 2 e painel de acessos.
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = process.env.OUT_DIR || "C:/Users/Jefinny/AppData/Local/Temp/usuarios-visual";
fs.mkdirSync(OUT, { recursive: true });

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const segredo = new TextEncoder().encode(env.JWT_SECRET);
const GESTOR = "91000000978";
const COMUM = "91000000979";

async function preparar() {
  await db.connect();
  for (const cpf of [GESTOR, COMUM]) {
    await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
    await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
    await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
  }
  const h = await bcrypt.hash("Fixture@2026", 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,'Gestor Visual',$2,true,false,now())`,
    [GESTOR, h],
  );
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,ativo,sexo,data_nascimento,nome_mae,telefone,cns)
     VALUES ($1,'Gestor Visual',true,'MASCULINO','1985-04-12','Mae do Gestor','32999990001','700000000000001')`,
    [GESTOR],
  );
  for (const m of ["GESTAO", "REGULACAO", "JUNTA", "CCZ", "PROCESSOS"]) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`,
      [GESTOR, m],
    );
  }
  // Usuário de exemplo: dois módulos com perfis diferentes.
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,'Maria Aparecida Souza',$2,true,true,now())`,
    [COMUM, h],
  );
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,ativo,sexo,data_nascimento,nome_mae,telefone,cns)
     VALUES ($1,'Maria Aparecida Souza',true,'FEMININO','1990-09-03','Joana Souza','32999990002','700000000000002')`,
    [COMUM],
  );
  for (const [m, p] of [["REGULACAO", "OPERADOR"], ["JUNTA", "SUPERVISOR"]]) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,$3,'ADMIN','TODOS','{}','{}','{}',true)`,
      [COMUM, m, p],
    );
  }
  const token = await new SignJWT({ userId: GESTOR, nome: "Gestor Visual" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
     VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`,
    [GESTOR, token],
  );
  return token;
}

async function main() {
  const token = await preparar();
  const browser = await chromium.launch();
  const larguras = [
    { nome: "1440", width: 1440, height: 900 },
    { nome: "390", width: 390, height: 844 },
  ];

  for (const t of larguras) {
    const ctx = await browser.newContext({
      viewport: { width: t.width, height: t.height },
      deviceScaleFactor: 1,
    });
    await ctx.addCookies([
      { name: "session_token", value: token, domain: "localhost", path: "/" },
    ]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/gerenciamento/usuarios`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/usuarios-lista-${t.nome}.png`, fullPage: true });
    await page.screenshot({ path: `${OUT}/usuarios-lista-${t.nome}-viewport.png` });

    // Cadastro — etapa 1
    await page.getByRole("button", { name: /Novo Usuário/i }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/usuarios-cadastro-1-${t.nome}.png`, fullPage: true });

    // Etapa 2: preenche CPF e nome e avança
    await page.fill('input[placeholder*="11 dígitos"]', "91000000980");
    await page.waitForTimeout(1500);
    const nomeInput = page.locator('input[placeholder*="nome do operador"]');
    if (await nomeInput.count()) {
      await nomeInput.fill("Teste Visual da Silva");
    }
    await page.getByRole("button", { name: /Avançar para acessos/i }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/usuarios-cadastro-2-${t.nome}.png` });
    // Liga um módulo para mostrar a configuração e o resumo preenchidos.
    const mod = page.getByText("Regulação de Exames", { exact: true }).first();
    if (await mod.count()) {
      await mod.click();
      await page.waitForTimeout(1500);
      // O editor tem rolagem própria: a captura é da janela.
      await page.screenshot({ path: `${OUT}/usuarios-cadastro-2b-${t.nome}.png` });
    }

    // Painel de acessos da Maria
    await page.goto(`${BASE}/gerenciamento/usuarios`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const linha = page.locator("tr", { hasText: "Maria Aparecida" });
    if (await linha.count()) {
      await linha.getByRole("button", { name: /Acessos/i }).first().click();
      await page.waitForTimeout(1600);
      // O painel é fixo: a captura é da janela, não da página inteira.
      await page.screenshot({ path: `${OUT}/usuarios-painel-${t.nome}.png` });
    }
    await ctx.close();
    console.log(`capturas ${t.nome}px: ok`);
  }

  await browser.close();

  // Limpeza
  for (const cpf of [GESTOR, COMUM, "91000000980"]) {
    await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
    await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
    await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
  }
  await db.end();
  console.log("Diretório:", OUT);
}

main().catch(async (e) => {
  console.error(e.message);
  try {
    await db.end();
  } catch {}
  process.exitCode = 1;
});
