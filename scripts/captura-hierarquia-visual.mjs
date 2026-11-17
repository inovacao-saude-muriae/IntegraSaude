// Capturas das três listagens de cadastro mostrando a hierarquia visual e a
// barra do topo (apenas "Adicionar novo"). Usa uma conta de fixture com acesso
// de administração aos módulos e cria registros temporários com marca própria.
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const MARCA = "ZVIS";
const GESTOR = "91000000990";
const SAIDA = `${process.env.TEMP}/hierarquia-visual`;
fs.mkdirSync(SAIDA, { recursive: true });

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();

async function limpar() {
  await db.query(
    `DELETE FROM processos_especialidade_procedimento WHERE especialidade_id IN (SELECT id FROM processos_especialidades WHERE nome LIKE $1)`,
    [`${MARCA}%`],
  );
  await db.query(`DELETE FROM processos_especialidades WHERE nome LIKE $1`, [`${MARCA}%`]);
  await db.query(`DELETE FROM processos_procedimentos WHERE nome LIKE $1`, [`${MARCA}%`]);
  await db.query(
    `DELETE FROM junta_especialidades WHERE servico_id IN (SELECT id FROM junta_servicos WHERE nome LIKE $1)`,
    [`${MARCA}%`],
  );
  await db.query(`DELETE FROM junta_servicos WHERE nome LIKE $1`, [`${MARCA}%`]);
  await db.query(
    `DELETE FROM regula_procedimentos WHERE tipo_exame_id IN (SELECT id FROM regula_tipo_exame WHERE nome LIKE $1)`,
    [`${MARCA}%`],
  );
  await db.query(`DELETE FROM regula_tipo_exame WHERE nome LIKE $1`, [`${MARCA}%`]);
}

await limpar();
await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);

const hash = await bcrypt.hash("Fixture@2026", 10);
await db.query(
  `INSERT INTO users (cpf, nome, senha_hash, ativo, primeiro_acesso, updated_at)
   VALUES ($1,'VISUAL',$2,true,false,now())`,
  [GESTOR, hash],
);
for (const m of ["GESTAO", "REGULACAO", "JUNTA", "PROCESSOS"]) {
  await db.query(
    `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
     VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`,
    [GESTOR, m],
  );
}
const seg = new TextEncoder().encode(env.JWT_SECRET);
const token = await new SignJWT({ userId: GESTOR })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(seg);
await db.query(
  `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
   VALUES (gen_random_uuid(),$1,$2,now()+interval '2 hours',now())`,
  [GESTOR, token],
);

// ── Regulação: 2 tipos de exame, cada um com procedimentos ────────────────
const tImg = (await db.query(`INSERT INTO regula_tipo_exame (nome) VALUES ($1) RETURNING id`, [`${MARCA} Imagem`])).rows[0].id;
const tLab = (await db.query(`INSERT INTO regula_tipo_exame (nome) VALUES ($1) RETURNING id`, [`${MARCA} Laboratório`])).rows[0].id;
for (const [t, n, v] of [
  [tImg, `${MARCA} Raio-X`, 10],
  [tImg, `${MARCA} Tomografia`, 20],
  [tImg, `${MARCA} Ultrassonografia`, 30],
  [tLab, `${MARCA} Hemograma`, 5],
  [tLab, `${MARCA} Glicemia`, 4],
]) {
  await db.query(
    `INSERT INTO regula_procedimentos (tipo_exame_id,nome,valor,ativo) VALUES ($1,$2,$3,true)`,
    [t, n, v],
  );
}

// ── Junta: 2 serviços, cada um com especialidades ────────────────────────
const sA = (await db.query(`INSERT INTO junta_servicos (nome,descricao,ativo) VALUES ($1,'Visual',true) RETURNING id`, [`${MARCA} Ambulatório`])).rows[0].id;
const sB = (await db.query(`INSERT INTO junta_servicos (nome,descricao,ativo) VALUES ($1,'Visual',true) RETURNING id`, [`${MARCA} CAEE`])).rows[0].id;
for (const [s, n] of [[sA, `${MARCA} Cardiologia`], [sA, `${MARCA} Endocrinologia`], [sB, `${MARCA} Fonoaudiologia`]]) {
  await db.query(`INSERT INTO junta_especialidades (servico_id,nome,ativo) VALUES ($1,$2,true)`, [s, n]);
}

// ── Processos: 2 especialidades com procedimentos (N:N) ──────────────────
const criarEsp = async (nome) =>
  (await db.query(
    `INSERT INTO processos_especialidades (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id`,
    [nome, nome.toLowerCase()],
  )).rows[0].id;
const criarProc = async (nome) =>
  (await db.query(
    `INSERT INTO processos_procedimentos (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id`,
    [nome, nome.toLowerCase()],
  )).rows[0].id;
const eOrto = await criarEsp(`${MARCA} Ortopedia`);
const eCard = await criarEsp(`${MARCA} Cardiologia`);
const pArtro = await criarProc(`${MARCA} Artroplastia`);
const pArtro2 = await criarProc(`${MARCA} Artroscopia`);
const pEco = await criarProc(`${MARCA} Ecocardiograma`);
for (const [e, p] of [[eOrto, pArtro], [eOrto, pArtro2], [eCard, pEco]]) {
  await db.query(
    `INSERT INTO processos_especialidade_procedimento (especialidade_id,procedimento_id) VALUES ($1,$2)`,
    [e, p],
  );
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "session_token", value: token, domain: "localhost", path: "/" }]);
const p = await ctx.newPage();

const abrir = async (rota, aba) => {
  await p.goto(BASE + rota, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  if (aba) {
    const t = p.getByRole("tab", { name: new RegExp(aba, "i") });
    if (await t.count()) {
      await t.first().click();
      await p.waitForTimeout(1200);
    }
  }
  const sel = p.locator(".cadFiltroSituacao select").first();
  if (await sel.count()) {
    await sel.selectOption("todos");
    await p.waitForTimeout(800);
  }
};

const resumo = {};
const tela = async (rota, aba, arquivo) => {
  await abrir(rota, aba);
  const info = await p.evaluate(() => ({
    busca: document.querySelectorAll(".cadBuscaBox, input[placeholder*='Selecionar ou digitar']").length,
    botao: [...document.querySelectorAll(".cadBtnAdicionar")].map((b) => b.textContent.trim()),
    categorias: document.querySelectorAll(".cadLinhaCategoria").length,
    subordinadas: document.querySelectorAll(".cadLinhaSubordinada").length,
    botoesCategoria: [...document.querySelectorAll(".cadLinhaCategoria button")].map((b) => b.textContent.trim()),
    botoesSubordinado: [...document.querySelectorAll(".cadLinhaSubordinada button")].map((b) => b.textContent.trim()),
    recuo: [...document.querySelectorAll(".cadLinhaSubordinada td:first-child")].slice(0, 1).map(
      (td) => Math.round(td.getBoundingClientRect().left - (td.closest("tr").querySelector("td")?.getBoundingClientRect().left ?? 0)) + Number(getComputedStyle(td).paddingLeft.replace("px", "")),
    ),
  }));
  resumo[arquivo] = info;
  await p.screenshot({ path: `${SAIDA}/${arquivo}`, fullPage: true });
};

try {
  await tela("/regulacao?tab=PROCEDIMENTOS", "Procedimentos", "regulacao.png");
  await tela("/gerenciamento/servicos-especialidades", null, "junta.png");
  await tela("/gerenciamento/especialidades-procedimentos", null, "processos.png");
} finally {
  await b.close();
  await limpar();
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
  await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);
  await db.end();
}

console.log(JSON.stringify(resumo, null, 1));
console.log(`capturas em ${SAIDA}`);
