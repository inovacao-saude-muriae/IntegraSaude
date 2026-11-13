/**
 * ACESSO DO ADMINISTRADOR DO CCZ AO GERENCIAMENTO → TUTORES.
 *
 * Cobre os 12 itens pedidos, com servidor, banco e server actions REAIS:
 *   1. Admin CCZ vê Tutores no Gerenciamento    7. Admin CCZ não ganha Gestão Geral
 *   2. Admin CCZ lista tutores                  8. Alteração preserva vínculos
 *   3. Admin CCZ edita tutor autorizado         9. Exclusão não exclui a Pessoa
 *   4. Admin CCZ exclui/desvincula tutor       10. Operações na auditoria
 *   5. Operador sem permissão não exclui       11. Acesso direto à rota autorizado
 *   6. Admin da Regulação não recebe Tutores   12. Actions negam sem permissão
 *
 * Uso: node scripts/teste-tutores-ccz.mjs   (com o servidor no ar)
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

const CCZ_ACTIONS = { rota: "/ccz", arquivo: "ccz/actions" };

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

// ── Sessões ────────────────────────────────────────────────────────────────
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

let manifest = null;
function actionId(nome, arquivo) {
  if (!manifest) {
    manifest = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  }
  for (const [id, info] of Object.entries(manifest.node || {})) {
    if (info?.exportedName === nome && String(info?.filename || "").includes(arquivo)) return id;
  }
  return null;
}

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
      "Next-Router-State-Tree": encodeURIComponent(
        JSON.stringify(["", { children: ["__PAGE__", {}] }, null, null, true]),
      ),
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

const ccz = (cpf, nome, args) => chamar(cpf, nome, args, CCZ_ACTIONS);

async function me(cpf) {
  const r = await fetch(`${BASE}/api/me`, {
    headers: { cookie: `session_token=${await tokenDe(cpf)}` },
  });
  return r.json();
}

async function pagina(rota, cpf) {
  const headers = cpf ? { cookie: `session_token=${await tokenDe(cpf)}` } : {};
  const r = await fetch(`${BASE}${rota}`, { headers, redirect: "manual" });
  const corpo = r.status >= 300 && r.status < 400 ? "" : await r.text();
  return { status: r.status, corpo };
}

async function main() {
  await db.connect();

  // ── Fixtures: usuários de teste ────────────────────────────────────────
  console.log("\nPreparando usuários de teste…");
  const ADMIN_CCZ = "90000000175";
  const OPER_CCZ = "90000000256";
  const ADMIN_REG = "90000000337";

  for (const [cpf, nome] of [
    [ADMIN_CCZ, "TST Tutores Admin CCZ"],
    [OPER_CCZ, "TST Tutores Operador CCZ"],
    [ADMIN_REG, "TST Tutores Admin Regulação"],
  ]) {
    // Senha de teste: mesmo hash da senha padrão usada nas outras suítes.
    await db.query(
      `INSERT INTO users (cpf, nome, senha_hash, ativo, updated_at)
       VALUES ($1, $2, $3, true, now())
       ON CONFLICT (cpf) DO NOTHING`,
      [cpf, nome, "$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLM"],
    );
  }

  const vinculos = [
    [ADMIN_CCZ, "CCZ", "ADMINISTRADOR", "ADMIN"],
    [OPER_CCZ, "CCZ", "OPERADOR", "OPERADOR"],
    [ADMIN_REG, "REGULACAO", "ADMINISTRADOR", "ADMIN"],
  ];
  for (const [cpf, modulo, perfil, nivel] of vinculos) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf, modulo, perfil, nivel, escopo, servicos, permissoes, removidas, ativo)
       VALUES ($1, $2, $3, $4, 'TODOS', '{}', '{}', '{}', true)
       ON CONFLICT DO NOTHING`,
      [cpf, modulo, perfil, nivel],
    );
  }

  // ── Fixture: pessoa + tutor + animal ───────────────────────────────────
  console.log("Preparando pessoa/tutor de teste…");
  await db.query("DELETE FROM ccz_animais WHERE id LIKE 'TSTTUT-%'");
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf IN ('90000001147','90000001066')");
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf IN ('90000001147','90000001066')");
  await db.query("DELETE FROM pessoa WHERE cpf IN ('90000001147','90000001066')");
  for (const [cpf, nome] of [
    ["90000001147", "TST Tutor Com Animal"],
    ["90000001066", "TST Tutor Sem Animal"],
  ]) {
    await db.query(
      `INSERT INTO pessoa (cpf, nome_completo, sexo, data_nascimento, nome_mae, telefone, ativo)
       VALUES ($1, $2, 'Masculino', '1980-01-01', 'Mãe de Teste', '32999990000', true)`,
      [cpf, nome],
    );
    await db.query(`INSERT INTO ccz_tutores (pessoa_cpf, rg) VALUES ($1, 'MG-123')`, [cpf]);
  }
  await db.query(
    `INSERT INTO ccz_animais (id, pessoa_cpf, nome, especie, sexo, porte, situacao)
     VALUES ('TSTTUT-1', '90000001147', 'Rex', 'Cão', 'M', 'Médio', 'Ativo')`,
  );

  // ── 1. Item Tutores no Gerenciamento ───────────────────────────────────
  console.log("\n1. Admin CCZ vê Tutores no Gerenciamento");
  const euAdmin = await me(ADMIN_CCZ);
  const permissoes = euAdmin.user?.permissoes || [];
  check(
    "permissões efetivas incluem ccz tutores visualizar/criar/editar/excluir",
    ["visualizar", "criar", "editar", "excluir"].every((p) =>
      permissoes.includes(`tutores:${p}`),
    ),
    permissoes.filter((p) => p.startsWith("tutores:")).join(", "),
  );
  const sidebar = fs.readFileSync("src/components/Sidebar.js", "utf8");
  check(
    "Sidebar: Tutor usa a regra TUTORES (não PACIENTE_GERAL)",
    /name: "Tutor",[\s\S]{0,200}visivelSe: "TUTORES"/.test(sidebar),
  );
  check(
    "Sidebar: regra TUTORES considera a permissão do CCZ",
    /case "TUTORES":[\s\S]{0,400}temPermissao\("CCZ", "tutores:visualizar"\)/.test(sidebar),
  );
  check(
    "Sidebar: Gerenciamento aparece com pelo menos um item autorizado",
    /const moduloOk =\s*\n?\s*item\.moduloRequerido == null/.test(sidebar),
  );

  // ── 2. Listar tutores ──────────────────────────────────────────────────
  console.log("\n2. Admin CCZ lista tutores");
  const lista = await ccz(ADMIN_CCZ, "listarTutoresComAnimais", []);
  check("lista de tutores retorna sucesso", lista.success === true, JSON.stringify(lista).slice(0, 140));
  const comAnimal = (lista.data || []).find((t) => t.pessoaCpf === "90000001147");
  check("tutor de teste aparece com o animal vinculado", Boolean(comAnimal) && comAnimal.animais.length === 1);

  // ── 3. Editar tutor ────────────────────────────────────────────────────
  console.log("\n3. Admin CCZ edita o tutor");
  const salvo = await ccz(ADMIN_CCZ, "salvarTutor", [
    {
      cpf: "90000001066",
      nomeCompleto: "TST Tutor Sem Animal Editado",
      dataNascimento: "1980-01-01",
      telefone: "32999990001",
      jaEhTutor: true,
      profissao: "Pedreiro",
    },
  ]);
  check("edição do tutor aceita", salvo.success === true, JSON.stringify(salvo).slice(0, 160));
  const pessoaDepois = (
    await db.query("SELECT nome_completo, telefone FROM pessoa WHERE cpf = '90000001066'")
  ).rows[0];
  check(
    "dados pessoais compartilhados atualizados na tabela central",
    pessoaDepois?.nome_completo === "TST Tutor Sem Animal Editado",
    JSON.stringify(pessoaDepois),
  );

  // ── 5. Operador sem permissão não exclui ───────────────────────────────
  console.log("\n5. Operador do CCZ não exclui");
  const operExclui = await ccz(OPER_CCZ, "excluirTutor", ["90000001066"]);
  check("operador recebe negativa ao excluir", operExclui.success === false, JSON.stringify(operExclui).slice(0, 120));
  check(
    "operador mantém o vínculo (nada foi excluído)",
    (await db.query("SELECT 1 FROM ccz_tutores WHERE pessoa_cpf='90000001066'")).rowCount === 1,
  );

  // ── 12. Actions negam sem permissão (módulo) ───────────────────────────
  console.log("\n12. Actions negam sem o módulo CCZ");
  const regLista = await ccz(ADMIN_REG, "listarTutoresComAnimais", []);
  check("admin da Regulação não lista tutores do CCZ", regLista.success === false, JSON.stringify(regLista).slice(0, 120));
  const regExclui = await ccz(ADMIN_REG, "excluirTutor", ["90000001066"]);
  check("admin da Regulação não exclui tutor", regExclui.success === false);

  // ── 6/7. Sem acesso automático ─────────────────────────────────────────
  console.log("\n6-7. Sem acesso automático a Tutores nem à Gestão Geral");
  const euReg = await me(ADMIN_REG);
  check(
    "admin da Regulação não tem módulo GESTAO",
    !(euReg.user?.modulos || []).some((m) => m.modulo === "GESTAO"),
  );
  check(
    "admin da Regulação não tem permissões de tutores do CCZ",
    !(euReg.user?.permissoes || []).some((p) => p.startsWith("tutores:")),
  );
  check(
    "admin do CCZ não tem módulo GESTAO",
    !(euAdmin.user?.modulos || []).some((m) => m.modulo === "GESTAO"),
  );
  const pgGestao = await pagina("/gerenciamento/usuarios", ADMIN_CCZ);
  check(
    "admin do CCZ não abre Gerenciar Usuários",
    pgGestao.status === 403 || /Acesso negado|AcessoNegado/i.test(pgGestao.corpo),
    String(pgGestao.status),
  );

  // ── 11. Acesso direto à rota ───────────────────────────────────────────
  console.log("\n11. Acesso direto à rota de Tutores");
  const pgTutores = await pagina("/gerenciamento/tutores", ADMIN_CCZ);
  check("admin do CCZ abre /gerenciamento/tutores", pgTutores.status === 200, String(pgTutores.status));
  const pgReg = await pagina("/gerenciamento/tutores", ADMIN_REG);
  check(
    "admin da Regulação é barrado em /gerenciamento/tutores",
    pgReg.status === 403 || /Acesso negado|AcessoNegado/i.test(pgReg.corpo),
    String(pgReg.status),
  );

  // ── 4/8/9. Exclusão do vínculo sem cascata ─────────────────────────────
  console.log("\n4-9. Excluir vínculo preserva pessoa e animais");
  const comDependencia = await ccz(ADMIN_CCZ, "excluirTutor", ["90000001147"]);
  check(
    "tutor com animal não é excluído (sem cascata)",
    comDependencia.success === false && /animal/i.test(comDependencia.error || ""),
    JSON.stringify(comDependencia).slice(0, 160),
  );
  check(
    "pessoa com animal continua existindo",
    (await db.query("SELECT 1 FROM pessoa WHERE cpf='90000001147'")).rowCount === 1,
  );

  const excluido = await ccz(ADMIN_CCZ, "excluirTutor", ["90000001066"]);
  check("tutor sem dependências é excluído", excluido.success === true, JSON.stringify(excluido).slice(0, 160));
  check(
    "vínculo de tutor removido",
    (await db.query("SELECT 1 FROM ccz_tutores WHERE pessoa_cpf='90000001066'")).rowCount === 0,
  );
  check(
    "Pessoa central PRESERVADA",
    (await db.query("SELECT 1 FROM pessoa WHERE cpf='90000001066'")).rowCount === 1,
  );
  check(
    "animal do outro tutor intacto",
    (await db.query("SELECT 1 FROM ccz_animais WHERE id='TSTTUT-1'")).rowCount === 1,
  );

  // ── 10. Auditoria ──────────────────────────────────────────────────────
  console.log("\n10. Auditoria");
  const aud = await db.query(
    `SELECT acao, entidade, entidade_id FROM audit_logs
     WHERE entidade = 'Tutor' AND entidade_id IN ('90000001147','90000001066')
     ORDER BY id DESC`,
  );
  check(
    "auditoria registra edição e exclusão do tutor",
    aud.rows.some((r) => r.acao === "EDITAR") && aud.rows.some((r) => r.acao === "EXCLUIR"),
    JSON.stringify(aud.rows.slice(0, 4)),
  );

  // ── Limpeza ────────────────────────────────────────────────────────────
  await db.query("DELETE FROM ccz_animais WHERE id LIKE 'TSTTUT-%'");
  await db.query("DELETE FROM ccz_tutores WHERE pessoa_cpf IN ('90000001147','90000001066')");
  await db.query("DELETE FROM pessoa_endereco WHERE pessoa_cpf IN ('90000001147','90000001066')");
  await db.query("DELETE FROM pessoa WHERE cpf IN ('90000001147','90000001066')");
  await db.query("DELETE FROM user_acessos WHERE user_cpf LIKE '9000000%'");
  await db.query("DELETE FROM users WHERE cpf LIKE '9000000%'");
  await db.query("DELETE FROM user_sessions WHERE token = ANY($1::text[])", [[...sessoes.values()]]);
  await db.end();

  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log("Falhas:\n - " + falhas.join("\n - "));
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
