/**
 * Catálogo PRÓPRIO de Especialidades e Procedimentos da área Processos.
 *
 * Verifica, com as server actions REAIS e sessões reais:
 *   1. cadastro de especialidade            8. validação do vínculo no backend
 *   2. edição de especialidade              9. cadastro de processo judicial
 *   3. inativação/reativação                10. edição de processo judicial
 *   4. cadastro de procedimento             11. consulta de processos
 *   5. vínculo procedimento ↔ especialidade 12. permissões de acesso
 *   6. filtragem por especialidade          13. independência da Junta Reguladora
 *   7. troca de especialidade no formulário 14. integridade das relações no banco
 *
 * Uso: node scripts/teste-catalogo-processos.mjs   (com o servidor no ar)
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
const segredo = new TextEncoder().encode(env.JWT_SECRET);

const CAT = {
  rota: "/camara-tecnica/processos/especialidades",
  arquivo: "camara-tecnica/processos/especialidades/actions",
};
const PROC = { rota: "/camara-tecnica/processos", arquivo: "camara-tecnica/processos/actions" };

let ok = 0;
let falhou = 0;
const falhas = [];
function check(nome, cond, extra = "") {
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhou += 1;
    falhas.push(nome);
    console.log(`  FALHA ${nome} ${extra}`);
  }
}

// ── Sessões reais ──────────────────────────────────────────────────────────
const sessoes = new Map();
async function tokenDe(cpf) {
  if (sessoes.has(cpf)) return sessoes.get(cpf);
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", [cpf])).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now() + interval '1 hour', now())`,
    [u.cpf, token],
  );
  sessoes.set(cpf, token);
  return token;
}

// ── Chamada de server action (mesmo protocolo do navegador) ────────────────
let manifest = null;
function actionId(nome, arquivo) {
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

const ROUTER_STATE = (rota) =>
  encodeURIComponent(JSON.stringify(["", { children: ["__PAGE__", {}] }, null, null, true]));

async function chamar(cpf, nome, args, { rota, arquivo }) {
  const token = await tokenDe(cpf);
  const id = actionId(nome, arquivo);
  if (!id) throw new Error(`server action "${nome}" não encontrada no manifest`);

  const form = new FormData();
  form.append("0", JSON.stringify(args));

  const r = await fetch(`${BASE}${rota}`, {
    method: "POST",
    headers: {
      cookie: `session_token=${token}`,
      "Next-Action": id,
      "Next-Router-State-Tree": ROUTER_STATE(rota),
      accept: "text/x-component",
    },
    body: form,
  });
  const texto = await r.text();
  for (const linha of texto.split("\n")) {
    if (!/^1:/.test(linha)) continue;
    try {
      const valor = JSON.parse(linha.slice(2));
      if (valor && typeof valor === "object") return valor;
    } catch {}
  }
  try {
    return JSON.parse(texto);
  } catch {
    return { success: false, error: `resposta não-JSON (${r.status})`, bruto: texto.slice(0, 160) };
  }
}

const cat = (cpf, nome, args) => chamar(cpf, nome, args, CAT);
const proc = (cpf, nome, args) => chamar(cpf, nome, args, PROC);

async function main() {
  await db.connect();
  const GESTOR = "00000000000";
  const JEFINNY = "12912453674"; // REGULACAO/SUPERVISOR — sem PROCESSOS

  console.log("\nPreparando…");
  await db.query("DELETE FROM processos_judiciais WHERE numero_processo LIKE 'TSTCAT-%'");
  await db.query("DELETE FROM processos_especialidade_procedimento");
  await db.query("DELETE FROM processos_procedimentos WHERE nome LIKE 'TSTCAT%'");
  await db.query("DELETE FROM processos_especialidades WHERE nome LIKE 'TSTCAT%'");

  const pessoa = (
    await db.query("SELECT cpf, nome_completo FROM pessoa WHERE ativo = true ORDER BY cpf LIMIT 1")
  ).rows[0];
  check("há paciente no cadastro único", Boolean(pessoa));

  // ── 1. Cadastro de especialidade ─────────────────────────────────────────
  console.log("\n1. Cadastro de especialidade");
  const e1 = await cat(GESTOR, "criarEspecialidadeProcesso", [{ nome: "TSTCAT Cardiologia" }]);
  check("cria especialidade", e1.success === true && Number.isInteger(e1.data?.id), JSON.stringify(e1).slice(0, 120));
  const e2 = await cat(GESTOR, "criarEspecialidadeProcesso", [{ nome: "TSTCAT Ortopedia" }]);
  check("cria segunda especialidade", e2.success === true);

  const duplicada = await cat(GESTOR, "criarEspecialidadeProcesso", [
    { nome: "  tstcat   CARDIOLOGIA " },
  ]);
  check(
    "nome equivalente (maiúsculas/espaços) é recusado",
    duplicada.success === false && /já existe/i.test(duplicada.error || ""),
    duplicada.error,
  );
  const vazia = await cat(GESTOR, "criarEspecialidadeProcesso", [{ nome: "   " }]);
  check("nome vazio é recusado", vazia.success === false);

  // ── 2. Edição de especialidade ───────────────────────────────────────────
  console.log("\n2. Edição de especialidade");
  const editada = await cat(GESTOR, "editarEspecialidadeProcesso", [
    e2.data.id,
    { nome: "TSTCAT Ortopedia e Traumatologia" },
  ]);
  check("edita o nome", editada.success === true && editada.data?.nome === "TSTCAT Ortopedia e Traumatologia", JSON.stringify(editada).slice(0, 140));

  const colisao = await cat(GESTOR, "editarEspecialidadeProcesso", [
    e2.data.id,
    { nome: "TSTCAT Cardiologia" },
  ]);
  check("edição não pode colidir com outra especialidade", colisao.success === false, colisao.error);

  // ── 4. Cadastro de procedimento ──────────────────────────────────────────
  console.log("\n4. Cadastro de procedimento");
  const p1 = await cat(GESTOR, "criarProcedimentoProcesso", [
    { nome: "TSTCAT Consulta Cardiológica", especialidadeIds: [e1.data.id] },
  ]);
  check("cria procedimento vinculado", p1.success === true && Number.isInteger(p1.data?.id), JSON.stringify(p1).slice(0, 140));
  const p2 = await cat(GESTOR, "criarProcedimentoProcesso", [
    { nome: "TSTCAT Ecocardiograma", especialidadeIds: [e1.data.id] },
  ]);
  check("cria segundo procedimento", p2.success === true);
  const p3 = await cat(GESTOR, "criarProcedimentoProcesso", [
    { nome: "TSTCAT Raio-X de Joelho", especialidadeIds: [e2.data.id] },
  ]);
  check("cria procedimento da outra especialidade", p3.success === true);

  const procDuplicado = await cat(GESTOR, "criarProcedimentoProcesso", [
    { nome: "tstcat ecocardiograma" },
  ]);
  check("procedimento duplicado é recusado", procDuplicado.success === false, procDuplicado.error);

  // ── 5. Vínculo N:N ───────────────────────────────────────────────────────
  console.log("\n5. Vínculo procedimento ↔ especialidade");
  const vincular = await cat(GESTOR, "definirProcedimentosDaEspecialidade", [
    e1.data.id,
    { procedimentoIds: [p1.data.id, p2.data.id, p3.data.id] },
  ]);
  check("procedimento pode atender a mais de uma especialidade", vincular.success === true, JSON.stringify(vincular).slice(0, 140));
  const pares = await db.query(
    "SELECT especialidade_id, procedimento_id FROM processos_especialidade_procedimento WHERE procedimento_id = $1 ORDER BY especialidade_id",
    [p3.data.id],
  );
  check("vínculo gravado nas duas especialidades", pares.rowCount === 2, pares.rowCount);

  // ── 6. Filtragem por especialidade ───────────────────────────────────────
  console.log("\n6. Filtragem de procedimentos por especialidade");
  const catalogo = await cat(GESTOR, "obterCatalogoParaFormulario", []);
  const espCardio = (catalogo.especialidades || []).find((e) => e.id === e1.data.id);
  const espOrto = (catalogo.especialidades || []).find((e) => e.id === e2.data.id);
  check("cardio lista só os seus procedimentos", (espCardio?.procedimentos || []).length === 3, (espCardio?.procedimentos || []).length);
  check("ortopedia lista o dela", (espOrto?.procedimentos || []).some((p) => p.id === p3.data.id));

  // ── 9. Cadastro de processo judicial ─────────────────────────────────────
  console.log("\n9. Cadastro de processo judicial");
  const criado = await proc(GESTOR, "criarProcesso", [
    {
      pacienteCpf: pessoa.cpf,
      numeroProcesso: "TSTCAT-0001",
      numeroPasta: "TSTCAT-P1",
      especialidadeId: e1.data.id,
      procedimentoId: p1.data.id,
    },
  ]);
  check("cadastra processo com catálogo próprio", criado.success === true && criado.data?.especialidadeId === e1.data.id, JSON.stringify(criado).slice(0, 160));
  const id = criado?.data?.id;

  // ── 8. Validação do vínculo no backend ───────────────────────────────────
  console.log("\n8. Validação do relacionamento no backend");
  // Remove o vínculo do p3 com a cardiologia e tenta gravar.
  await cat(GESTOR, "definirProcedimentosDaEspecialidade", [
    e1.data.id,
    { procedimentoIds: [p1.data.id, p2.data.id] },
  ]);
  const invalido = await proc(GESTOR, "criarProcesso", [
    {
      pacienteCpf: pessoa.cpf,
      numeroProcesso: "TSTCAT-0002",
      numeroPasta: "TSTCAT-P2",
      especialidadeId: e1.data.id,
      procedimentoId: p3.data.id,
    },
  ]);
  check(
    "procedimento não vinculado é barrado",
    invalido.success === false && /não está vinculado/i.test(invalido.error || ""),
    invalido.error,
  );
  const semEsp = await proc(GESTOR, "criarProcesso", [
    { pacienteCpf: pessoa.cpf, numeroProcesso: "TSTCAT-0003", numeroPasta: "X", procedimentoId: p1.data.id },
  ]);
  check("procedimento sem especialidade é barrado", semEsp.success === false);

  // ── 7. Troca de especialidade no formulário judicial ─────────────────────
  console.log("\n7. Troca de especialidade no formulário");
  const trocou = await proc(GESTOR, "editarProcesso", [
    id,
    {
      pacienteCpf: pessoa.cpf,
      numeroProcesso: "TSTCAT-0001",
      numeroPasta: "TSTCAT-P1",
      especialidadeId: e2.data.id,
      // a tela limpa o procedimento ao trocar de especialidade
      procedimentoId: null,
    },
  ]);
  check(
    "troca de especialidade grava a nova e limpa o procedimento",
    trocou.success === true &&
      trocou.data?.especialidadeId === e2.data.id &&
      trocou.data?.procedimentoId === null,
    JSON.stringify(trocou).slice(0, 160),
  );
  const voltou = await proc(GESTOR, "editarProcesso", [
    id,
    {
      pacienteCpf: pessoa.cpf,
      numeroProcesso: "TSTCAT-0001",
      numeroPasta: "TSTCAT-P1",
      especialidadeId: e1.data.id,
      procedimentoId: p2.data.id,
    },
  ]);
  check("volta com especialidade e procedimento válidos", voltou.success === true && voltou.data?.procedimentoId === p2.data.id, JSON.stringify(voltou).slice(0, 160));

  // ── 11. Consulta ─────────────────────────────────────────────────────────
  console.log("\n11. Consulta de processos");
  const lista = await proc(GESTOR, "listarProcessos", [{ termo: "TSTCAT-0001" }]);
  check("consulta encontra o processo", lista.success === true && (lista.data || []).some((p) => p.id === id));
  check("consulta traz os nomes do catálogo", (lista.data || [])[0]?.especialidadeNome === "TSTCAT Cardiologia", (lista.data || [])[0]?.especialidadeNome);

  // ── 3. Inativação ────────────────────────────────────────────────────────
  console.log("\n3. Inativação de especialidade/procedimento");
  const inativaProc = await cat(GESTOR, "alterarSituacaoProcedimentoProcesso", [p2.data.id, { ativo: false }]);
  check("inativa procedimento", inativaProc.success === true && inativaProc.data?.ativo === false);
  const catDepois = await cat(GESTOR, "obterCatalogoParaFormulario", []);
  const espDepois = (catDepois.especialidades || []).find((e) => e.id === e1.data.id);
  check("procedimento inativo sai do formulário", !(espDepois?.procedimentos || []).some((p) => p.id === p2.data.id));
  const detalhe = await proc(GESTOR, "obterProcesso", [id]);
  check(
    "processo histórico preserva o procedimento inativo",
    detalhe.data?.procedimentoId === p2.data.id && detalhe.data?.procedimentoInativo === true,
    JSON.stringify(detalhe.data || {}).slice(0, 160),
  );
  const inativaEsp = await cat(GESTOR, "alterarSituacaoEspecialidadeProcesso", [e2.data.id, { ativo: false }]);
  check("inativa especialidade", inativaEsp.success === true && inativaEsp.data?.ativo === false);
  const catDepois2 = await cat(GESTOR, "obterCatalogoParaFormulario", []);
  check("especialidade inativa sai do formulário", !(catDepois2.especialidades || []).some((e) => e.id === e2.data.id));
  const novoComInativa = await proc(GESTOR, "criarProcesso", [
    { pacienteCpf: pessoa.cpf, numeroProcesso: "TSTCAT-0004", numeroPasta: "X", especialidadeId: e2.data.id },
  ]);
  check("não permite cadastro com especialidade inativa", novoComInativa.success === false, novoComInativa.error);
  const reativa = await cat(GESTOR, "alterarSituacaoEspecialidadeProcesso", [e2.data.id, { ativo: true }]);
  check("reativa especialidade", reativa.success === true && reativa.data?.ativo === true);

  // ── 12. Permissões ───────────────────────────────────────────────────────
  console.log("\n12. Permissões de acesso");
  const negVer = await cat(JEFINNY, "listarCatalogoProcessos", [{}]);
  check("catálogo negado a quem não tem PROCESSOS", negVer.success !== true);
  const negCriar = await cat(JEFINNY, "criarEspecialidadeProcesso", [{ nome: "TSTCAT Invasao" }]);
  check("criação de especialidade negada sem permissão", negCriar.success !== true);
  const negVinc = await cat(JEFINNY, "definirProcedimentosDaEspecialidade", [e1.data.id, { procedimentoIds: [] }]);
  check("gestão de vínculos negada sem permissão", negVinc.success !== true);
  const negProc = await proc(JEFINNY, "criarProcesso", [
    { pacienteCpf: pessoa.cpf, numeroProcesso: "TSTCAT-9999", numeroPasta: "X" },
  ]);
  check("cadastro de processo negado sem permissão", negProc.success !== true);

  // ── 13. Independência da Junta Reguladora ────────────────────────────────
  console.log("\n13. Independência da Junta Reguladora");
  const coluna = await db.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name='junta_especialidades' AND column_name='tipo_exame_id'`,
  );
  check("junta_especialidades não tem coluna de Processos", coluna.rowCount === 0);
  const fks = await db.query(
    `SELECT conname, confrelid::regclass::text AS tabela
       FROM pg_constraint
      WHERE conrelid = 'processos_judiciais'::regclass AND contype = 'f'`,
  );
  const tabelasRef = fks.rows.map((r) => r.tabela);
  check("processo só referencia tabelas da área Processos + Pessoa", tabelasRef.every((t) => /^(processos_|pessoa)/.test(t)), tabelasRef.join(", "));
  const catJuntaAntes = (await db.query("SELECT count(*)::int AS n FROM junta_especialidades")).rows[0].n;
  await cat(GESTOR, "criarEspecialidadeProcesso", [{ nome: "TSTCAT Neurologia" }]);
  const catJuntaDepois = (await db.query("SELECT count(*)::int AS n FROM junta_especialidades")).rows[0].n;
  check("cadastro em Processos não altera junta_especialidades", catJuntaAntes === catJuntaDepois, `${catJuntaAntes}→${catJuntaDepois}`);
  const catProc = (await db.query("SELECT count(*)::int AS n FROM processos_especialidades")).rows[0].n;
  check("cadastro vai para processos_especialidades", catProc >= 3, catProc);

  // ── 14. Integridade no banco ─────────────────────────────────────────────
  console.log("\n14. Integridade das relações no banco");
  const orfao = await db.query(
    `SELECT count(*)::int AS n FROM processos_especialidade_procedimento v
      WHERE NOT EXISTS (SELECT 1 FROM processos_especialidades e WHERE e.id = v.especialidade_id)
         OR NOT EXISTS (SELECT 1 FROM processos_procedimentos p WHERE p.id = v.procedimento_id)`,
  );
  check("sem vínculos órfãos", orfao.rows[0].n === 0, orfao.rows[0].n);
  const dupChave = await db.query(
    `SELECT nome_chave, count(*) FROM processos_especialidades GROUP BY 1 HAVING count(*) > 1`,
  );
  check("nome_chave único no catálogo de especialidades", dupChave.rowCount === 0);
  const dupPar = await db.query(
    `SELECT especialidade_id, procedimento_id, count(*) FROM processos_especialidade_procedimento
      GROUP BY 1,2 HAVING count(*) > 1`,
  );
  check("par especialidade/procedimento único", dupPar.rowCount === 0);
  const procInvalido = await db.query(
    `SELECT count(*)::int AS n FROM processos_judiciais pj
      WHERE pj.procedimento_id IS NOT NULL AND pj.especialidade_id IS NULL`,
  );
  check("processo nunca tem procedimento sem especialidade", procInvalido.rows[0].n === 0);

  // ── Auditoria do catálogo ────────────────────────────────────────────────
  console.log("\n15. Auditoria do catálogo");
  const aud = await db.query(
    `SELECT acao, entidade FROM audit_logs
      WHERE entidade IN ('ProcessoEspecialidade','ProcessoProcedimento','ProcessoEspecialidadeProcedimento')`,
  );
  check("auditoria registra criação de especialidade", aud.rows.some((r) => r.entidade === "ProcessoEspecialidade" && r.acao === "CRIAR"));
  check("auditoria registra inativação", aud.rows.some((r) => r.acao === "INATIVAR"));
  check("auditoria registra vínculos", aud.rows.some((r) => r.entidade === "ProcessoEspecialidadeProcedimento"));

  // limpeza
  await db.query("DELETE FROM processos_judiciais WHERE numero_processo LIKE 'TSTCAT-%'");
  await db.query("DELETE FROM processos_especialidade_procedimento");
  await db.query("DELETE FROM processos_procedimentos WHERE nome LIKE 'TSTCAT%'");
  await db.query("DELETE FROM processos_especialidades WHERE nome LIKE 'TSTCAT%'");
  for (const token of sessoes.values()) {
    await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
  }
  await db.end();

  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  if (falhas.length) console.log("Falhas: " + falhas.join(" | "));
  process.exit(falhou === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
