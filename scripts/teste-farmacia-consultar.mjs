/**
 * Farmácia Judicial — aba Consultar Processos (filtros, paginação, detalhe e
 * exclusão protegida). Chama as server actions REAIS e valida o banco.
 *
 * Uso: node scripts/teste-farmacia-consultar.mjs   (com o servidor no ar)
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN = "91000000996";
const SEM_ADMIN = "91000000995";

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
const check = (nome, cond, extra = "") => {
  if (cond) { ok += 1; console.log(`  OK   ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA ${nome} ${extra}`); }
};

const sessoes = new Map();
async function tokenDe(cpf) {
  if (sessoes.has(cpf)) return sessoes.get(cpf);
  const token = await new SignJWT({ userId: cpf }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("1h").sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
     VALUES (gen_random_uuid(),$1,$2,now()+interval '1 hour',now())`, [cpf, token]);
  sessoes.set(cpf, token);
  return token;
}

let manifest = null;
function actionId(nome, arquivo = "camara-tecnica/farmacia-judicial/actions") {
  if (!manifest) manifest = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  for (const [id, info] of Object.entries(manifest.node || {})) {
    if (info?.exportedName === nome && String(info?.filename || "").includes(arquivo)) return id;
  }
  return null;
}

const ROUTER_STATE = encodeURIComponent(JSON.stringify([
  "", { children: ["camara-tecnica", { children: ["farmacia-judicial", { children: ["__PAGE__", {}] }] }] }, null, null, true,
]));

async function chamar(cpf, nome, args) {
  const token = await tokenDe(cpf);
  const id = actionId(nome);
  if (!id) throw new Error(`server action "${nome}" não encontrada`);
  const form = new FormData();
  form.append("0", JSON.stringify(args));
  const r = await fetch(`${BASE}/camara-tecnica/farmacia-judicial`, {
    method: "POST",
    headers: { cookie: `session_token=${token}`, "Next-Action": id, "Next-Router-State-Tree": ROUTER_STATE, accept: "text/x-component" },
    body: form,
  });
  const texto = await r.text();
  if (r.status >= 500) return { success: false, error: `erro interno (${r.status})` };
  for (const linha of texto.split("\n")) {
    if (!/^1:/.test(linha)) continue;
    try { const v = JSON.parse(linha.slice(2)); if (v && typeof v === "object") return v; } catch {}
  }
  return { success: false, error: "sem resposta interpretável" };
}

const PFX = "TSTFC";
const CPFS = ["91000000960", "91000000961", "91000000962"];

async function limpar() {
  await db.query("DELETE FROM farmacia_dispensacoes_medicamentos WHERE paciente_pasta LIKE $1", [`${PFX}%`]);
  await db.query("DELETE FROM farmacia_pacientes WHERE numero_pasta LIKE $1", [`${PFX}%`]);
  await db.query("DELETE FROM farmacia_medicamentos WHERE nome LIKE $1", [`${PFX}%`]);
  await db.query("DELETE FROM pessoa WHERE cpf = ANY($1)", [CPFS]);
  await db.query("DELETE FROM audit_logs WHERE entidade='PacienteJudicial' AND entidade_id LIKE $1", [`${PFX}%`]);
  await db.query("DELETE FROM user_sessions WHERE user_id = ANY($1)", [[ADMIN, SEM_ADMIN]]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf = ANY($1)", [[ADMIN, SEM_ADMIN]]);
  await db.query("DELETE FROM users WHERE cpf = ANY($1)", [[ADMIN, SEM_ADMIN]]);
}

async function conta(cpf, nome, modulos, nivel = "ADMIN") {
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,$2,'x',true,false,now())`, [cpf, nome]);
  for (const m of modulos) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,$3,$4,'TODOS','{}','{}','{}',true)`,
      [cpf, m, nivel === "ADMIN" ? "ADMINISTRADOR" : "OPERADOR", nivel]);
  }
}

async function pessoa(cpf, nome) {
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
     VALUES ($1,$2,'Feminino','1990-01-01','Mae Teste','32999990000','ATIVO',true)`, [cpf, nome]);
}

console.log("\n0. Preparação");
await limpar();
await conta(ADMIN, "TESTE Farmacia Consulta", ["FARMACIA"], "ADMIN");
await conta(SEM_ADMIN, "TESTE Farmacia Operador", ["FARMACIA"], "OPERADOR");
await pessoa(CPFS[0], "TESTE FC Alfa");
await pessoa(CPFS[1], "TESTE FC Beta");
await pessoa(CPFS[2], "TESTE FC Gama");
const m1 = (await db.query("INSERT INTO farmacia_medicamentos (nome,tipo,dosagem,ativo) VALUES ($1,'Analgésico','500mg',true) RETURNING id", [`${PFX} Dipirona`])).rows[0].id;
const m2 = (await db.query("INSERT INTO farmacia_medicamentos (nome,tipo,dosagem,ativo) VALUES ($1,'Anti-hipertensivo','50mg',true) RETURNING id", [`${PFX} Losartana`])).rows[0].id;
await db.query(
  `INSERT INTO farmacia_pacientes (numero_pasta,pessoa_cpf,numero_processo,status,justificativa_inativacao,created_at)
   VALUES ($1,$2,'5000001-11.2026.8.13.0439','ATIVO',NULL, now()-interval '2 days'),
          ($3,$4,'5000002-22.2026.8.13.0439','INATIVO','Processo suspenso por decisão judicial em 18/11/2026.', now()-interval '1 day')`,
  [`${PFX}-001`, CPFS[0], `${PFX}-002`, CPFS[1]]);
await db.query(
  `INSERT INTO farmacia_tratamentos_pacientes (paciente_pasta,medicamento_id,qtd_prescrita_mensal,ativo)
   VALUES ($1,$3,60,true),($1,$4,30,true),($2,$3,30,true)`,
  [`${PFX}-001`, `${PFX}-002`, m1, m2]);

console.log("\n1. Filtros e paginação");
// As fixtures são contadas apenas entre as do próprio prefixo (o banco de dev
// pode ter outros registros).
const contar = (res) => res.registros.filter((r) => String(r.numeroPasta).startsWith(PFX)).length;
const todos = await chamar(ADMIN, "listarProcessosFarmacia", [{}]);
check("sem filtros devolve todos os registros", todos.success === true && contar(todos) === 2, String(contar(todos)));
check("página de 100 registros", todos.tamanho === 100);
check("um registro por processo (sem duplicar medicamentos)", contar(todos) === 2, String(contar(todos)));
check("ordenação do mais recente para o mais antigo",
  todos.registros[0].numeroPasta === `${PFX}-002`, JSON.stringify(todos.registros.map((r) => r.numeroPasta)));

const hoje = new Date().toISOString().slice(0, 10);
const semPeriodo = await chamar(ADMIN, "listarProcessosFarmacia", [{ dataInicio: "2020-01-01", dataFim: "2020-12-31" }]);
check("período fora do cadastro devolve vazio", semPeriodo.total === 0);

const porMed = await chamar(ADMIN, "listarProcessosFarmacia", [{ medicamentoId: m2 }]);
check("filtro por medicamento devolve só quem usa", contar(porMed) === 1 && porMed.registros.find((r) => String(r.numeroPasta).startsWith(PFX))?.numeroPasta === `${PFX}-001`);

const inativos = await chamar(ADMIN, "listarProcessosFarmacia", [{ situacao: "inativos" }]);
check("filtro Inativo", contar(inativos) === 1 && inativos.registros.find((r) => String(r.numeroPasta).startsWith(PFX))?.numeroPasta === `${PFX}-002`, JSON.stringify(inativos.registros.map((r) => r.numeroPasta)));
const ativos = await chamar(ADMIN, "listarProcessosFarmacia", [{ situacao: "ativos" }]);
check("filtro Ativo", contar(ativos) === 1 && ativos.registros.find((r) => String(r.numeroPasta).startsWith(PFX))?.numeroPasta === `${PFX}-001`, JSON.stringify(ativos.registros.map((r) => r.numeroPasta)));

const pagina2 = await chamar(ADMIN, "listarProcessosFarmacia", [{ pagina: 2 }]);
check("paginação no backend respeita 100 por página", pagina2.success === true && pagina2.tamanho === 100 && contar(pagina2) === 0);

console.log("\n2. Visualização do processo");
const det = await chamar(ADMIN, "obterProcessoFarmacia", [`${PFX}-002`]);
check("detalhe carrega", det.success === true && det.processo.numeroPasta === `${PFX}-002`);
check("detalhe traz paciente", det.processo.patientName === "TESTE FC Beta");
check("detalhe traz situação e justificativa",
  det.processo.status === "INATIVO" && /decisão judicial/.test(det.processo.justificativaInativacao));
check("detalhe traz os medicamentos vinculados", det.processo.medicamentos.length === 1);

console.log("\n2.1 Edição do processo (situação + justificativa)");
const ed = await chamar(ADMIN, "obterProcessoParaEdicao", [`${PFX}-002`]);
check("edição carrega processo + medicamentos",
  ed.success === true && ed.processo.numeroProcesso === "5000002-22.2026.8.13.0439" && ed.processo.medicamentos.length === 1);
check("edição traz a justificativa já registrada", /decisão judicial/.test(ed.processo.justificativaInativacao || ""));

const semJust = await chamar(ADMIN, "editarProcessoFarmacia", [
  { numeroPasta: `${PFX}-001`, numeroProcesso: "5000001-11.2026.8.13.0439", status: "Inativo", justificativaInativacao: "curta" },
]);
check("inativar sem justificativa válida é recusado", semJust.success === false && /Justificativa/i.test(semJust.error || ""), JSON.stringify(semJust));

const longa = "x".repeat(501);
const justLonga = await chamar(ADMIN, "editarProcessoFarmacia", [
  { numeroPasta: `${PFX}-001`, numeroProcesso: "5000001-11.2026.8.13.0439", status: "Inativo", justificativaInativacao: longa },
]);
check("justificativa acima de 500 é recusada", justLonga.success === false && /500/.test(justLonga.error || ""));

const inativou = await chamar(ADMIN, "editarProcessoFarmacia", [
  { numeroPasta: `${PFX}-001`, numeroProcesso: "5000001-11.2026.8.13.0439", status: "Inativo",
    justificativaInativacao: "Processo suspenso por determinação judicial em 19/11/2026." },
]);
check("inativar pela edição grava status e justificativa", inativou.success === true, JSON.stringify(inativou.error || ""));
const aposInativar = (await db.query("SELECT status, justificativa_inativacao AS j FROM farmacia_pacientes WHERE numero_pasta=$1", [`${PFX}-001`])).rows[0];
check("banco com status INATIVO", aposInativar?.status === "INATIVO" && /determinação judicial/.test(aposInativar.j || ""));
const audInativou = await db.query("SELECT acao FROM audit_logs WHERE entidade='PacienteJudicial' AND entidade_id=$1", [`${PFX}-001`]);
check("inativação auditada como DESATIVAR", audInativou.rows.some((r) => r.acao === "DESATIVAR"));

const reativou = await chamar(ADMIN, "editarProcessoFarmacia", [
  { numeroPasta: `${PFX}-001`, numeroProcesso: "5000001-11.2026.8.13.0439", status: "Ativo", justificativaInativacao: "" },
]);
check("reativar pela edição", reativou.success === true, JSON.stringify(reativou.error || ""));
const aposReativar = (await db.query("SELECT status, justificativa_inativacao AS j FROM farmacia_pacientes WHERE numero_pasta=$1", [`${PFX}-001`])).rows[0];
check("reativar preserva a justificativa anterior (histórico)",
  aposReativar?.status === "ATIVO" && /determinação judicial/.test(aposReativar.j || ""));
const audReativou = await db.query("SELECT acao FROM audit_logs WHERE entidade='PacienteJudicial' AND entidade_id=$1", [`${PFX}-001`]);
check("reativação auditada como REATIVAR", audReativou.rows.some((r) => r.acao === "REATIVAR"));

const semEdicao = await chamar(SEM_ADMIN, "editarProcessoFarmacia", [
  { numeroPasta: `${PFX}-001`, numeroProcesso: "5000001-11.2026.8.13.0439", status: "Ativo" },
]);
check("operador sem permissão de editar é recusado", semEdicao.success === false);

console.log("\n2.2 Novo processo sempre ATIVO (backend)");
const novo = await chamar(ADMIN, "createPacienteJudicial", [
  { cpf: CPFS[2], numeroPasta: `${PFX}-003`, numeroProcesso: "5000003-33.2026.8.13.0439",
    status: "Inativo", justificativaInativacao: "Tentativa de inativar no cadastro (deve ser ignorada).", medicamentos: [] },
]);
check("cadastro aceita e grava ATIVO mesmo recebendo Inativo", novo.success === true, JSON.stringify(novo.error || ""));
const novoDb = (await db.query("SELECT status, justificativa_inativacao AS j FROM farmacia_pacientes WHERE numero_pasta=$1", [`${PFX}-003`])).rows[0];
check("processo novo no banco está ATIVO e sem justificativa", novoDb?.status === "ATIVO" && !novoDb.j);
await db.query("DELETE FROM farmacia_pacientes WHERE numero_pasta=$1", [`${PFX}-003`]);

console.log("\n3. Exclusão protegida");
const semConf = await chamar(ADMIN, "excluirProcessoFarmacia", [`${PFX}-001`, {}]);
check("exclusão exige confirmação", semConf.success === false && /confirmada/i.test(semConf.error || ""));

const lote = await db.query("SELECT id FROM farmacia_lotes_medicamentos LIMIT 1");
if (lote.rowCount === 0) {
  await db.query(
    `INSERT INTO farmacia_lotes_medicamentos (medicamento_id,numero_lote,fornecedor,qtd_inicial,valor_unitario,data_entrada,data_validade)
     VALUES ($1,'TSTFC-L1','Fornecedor Teste',100,1.50,CURRENT_DATE,CURRENT_DATE + 365)`, [m1]);
}
const loteId = (await db.query("SELECT id FROM farmacia_lotes_medicamentos LIMIT 1")).rows[0].id;
await db.query(
  `INSERT INTO farmacia_dispensacoes_medicamentos (paciente_pasta,lote_medicamento_id,qtd_entregue,data_dispensacao)
   VALUES ($1,$2,10,now())`, [`${PFX}-001`, loteId]);
const comDispensacao = await chamar(ADMIN, "excluirProcessoFarmacia", [`${PFX}-001`, { confirmado: true }]);
check("exclusão bloqueada quando há dispensação", comDispensacao.success === false && /dispensa/i.test(comDispensacao.error || ""));
const aindaExiste = await db.query("SELECT 1 FROM farmacia_pacientes WHERE numero_pasta=$1", [`${PFX}-001`]);
check("registro preservado após bloqueio", aindaExiste.rowCount === 1);

const semPermissao = await chamar(SEM_ADMIN, "excluirProcessoFarmacia", [`${PFX}-002`, { confirmado: true }]);
check("operador sem permissão não exclui", semPermissao.success === false);

const excl = await chamar(ADMIN, "excluirProcessoFarmacia", [`${PFX}-002`, { confirmado: true }]);
check("administrador exclui processo sem dispensação", excl.success === true, JSON.stringify(excl.error || ""));
const restou = await db.query("SELECT 1 FROM farmacia_pacientes WHERE numero_pasta=$1", [`${PFX}-002`]);
check("registro excluído do banco", restou.rowCount === 0);
const aud = await db.query("SELECT acao FROM audit_logs WHERE entidade='PacienteJudicial' AND entidade_id=$1", [`${PFX}-002`]);
check("exclusão auditada", aud.rows.some((r) => r.acao === "EXCLUIR"));

await db.query("DELETE FROM farmacia_dispensacoes_medicamentos WHERE paciente_pasta LIKE $1", [`${PFX}%`]);
await limpar();
await db.end();
console.log(`\n${ok} OK · ${falhas.length} FALHA(S)`);
if (falhas.length) console.log(falhas.join("\n"));
process.exit(falhas.length ? 1 : 0);
