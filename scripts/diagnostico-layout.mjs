/** Diagnóstico de layout: Sidebar, Header, main e containers das 3 telas. */
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
const segredo = new TextEncoder().encode(env.JWT_SECRET);
const GESTOR = "91000000981";

async function preparar() {
  await db.connect();
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
  await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);
  const h = await bcrypt.hash("Fixture@2026", 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,'Diagnostico Layout',$2,true,false,now())`, [GESTOR, h]);
  for (const m of ["GESTAO", "REGULACAO", "JUNTA", "PROCESSOS", "CCZ"]) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`, [GESTOR, m]);
  }
  const token = await new SignJWT({ userId: GESTOR, nome: "Diagnostico" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
     VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`, [GESTOR, token]);
  return token;
}

const ROTAS = [
  ["regulacao", "/regulacao?tab=PROCEDIMENTOS"],
  ["junta", "/junta-reguladora?tab=SERVICOS"],
  ["processos", "/gerenciamento/especialidades-procedimentos"],
];

async function main() {
  const token = await preparar();
  const browser = await chromium.launch();
  for (const w of [1920, 1440, 1366, 1024, 768, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    for (const [nome, rota] of ROTAS) {
      await page.goto(`${BASE}${rota}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(1200);
      const info = await page.evaluate(() => {
        const g = (sel) => document.querySelector(sel);
        const rect = (el) => (el ? el.getBoundingClientRect() : null);
        const sb = g("aside") || g('[class*="sidebar"]');
        const hd = g("header");
        const mn = g("main");
        const doc = document.documentElement;
        const out = {
          sidebar: rect(sb),
          header: rect(hd),
          main: rect(mn),
          scrollW: doc.scrollWidth,
          clientW: doc.clientWidth,
          overflowX: doc.scrollWidth > doc.clientWidth + 1,
        };
        // container de conteúdo da página
        const cont = mn ? mn.querySelector("div") : null;
        out.container = rect(cont);
        // Quem estoura a largura da página?
        if (doc.scrollWidth > doc.clientWidth + 1) {
          const culpados = [];
          document.querySelectorAll("*").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.right > doc.clientWidth + 1 && r.width > 0) {
              const st = getComputedStyle(el);
              culpados.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className && String(el.className).slice(0, 60)) || "",
                right: Math.round(r.right),
                width: Math.round(r.width),
                minW: st.minWidth,
                ws: st.whiteSpace,
              });
            }
          });
          out.culpados = culpados.slice(0, 12);
        }
        return out;
      });
      const f = (r) => (r ? `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x)}` : "-");
      console.log(
        `${String(w).padStart(4)} ${nome.padEnd(10)} sidebar=${f(info.sidebar)} header=${f(info.header)} main=${f(info.main)} cont=${f(info.container)} scrollW=${info.scrollW}/${info.clientW}${info.overflowX ? " OVERFLOW-X!" : ""}`,
      );
      if (info.culpados) {
        for (const c of info.culpados) {
          console.log(`        -> ${c.tag}.${c.cls} right=${c.right} w=${c.width} minW=${c.minW} ws=${c.ws}`);
        }
      }
    }
    await ctx.close();
  }
  await browser.close();
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
  await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);
  await db.end();
}
main().catch(async (e) => { console.error(e.message); try { await db.end(); } catch {} });
