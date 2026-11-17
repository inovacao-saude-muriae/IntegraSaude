// Captura e medição visual da situação cadastral (Pacientes e Tutores).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(process.env.TEMP || ".", "situacao-cadastral");
fs.mkdirSync(OUT, { recursive: true });

const G = "91000000996";

const ROTAS = [
  ["/gerenciamento/pessoas", "pacientes"],
  ["/gerenciamento/tutores", "tutores"],
  ["/ccz?tab=TUTORES&subTab=LISTA", "ccz-tutores"],
];

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const limpar = async () => {
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [G]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [G]);
  await db.query("DELETE FROM users WHERE cpf=$1", [G]);
};
await limpar();
const h = await bcrypt.hash("Fixture@2026", 10);
await db.query(
  `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at) VALUES ($1,'SITUACAO',$2,true,false,now())`,
  [G, h],
);
for (const m of ["GESTAO", "CCZ", "REGULACAO"]) {
  await db.query(
    `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
     VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`,
    [G, m],
  );
}
const seg = new TextEncoder().encode(env.JWT_SECRET);
const token = await new SignJWT({ userId: G })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(seg);
await db.query(
  `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
   VALUES (gen_random_uuid(),$1,$2,now()+interval '1 hour',now())`,
  [G, token],
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();

for (const [rota, nome] of ROTAS) {
  await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `${nome}.png`), fullPage: true });
  const info = await page.evaluate(() => {
    const sel = document.querySelector('select[id="situacaoCadastral"]');
    const filtros = [...document.querySelectorAll('[aria-label="Filtrar por situação cadastral"] button')].map((b) => b.textContent.trim());
    const cabecalho = document.querySelector("h1")?.textContent?.trim() || "";
    const tags = [...document.querySelectorAll(".cadStatusAtivo, .cadStatusInativo, .cadStatusFalecido")].map((e) => e.textContent.trim());
    return { cabecalho, filtros, campo: sel ? sel.tagName : null, tags: tags.slice(0, 6) };
  });
  console.log(nome, JSON.stringify(info));
}

await browser.close();
await limpar();
await db.end();
console.log("Capturas em", OUT);
