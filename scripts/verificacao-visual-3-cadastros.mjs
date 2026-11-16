/**
 * Comparação visual das 3 telas de cadastro de gerenciamento.
 * Mede com getBoundingClientRect e captura em 1440px e 390px.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SAIDA = path.join(process.env.TEMP || ".", "cadastros-3-visual");
fs.mkdirSync(SAIDA, { recursive: true });

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const seg = new TextEncoder().encode(env.JWT_SECRET);
const CPF = "91000000999";

await db.connect();
await db.query("DELETE FROM user_sessions WHERE user_id=$1", [CPF]);
await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [CPF]);
await db.query("DELETE FROM users WHERE cpf=$1", [CPF]);
const h = await bcrypt.hash("Fixture@2026", 10);
await db.query(
  `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
   VALUES ($1,'TESTE Visual 3 Cadastros',$2,true,false,now())`,
  [CPF, h],
);
for (const m of ["GESTAO", "JUNTA", "REGULACAO", "PROCESSOS"]) {
  await db.query(
    `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
     VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`,
    [CPF, m],
  );
}
const token = await new SignJWT({ userId: CPF, nome: "TESTE Visual" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(seg);
await db.query(
  `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
   VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`,
  [CPF, token],
);
await db.end();

const TELAS = [
  ["regulacao", "/regulacao?tab=PROCEDIMENTOS", "Exames e Procedimentos"],
  ["junta", "/gerenciamento/servicos-especialidades", "Serviços e Especialidades"],
  ["processos", "/gerenciamento/especialidades-procedimentos", "Especialidades e Procedimentos"],
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();

const medir = () =>
  p.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const card = document.querySelector(".cadCard");
    const titulo = document.querySelector(".cadPaginaTitulo");
    const sub = document.querySelector(".cadPaginaSubtitulo");
    const busca = document.querySelector(".cadBuscaBox");
    const cardTitle = document.querySelector(".cadCardTitle");
    const tabela = document.querySelector(".cadTabela");
    const th = document.querySelector(".cadTabela thead th");
    const btn = document.querySelector(".cadBtnAdicionar");
    const fmt = (x) =>
      x ? { x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height) } : null;
    return {
      temTituloPagina: Boolean(titulo),
      tituloTexto: titulo?.textContent?.trim() || "",
      subtitulo: sub?.textContent?.trim()?.slice(0, 60) || "",
      card: fmt(r(card)),
      cardTitle: fmt(r(cardTitle)),
      busca: fmt(r(busca)),
      tabela: fmt(r(tabela)),
      th: fmt(r(th)),
      btnAdicionar: fmt(r(btn)),
      btnTexto: btn?.textContent?.trim() || "",
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      fonteTitulo: titulo ? getComputedStyle(titulo).fontSize : "",
      fonteCardTitle: cardTitle ? getComputedStyle(cardTitle).fontSize : "",
      raioCard: card ? getComputedStyle(card).borderRadius : "",
    };
  });

const resultados = {};
for (const [chave, rota, esperado] of TELAS) {
  await p.goto(BASE + rota, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  resultados[chave] = { rota, esperado, desktop: await medir() };
  await p.screenshot({ path: `${SAIDA}/${chave}-1440.png` });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(1200);
  resultados[chave].mobile = await medir();
  await p.screenshot({ path: `${SAIDA}/${chave}-390.png`, fullPage: false });
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.waitForTimeout(600);
}

// Comparação
const chaves = TELAS.map((t) => t[0]);
const base = resultados[chaves[0]].desktop;
const comparacao = [];
for (const k of chaves.slice(1)) {
  const d = resultados[k].desktop;
  for (const campo of ["card", "cardTitle", "busca", "tabela", "th", "btnAdicionar"]) {
    const a = base[campo];
    const c = d[campo];
    const igual = JSON.stringify(a) === JSON.stringify(c);
    comparacao.push({ campo, [`${chaves[0]}`]: a, [k]: c, igual });
  }
  comparacao.push({ campo: "fonteTitulo", [chaves[0]]: base.fonteTitulo, [k]: d.fonteTitulo, igual: base.fonteTitulo === d.fonteTitulo });
  comparacao.push({ campo: "fonteCardTitle", [chaves[0]]: base.fonteCardTitle, [k]: d.fonteCardTitle, igual: base.fonteCardTitle === d.fonteCardTitle });
  comparacao.push({ campo: "raioCard", [chaves[0]]: base.raioCard, [k]: d.raioCard, igual: base.raioCard === d.raioCard });
  comparacao.push({ campo: "temTituloPagina", [chaves[0]]: base.temTituloPagina, [k]: d.temTituloPagina, igual: base.temTituloPagina === d.temTituloPagina });
}

await b.close();

const db2 = new Client({ connectionString: env.DATABASE_URL });
await db2.connect();
await db2.query("DELETE FROM user_sessions WHERE user_id=$1", [CPF]);
await db2.query("DELETE FROM user_acessos WHERE user_cpf=$1", [CPF]);
await db2.query("DELETE FROM users WHERE cpf=$1", [CPF]);
await db2.end();

fs.writeFileSync(path.join(SAIDA, "medicoes.json"), JSON.stringify({ resultados, comparacao }, null, 2));

console.log("\n=== MEDIÇÕES 1440px ===");
for (const k of chaves) {
  const d = resultados[k].desktop;
  console.log(
    `${k.padEnd(11)} titulo=${d.temTituloPagina} card=${JSON.stringify(d.card)} busca=${JSON.stringify(d.busca)} tabela=${JSON.stringify(d.tabela)} botao=${JSON.stringify(d.btnAdicionar)} overflow=${d.overflow}`,
  );
}
console.log("\n=== COMPARAÇÃO (base = regulação) ===");
const divergentes = comparacao.filter((c) => !c.igual);
if (divergentes.length === 0) console.log("todas as medidas coincidem");
for (const c of divergentes) console.log("DIVERGE:", JSON.stringify(c));
console.log("\n=== MOBILE 390px ===");
for (const k of chaves) {
  const m = resultados[k].mobile;
  console.log(`${k.padEnd(11)} overflow=${m.overflow} card=${JSON.stringify(m.card)}`);
}
console.log(`\ncapturas em ${SAIDA}`);
