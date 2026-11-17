// Capturas das páginas padronizadas (Junta Reguladora e CCZ) para conferir o
// container principal no padrão da Lista de Espera da Regulação.
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const G = "91000000992";
const SAIDA = `${process.env.TEMP}/padrao-containers`;
fs.mkdirSync(SAIDA, { recursive: true });

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
  `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at) VALUES ($1,'PADRAO',$2,true,false,now())`,
  [G, h],
);
for (const m of ["GESTAO", "REGULACAO", "JUNTA", "CCZ"]) {
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

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();

const paginas = [
  ["/regulacao?tab=LISTA_ESPERA", "regulacao-lista-espera.png"],
  ["/junta-reguladora?tab=CADASTRO", "junta-novo-pedido.png"],
  ["/junta-reguladora?tab=SERVICOS&subTab=CAEE", "junta-servicos.png"],
  ["/junta-reguladora?tab=RELATORIO", "junta-prontuario.png"],
  ["/ccz?tab=PROCEDIMENTOS&subTab=LISTA", "ccz-procedimentos.png"],
  ["/ccz?tab=ESPOROTRICOSE&subTab=LISTA", "ccz-esporotricose.png"],
  ["/ccz?tab=DENUNCIA_AGRESSIVO&subTab=LISTA", "ccz-denuncias.png"],
];
const resumo = [];
try {
  for (const [rota, arq] of paginas) {
    await p.goto(BASE + rota, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2300);
    const m = await p.evaluate(() => {
      const painel = document.querySelector(".paginaPainel, [class*='unifiedPanel'], [class*='card']");
      const s = painel ? getComputedStyle(painel) : null;
      const r = painel?.getBoundingClientRect();
      return {
        tituloExterno: document.querySelectorAll("h1").length,
        painel: r ? { w: Math.round(r.width), pad: s.padding, radius: s.borderRadius } : null,
      };
    });
    resumo.push({ rota, ...m });
    await p.screenshot({ path: `${SAIDA}/${arq}`, fullPage: true });
  }
} finally {
  await b.close();
  await limpar();
  await db.end();
}
console.log(JSON.stringify(resumo, null, 1));
console.log(`capturas em ${SAIDA}`);
