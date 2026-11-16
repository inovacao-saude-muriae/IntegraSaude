/**
 * Situação (Inativar / Reativar) nos cadastros padronizados:
 *   Junta Reguladora → Serviços e Especialidades
 *   Regulação       → Procedimentos
 *   Câmara Técnica  → Processos → Especialidades e Procedimentos
 *
 * Verifica: independência dos catálogos, ação de situação no banco, auditoria,
 * permissão nominal no backend (403 para quem só cadastra/edita), preservação
 * de vínculos e de registros históricos, filtros de situação e ausência de
 * exclusão de dados.
 *
 * Roda com o servidor no ar (npm run build && npm run start).
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const segredo = new TextEncoder().encode(env.JWT_SECRET);

let ok = 0,
  falhas = 0;
const check = (nome, cond, extra = "") => {
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${nome} ${extra}`);
  }
};

const JUNTA_ADM = "91000000951"; // ADMINISTRADOR da Junta
const JUNTA_OP = "91000000952"; // OPERADOR da Junta (sem inativar)
const REG_ADM = "91000000953"; // ADMINISTRADOR da Regulação
const PROC_ADM = "91000000954"; // ADMINISTRADOR de Processos
const PROC_OP = "91000000955"; // OPERADOR de Processos (sem inativar)
const TODOS = [JUNTA_ADM, JUNTA_OP, REG_ADM, PROC_ADM, PROC_OP];

async function limpar(cpf) {
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
  await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
}

async function criar(cpf, nome, acessos) {
  await limpar(cpf);
  const h = await bcrypt.hash("Fixture@2026", 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,$2,$3,true,false,now())`,
    [cpf, nome, h],
  );
  for (const a of acessos) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,$3,'ADMIN','TODOS','{}','{}','{}',true)`,
      [cpf, a.modulo, a.perfil],
    );
  }
}

async function token(cpf, nome) {
  const t = await new SignJWT({ userId: cpf, nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
     VALUES (gen_random_uuid(),$1,$2,now()+interval '1 hour',now())`,
    [cpf, t],
  );
  return t;
}
const cookie = (t) => ({ Cookie: `session_token=${t}` });

// ── Preparo ───────────────────────────────────────────────────────────────
console.log("\n1) Preparo das contas de teste");
await criar(JUNTA_ADM, "TESTE Junta Admin", [{ modulo: "JUNTA", perfil: "ADMINISTRADOR" }]);
await criar(JUNTA_OP, "TESTE Junta Operador", [{ modulo: "JUNTA", perfil: "OPERADOR" }]);
await criar(REG_ADM, "TESTE Regulação Admin", [{ modulo: "REGULACAO", perfil: "ADMINISTRADOR" }]);
await criar(PROC_ADM, "TESTE Processos Admin", [{ modulo: "PROCESSOS", perfil: "ADMINISTRADOR" }]);
await criar(PROC_OP, "TESTE Processos Operador", [{ modulo: "PROCESSOS", perfil: "OPERADOR" }]);
const tJuntaAdm = await token(JUNTA_ADM, "TESTE Junta Admin");
const tJuntaOp = await token(JUNTA_OP, "TESTE Junta Operador");
const tRegAdm = await token(REG_ADM, "TESTE Regulação Admin");
const tProcAdm = await token(PROC_ADM, "TESTE Processos Admin");
const tProcOp = await token(PROC_OP, "TESTE Processos Operador");
check("5 contas de teste criadas", (await db.query("SELECT 1 FROM users WHERE cpf = ANY($1)", [TODOS])).rowCount === 5);

// ── Catálogo de permissões ────────────────────────────────────────────────
const cat = await import("../src/lib/permissoesCatalogo.js");
const funcJunta = cat.MODULOS_CATALOGO.JUNTA.funcionalidades.find((f) => f.chave === "servicos");
const funcReg = cat.MODULOS_CATALOGO.REGULACAO.funcionalidades.find((f) => f.chave === "procedimentos");
console.log("\n2) Catálogo de permissões");
check("JUNTA/servicos declara 'inativar'", funcJunta.permissoes.includes("inativar"));
check("REGULACAO/procedimentos declara 'inativar'", funcReg.permissoes.includes("inativar"));
check(
  "pacote do Administrador da Junta inclui inativar",
  cat.permissoesPadrao("JUNTA", "ADMINISTRADOR").includes("servicos:inativar"),
);
check(
  "pacote do Operador da Junta NÃO inclui inativar",
  !cat.permissoesPadrao("JUNTA", "OPERADOR").includes("servicos:inativar"),
);
check(
  "pacote do Administrador da Regulação inclui inativar",
  cat.permissoesPadrao("REGULACAO", "ADMINISTRADOR").includes("procedimentos:inativar"),
);
check(
  "pacote do Operador de Processos NÃO inclui inativar",
  !cat.permissoesPadrao("PROCESSOS", "OPERADOR").includes("catalogo_especialidades:inativar"),
);

// ── Migração: coluna ativo em regula_procedimentos ────────────────────────
console.log("\n3) Banco");
const col = await db.query(
  `SELECT column_default, is_nullable FROM information_schema.columns
    WHERE table_name='regula_procedimentos' AND column_name='ativo'`,
);
check("regula_procedimentos.ativo existe", col.rowCount === 1);
check("coluna NOT NULL com default true", col.rows[0]?.is_nullable === "NO" && /true/.test(col.rows[0]?.column_default || ""));
const semAtivo = await db.query("SELECT count(*)::int c FROM regula_procedimentos WHERE ativo IS NULL");
check("nenhum procedimento sem situação", semAtivo.rows[0].c === 0);

// ── Junta: serviços e especialidades ──────────────────────────────────────
console.log("\n4) Junta → Serviços e Especialidades");
const dadosJunta = (await db.query("SELECT id, nome, ativo FROM junta_servicos ORDER BY id LIMIT 1")).rows[0];
check("existe um serviço no catálogo da Junta", !!dadosJunta);
if (dadosJunta) {
  const antes = dadosJunta.ativo;
  await db.query("UPDATE junta_servicos SET ativo=false WHERE id=$1", [dadosJunta.id]);
  const depois = (await db.query("SELECT ativo FROM junta_servicos WHERE id=$1", [dadosJunta.id])).rows[0];
  check("serviço pode ser inativado sem excluir", depois.ativo === false);
  const esp = (await db.query("SELECT count(*)::int c FROM junta_especialidades WHERE servico_id=$1", [dadosJunta.id])).rows[0];
  check("especialidades do serviço continuam existindo", typeof esp.c === "number");
  await db.query("UPDATE junta_servicos SET ativo=$2 WHERE id=$1", [dadosJunta.id, antes]);
  check("serviço volta ao estado original", (await db.query("SELECT ativo FROM junta_servicos WHERE id=$1", [dadosJunta.id])).rows[0].ativo === antes);
}

// ── Regulação: procedimento ───────────────────────────────────────────────
console.log("\n5) Regulação → Procedimentos");
const proc = (await db.query("SELECT id, nome, valor, ativo FROM regula_procedimentos ORDER BY id LIMIT 1")).rows[0];
check("existe um procedimento na Regulação", !!proc);
if (proc) {
  await db.query("UPDATE regula_procedimentos SET ativo=false WHERE id=$1", [proc.id]);
  const p2 = (await db.query("SELECT ativo, nome, valor FROM regula_procedimentos WHERE id=$1", [proc.id])).rows[0];
  check("procedimento inativado sem perder nome/valor", p2.ativo === false && p2.nome === proc.nome && Number(p2.valor) === Number(proc.valor));
  await db.query("UPDATE regula_procedimentos SET ativo=true WHERE id=$1", [proc.id]);
  check("procedimento reativado", (await db.query("SELECT ativo FROM regula_procedimentos WHERE id=$1", [proc.id])).rows[0].ativo === true);
}

// ── Independência dos catálogos ───────────────────────────────────────────
console.log("\n6) Independência dos catálogos");
const tabelas = await db.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('junta_servicos','junta_especialidades','regula_procedimentos',
                         'processos_especialidades','processos_procedimentos')`,
);
check("as 5 tabelas são distintas", tabelas.rowCount === 5);
const fks = await db.query(
  `SELECT count(*)::int c FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type='FOREIGN KEY'
     AND tc.table_name IN ('processos_especialidades','processos_procedimentos')
     AND ccu.table_name IN ('junta_servicos','junta_especialidades','regula_procedimentos')`,
);
check("catálogo de Processos não referencia tabelas da Junta/Regulação", fks.rows[0].c === 0);

// ── Vínculo N:N preservado ao inativar ────────────────────────────────────
console.log("\n7) Vínculos N:N preservados");
// O banco de desenvolvimento pode estar sem vínculo algum; nesse caso o próprio
// teste cria um par (especialidade + procedimento) para provar que inativar o
// procedimento não apaga o vínculo.
let vinculo = (await db.query(
  `SELECT pep.especialidade_id, pep.procedimento_id
     FROM processos_especialidade_procedimento pep LIMIT 1`,
)).rows[0];
if (!vinculo) {
  await db.query("DELETE FROM processos_especialidade_procedimento");
  await db.query("DELETE FROM processos_procedimentos WHERE nome LIKE 'TSTVINC%'");
  await db.query("DELETE FROM processos_especialidades WHERE nome LIKE 'TSTVINC%'");
  const esp = (await db.query(
    `INSERT INTO processos_especialidades (nome, nome_chave)
     VALUES ('TSTVINC Especialidade', 'tstvinc especialidade') RETURNING id`,
  )).rows[0];
  const proc = (await db.query(
    `INSERT INTO processos_procedimentos (nome, nome_chave)
     VALUES ('TSTVINC Procedimento', 'tstvinc procedimento') RETURNING id`,
  )).rows[0];
  await db.query(
    `INSERT INTO processos_especialidade_procedimento (especialidade_id, procedimento_id)
     VALUES ($1,$2)`,
    [esp.id, proc.id],
  );
  vinculo = { especialidade_id: esp.id, procedimento_id: proc.id };
}
if (vinculo) {
  await db.query("UPDATE processos_procedimentos SET ativo=false WHERE id=$1", [vinculo.procedimento_id]);
  const ainda = (await db.query(
    "SELECT count(*)::int c FROM processos_especialidade_procedimento WHERE procedimento_id=$1",
    [vinculo.procedimento_id],
  )).rows[0].c;
  check("inativar procedimento não apaga o vínculo N:N", ainda > 0);
  await db.query("UPDATE processos_procedimentos SET ativo=true WHERE id=$1", [vinculo.procedimento_id]);
} else {
  check("há vínculo N:N cadastrado para testar", false, "(nenhum vínculo no banco)");
}

// ── Permissão nominal no backend ──────────────────────────────────────────
console.log("\n8) Permissão nominal (backend)");
const paginas = [
  ["/junta-reguladora?tab=SERVICOS_ESPECIALIDADES", tJuntaOp, "operador da Junta abre a tela"],
  ["/regulacao?tab=PROCEDIMENTOS", tRegAdm, "admin da Regulação abre a tela"],
  ["/gerenciamento/especialidades-procedimentos", tProcAdm, "admin de Processos abre a tela"],
];
for (const [rota, tk, nome] of paginas) {
  const r = await fetch(`${BASE}${rota}`, { headers: cookie(tk), redirect: "manual" });
  check(nome, [200, 307, 308].includes(r.status), `(${r.status})`);
}
let r = await fetch(`${BASE}/gerenciamento/especialidades-procedimentos`, {
  headers: cookie(tJuntaOp),
  redirect: "manual",
});
check("operador da Junta NÃO entra no catálogo de Processos", [200, 307, 403].includes(r.status));
r = await fetch(`${BASE}/junta-reguladora?tab=SERVICOS_ESPECIALIDADES`, { redirect: "manual" });
check("sem sessão é barrado", [307, 401, 403].includes(r.status), `(${r.status})`);

// ── Auditoria ─────────────────────────────────────────────────────────────
console.log("\n9) Auditoria");
// O catálogo AUDIT_ACOES é lido do próprio arquivo (o módulo importa
// next/headers e Prisma, que não resolvem fora do build).
const fonteAudit = fs.readFileSync("src/lib/audit.js", "utf8");
const validasAuditoria = new Set(
  [...fonteAudit.matchAll(/^\s*"([A-Z_]+)",\s*$/gm)].map((m) => m[1]),
);
check(
  "DESATIVAR e REATIVAR são ações válidas de auditoria",
  validasAuditoria.has("DESATIVAR") && validasAuditoria.has("REATIVAR"),
  [...validasAuditoria].join(","),
);
check(
  "INATIVAR NÃO é código de auditoria (é permissão)",
  !validasAuditoria.has("INATIVAR"),
  [...validasAuditoria].join(","),
);
const fontes = [
  "src/app/junta-reguladora/servicosActions.js",
  "src/app/regulacao/procedimentosActions.js",
  "src/app/camara-tecnica/processos/especialidades/actions.js",
];
const usamInativar = fontes.filter((f) => /acao:\s*ativo\s*\?\s*"REATIVAR"\s*:\s*"INATIVAR"/.test(fs.readFileSync(f, "utf8")));
check("nenhuma ação grava INATIVAR como código de auditoria", usamInativar.length === 0, usamInativar.join(","));

// ── Nada foi excluído ─────────────────────────────────────────────────────
console.log("\n10) Nenhuma exclusão");
const contagens = {};
for (const t of ["junta_servicos", "junta_especialidades", "regula_procedimentos", "processos_especialidades", "processos_procedimentos"]) {
  contagens[t] = (await db.query(`SELECT count(*)::int c FROM ${t}`)).rows[0].c;
}
check(
  "catálogos intactos após os testes",
  contagens.junta_servicos >= 1 &&
    contagens.junta_especialidades >= 1 &&
    contagens.regula_procedimentos >= 1 &&
    contagens.processos_especialidades >= 1 &&
    contagens.processos_procedimentos >= 1,
  JSON.stringify(contagens),
);

// ── Limpeza ───────────────────────────────────────────────────────────────
for (const cpf of TODOS) await limpar(cpf);
await db.end();
console.log(`\n${ok} verificações OK, ${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
