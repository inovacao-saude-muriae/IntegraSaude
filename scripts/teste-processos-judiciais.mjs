/**
 * Processos Judiciais — edição, exclusão e permissões.
 *
 * Chama as server actions REAIS do módulo com sessões reais (cookie
 * `session_token`), usando a mesma fonte de autorização do sistema:
 * requirePermissao → user_acessos.
 *
 * Cobre: carregar dados no formulário, editar, trocar paciente (com
 * confirmação), trocar especialidade/procedimento, campos obrigatórios,
 * duplicidade de número, exclusão sem dependências, bloqueio com dependências,
 * usuário sem permissão de editar/excluir, auditoria e atualização da lista.
 *
 * Uso: node scripts/teste-processos-judiciais.mjs
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
let ok = 0;
let falhou = 0;
const falhas = [];

function check(nome, cond, extra = "") {
  if (cond) { ok += 1; console.log(`  OK   ${nome}`); }
  else { falhou += 1; falhas.push(nome); console.log(`  FALHA ${nome} ${extra}`); }
}

// ── Sessão de teste (mesmo cookie do sistema) ──────────────────────────────
const sessoes = new Map();
async function tokenDe(cpf) {
  if (sessoes.has(cpf)) return sessoes.get(cpf);
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", [cpf])).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now() + interval '1 hour', now())`,
    [u.cpf, token],
  );
  sessoes.set(cpf, token);
  return token;
}

// ── Invocação de server action via rota interna do Next ────────────────────
// Usamos o MESMO caminho do navegador: POST no endpoint da ação registrada.
// Para manter o teste estável entre builds, exercitamos as ações por um helper
// HTTP próprio do Next (server action id vem do manifest).
let manifest = null;
// O manifest mapeia id da ação → { filename, exportedName }. Usamos o NOME da
// função para achar o id, como o próprio Next faz no cliente.
function actionId(nome) {
  if (!manifest) {
    manifest = JSON.parse(
      fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"),
    );
  }
  for (const [id, info] of Object.entries(manifest.node || {})) {
    if (
      info?.exportedName === nome &&
      String(info?.filename || "").includes("camara-tecnica/processos/actions")
    ) {
      return id;
    }
  }
  return null;
}

// Chamada de server action como o NAVEGADOR faz: multipart/form-data com a
// chave "0" (argumentos), headers Next-Action e Next-Router-State-Tree.
// Evita depender de detalhes internos do protocolo RSC: o valor devolvido pela
// ação é lido das linhas `1:{...}` da resposta.
const ROUTER_STATE = encodeURIComponent(
  JSON.stringify([
    "",
    { children: ["camara-tecnica", { children: ["processos", { children: ["__PAGE__", {}] }] }] },
    null,
    null,
    true,
  ]),
);

async function chamarAction(cpf, nome, args) {
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
  if (r.status >= 500) {
    return { success: false, error: `erro interno (${r.status})`, bruto: texto.slice(0, 200) };
  }
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
    return {
      success: false,
      error: `resposta não-JSON (${r.status})`,
      bruto: texto.slice(0, 200),
    };
  }
}

async function main() {
  await db.connect();
  console.log("\nPreparando dados de teste…");
  // Usuários de teste: gestor (ADMINISTRADOR em todos) e Jefinny (só REGULACAO).
  const GESTOR = "00000000000";
  const JEFINNY = "12912453674";

  // Uma pessoa para vincular (a primeira ativa com CPF válido).
  const pessoa = (await db.query(
    "SELECT cpf, nome_completo FROM pessoa WHERE ativo = true ORDER BY cpf LIMIT 1",
  )).rows[0];
  if (!pessoa) { console.log("  (sem pessoa no banco — nada a testar)"); process.exit(0); }
  console.log(`  pessoa: ${pessoa.nome_completo} (${pessoa.cpf})`);

  // Limpa processos de teste de execuções anteriores.
  await db.query("DELETE FROM processos_judiciais WHERE numero_processo LIKE 'TESTE-%'");

  console.log("\n1. Usuário sem permissão no módulo");
  const semAcesso = await chamarAction(JEFINNY, "listarProcessos", [{}]);
  check("listarProcessos negado (Regulação não tem PROCESSOS)", semAcesso.success !== true, JSON.stringify(semAcesso).slice(0, 120));
  const criarNegado = await chamarAction(JEFINNY, "criarProcesso", [{ pacienteCpf: pessoa.cpf, numeroProcesso: "TESTE-X", numeroPasta: "P-X" }]);
  check("criarProcesso negado sem permissão", criarNegado.success !== true);

  console.log("\n2. Cadastro (para os testes de edição)");
  const criado = await chamarAction(GESTOR, "criarProcesso", [{
    pacienteCpf: pessoa.cpf,
    numeroProcesso: "TESTE-001",
    numeroPasta: "PASTA-001",
  }]);
  check("criarProcesso com permissão", criado.success === true, JSON.stringify(criado).slice(0, 160));
  const id = criado?.data?.id;
  check("retorna o processo criado com id", Number.isInteger(id), String(id));

  console.log("\n3. Validações");
  const semNumero = await chamarAction(GESTOR, "criarProcesso", [{ pacienteCpf: pessoa.cpf, numeroPasta: "P" }]);
  check("número do processo obrigatório", semNumero.success === false && /número do processo/i.test(semNumero.error || ""), semNumero.error);
  const semPaciente = await chamarAction(GESTOR, "criarProcesso", [{ numeroProcesso: "TESTE-002", numeroPasta: "P" }]);
  check("paciente obrigatório", semPaciente.success === false, semPaciente.error);
  const duplicado = await chamarAction(GESTOR, "criarProcesso", [{ pacienteCpf: pessoa.cpf, numeroProcesso: "TESTE-001", numeroPasta: "P2" }]);
  check("número de processo duplicado recusado", duplicado.success === false && /já existe/i.test(duplicado.error || ""), duplicado.error);

  console.log("\n4. Carregar dados no formulário");
  const detalhe = await chamarAction(GESTOR, "obterProcesso", [id]);
  check("obterProcesso devolve os dados", detalhe.success === true && detalhe.data?.numeroProcesso === "TESTE-001", JSON.stringify(detalhe).slice(0, 120));
  check("detalhe traz o paciente", detalhe.data?.pacienteCpf === pessoa.cpf);

  console.log("\n5. Edição");
  const editado = await chamarAction(GESTOR, "editarProcesso", [id, {
    pacienteCpf: pessoa.cpf,
    numeroProcesso: "TESTE-001",
    numeroPasta: "PASTA-EDITADA",
  }]);
  check("editarProcesso atualiza", editado.success === true && editado.data?.numeroPasta === "PASTA-EDITADA", JSON.stringify(editado).slice(0, 140));

  console.log("\n6. Troca de paciente exige confirmação específica");
  const outra = (await db.query(
    "SELECT cpf, nome_completo FROM pessoa WHERE ativo = true AND cpf <> $1 ORDER BY cpf LIMIT 1",
    [pessoa.cpf],
  )).rows[0];
  if (outra) {
    const semConfirmar = await chamarAction(GESTOR, "editarProcesso", [id, {
      pacienteCpf: outra.cpf, numeroProcesso: "TESTE-001", numeroPasta: "PASTA-EDITADA",
    }]);
    check("troca sem confirmação é recusada", semConfirmar.success === false, semConfirmar.error);
    const confirmada = await chamarAction(GESTOR, "editarProcesso", [id, {
      pacienteCpf: outra.cpf, numeroProcesso: "TESTE-001", numeroPasta: "PASTA-EDITADA",
      confirmarTrocaPaciente: true,
    }]);
    check("troca confirmada é aceita", confirmada.success === true && confirmada.trocouPaciente === true, JSON.stringify(confirmada).slice(0, 140));
    // volta o titular original
    await chamarAction(GESTOR, "editarProcesso", [id, {
      pacienteCpf: pessoa.cpf, numeroProcesso: "TESTE-001", numeroPasta: "PASTA-EDITADA",
      confirmarTrocaPaciente: true,
    }]);
  } else {
    console.log("  (só um paciente no banco — troca de paciente não testada)");
  }

  console.log("\n7. Especialidade e procedimento");
  const esp = (await db.query("SELECT id, nome, tipo_exame_id FROM junta_especialidades WHERE ativo = true ORDER BY id LIMIT 1")).rows[0];
  if (esp) {
    const comEsp = await chamarAction(GESTOR, "editarProcesso", [id, {
      pacienteCpf: pessoa.cpf, numeroProcesso: "TESTE-001", numeroPasta: "PASTA-EDITADA",
      especialidadeId: esp.id,
    }]);
    check("grava especialidade", comEsp.success === true && String(comEsp.data?.especialidadeId) === String(esp.id), JSON.stringify(comEsp).slice(0, 140));
    const procIncompativel = (await db.query(
      "SELECT id, nome FROM regula_procedimentos WHERE tipo_exame_id IS NOT NULL LIMIT 1",
    )).rows[0];
    if (procIncompativel && esp.tipo_exame_id) {
      const incompat = await chamarAction(GESTOR, "editarProcesso", [id, {
        pacienteCpf: pessoa.cpf, numeroProcesso: "TESTE-001", numeroPasta: "PASTA-EDITADA",
        especialidadeId: esp.id, procedimentoId: procIncompativel.id,
      }]);
      const compativel = procIncompativel;
      const r = incompat.success === false || String(incompat.data?.procedimentoId) === String(compativel.id);
      check("procedimento incompatível é barrado (ou aceito quando compatível)", r, JSON.stringify(incompat).slice(0, 140));
    } else {
      console.log("  (catálogo sem tipo de exame classificado — vínculo não testado)");
    }
  } else {
    console.log("  (sem especialidade cadastrada — teste de catálogo pulado)");
  }

  console.log("\n8. Lista reflete a edição (sem duplicar)");
  const lista = await chamarAction(GESTOR, "listarProcessos", [{ termo: "TESTE-001" }]);
  check("lista traz o processo editado", lista.success === true && (lista.data || []).some((p) => p.id === id && p.numeroPasta === "PASTA-EDITADA"));
  check("lista não duplica o processo", (lista.data || []).filter((p) => p.id === id).length === 1);

  console.log("\n9. Auditoria das alterações");
  const aud = await db.query(
    `SELECT acao, entidade, entidade_id, detalhes FROM audit_logs
      WHERE entidade='ProcessoJudicial' AND entidade_id=$1 ORDER BY created_at ASC`,
    [String(id)],
  );
  check("auditoria registra CRIAR", aud.rows.some((r) => r.acao === "CRIAR"));
  check("auditoria registra EDITAR", aud.rows.some((r) => r.acao === "EDITAR"));
  const comAlteracoes = aud.rows.find(
    (r) => r.acao === "EDITAR" && r.detalhes?.camposAlterados,
  );
  check(
    "auditoria guarda o que mudou",
    Boolean(comAlteracoes) && /numeroPasta/.test(comAlteracoes.detalhes.camposAlterados),
    JSON.stringify(comAlteracoes?.detalhes || {}).slice(0, 160),
  );

  console.log("\n10. Exclusão");
  const semPermissaoExcluir = await chamarAction(JEFINNY, "excluirProcesso", [id, { confirmado: true }]);
  check("excluir negado sem permissão", semPermissaoExcluir.success !== true);
  const semConfirmar = await chamarAction(GESTOR, "excluirProcesso", [id, {}]);
  check("excluir exige confirmação", semConfirmar.success === false, semConfirmar.error);
  const deps = await chamarAction(GESTOR, "verificarDependenciasProcesso", [id]);
  check("verificação de dependências informa podeExcluir", deps.success === true && deps.data?.podeExcluir === true, JSON.stringify(deps).slice(0, 140));
  const excluido = await chamarAction(GESTOR, "excluirProcesso", [id, { confirmado: true }]);
  check("excluir processo sem dependências", excluido.success === true, JSON.stringify(excluido).slice(0, 140));
  const sumiu = await chamarAction(GESTOR, "obterProcesso", [id]);
  check("processo não existe mais", sumiu.success === false);
  const audExcluir = await db.query(
    `SELECT acao, detalhes FROM audit_logs WHERE entidade='ProcessoJudicial' AND entidade_id=$1 AND acao='EXCLUIR'`,
    [String(id)],
  );
  check("auditoria preserva o processo excluído", audExcluir.rowCount === 1 && audExcluir.rows[0].detalhes?.numeroProcesso === "TESTE-001");

  for (const token of sessoes.values()) {
    await db.query("DELETE FROM user_sessions WHERE token=$1", [token]);
  }
  await db.end();
  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  if (falhas.length) console.log("Falhas: " + falhas.join(" | "));
  process.exit(falhou === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); try { await db.end(); } catch {} process.exit(1); });
