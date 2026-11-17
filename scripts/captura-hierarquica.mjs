/** Capturas da situação HIERÁRQUICA nas três telas (ativos, inativos e indisponíveis). */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SAIDA = path.join(process.env.TEMP || ".", "hierarquica-visual");
fs.mkdirSync(SAIDA, { recursive: true });
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const G = "91000000890";
const MARCA = "ZQHR";
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const seg = new TextEncoder().encode(env.JWT_SECRET);

const limpar = async () => {
  await db.query(`DELETE FROM regula_procedimentos WHERE tipo_exame_id IN (SELECT id FROM regula_tipo_exame WHERE nome LIKE $1)`, [`${MARCA}%`]);
  await db.query(`DELETE FROM regula_tipo_exame WHERE nome LIKE $1`, [`${MARCA}%`]);
  await db.query(`DELETE FROM junta_especialidades WHERE servico_id IN (SELECT id FROM junta_servicos WHERE nome LIKE $1)`, [`${MARCA}%`]);
  await db.query(`DELETE FROM junta_servicos WHERE nome LIKE $1`, [`${MARCA}%`]);
  await db.query(`DELETE FROM processos_especialidade_procedimento WHERE especialidade_id IN (SELECT id FROM processos_especialidades WHERE nome LIKE $1) OR procedimento_id IN (SELECT id FROM processos_procedimentos WHERE nome LIKE $1)`, [`${MARCA}%`]);
  await db.query(`DELETE FROM processos_especialidades WHERE nome LIKE $1`, [`${MARCA}%`]);
  await db.query(`DELETE FROM processos_procedimentos WHERE nome LIKE $1`, [`${MARCA}%`]);
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [G]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [G]);
  await db.query("DELETE FROM users WHERE cpf=$1", [G]);
};

await limpar();
const h = await bcrypt.hash("Fixture@2026", 10);
await db.query(`INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at) VALUES ($1,'DEMO Hierarquia',$2,true,false,now())`, [G, h]);
for (const m of ["GESTAO", "REGULACAO", "JUNTA", "PROCESSOS"]) {
  await db.query(`INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo) VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`, [G, m]);
}
const token = await new SignJWT({ userId: G, nome: "DEMO Hierarquia" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(seg);
await db.query(`INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,now()+interval '1 hour',now())`, [G, token]);

// Dados de demonstração: categoria inativa, subordinado inativo e irmão ativo.
const tImg = (await db.query(`INSERT INTO regula_tipo_exame (nome, ativo) VALUES ($1,true) RETURNING id`, [`${MARCA} Imagem`])).rows[0].id;
const tLab = (await db.query(`INSERT INTO regula_tipo_exame (nome, ativo) VALUES ($1,false) RETURNING id`, [`${MARCA} Laboratório`])).rows[0].id;
await db.query(`INSERT INTO regula_procedimentos (tipo_exame_id,nome,valor,ativo) VALUES ($1,$2,10,true)`, [tImg, `${MARCA} Raio-X`]);
await db.query(`INSERT INTO regula_procedimentos (tipo_exame_id,nome,valor,ativo) VALUES ($1,$2,20,false)`, [tImg, `${MARCA} Tomografia`]);
await db.query(`INSERT INTO regula_procedimentos (tipo_exame_id,nome,valor,ativo) VALUES ($1,$2,5,true)`, [tLab, `${MARCA} Hemograma`]);

const sCAEE = (await db.query(`INSERT INTO junta_servicos (nome, ativo) VALUES ($1,true) RETURNING id`, [`${MARCA} CAEE`])).rows[0].id;
const sAPAE = (await db.query(`INSERT INTO junta_servicos (nome, ativo) VALUES ($1,false) RETURNING id`, [`${MARCA} APAE`])).rows[0].id;
await db.query(`INSERT INTO junta_especialidades (servico_id,nome,ativo) VALUES ($1,$2,true)`, [sCAEE, `${MARCA} Fono`]);
await db.query(`INSERT INTO junta_especialidades (servico_id,nome,ativo) VALUES ($1,$2,false)`, [sCAEE, `${MARCA} Fisio`]);
await db.query(`INSERT INTO junta_especialidades (servico_id,nome,ativo) VALUES ($1,$2,true)`, [sAPAE, `${MARCA} Terapia`]);

const espOrto = (await db.query(`INSERT INTO processos_especialidades (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id`, [`${MARCA} Ortopedia`, `${MARCA} ortopedia`])).rows[0].id;
const espNeuro = (await db.query(`INSERT INTO processos_especialidades (nome,nome_chave,ativo) VALUES ($1,$2,false) RETURNING id`, [`${MARCA} Neurologia`, `${MARCA} neurologia`])).rows[0].id;
const pBloq = (await db.query(`INSERT INTO processos_procedimentos (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id`, [`${MARCA} Bloqueio`, `${MARCA} bloqueio`])).rows[0].id;
const pArtro = (await db.query(`INSERT INTO processos_procedimentos (nome,nome_chave,ativo) VALUES ($1,$2,false) RETURNING id`, [`${MARCA} Artroplastia`, `${MARCA} artroplastia`])).rows[0].id;
for (const [e, p] of [[espOrto, pBloq], [espOrto, pArtro], [espNeuro, pBloq]]) {
  await db.query(`INSERT INTO processos_especialidade_procedimento (especialidade_id,procedimento_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [e, p]);
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();

const telas = [
  { rota: "/regulacao?tab=PROCEDIMENTOS", nome: "regulacao" },
  { rota: "/gerenciamento/servicos-especialidades", nome: "junta" },
  { rota: "/gerenciamento/especialidades-procedimentos", nome: "processos" },
];
for (const t of telas) {
  await p.goto(BASE + t.rota, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  await p.locator(".cadFiltroSituacao select").first().selectOption("todos");
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${SAIDA}/${t.nome}-todos-1440.png`, fullPage: true });
}
await b.close();
await limpar();
await db.end();
console.log("capturas em", SAIDA);
