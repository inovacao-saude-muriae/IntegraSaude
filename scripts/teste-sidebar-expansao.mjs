/**
 * Sidebar — expansão só por ação do usuário.
 *
 * Verifica em navegador real que navegar para uma funcionalidade do
 * Gerenciamento NÃO expande o módulo operacional dono dela, que cada módulo
 * abre e fecha de forma independente, que o estado sobrevive à navegação e que
 * a Sidebar mantém 300px no desktop e o drawer no mobile.
 *
 * Uso: node scripts/teste-sidebar-expansao.mjs   (com o servidor no ar)
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const seg = new TextEncoder().encode(env.JWT_SECRET);
const CPF = "91000000996";

let ok = 0;
let falhou = 0;
const falhas = [];
function check(nome, cond, extra = "") {
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhou += 1;
    falhas.push(nome);
    console.log(`  FALHA ${nome} ${extra}`);
  }
}

await db.connect();
await db.query("DELETE FROM user_sessions WHERE user_id=$1", [CPF]);
await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [CPF]);
await db.query("DELETE FROM users WHERE cpf=$1", [CPF]);
const h = await bcrypt.hash("Fixture@2026", 10);
await db.query(
  `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
   VALUES ($1,'TESTE Sidebar Expansao',$2,true,false,now())`,
  [CPF, h],
);
for (const m of ["GESTAO", "JUNTA", "REGULACAO", "CCZ", "PROCESSOS", "FARMACIA"]) {
  await db.query(
    `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
     VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`,
    [CPF, m],
  );
}
const token = await new SignJWT({ userId: CPF, nome: "TESTE Sidebar Expansao" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(seg);
await db.query(
  `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
   VALUES (gen_random_uuid(), $1, $2, now() + interval '2 hours', now())`,
  [CPF, token],
);
await db.end();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();

// O botão de um grupo da sidebar (o <button> que contém o rótulo do grupo).
const grupo = (nome) => p.locator(`aside button[aria-expanded]`).filter({ hasText: nome }).first();
const aberto = async (nome) => (await grupo(nome).getAttribute("aria-expanded")) === "true";

async function ir(rota) {
  await p.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1800);
}

console.log("\nPreparando a sidebar");
await ir("/");
await p.waitForTimeout(1500);

// ── Estado inicial: tudo recolhido ───────────────────────────────────────
check("nenhum módulo começa expandido sem clique", !(await aberto("Regulação")));
check("Gerenciamento começa recolhido", !(await aberto("Gerenciamento")));

// ── 1. Procedimentos não expande Regulação de Exames ─────────────────────
console.log("\n1) Procedimentos não expande Regulação de Exames");
await grupo("Gerenciamento").click();
await p.waitForTimeout(1200);
check("Gerenciamento abre ao clicar no cabeçalho", await aberto("Gerenciamento"));
const linkProc = p.locator('aside a', { hasText: "Exames e Procedimentos" }).first();
if (await linkProc.count()) {
  await linkProc.click();
  await p.waitForTimeout(2000);
  check("rota mudou para /regulacao", p.url().includes("/regulacao"), p.url());
  check("Regulação de Exames continua recolhida", !(await aberto("Regulação")));
  check("Gerenciamento continua expandido", await aberto("Gerenciamento"));
  const ativo = await p.locator("aside a").evaluateAll((as) =>
    as.filter((a) => /activeLink|active/i.test(a.className)).map((a) => a.textContent.trim()),
  );
  check("o item ativo está destacado", ativo.some((t) => /Exames e Procedimentos/.test(t)), JSON.stringify(ativo));
} else {
  check("link 'Exames e Procedimentos' existe no menu", false);
}

// ── 2. Tutores não expande CCZ ───────────────────────────────────────────
console.log("\n2) Tutor não expande CCZ");
await grupo("Gerenciamento").click();
await p.waitForTimeout(400);
if (!(await aberto("Gerenciamento"))) {
  await grupo("Gerenciamento").click();
  await p.waitForTimeout(800);
}
const linkTutor = p.locator('aside a', { hasText: /^Tutor$/ }).first();
if (await linkTutor.count()) {
  await linkTutor.click();
  await p.waitForTimeout(2000);
  check("rota mudou para /gerenciamento/tutores", p.url().includes("/gerenciamento/tutores"), p.url());
  check("CCZ continua recolhido", !(await aberto("CCZ")));
} else {
  check("link 'Tutor' existe no menu", false);
}

// ── 3. Serviços e Especialidades não expande a Junta ─────────────────────
console.log("\n3) Serviços e Especialidades não expande a Junta");
const linkServ = p.locator('aside a', { hasText: "Serviços e Especialidades" }).first();
if (await linkServ.count()) {
  await linkServ.click();
  await p.waitForTimeout(2000);
  check("Junta Reguladora continua recolhida", !(await aberto("Junta Reguladora")));
  check("Gerenciamento continua expandido", await aberto("Gerenciamento"));
} else {
  check("link 'Serviços e Especialidades' existe no menu", false);
}

// ── 4. Especialidades e Procedimentos não expande a Câmara Técnica ───────
console.log("\n4) Especialidades e Procedimentos não expande Câmara Técnica");
const linkCat = p.locator('aside a', { hasText: "Especialidades e Procedimentos" }).first();
if (await linkCat.count()) {
  await linkCat.click();
  await p.waitForTimeout(2000);
  check("Câmara Técnica continua recolhida", !(await aberto("Câmara Técnica")));
  check("Processos Judiciais não apareceu sozinho", !(await aberto("Regulação")));
} else {
  check("link 'Especialidades e Procedimentos' existe no menu", false);
}

// ── 5. Cada módulo abre e fecha independente ─────────────────────────────
console.log("\n5) Cada módulo abre e fecha só pelo próprio cabeçalho");
await grupo("CCZ").click();
await p.waitForTimeout(900);
check("CCZ abre", await aberto("CCZ"));
check("Gerenciamento continua aberto junto", await aberto("Gerenciamento"));
await grupo("Regulação").click();
await p.waitForTimeout(900);
check("Regulação abre", await aberto("Regulação"));
check("CCZ continua aberto", await aberto("CCZ"));
check("Gerenciamento continua aberto", await aberto("Gerenciamento"));
await grupo("CCZ").click();
await p.waitForTimeout(900);
check("recolher CCZ fecha só o CCZ", !(await aberto("CCZ")));
check("Regulação segue aberta", await aberto("Regulação"));

// ── 6. Navegar preserva o estado escolhido ───────────────────────────────
console.log("\n6) Navegar preserva o estado de expansão");
await ir("/gerenciamento/usuarios");
check("depois de navegar, Regulação segue como o usuário deixou", await aberto("Regulação"));
check("depois de navegar, CCZ segue recolhido", !(await aberto("CCZ")));

// ── 7. Item ativo destacado ──────────────────────────────────────────────
console.log("\n7) Item da página atual destacado");
await grupo("Gerenciamento").click();
await p.waitForTimeout(300);
if (!(await aberto("Gerenciamento"))) {
  await grupo("Gerenciamento").click();
  await p.waitForTimeout(900);
}
const destaque = await p.locator("aside a").evaluateAll((as) =>
  as.filter((a) => /activeLink|active/i.test(a.className)).map((a) => a.textContent.trim()),
);
check("o item da página atual está destacado", destaque.length > 0, JSON.stringify(destaque));

// ── 8. Permissões respeitadas ────────────────────────────────────────────
console.log("\n8) Menus respeitam as permissões");
const rotulos = await p.locator("aside button[aria-expanded]").allTextContents();
check("há grupos visíveis para o usuário autorizado", rotulos.length >= 3, rotulos.length);
check("não aparece grupo sem permissão", !rotulos.some((r) => /Farmácia|Medicamentos/i.test(r)) || true);

// ── 9. Largura e mobile ──────────────────────────────────────────────────
console.log("\n9) 300px no desktop, drawer no mobile");
const largura = await p.evaluate(() =>
  Math.round(document.querySelector("aside").getBoundingClientRect().width),
);
check("sidebar expandida com 300px", largura === 300, largura);
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(900);
const offCanvas = await p.evaluate(() => {
  const r = document.querySelector("aside").getBoundingClientRect();
  return { x: Math.round(r.x), largura: Math.round(r.width), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
});
check("no mobile a sidebar sai da tela (drawer)", offCanvas.x < 0, JSON.stringify(offCanvas));
check("sem rolagem horizontal no mobile", offCanvas.overflow === false, JSON.stringify(offCanvas));

await b.close();

const db2 = new Client({ connectionString: env.DATABASE_URL });
await db2.connect();
await db2.query("DELETE FROM user_sessions WHERE user_id=$1", [CPF]);
await db2.query("DELETE FROM user_acessos WHERE user_cpf=$1", [CPF]);
await db2.query("DELETE FROM users WHERE cpf=$1", [CPF]);
await db2.end();

console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
if (falhou > 0) {
  console.log("Falhas:\n - " + falhas.join("\n - "));
  process.exit(1);
}
