/**
 * Validação visual das três telas de cadastro + Sidebar.
 * 1920 / 1440 / 1366 / 1024 / 768 / 390 px.
 * Mede a Sidebar com getBoundingClientRect (expandida e recolhida).
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = process.env.OUT_DIR || "C:/Users/Jefinny/AppData/Local/Temp/cadastros-visual";
fs.mkdirSync(OUT, { recursive: true });

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const segredo = new TextEncoder().encode(env.JWT_SECRET);
const GESTOR = "91000000982";

const ROTAS = [
  ["regulacao-procedimentos", "/regulacao?tab=PROCEDIMENTOS"],
  ["junta-servicos", "/junta-reguladora?tab=SERVICOS_ESPECIALIDADES"],
  ["processos-catalogo", "/gerenciamento/especialidades-procedimentos"],
];
const LARGURAS = [1920, 1440, 1366, 1024, 768, 390];

async function preparar() {
  await db.connect();
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
  await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);
  const h = await bcrypt.hash("Fixture@2026", 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,'Validacao Visual',$2,true,false,now())`, [GESTOR, h]);
  for (const m of ["GESTAO", "REGULACAO", "JUNTA", "PROCESSOS", "CCZ"]) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`, [GESTOR, m]);
  }
  const token = await new SignJWT({ userId: GESTOR, nome: "Validacao" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
     VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`, [GESTOR, token]);
  return token;
}

const medir = (page) =>
  page.evaluate(() => {
    const sb = document.querySelector("aside");
    const hd = document.querySelector("header");
    const mn = document.querySelector("main");
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const doc = document.documentElement;
    return {
      sidebar: r(sb)?.width ?? null,
      sidebarX: r(sb)?.x ?? null,
      headerX: r(hd)?.x ?? null,
      headerW: r(hd)?.width ?? null,
      mainX: r(mn)?.x ?? null,
      mainW: r(mn)?.width ?? null,
      overflowX: doc.scrollWidth > doc.clientWidth + 1,
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
    };
  });

async function main() {
  const token = await preparar();
  const browser = await chromium.launch();
  const linhas = [];

  for (const w of LARGURAS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();

    for (const [nome, rota] of ROTAS) {
      await page.goto(`${BASE}${rota}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(1300);
      const m = await medir(page);
      linhas.push({ w, nome, ...m });
      await page.screenshot({ path: `${OUT}/${nome}-${w}.png`, fullPage: w <= 768 });
    }

    // Sidebar recolhida (só em desktop, onde o botão existe)
    if (w > 768) {
      await page.goto(`${BASE}${ROTAS[0][1]}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(900);
      const botao = page.getByRole("button", { name: /Recolher menu/i });
      if (await botao.count()) {
        await botao.first().click();
        await page.waitForTimeout(700);
        const recolhida = await medir(page);
        linhas.push({ w, nome: "sidebar-recolhida", ...recolhida });
        await page.screenshot({ path: `${OUT}/sidebar-recolhida-${w}.png` });
      }
    }
    await ctx.close();
  }

  await browser.close();

  console.log("\nLARGURA | TELA                    | sidebar | headerX | mainX | mainW | overflow");
  for (const l of linhas) {
    console.log(
      `${String(l.w).padStart(7)} | ${l.nome.padEnd(23)} | ${String(l.sidebar && Math.round(l.sidebar)).padStart(7)} | ${String(l.headerX && Math.round(l.headerX)).padStart(7)} | ${String(l.mainX && Math.round(l.mainX)).padStart(5)} | ${String(l.mainW && Math.round(l.mainW)).padStart(5)} | ${l.overflowX ? "SIM" : "não"}`,
    );
  }

  const desktop = linhas.filter((l) => l.w > 768 && l.nome !== "sidebar-recolhida");
  const ok300 = desktop.every((l) => Math.round(l.sidebar) === 300);
  const alinhado = desktop.every((l) => Math.round(l.headerX) === 300 && Math.round(l.mainX) === 300);
  const recolhidas = linhas.filter((l) => l.nome === "sidebar-recolhida");
  const okRecolhida = recolhidas.every((l) => Math.round(l.sidebar) === 76);
  const semOverflow = linhas.every((l) => !l.overflowX);

  console.log(`\nSidebar 300px em desktop: ${ok300 ? "OK" : "FALHA"}`);
  console.log(`Header/main alinhados em 300px: ${alinhado ? "OK" : "FALHA"}`);
  console.log(`Sidebar recolhida 76px: ${okRecolhida ? "OK" : "FALHA"}`);
  console.log(`Sem rolagem horizontal: ${semOverflow ? "OK" : "FALHA"}`);
  console.log("Capturas:", OUT);

  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
  await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);
  await db.end();
  if (!(ok300 && alinhado && okRecolhida && semOverflow)) process.exitCode = 1;
}
main().catch(async (e) => { console.error(e.message); try { await db.end(); } catch {} process.exitCode = 1; });
