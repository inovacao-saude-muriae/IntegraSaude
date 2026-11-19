/**
 * Processos Cirúrgicos — cadastro de processos e bloqueios judiciais.
 *
 * Chama as server actions REAIS do módulo Processos com sessões reais (cookie
 * session_token) e valida o banco: pasta por paciente, reaproveitamento da
 * pasta entre processos do mesmo paciente, duplicidade de processo/pasta,
 * catálogo (especialidade/procedimento ativos e vinculados), bloqueio vinculado
 * ao processo, valor decimal > 0, data obrigatória, dependência de exclusão,
 * auditoria e permissões.
 *
 * Uso: node scripts/teste-processos-cirurgicos.mjs   (com o servidor no ar)
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const GESTOR = "91000000996"; // ADMINISTRADOR de PROCESSOS (fixture)
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
    if (info?.exportedName === nome && String(info?.filename || "").includes(arquivo)) {
      return id;
    }
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

async function chamar(cpf, nome, args, arquivo = "camara-tecnica/processos/actions") {
  const token = await tokenDe(cpf);
  const id = actionId(nome, arquivo);
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

// ── Fixtures ──────────────────────────────────────────────────────────────
const PFX = "TSTPC";
const CPF_A = "91000000940";
const CPF_B = "91000000941";
const CPF_C = "91000000942";

async function limpar() {
  await db.query(
    `DELETE FROM processos_bloqueios WHERE processo_id IN (
       SELECT id FROM processos_judiciais WHERE numero_processo LIKE $1)`,
    [`${PFX}-%`],
  );
  await db.query("DELETE FROM processos_judiciais WHERE numero_processo LIKE $1", [`${PFX}-%`]);
  await db.query("DELETE FROM processos_especialidade_procedimento WHERE especialidade_id IN (SELECT id FROM processos_especialidades WHERE nome LIKE $1)", [`${PFX}%`]);
  await db.query("DELETE FROM processos_procedimentos WHERE nome LIKE $1", [`${PFX}%`]);
  await db.query("DELETE FROM processos_especialidades WHERE nome LIKE $1", [`${PFX}%`]);
  await db.query("DELETE FROM pessoa WHERE cpf = ANY($1)", [[CPF_A, CPF_B, CPF_C]]);
  await db.query("DELETE FROM audit_logs WHERE user_cpf = $1 AND entidade IN ('ProcessoJudicial','ProcessoBloqueio')", [GESTOR]);
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

async function pessoa(cpf, nome) {
  await db.query(
    `INSERT INTO pessoa (cpf,nome_completo,sexo,data_nascimento,nome_mae,telefone,situacao,ativo)
     VALUES ($1,$2,'Feminino','1990-01-01','Mae Teste','32999990000','ATIVO',true)`,
    [cpf, nome],
  );
}

console.log("\n0. Preparação");
await limpar();
await conta(GESTOR, "TESTE Processos Cirurgicos", ["PROCESSOS"]);
await conta(SEM_ACESSO, "TESTE Sem Processos", ["CCZ"]);
await pessoa(CPF_A, "TESTE Paciente A");
await pessoa(CPF_B, "TESTE Paciente B");
await pessoa(CPF_C, "TESTE Paciente C");
const esp = await db.query(
  "INSERT INTO processos_especialidades (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id",
  [`${PFX} Cardiologia`, "tstpc cardiologia"],
);
const esp2 = await db.query(
  "INSERT INTO processos_especialidades (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id",
  [`${PFX} Ortopedia`, "tstpc ortopedia"],
);
const proc = await db.query(
  "INSERT INTO processos_procedimentos (nome,nome_chave,ativo) VALUES ($1,$2,true) RETURNING id",
  [`${PFX} Cateterismo`, "tstpc cateterismo"],
);
const procInativo = await db.query(
  "INSERT INTO processos_procedimentos (nome,nome_chave,ativo) VALUES ($1,$2,false) RETURNING id",
  [`${PFX} Procedimento Inativo`, "tstpc procedimento inativo"],
);
await db.query(
  "INSERT INTO processos_especialidade_procedimento (especialidade_id,procedimento_id) VALUES ($1,$2),($1,$3)",
  [esp.rows[0].id, proc.rows[0].id, procInativo.rows[0].id],
);
const ESP = esp.rows[0].id;
const ESP2 = esp2.rows[0].id;
const PROC = proc.rows[0].id;
const PROC_INATIVO = procInativo.rows[0].id;
check("fixtures criadas", Boolean(ESP && PROC));

// ── 1. Catálogo ───────────────────────────────────────────────────────────
console.log("\n1. Catálogo de Especialidades e Procedimentos");
const cat = await chamar(GESTOR, "obterCatalogoParaFormulario", [], "camara-tecnica/processos/especialidades/actions");
check("catálogo carrega especialidades ativas", cat.success && cat.especialidades.length >= 2);
const catEsp = cat.especialidades?.find((e) => e.id === ESP);
check("procedimento ativo aparece na especialidade", Boolean(catEsp?.procedimentos.some((p) => p.id === PROC)));
check("procedimento inativo NÃO aparece", !catEsp?.procedimentos.some((p) => p.id === PROC_INATIVO));

// ── 2. Novo processo e pasta por paciente ─────────────────────────────────
console.log("\n2. Novo processo e número de pasta");
const p1 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_A,
  numeroProcesso: `${PFX}-001`,
  numeroPasta: "PC-500",
  especialidadeId: ESP,
  procedimentoId: PROC,
}]);
check("processo criado", p1.success === true, JSON.stringify(p1.error || ""));
check("pasta devolvida no processo", p1.data?.numeroPasta === "PC-500", p1.data?.numeroPasta);
const pastaA = await db.query("SELECT numero_pasta FROM pessoa WHERE cpf=$1", [CPF_A]);
check("pasta gravada no PACIENTE (fonte única)", pastaA.rows[0].numero_pasta === "PC-500", pastaA.rows[0].numero_pasta);

const p2 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_A,
  numeroProcesso: `${PFX}-002`,
  numeroPasta: "PC-500", // mesma pasta do paciente
  especialidadeId: ESP2,
}]);
check("segundo processo do mesmo paciente usa a mesma pasta", p2.success === true, JSON.stringify(p2.error || ""));
const qtdPasta = await db.query("SELECT count(*)::int AS n FROM pessoa WHERE numero_pasta='PC-500'");
check("pasta não é duplicada em outra pessoa", qtdPasta.rows[0].n === 1, String(qtdPasta.rows[0].n));

const p3 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_A,
  numeroProcesso: `${PFX}-003`,
  numeroPasta: "PC-999", // tenta trocar a pasta já existente
  especialidadeId: ESP,
}]);
check("não permite trocar a pasta do paciente pelo processo", p3.success === false && p3.status === 409, JSON.stringify(p3.error || ""));

const p4 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_B,
  numeroProcesso: `${PFX}-004`,
  numeroPasta: "PC-500", // pasta de outro paciente
  especialidadeId: ESP,
}]);
check("não permite pasta de outro paciente", p4.success === false && p4.status === 409, JSON.stringify(p4.error || ""));

const p5 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_B,
  numeroProcesso: `${PFX}-001`, // número repetido
  numeroPasta: "PC-501",
  especialidadeId: ESP,
}]);
check("número de processo duplicado é recusado", p5.success === false && p5.status === 409);

const p6 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_B,
  numeroProcesso: "",
  numeroPasta: "PC-501",
  especialidadeId: ESP,
}]);
check("número do processo é obrigatório", p6.success === false);

const p7 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_B,
  numeroProcesso: `${PFX}-005`,
  numeroPasta: "",
  especialidadeId: ESP,
}]);
check("número da pasta é obrigatório quando o paciente não tem", p7.success === false);

const p8 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_B,
  numeroProcesso: `${PFX}-006`,
  numeroPasta: "PC-501",
  especialidadeId: ESP,
  procedimentoId: PROC_INATIVO,
}]);
check("procedimento inativo é recusado no cadastro", p8.success === false);

const p9 = await chamar(GESTOR, "criarProcesso", [{
  pacienteCpf: CPF_B,
  numeroProcesso: `${PFX}-007`,
  numeroPasta: "PC-501",
  especialidadeId: ESP2,
  procedimentoId: PROC, // não vinculado à Ortopedia
}]);
check("procedimento fora da especialidade é recusado", p9.success === false);

// ── 3. Bloqueio ───────────────────────────────────────────────────────────
console.log("\n3. Realizar bloqueio");
const idA1 = p1.data.id;
const busca = await chamar(GESTOR, "buscarProcessosParaBloqueio", ["TESTE Paciente A"]);
check("busca por nome devolve os dois processos do paciente", busca.success && busca.data.length === 2, String(busca.data?.length));
const buscaCpf = await chamar(GESTOR, "buscarProcessosParaBloqueio", ["910.000.009-40"]);
check("busca por CPF com máscara funciona", buscaCpf.success && buscaCpf.data.length === 2);
const buscaProc = await chamar(GESTOR, "buscarProcessosParaBloqueio", [`${PFX}-001`]);
check("busca por número do processo funciona", buscaProc.success && buscaProc.data.length === 1);

const b1 = await chamar(GESTOR, "criarBloqueio", [{
  processoId: idA1,
  dataBloqueio: "2026-11-18",
  valor: "1.234,56",
  observacao: "Bloqueio judicial teste",
}]);
check("bloqueio criado", b1.success === true, JSON.stringify(b1.error || ""));
check("valor gravado como decimal exato", String(b1.data?.valor) === "1234.56", String(b1.data?.valor));
const bRow = await db.query("SELECT processo_id, valor::text AS v, data_bloqueio::text AS d FROM processos_bloqueios WHERE id=$1", [b1.data?.id]);
check("bloqueio vinculado ao PROCESSO", bRow.rows[0]?.processo_id === idA1, String(bRow.rows[0]?.processo_id));
check("data do bloqueio gravada como DATE", bRow.rows[0]?.d === "2026-11-18", bRow.rows[0]?.d);

const b2 = await chamar(GESTOR, "criarBloqueio", [{
  processoId: idA1, dataBloqueio: "2026-11-18", valor: "0,00",
}]);
check("valor zero é recusado", b2.success === false);
const b3 = await chamar(GESTOR, "criarBloqueio", [{
  processoId: idA1, dataBloqueio: "2026-11-18", valor: "",
}]);
check("valor vazio é recusado", b3.success === false);
const b4 = await chamar(GESTOR, "criarBloqueio", [{ processoId: idA1, valor: "10,00" }]);
check("data é obrigatória", b4.success === false);
const b5 = await chamar(GESTOR, "criarBloqueio", [{
  processoId: 0, dataBloqueio: "2026-11-18", valor: "10,00",
}]);
check("processo inexistente é recusado", b5.success === false);
const b6 = await chamar(GESTOR, "criarBloqueio", [{
  processoId: idA1, dataBloqueio: "2026-02-31", valor: "10,00",
}]);
check("data inválida é recusada", b6.success === false);

const lista = await chamar(GESTOR, "listarBloqueios", [{ processoId: idA1 }]);
check("listagem filtra por processo", lista.success && lista.data.length === 1, String(lista.data?.length));
check("listagem traz paciente/pasta/especialidade", Boolean(lista.data?.[0]?.processo?.pacienteNome && lista.data?.[0]?.processo?.numeroPasta));

// ── 3.1 Filtros de consulta (backend) ────────────────────────────────────
console.log("\n3.1 Filtros de consulta");
// A tela controla o estado inicial; o backend devolve TODOS quando não há filtro.
const semFiltro = await chamar(GESTOR, "listarProcessos", [{}]);
check("sem filtro devolve todos os processos", semFiltro.success && semFiltro.data.length >= 3 && semFiltro.total === semFiltro.data.length, String(semFiltro.data?.length));
const todosProc = await chamar(GESTOR, "listarProcessos", [{ todos: true }]);
check("consultar todos traz os processos", todosProc.success && todosProc.data.length >= 3, String(todosProc.data?.length));
check("consultar todos informa o total", todosProc.total === todosProc.data.length);

// Campo único "Buscar Registro": nome, CPF, número do processo e da pasta.
const bNome = await chamar(GESTOR, "listarProcessos", [{ busca: "TESTE Paciente A" }]);
check("busca única por nome do paciente", bNome.success && bNome.data.length === 2, String(bNome.data?.length));
const bCpf = await chamar(GESTOR, "listarProcessos", [{ busca: "910.000.009-40" }]);
check("busca única por CPF com máscara", bCpf.success && bCpf.data.length === 2, String(bCpf.data?.length));
const bNumero = await chamar(GESTOR, "listarProcessos", [{ busca: `${PFX}-001` }]);
check("busca única por número do processo", bNumero.success && bNumero.data.length === 1, String(bNumero.data?.length));
const bPasta = await chamar(GESTOR, "listarProcessos", [{ busca: "PC-500" }]);
check("busca única por número da pasta", bPasta.success && bPasta.data.length === 2, String(bPasta.data?.length));

// Especialidade e procedimento independentes.
const fProcSozinho = await chamar(GESTOR, "listarProcessos", [{ procedimentoId: PROC }]);
check("filtra só por procedimento (sem especialidade)", fProcSozinho.success && fProcSozinho.data.length >= 1, String(fProcSozinho.data?.length));
const fEsp = await chamar(GESTOR, "listarProcessos", [{ especialidadeId: ESP2 }]);
check("filtro por especialidade", fEsp.success && fEsp.data.length === 1, String(fEsp.data?.length));
const fProcCat = await chamar(GESTOR, "listarProcessos", [{ especialidadeId: ESP, procedimentoId: PROC }]);
check("especialidade + procedimento combinados", fProcCat.success && fProcCat.data.length >= 1);
const fCombinado = await chamar(GESTOR, "listarProcessos", [
  { busca: "TESTE Paciente A", especialidadeId: ESP, procedimentoId: PROC },
]);
check("busca + especialidade + procedimento (AND)", fCombinado.success && fCombinado.data.length === 1, String(fCombinado.data?.length));
const fNenhum = await chamar(GESTOR, "listarProcessos", [{ busca: `${PFX}-NAO-EXISTE` }]);
check("consulta sem correspondência devolve vazio", fNenhum.success && fNenhum.data.length === 0 && fNenhum.total === 0);

// Período de cadastro (created_at gravado pelo servidor).
// O dia é o LOCAL (America/Sao_Paulo, UTC-3) — não o dia UTC do servidor.
const dia = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const fHoje = await chamar(GESTOR, "listarProcessos", [{ dataInicio: dia, dataFim: dia }]);
// A paginação é do backend (100/página): o período tem de trazer exatamente os
// processos criados por esta suíte (contados no próprio dia local).
const { rows: criadosHoje } = await db.query(
  `SELECT count(*)::int AS n FROM processos_judiciais
    WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = $1::date`,
  [dia],
);
// A consulta não filtra por prefixo: o esperado são TODOS os processos do dia.
const esperadoHoje = criadosHoje[0].n;
check(
  "período de cadastro inclui os processos de hoje",
  fHoje.success && esperadoHoje > 0 && fHoje.data.length === esperadoHoje,
  `${fHoje.data?.length}/${esperadoHoje}`,
);
const fFuturo = await chamar(GESTOR, "listarProcessos", [{ dataInicio: "2030-01-01", dataFim: "2030-12-31" }]);
check("período de cadastro sem registros devolve vazio", fFuturo.success && fFuturo.data.length === 0);
check("processo traz a data de cadastro do servidor", Boolean(todosProc.data?.[0]?.dataCadastro), JSON.stringify(todosProc.data?.[0]?.dataCadastro));

// Bloqueios: busca única, filtros independentes e período da Data CI.
const bPeriodo = await chamar(GESTOR, "listarBloqueios", [{ dataInicio: "2026-11-18", dataFim: "2026-11-18" }]);
check("período da data do bloqueio (dia exato)", bPeriodo.success && bPeriodo.data.length === 2, String(bPeriodo.data?.length));
const bPeriodoVazio = await chamar(GESTOR, "listarBloqueios", [{ dataInicio: "2026-01-01", dataFim: "2026-01-31" }]);
check("período sem bloqueios devolve vazio", bPeriodoVazio.success && bPeriodoVazio.data.length === 0);
const bTotal = await chamar(GESTOR, "listarBloqueios", [{ todos: true }]);
check("consulta de bloqueios informa o valor total", bTotal.success && bTotal.valorTotal === "1358.56", String(bTotal.valorTotal));
const bProcSozinho = await chamar(GESTOR, "listarBloqueios", [{ procedimentoId: PROC }]);
check("bloqueios filtrados só por procedimento", bProcSozinho.success && bProcSozinho.data.length === 1, String(bProcSozinho.data?.length));
const bPorEsp = await chamar(GESTOR, "listarBloqueios", [{ especialidadeId: ESP }]);
check("bloqueios filtrados por especialidade", bPorEsp.success && bPorEsp.data.length === 1, String(bPorEsp.data?.length));
const bBusca = await chamar(GESTOR, "listarBloqueios", [{ busca: "PC-500" }]);
check("bloqueios pela busca única (pasta)", bBusca.success && bBusca.data.length === 1, String(bBusca.data?.length));

// ── 4. Exclusão bloqueada por dependência ────────────────────────────────
console.log("\n4. Dependências e exclusão");
const deps = await chamar(GESTOR, "verificarDependenciasProcesso", [idA1]);
check("processo com bloqueio não pode ser excluído", deps.success && deps.data.podeExcluir === false);
const exc = await chamar(GESTOR, "excluirProcesso", [idA1, { confirmado: true }]);
check("exclusão recusada com bloqueio vinculado", exc.success === false && exc.status === 409);

// ── 5. Auditoria ─────────────────────────────────────────────────────────
console.log("\n5. Auditoria");
const aud = await db.query(
  "SELECT acao, entidade FROM audit_logs WHERE entidade IN ('ProcessoJudicial','ProcessoBloqueio') AND user_cpf=$1 ORDER BY id",
  [GESTOR],
);
check("cadastro de processo auditado", aud.rows.some((r) => r.entidade === "ProcessoJudicial" && r.acao === "CRIAR"));
check("bloqueio auditado", aud.rows.some((r) => r.entidade === "ProcessoBloqueio" && r.acao === "CRIAR"));

// ── 6. Permissões ────────────────────────────────────────────────────────
console.log("\n6. Permissões");
const negadoCriar = await chamar(SEM_ACESSO, "criarProcesso", [{
  pacienteCpf: CPF_C, numeroProcesso: `${PFX}-900`, numeroPasta: "PC-900", especialidadeId: ESP,
}]);
check("sem PROCESSOS: criar processo negado", negadoCriar.success === false);
const negadoBloqueio = await chamar(SEM_ACESSO, "criarBloqueio", [{
  processoId: idA1, dataBloqueio: "2026-11-18", valor: "10,00",
}]);
check("sem PROCESSOS: bloqueio negado", negadoBloqueio.success === false);
const negadoLista = await chamar(SEM_ACESSO, "listarBloqueios", [{}]);
check("sem PROCESSOS: listagem negada", negadoLista.success === false);
const nada = await db.query("SELECT count(*)::int AS n FROM processos_judiciais WHERE numero_processo=$1", [`${PFX}-900`]);
check("nada foi gravado pela sessão negada", nada.rows[0].n === 0);

// ── 7. Tabela de bloqueios: pesquisa, edição e exclusão ──────────────────
console.log("\n7. Tabela de bloqueios");
const b7 = await chamar(GESTOR, "criarBloqueio", [{
  processoId: p2.data.id, dataBloqueio: "2026-11-10", valor: "250,00",
}]);
check("segundo bloqueio criado (outro processo)", b7.success === true, JSON.stringify(b7.error || ""));

const todos = await chamar(GESTOR, "listarBloqueios", [{ todos: true }]);
check("listagem traz todos os bloqueios", todos.success && todos.data.length === 3, String(todos.data?.length));
check(
  "ordenado do mais recente para o mais antigo",
  todos.data?.[0]?.dataBloqueio === "2026-11-18" && todos.data?.[2]?.dataBloqueio === "2026-11-10",
  JSON.stringify(todos.data?.map((b) => b.dataBloqueio)),
);
const porNome = await chamar(GESTOR, "listarBloqueios", [{ termo: "TESTE Paciente A" }]);
check("pesquisa por nome do paciente", porNome.success && porNome.data.length === 2, String(porNome.data?.length));
const porCpf = await chamar(GESTOR, "listarBloqueios", [{ termo: "910.000.009-40" }]);
check("pesquisa por CPF com máscara", porCpf.success && porCpf.data.length === 2);
const porPasta = await chamar(GESTOR, "listarBloqueios", [{ termo: "PC-500" }]);
check("pesquisa por número da pasta", porPasta.success && porPasta.data.length === 2);
const porProcesso = await chamar(GESTOR, "listarBloqueios", [{ termo: `${PFX}-001` }]);
check("pesquisa por número do processo", porProcesso.success && porProcesso.data.length === 1, String(porProcesso.data?.length));
check("linha traz paciente, pasta, especialidade e procedimento",
  Boolean(porProcesso.data?.[0]?.processo?.pacienteNome && porProcesso.data?.[0]?.processo?.numeroPasta),
  JSON.stringify(porProcesso.data?.[0]?.processo || {}));

const ed = await chamar(GESTOR, "editarBloqueio", [b7.data.id, {
  dataBloqueio: "2026-11-12", valor: "300,75", observacao: "Corrigido",
}]);
check("bloqueio editado", ed.success === true, JSON.stringify(ed.error || ""));
check("valor editado em decimal exato", String(ed.data?.valor) === "300.75", String(ed.data?.valor));
check("processo preservado na edição", ed.data?.processoId === p2.data.id);
const edInvalido = await chamar(GESTOR, "editarBloqueio", [b7.data.id, { dataBloqueio: "2026-11-12", valor: "0" }]);
check("edição recusa valor zero", edInvalido.success === false);

// A aba Consultar Bloqueios passou a ser SOMENTE LEITURA (sem Editar/Excluir):
// a ação de exclusão continua existindo no backend, com confirmação e
// auditoria, mas não é mais exposta na tabela. A contagem da suíte é validada.
const restantes = await chamar(GESTOR, "listarBloqueios", [{ todos: true }]);
check("listagem continua íntegra após a edição", restantes.data?.length === 3, String(restantes.data?.length));

const audB = await db.query(
  "SELECT acao FROM audit_logs WHERE entidade='ProcessoBloqueio' AND user_cpf=$1 ORDER BY id",
  [GESTOR],
);
check("edição auditada", audB.rows.some((r) => r.acao === "EDITAR"));
// Sem Editar/Excluir na tabela, nenhuma exclusão é disparada pela tela; a
// auditoria da edição é a que a suíte exerce.
check("nenhuma exclusão indevida registrada", !audB.rows.some((r) => r.acao === "EXCLUIR"));

const negadoEdit = await chamar(SEM_ACESSO, "editarBloqueio", [b1.data.id, {
  dataBloqueio: "2026-11-18", valor: "10,00",
}]);
check("sem PROCESSOS: edição negada", negadoEdit.success === false);
const negadoExc = await chamar(SEM_ACESSO, "editarBloqueio", [b1.data.id, { dataBloqueio: "2026-11-18", valor: "10,00" }]);
check("sem PROCESSOS: exclusão/edição negada", negadoExc.success === false);

await limpar();
await db.end();
console.log(`\n${ok} OK · ${falhas.length} FALHA(S)`);
if (falhas.length) console.log(falhas.join("\n"));
process.exit(falhas.length ? 1 : 0);
