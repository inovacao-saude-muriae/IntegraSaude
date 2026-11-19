/**
 * Processos Cirúrgicos — Status do Processo (Ativo/Inativo) e justificativa.
 *
 * Valida pelas server actions REAIS: padrão Ativo, Inativo exige justificativa
 * (15–500), persistência, histórico preservado na reativação, auditoria
 * DESATIVAR/REATIVAR, filtro Todos/Ativos/Inativos e independência em relação
 * à Situação Cadastral da pessoa.
 *
 * Uso: node scripts/teste-processos-status.mjs   (com o servidor no ar)
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const GESTOR = "91000000996";
const SEM_ACESSO = "91000000995";
const SENHA = "Fixture@2026";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const segredo = new TextEncoder().encode(env.JWT_SECRET);

let ok = 0;
const falhas = [];
function check(nome, cond, extra = "") {
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhas.push(nome);
    console.log(`  FALHA ${nome} ${extra}`);
  }
}

const sessoes = new Map();
async function tokenDe(cpf) {
  if (sessoes.has(cpf)) return sessoes.get(cpf);
  const token = await new SignJWT({ userId: cpf })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now() + interval '1 hour', now())`,
    [cpf, token],
  );
  sessoes.set(cpf, token);
  return token;
}

let manifest = null;
function actionId(nome, arquivo = "camara-tecnica/processos/actions") {
  if (!manifest) {
    manifest = JSON.parse(
      fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"),
    );
  }
  for (const [id, info] of Object.entries(manifest.node || {})) {
    if (info?.exportedName === nome && String(info?.filename || "").includes(arquivo)) return id;
  }
  return null;
}

const ROUTER_STATE = encodeURIComponent(
  JSON.stringify([
    "",
    { children: ["camara-tecnica", { children: ["processos", { children: ["__PAGE__", {}] }] }] },
    null,
    null,
    true,
  ]),
);

async function chamar(cpf, nome, args) {
  const token = await tokenDe(cpf);
  const id = actionId(nome);
  if (!id) throw new Error(`server action "${nome}" não encontrada no manifest`);
  const form = new FormData();
  form.append("0", JSON.stringify(args));
  const r = await fetch(`${BASE}/camara-tecnica/processos`, {
    method: "POST",
    headers: {
      cookie: `session_token=${token}`,
      "Next-Action": id,
      "Next-Router-State-Tree": ROUTER_STATE,
      accept: "text/x-component",
    },
    body: form,
  });
  const texto = await r.text();
  if (r.status >= 500) return { success: false, error: `erro interno (${r.status})` };
  for (const linha of texto.split("\n")) {
    if (!/^1:/.test(linha)) continue;
    try {
      const valor = JSON.parse(linha.slice(2));
      if (valor && typeof valor === "object") return valor;
    } catch {}
  }
  return { success: false, error: "sem resposta interpretável" };
}

const PFX = "TSTST";
const CPF_A = "91000000940";
const CPF_B = "91000000941";

async function limpar() {
  await db.query(
    `DELETE FROM processos_bloqueios WHERE processo_id IN (
       SELECT id FROM processos_judiciais WHERE numero_processo LIKE $1)`,
    [`${PFX}-%`],
  );
  await db.query("DELETE FROM processos_judiciais WHERE numero_processo LIKE $1", [`${PFX}-%`]);
  await db.query(
    "DELETE FROM processos_especialidade_procedimento WHERE especialidade_id IN (SELECT id FROM processos_especialidades WHERE nome LIKE $1)",
    [`${PFX}%`],
  );
  await db.query("DELETE FROM processos_procedimentos WHERE nome LIKE $1", [`${PFX}%`]);
  await db.query("DELETE FROM processos_especialidades WHERE nome LIKE $1", [`${PFX}%`]);
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf = ANY($1)", [[CPF_A, CPF_B]]);
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf = ANY($1)", [[CPF_A, CPF_B]]);
  await db.query("DELETE FROM pessoa WHERE cpf = ANY($1)", [[CPF_A, CPF_B]]);
  await db.query("DELETE FROM audit_logs WHERE user_cpf = $1 AND entidade='ProcessoJudicial'", [GESTOR]);
  await db.query("DELETE FROM user_sessions WHERE user_id = ANY($1)", [[GESTOR, SEM_ACESSO]]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf = ANY($1)", [[GESTOR, SEM_ACESSO]]);
  await db.query("DELETE FROM users WHERE cpf = ANY($1)", [[GESTOR, SEM_ACESSO]]);
}

async function conta(cpf, nome, modulos) {
  const h = await bcrypt.hash(SENHA, 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,$2,$3,true,false,now())`,
    [cpf, nome, h],
  );
  for (const m of modulos) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`,
      [cpf, m],
    );
  }
}

async function pessoa(cpf, nome, situacao = "ATIVO") {
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
     VALUES ($1,$2,'Feminino','1990-01-01','Mae Teste','32999990000',$3::"SituacaoCadastral",($3::text = 'ATIVO'))`,
    [cpf, nome, situacao],
  );
}

console.log("\n0. Preparação");
await limpar();
await conta(GESTOR, "TESTE Status Processo", ["PROCESSOS"]);
await conta(SEM_ACESSO, "TESTE Sem Processos", ["CCZ"]);
await pessoa(CPF_A, "TESTE Status A");
await pessoa(CPF_B, "TESTE Status B", "FALECIDO");
const esp = await db.query(
  "INSERT INTO processos_especialidades (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id",
  [`${PFX} Cardiologia`, "tstst cardiologia"],
);
const proc = await db.query(
  "INSERT INTO processos_procedimentos (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id",
  [`${PFX} Cateterismo`, "tstst cateterismo"],
);
await db.query(
  "INSERT INTO processos_especialidade_procedimento (especialidade_id,procedimento_id) VALUES ($1,$2)",
  [esp.rows[0].id, proc.rows[0].id],
);
const ESP = esp.rows[0].id;
const PROC = proc.rows[0].id;

const base = (extra = {}) => ({
  pacienteCpf: CPF_A,
  numeroPasta: "PS-900",
  especialidadeId: ESP,
  procedimentoId: PROC,
  ...extra,
});

// ── 1. Padrão Ativo ───────────────────────────────────────────────────────
console.log("\n1. Cadastro com situação padrão");
const p1 = await chamar(GESTOR, "criarProcesso", [base({ numeroProcesso: `${PFX}-001` })]);
check("processo criado sem informar status", p1.success === true, JSON.stringify(p1.error || ""));
check("status padrão é ATIVO", p1.data?.status === "ATIVO", String(p1.data?.status));
check("justificativa vazia quando Ativo", !p1.data?.justificativaInativacao);
const dbP1 = await db.query("SELECT status, justificativa_inativacao FROM processos_judiciais WHERE id=$1", [p1.data.id]);
check("banco grava ATIVO", dbP1.rows[0].status === "ATIVO");
check("banco sem justificativa", dbP1.rows[0].justificativa_inativacao === null);

// ── 2. Inativo exige justificativa ────────────────────────────────────────
console.log("\n2. Inativo exige justificativa");
const semJust = await chamar(GESTOR, "criarProcesso", [
  base({ numeroProcesso: `${PFX}-002`, status: "INATIVO" }),
]);
check("Inativo sem justificativa é recusado", semJust.success === false, JSON.stringify(semJust.error || ""));
const justCurta = await chamar(GESTOR, "criarProcesso", [
  base({ numeroProcesso: `${PFX}-003`, status: "INATIVO", justificativaInativacao: "curta" }),
]);
check("justificativa curta é recusada", justCurta.success === false);
const justLonga = await chamar(GESTOR, "criarProcesso", [
  base({ numeroProcesso: `${PFX}-004`, status: "INATIVO", justificativaInativacao: "x".repeat(501) }),
]);
check("justificativa acima de 500 é recusada", justLonga.success === false);
const p2 = await chamar(GESTOR, "criarProcesso", [
  base({
    numeroProcesso: `${PFX}-005`,
    status: "INATIVO",
    justificativaInativacao: "Processo arquivado por decisão judicial em 18/11/2026.",
  }),
]);
check("Inativo com justificativa válida é aceito", p2.success === true, JSON.stringify(p2.error || ""));
check("status INATIVO gravado", p2.data?.status === "INATIVO", String(p2.data?.status));
check("justificativa devolvida", /decisão judicial/.test(p2.data?.justificativaInativacao || ""));
const dbP2 = await db.query("SELECT status, justificativa_inativacao FROM processos_judiciais WHERE id=$1", [p2.data.id]);
check("banco grava INATIVO + justificativa", dbP2.rows[0].status === "INATIVO" && /decisão judicial/.test(dbP2.rows[0].justificativa_inativacao));
check("auditoria de criação marca motivoRegistrado",
  (await db.query("SELECT 1 FROM audit_logs WHERE entidade='ProcessoJudicial' AND entidade_id=$1 AND detalhes->>'motivoRegistrado'='true'", [String(p2.data.id)])).rowCount === 1);

// ── 3. Edição: inativar, reativar e histórico ─────────────────────────────
console.log("\n3. Edição do status pelo Editar");
const edSemJust = await chamar(GESTOR, "editarProcesso", [p1.data.id, base({ numeroProcesso: `${PFX}-001`, status: "INATIVO" })]);
check("editar para Inativo sem justificativa é recusado", edSemJust.success === false);
const edInativa = await chamar(GESTOR, "editarProcesso", [
  p1.data.id,
  base({ numeroProcesso: `${PFX}-001`, status: "INATIVO", justificativaInativacao: "Bloqueio integral determinado pela 2ª Vara Cível." }),
]);
check("editar para Inativo com justificativa", edInativa.success === true, JSON.stringify(edInativa.error || ""));
check("status alterado para INATIVO", edInativa.data?.status === "INATIVO");
const audInat = await db.query(
  "SELECT acao FROM audit_logs WHERE entidade='ProcessoJudicial' AND entidade_id=$1 AND acao IN ('DESATIVAR','REATIVAR') ORDER BY id",
  [String(p1.data.id)],
);
check("auditoria registra DESATIVAR", audInat.rows.some((r) => r.acao === "DESATIVAR"));

const edReativa = await chamar(GESTOR, "editarProcesso", [
  p1.data.id,
  base({ numeroProcesso: `${PFX}-001`, status: "ATIVO" }),
]);
check("editar para Ativo", edReativa.success === true, JSON.stringify(edReativa.error || ""));
check("status volta a ATIVO", edReativa.data?.status === "ATIVO");
check("justificativa preservada na reativação", /2ª Vara Cível/.test(edReativa.data?.justificativaInativacao || ""), String(edReativa.data?.justificativaInativacao));
const dbP1b = await db.query("SELECT status, justificativa_inativacao FROM processos_judiciais WHERE id=$1", [p1.data.id]);
check("banco preserva o histórico da inativação", dbP1b.rows[0].status === "ATIVO" && /2ª Vara/.test(dbP1b.rows[0].justificativa_inativacao || ""));
const audReat = await db.query(
  "SELECT acao FROM audit_logs WHERE entidade='ProcessoJudicial' AND entidade_id=$1 AND acao='REATIVAR'",
  [String(p1.data.id)],
);
check("auditoria registra REATIVAR", audReat.rowCount === 1);

// ── 4. Filtro Todos/Ativos/Inativos ───────────────────────────────────────
console.log("\n4. Filtro por situação do processo");
const todos = await chamar(GESTOR, "listarProcessos", [{ todos: true, busca: PFX, status: "todos" }]);
const ativos = await chamar(GESTOR, "listarProcessos", [{ todos: true, busca: PFX, status: "ativos" }]);
const inativos = await chamar(GESTOR, "listarProcessos", [{ todos: true, status: "inativos" }]);
check("Todos traz os dois", todos.data?.length === 2, String(todos.data?.length));
check("Ativos traz apenas ATIVO", ativos.data?.length === 1 && ativos.data[0].status === "ATIVO", JSON.stringify(ativos.data?.map((p) => p.status)));
check("Inativos traz apenas INATIVO", inativos.data?.length === 1 && inativos.data[0].status === "INATIVO");
const porNumero = await chamar(GESTOR, "listarProcessos", [{ todos: true, busca: `${PFX}-005` }]);
check("busca por número mantém o status no resultado", porNumero.data?.[0]?.status === "INATIVO");

// ── 5. Independência da Situação Cadastral ────────────────────────────────
console.log("\n5. Independência da Situação Cadastral");
const falecidoAtivo = await chamar(GESTOR, "criarProcesso", [
  base({ pacienteCpf: CPF_B, numeroPasta: "PS-901", numeroProcesso: `${PFX}-006`, status: "ATIVO" }),
]);
check("pessoa Falecida não pode ter novo processo", falecidoAtivo.success === false, JSON.stringify(falecidoAtivo.error || ""));
await db.query("UPDATE pessoa SET situacao='FALECIDO', ativo=false WHERE cpf=$1", [CPF_A]);
const dbApos = await db.query("SELECT status FROM processos_judiciais WHERE id=$1", [p1.data.id]);
check("alterar a situação cadastral não altera o status do processo", dbApos.rows[0].status === "ATIVO");
const listaApos = await chamar(GESTOR, "listarProcessos", [{ todos: true, busca: PFX, status: "ativos" }]);
check(
  "filtro de status do processo segue independente",
  listaApos.data?.length === 1 && listaApos.data[0].status === "ATIVO",
  JSON.stringify(listaApos.data?.map((p) => p.status)),
);

// ── 6. Permissão ──────────────────────────────────────────────────────────
console.log("\n6. Permissão");
const negado = await chamar(SEM_ACESSO, "editarProcesso", [p1.data.id, base({ numeroProcesso: `${PFX}-001`, status: "INATIVO", justificativaInativacao: "Tentativa sem permissão de edição." })]);
check("sem PROCESSOS: alteração de status negada", negado.success === false);

await limpar();
await db.end();
console.log(`\n${ok} OK · ${falhas.length} FALHA(S)`);
if (falhas.length) console.log(falhas.join("\n"));
process.exit(falhas.length ? 1 : 0);
