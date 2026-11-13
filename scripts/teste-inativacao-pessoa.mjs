/**
 * INATIVAÇÃO E REATIVAÇÃO DE PESSOAS (cadastro central / EMPI).
 *
 * Testa a funcionalidade ponta a ponta com banco e server actions REAIS:
 *   1. inativar pessoa ativa
 *   2. reativar pessoa inativa
 *   3. impedir inativação sem permissão
 *   4. impedir reativação sem permissão
 *   5. exigir justificativa na inativação
 *   6. preservar vínculos da Regulação
 *   7. preservar vínculos da Câmara Técnica (Farmácia e Processos)
 *   8. preservar registros da Junta Reguladora
 *   9. preservar vínculos do CCZ (tutor + animal)
 *  10. consultar histórico de pessoa inativa
 *  11. filtrar pessoas ativas e inativas
 *  12. impedir duplicação de cadastro na reativação
 *  13. comportamento dos formulários que usam o cadastro central
 *  14. registros de auditoria
 *
 * Uso: node scripts/teste-inativacao-pessoa.mjs   (servidor no ar)
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

const PESSOAS = { rota: "/gerenciamento/pessoas", arquivo: "gerenciamento/pessoas/actions" };
const SITUACAO = {
  rota: "/gerenciamento/pessoas",
  arquivo: "gerenciamento/pessoas/pessoaInativacao",
};

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

function dv(base) {
  let s = 0;
  for (let i = 0; i < base.length; i++) s += Number(base[i]) * (base.length + 1 - i);
  const r = (s * 10) % 11;
  return r === 10 ? 0 : r;
}
const cpfValido = (b) => b + dv(b) + dv(b + dv(b));

const CPF = {
  GESTOR: "00000000000",
  SEM_SITUACAO: cpfValido("920000010"), // Gestão Geral SEM inativar/reativar
  SEM_ACESSO: cpfValido("920000011"), // pessoa sem usuário nem vínculo
  AUTOR_SEM_VINCULO: cpfValido("920000015"), // usuário sem nenhum vínculo
  COM_VINCULOS: cpfValido("920000012"),
  DUPLICADO: cpfValido("920000013"),
  USUARIO: cpfValido("920000014"), // pessoa que também é usuário ativo
};

const sessoes = new Map();
async function tokenDe(cpf) {
  if (sessoes.has(cpf)) return sessoes.get(cpf);
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", [cpf])).rows[0];
  if (!u) throw new Error(`usuário ${cpf} não existe`);
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
    manifest = JSON.parse(
      fs.readFileSync(".next/server/app/gerenciamento/pessoas/page/server-reference-manifest.json", "utf8"),
    );
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
    return { success: false, error: `resposta não-JSON (${r.status})` };
  }
}

const pessoas = (cpf, nome, args) => chamar(cpf, nome, args, PESSOAS);
const situacao = (cpf, nome, args) => chamar(cpf, nome, args, SITUACAO);

async function main() {
  await db.connect();

  // ── Usuários de teste ──────────────────────────────────────────────────
  console.log("\nPreparando usuários de teste…");
  const HASH = "$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLM";
  for (const [cpf, nome] of [
    [CPF.SEM_SITUACAO, "TSTI Gestor sem situacao"],
    [CPF.USUARIO, "TSTI Pessoa que e usuario"],
  ]) {
    await db.query(
      `INSERT INTO users (cpf, nome, senha_hash, ativo, updated_at)
       VALUES ($1, $2, $3, true, now()) ON CONFLICT (cpf) DO NOTHING`,
      [cpf, nome, HASH],
    );
  }
  // Gestão Geral SEM inativar/reativar (só visualizar/criar/editar).
  await db.query(
    `INSERT INTO user_acessos (user_cpf, modulo, perfil, nivel, escopo, servicos, permissoes, removidas, ativo)
     VALUES ($1, 'GESTAO', 'SUPERVISOR', 'OPERADOR', 'TODOS', '{}', '{pessoas:visualizar,pessoas:editar}', '{}', true)
     ON CONFLICT DO NOTHING`,
    [CPF.SEM_SITUACAO],
  );

  // ── Pessoas de teste ───────────────────────────────────────────────────
  console.log("Preparando pessoas de teste…");
  const lista = [CPF.SEM_SITUACAO, CPF.SEM_ACESSO, CPF.COM_VINCULOS, CPF.DUPLICADO, CPF.USUARIO]
    .map((c) => `'${c}'`)
    .join(",");
  await db.query(`DELETE FROM ccz_animais WHERE id LIKE 'TSTI%'`);
  await db.query(`DELETE FROM ccz_tutores WHERE pessoa_cpf IN (${lista})`);
  await db.query(`DELETE FROM farmacia_pacientes WHERE pessoa_cpf IN (${lista})`);
  await db.query(`DELETE FROM junta_pacientes WHERE pessoa_cpf IN (${lista})`);
  await db.query(`DELETE FROM regula_pedidos_exames WHERE pessoa_cpf IN (${lista})`);
  await db.query(`DELETE FROM processos_judiciais WHERE pessoa_cpf IN (${lista})`);
  await db.query(`DELETE FROM pessoa_endereco WHERE pessoa_cpf IN (${lista})`);
  await db.query(`DELETE FROM audit_logs WHERE entidade='Pessoa' AND entidade_id IN (${lista})`);
  await db.query(`DELETE FROM pessoa WHERE cpf IN (${lista})`);
  // Fixtures que NÃO são usuários do sistema (as que são já têm registro em users).
  await db.query(`DELETE FROM users WHERE cpf IN (${lista})`);

  // Usuários do teste precisam existir DEPOIS dessa limpeza.
  for (const [cpf, nome] of [
    [CPF.SEM_SITUACAO, "TSTI Gestor sem situacao"],
    [CPF.USUARIO, "TSTI Pessoa que e usuario"],
  ]) {
    await db.query(
      `INSERT INTO users (cpf, nome, senha_hash, ativo, updated_at)
       VALUES ($1, $2, $3, true, now()) ON CONFLICT (cpf) DO NOTHING`,
      [cpf, nome, HASH],
    );
  }
  await db.query(
    `INSERT INTO user_acessos (user_cpf, modulo, perfil, nivel, escopo, servicos, permissoes, removidas, ativo)
     VALUES ($1, 'GESTAO', 'SUPERVISOR', 'OPERADOR', 'TODOS', '{}', '{pessoas:visualizar,pessoas:editar}', '{}', true)
     ON CONFLICT DO NOTHING`,
    [CPF.SEM_SITUACAO],
  );

  for (const cpf of [CPF.SEM_SITUACAO, CPF.SEM_ACESSO, CPF.COM_VINCULOS, CPF.DUPLICADO, CPF.USUARIO]) {
    await db.query(
      `INSERT INTO pessoa (cpf, nome_completo, sexo, data_nascimento, nome_mae, telefone, ativo)
       VALUES ($1, $2, 'Feminino', '1985-03-03', 'Mãe de Teste', '32999991111', true)`,
      [cpf, `TSTI ${cpf.slice(-4)}`],
    );
  }

  // Vínculos da pessoa COM_VINCULOS em todos os módulos.
  let tipoExame = (await db.query("SELECT id FROM regula_tipo_exame LIMIT 1")).rows[0];
  if (!tipoExame) {
    tipoExame = (
      await db.query("INSERT INTO regula_tipo_exame (nome) VALUES ('TSTI Tipo') RETURNING id")
    ).rows[0];
  }
  const procReg =
    (await db.query("SELECT id FROM regula_procedimentos LIMIT 1")).rows[0] ||
    (
      await db.query(
        `INSERT INTO regula_procedimentos (tipo_exame_id, nome, valor)
         VALUES ($1, 'TSTI Procedimento', 0) RETURNING id`,
        [tipoExame.id],
      )
    ).rows[0];
  await db.query(
    `INSERT INTO regula_pedidos_exames (pessoa_cpf, procedimento_id, status, data_solicitacao)
     VALUES ($1, $2, 'Aguardando', now())`,
    [CPF.COM_VINCULOS, procReg.id],
  );
  await db.query(
    `INSERT INTO farmacia_pacientes (numero_pasta, pessoa_cpf, numero_processo, status)
     VALUES ('TSTI-F1', $1, 'TSTI-PROC-1', 'ATIVO')`,
    [CPF.COM_VINCULOS],
  );
  await db.query(
    `INSERT INTO junta_pacientes (pessoa_cpf, tipo_deficiencia) VALUES ($1, 'Teste')`,
    [CPF.COM_VINCULOS],
  );
  await db.query(`INSERT INTO ccz_tutores (pessoa_cpf) VALUES ($1)`, [CPF.COM_VINCULOS]);
  await db.query(
    `INSERT INTO ccz_animais (id, pessoa_cpf, nome, especie, sexo, porte, situacao)
     VALUES ('TSTI-1', $1, 'Luna', 'Gato', 'F', 'Pequeno', 'Ativo')`,
    [CPF.COM_VINCULOS],
  );
  await db.query(
    `INSERT INTO processos_judiciais (pessoa_cpf, numero_processo, numero_pasta, created_at, updated_at)
     VALUES ($1, 'TSTI-0001', 'TSTI-P1', now(), now())`,
    [CPF.COM_VINCULOS],
  );

  const JUST = "Cadastro de teste para validar a inativação segura do cadastro central.";

  // ── 3. Sem permissão para inativar ─────────────────────────────────────
  console.log("\n3. Inativar sem permissão");
  const semPermInativar = await situacao(CPF.SEM_SITUACAO, "inativarPessoa", [
    CPF.SEM_ACESSO,
    { justificativa: JUST },
  ]);
  check("inativação negada sem pessoas:inativar", semPermInativar.success === false);
  check(
    "mensagem de acesso negado",
    /permiss/i.test(semPermInativar.error || ""),
    semPermInativar.error,
  );
  check(
    "cadastro continua ativo",
    (await db.query("SELECT ativo FROM pessoa WHERE cpf=$1", [CPF.SEM_ACESSO])).rows[0].ativo === true,
  );

  // Autor sem vínculo: usuário dedicado, criado só para esta checagem.
  await db.query(
    `INSERT INTO users (cpf, nome, senha_hash, ativo, updated_at)
     VALUES ($1, 'TSTI sem vinculo', $2, true, now()) ON CONFLICT (cpf) DO NOTHING`,
    [CPF.AUTOR_SEM_VINCULO, HASH],
  );
  const semVinculo = await situacao(CPF.AUTOR_SEM_VINCULO, "inativarPessoa", [
    CPF.DUPLICADO,
    { justificativa: JUST },
  ]).catch((e) => ({ success: false, error: e.message }));
  check("usuário sem nenhum vínculo não inativa", semVinculo.success === false);


  // ── 5. Justificativa obrigatória ───────────────────────────────────────
  console.log("\n5. Justificativa obrigatória");
  const semJust = await situacao(CPF.GESTOR, "inativarPessoa", [CPF.SEM_ACESSO, {}]);
  check("inativação sem justificativa recusada", semJust.success === false);
  check("mensagem pede a justificativa", /justificativa/i.test(semJust.error || ""), semJust.error);
  const curta = await situacao(CPF.GESTOR, "inativarPessoa", [
    CPF.SEM_ACESSO,
    { justificativa: "curta" },
  ]);
  check("justificativa curta recusada", curta.success === false);
  check(
    "cadastro segue ativo após as recusas",
    (await db.query("SELECT ativo FROM pessoa WHERE cpf=$1", [CPF.SEM_ACESSO])).rows[0].ativo === true,
  );

  // ── 1. Inativar pessoa ativa ───────────────────────────────────────────
  console.log("\n1. Inativar pessoa ativa");
  const inativou = await situacao(CPF.GESTOR, "inativarPessoa", [
    CPF.SEM_ACESSO,
    { justificativa: JUST },
  ]);
  check("inativação aceita", inativou.success === true, JSON.stringify(inativou).slice(0, 160));
  check(
    "pessoa.ativo = false",
    (await db.query("SELECT ativo FROM pessoa WHERE cpf=$1", [CPF.SEM_ACESSO])).rows[0].ativo === false,
  );
  const deNovo = await situacao(CPF.GESTOR, "inativarPessoa", [
    CPF.SEM_ACESSO,
    { justificativa: JUST },
  ]);
  check("não inativa duas vezes", deNovo.success === false);

  // ── 6-9. Preservação dos vínculos ──────────────────────────────────────
  console.log("\n6-9. Inativar pessoa COM vínculos (todos os módulos)");
  const comVinculos = await situacao(CPF.GESTOR, "inativarPessoa", [
    CPF.COM_VINCULOS,
    { justificativa: "Paciente com histórico completo; cadastro em revisão." },
  ]);
  check("inativação aceita mesmo com vínculos", comVinculos.success === true, JSON.stringify(comVinculos).slice(0, 160));
  check(
    "6. pedido da Regulação preservado",
    (await db.query("SELECT 1 FROM regula_pedidos_exames WHERE pessoa_cpf=$1", [CPF.COM_VINCULOS])).rowCount === 1,
  );
  check(
    "7a. pasta da Farmácia preservada",
    (await db.query("SELECT 1 FROM farmacia_pacientes WHERE pessoa_cpf=$1", [CPF.COM_VINCULOS])).rowCount === 1,
  );
  check(
    "7b. processo judicial preservado",
    (await db.query("SELECT 1 FROM processos_judiciais WHERE pessoa_cpf=$1", [CPF.COM_VINCULOS])).rowCount === 1,
  );
  check(
    "8. registro da Junta preservado",
    (await db.query("SELECT 1 FROM junta_pacientes WHERE pessoa_cpf=$1", [CPF.COM_VINCULOS])).rowCount === 1,
  );
  check(
    "9a. vínculo de tutor preservado",
    (await db.query("SELECT 1 FROM ccz_tutores WHERE pessoa_cpf=$1", [CPF.COM_VINCULOS])).rowCount === 1,
  );
  check(
    "9b. animal do tutor preservado",
    (await db.query("SELECT 1 FROM ccz_animais WHERE id='TSTI-1'")).rowCount === 1,
  );

  // ── 10. Histórico de pessoa inativa ────────────────────────────────────
  console.log("\n10. Consultar histórico da pessoa inativa");
  const hist = await situacao(CPF.GESTOR, "consultarSituacaoPessoa", [CPF.COM_VINCULOS]);
  check("consulta autorizada", hist.success === true, JSON.stringify(hist).slice(0, 160));
  check("situação inativa informada", hist.data?.ativo === false);
  check(
    "contagens por módulo presentes",
    hist.data?.vinculos?.regulacao === 1 &&
      hist.data?.vinculos?.farmacia === 1 &&
      hist.data?.vinculos?.processos === 1 &&
      hist.data?.vinculos?.junta === 1 &&
      hist.data?.vinculos?.ccz === 1,
    JSON.stringify(hist.data?.vinculos),
  );
  check(
    "última alteração de situação registrada",
    hist.data?.ultimaAlteracaoSituacao?.acao === "DESATIVAR",
    JSON.stringify(hist.data?.ultimaAlteracaoSituacao),
  );

  // ── 11. Filtros de listagem ────────────────────────────────────────────
  console.log("\n11. Filtrar ativas / inativas / todas");
  console.log(
    "   (estado)",
    JSON.stringify(
      (await db.query("SELECT cpf, ativo, unificado_em_cpf FROM pessoa WHERE cpf = ANY($1::text[])", [
        [CPF.SEM_ACESSO, CPF.COM_VINCULOS],
      ])).rows,
    ),
  );
  const ativas = await pessoas(CPF.GESTOR, "listarPessoas", ["", { situacao: "ativas" }]);
  const inativas = await pessoas(CPF.GESTOR, "listarPessoas", ["", { situacao: "inativas" }]);
  const todas = await pessoas(CPF.GESTOR, "listarPessoas", ["", { situacao: "todas" }]);
  check(
    "inativa NÃO aparece em ativas",
    !(ativas.data || []).some((p) => p.cpf === CPF.SEM_ACESSO),
  );
  check(
    "inativa aparece em inativas",
    (inativas.data || []).some((p) => p.cpf === CPF.SEM_ACESSO),
    JSON.stringify(inativas).slice(0, 200),
  );
  check(
    "ativa NÃO aparece em inativas",
    !(inativas.data || []).some((p) => p.cpf === CPF.GESTOR),
  );
  check(
    "todas traz as duas situações",
    (todas.data || []).some((p) => p.cpf === CPF.SEM_ACESSO) &&
      (todas.data || []).some((p) => p.cpf === CPF.COM_VINCULOS),
  );
  const buscaInativa = await pessoas(CPF.GESTOR, "listarPessoas", [
    CPF.COM_VINCULOS,
    { situacao: "inativas" },
  ]);
  check(
    "busca por CPF encontra pessoa inativa",
    (buscaInativa.data || []).some((p) => p.cpf === CPF.COM_VINCULOS),
    JSON.stringify(buscaInativa).slice(0, 200),
  );

  // ── 4. Sem permissão para reativar ─────────────────────────────────────
  console.log("\n4. Reativar sem permissão");
  const semPermReativar = await situacao(CPF.SEM_SITUACAO, "reativarPessoa", [
    CPF.SEM_ACESSO,
    { justificativa: "Paciente voltou ao acompanhamento na UBS central." },
  ]);
  check("reativação negada sem pessoas:reativar", semPermReativar.success === false);
  check(
    "cadastro continua inativo",
    (await db.query("SELECT ativo FROM pessoa WHERE cpf=$1", [CPF.SEM_ACESSO])).rows[0].ativo === false,
  );

  // ── 2 e 12. Reativar (sem duplicar cadastro) ───────────────────────────
  console.log("\n2 e 12. Reativar pessoa inativa");
  const antes = (await db.query("SELECT count(*)::int c FROM pessoa")).rows[0].c;
  const reativou = await situacao(CPF.GESTOR, "reativarPessoa", [
    CPF.COM_VINCULOS,
    { justificativa: "Paciente retornou ao acompanhamento; cadastro conferido." },
  ]);
  check("reativação aceita", reativou.success === true, JSON.stringify(reativou).slice(0, 160));
  check(
    "pessoa.ativo = true",
    (await db.query("SELECT ativo FROM pessoa WHERE cpf=$1", [CPF.COM_VINCULOS])).rows[0].ativo === true,
  );
  const depois = (await db.query("SELECT count(*)::int c FROM pessoa")).rows[0].c;
  check("nenhum registro novo criado", antes === depois, `${antes} -> ${depois}`);
  check(
    "existe exatamente 1 registro com o CPF",
    (await db.query("SELECT count(*)::int c FROM pessoa WHERE cpf=$1", [CPF.COM_VINCULOS])).rows[0].c === 1,
  );
  check(
    "vínculos continuam intactos após reativar",
    (await db.query("SELECT 1 FROM ccz_tutores WHERE pessoa_cpf=$1", [CPF.COM_VINCULOS])).rowCount === 1 &&
      (await db.query("SELECT 1 FROM junta_pacientes WHERE pessoa_cpf=$1", [CPF.COM_VINCULOS])).rowCount === 1,
  );
  const reativarDuas = await situacao(CPF.GESTOR, "reativarPessoa", [
    CPF.COM_VINCULOS,
    { justificativa: "Paciente retornou ao acompanhamento; cadastro conferido." },
  ]);
  check("não reativa duas vezes", reativarDuas.success === false);
  const semJustReativar = await situacao(CPF.GESTOR, "reativarPessoa", [CPF.SEM_ACESSO, {}]);
  check("reativação exige justificativa", semJustReativar.success === false);

  // ── 13. Formulários que usam o cadastro central ────────────────────────
  console.log("\n13. Formulários de novos cadastros");
  await situacao(CPF.GESTOR, "inativarPessoa", [
    CPF.DUPLICADO,
    { justificativa: "Cadastro provisório criado por engano no balcão." },
  ]);
  const jaInativa = await pessoas(CPF.GESTOR, "criarPessoa", [
    {
      cpf: CPF.DUPLICADO,
      nomeCompleto: "TSTI Duplicado",
      sexo: "Feminino",
      dataNascimento: "1985-03-03",
      nomeMae: "Mãe de Teste",
      telefone: "32999991111",
    },
  ]);
  check(
    "não cria novo cadastro com CPF de pessoa inativa",
    jaInativa.success === false,
    JSON.stringify(jaInativa).slice(0, 160),
  );
  const atualizouInativa = await pessoas(CPF.GESTOR, "atualizarPessoa", [
    CPF.DUPLICADO,
    {
      cpf: CPF.DUPLICADO,
      nomeCompleto: "TSTI Duplicado editado",
      sexo: "Feminino",
      dataNascimento: "1985-03-03",
      nomeMae: "Mãe de Teste",
      telefone: "32999991111",
    },
  ]);
  check(
    "edição de cadastro inativo é recusada",
    atualizouInativa.success === false,
    JSON.stringify(atualizouInativa).slice(0, 160),
  );
  const ubsInativa = await pessoas(CPF.SEM_SITUACAO, "listarUbs", []);
  check(
    "consulta de apoio (UBS) segue funcionando",
    ubsInativa.success === true,
  );

  // ── Proteção de acesso: pessoa que é usuário ativo ─────────────────────
  console.log("\nProteção de acesso (pessoa = usuário ativo)");
  const usuarioAtivo = await situacao(CPF.GESTOR, "inativarPessoa", [
    CPF.USUARIO,
    { justificativa: "Tentativa de inativar cadastro ligado a usuário ativo." },
  ]);
  check(
    "inativação de pessoa com usuário ativo é bloqueada",
    usuarioAtivo.success === false && usuarioAtivo.status === 409,
    JSON.stringify(usuarioAtivo).slice(0, 160),
  );
  check(
    "cadastro preservado",
    (await db.query("SELECT ativo FROM pessoa WHERE cpf=$1", [CPF.USUARIO])).rows[0].ativo === true,
  );

  // ── 14. Auditoria ──────────────────────────────────────────────────────
  console.log("\n14. Auditoria");
  const aud = (
    await db.query(
      `SELECT acao, user_cpf, descricao, detalhes FROM audit_logs
       WHERE entidade='Pessoa' AND entidade_id = ANY($1::text[])
       ORDER BY id DESC`,
      [[CPF.COM_VINCULOS, CPF.SEM_ACESSO, CPF.USUARIO]],
    )
  ).rows;
  const desativar = aud.find((r) => r.acao === "DESATIVAR");
  check("inativação registrada (DESATIVAR)", Boolean(desativar));
  check("usuário responsável registrado", desativar?.user_cpf === CPF.GESTOR);
  check(
    "situação anterior e nova registradas",
    desativar?.detalhes?.situacaoAnterior === "ATIVA" &&
      desativar?.detalhes?.novaSituacao === "INATIVA",
    JSON.stringify(desativar?.detalhes),
  );
  check(
    "justificativa registrada",
    String(desativar?.descricao || "").includes("Justificativa:") &&
      String(desativar?.descricao || "").length > 40,
    String(desativar?.descricao || "").slice(0, 120),
  );
  check("resultado registrado", desativar?.detalhes?.resultado === "SUCESSO");
  const reativarAud = aud.find((r) => r.acao === "REATIVAR");
  check("reativação registrada (REATIVAR)", Boolean(reativarAud));
  check(
    "reativação guarda situação anterior INATIVA",
    reativarAud?.detalhes?.situacaoAnterior === "INATIVA" &&
      reativarAud?.detalhes?.novaSituacao === "ATIVA",
  );
  check(
    "tentativa bloqueada registrada (NEGAR)",
    aud.some((r) => r.acao === "NEGAR"),
  );

  // ── Limpeza ────────────────────────────────────────────────────────────
  const listaFinal = [CPF.SEM_SITUACAO, CPF.SEM_ACESSO, CPF.COM_VINCULOS, CPF.DUPLICADO, CPF.USUARIO]
    .map((c) => `'${c}'`)
    .join(",");
  await db.query(`DELETE FROM ccz_animais WHERE id LIKE 'TSTI%'`);
  await db.query(`DELETE FROM ccz_tutores WHERE pessoa_cpf IN (${listaFinal})`);
  await db.query(`DELETE FROM farmacia_pacientes WHERE pessoa_cpf IN (${listaFinal})`);
  await db.query(`DELETE FROM junta_pacientes WHERE pessoa_cpf IN (${listaFinal})`);
  await db.query(`DELETE FROM regula_pedidos_exames WHERE pessoa_cpf IN (${listaFinal})`);
  await db.query(`DELETE FROM processos_judiciais WHERE pessoa_cpf IN (${listaFinal})`);
  await db.query(`DELETE FROM pessoa_endereco WHERE pessoa_cpf IN (${listaFinal})`);
  await db.query(`DELETE FROM pessoa WHERE cpf IN (${listaFinal})`);
  await db.query(`DELETE FROM user_acessos WHERE user_cpf = ANY($1::text[])`, [
    [CPF.SEM_SITUACAO, CPF.USUARIO, CPF.SEM_ACESSO, CPF.AUTOR_SEM_VINCULO],
  ]);
  await db.query(`DELETE FROM users WHERE cpf = ANY($1::text[])`, [
    [CPF.SEM_SITUACAO, CPF.USUARIO, CPF.SEM_ACESSO, CPF.AUTOR_SEM_VINCULO],
  ]);
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
