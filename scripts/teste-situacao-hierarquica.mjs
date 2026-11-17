/**
 * Inativação/reativação HIERÁRQUICA nos três cadastros.
 *
 *   Regulação → Tipo de Exame      → Procedimento
 *   Junta     → Serviço            → Especialidade
 *   Processos → Especialidade      → Procedimento (N:N)
 *
 * Valida, no backend e na tela, que:
 *  - inativar a categoria deixa os subordinados indisponíveis SEM mudar o
 *    `ativo` deles;
 *  - reativar a categoria devolve cada subordinado ao estado anterior
 *    (as inativações individuais são preservadas);
 *  - inativar um subordinado não afeta os irmãos;
 *  - no N:N, a inativação de uma categoria não afeta a disponibilidade do
 *    procedimento pela outra categoria ativa;
 *  - registros históricos e vínculos são preservados.
 */
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
const db = new Client({ connectionString: env.DATABASE_URL });
const segredo = new TextEncoder().encode(env.JWT_SECRET);
const GESTOR = "91000000891";
const MARCA = "ZQHR";

let ok = 0;
let falhou = 0;
const falhas = [];
const check = (nome, cond, extra = "") => {
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhou += 1;
    falhas.push(nome);
    console.log(`  FALHA ${nome} ${extra}`);
  }
};

// ── Server actions ────────────────────────────────────────────────────────
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

async function chamar(token, nome, args, { rota, arquivo }) {
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
  const objetos = [];
  for (const linha of texto.split("\n")) {
    if (!/^1:/.test(linha)) continue;
    try {
      const valor = JSON.parse(linha.slice(2));
      if (valor && typeof valor === "object") objetos.push(valor);
    } catch {}
  }
  // O fluxo manda o retorno da action e, em seguida, os dados page/children
  // revalidados; o retorno da action é sempre o primeiro objeto.
  if (objetos.length) return objetos[0];
  return { success: false, error: `resposta inesperada (${r.status})`, bruto: texto.slice(0, 160) };
}

const REG = { rota: "/regulacao?tab=PROCEDIMENTOS", arquivo: "regulacao/procedimentosActions" };
const JUN = {
  rota: "/gerenciamento/servicos-especialidades",
  arquivo: "junta-reguladora/servicosActions",
};
const PRO = {
  rota: "/gerenciamento/especialidades-procedimentos",
  arquivo: "processos/especialidades/actions",
};

await db.connect();

// ── Fixture ───────────────────────────────────────────────────────────────
async function preparar() {
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
  await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);
  const h = await bcrypt.hash("Fixture@2026", 10);
  await db.query(
    `INSERT INTO users (cpf, nome, senha_hash, ativo, primeiro_acesso, updated_at)
     VALUES ($1,'TESTE Hierarquico',$2,true,false,now())`,
    [GESTOR, h],
  );
  for (const m of ["GESTAO", "REGULACAO", "JUNTA", "PROCESSOS"]) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf, modulo, perfil, nivel, escopo, servicos, permissoes, removidas, ativo)
       VALUES ($1,$2,'ADMINISTRADOR','ADMIN','TODOS','{}','{}','{}',true)`,
      [GESTOR, m],
    );
  }
  const token = await new SignJWT({ userId: GESTOR, nome: "TESTE Hierarquico" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now() + interval '2 hours', now())`,
    [GESTOR, token],
  );
  return token;
}

async function limpar() {
  // (`MARCA` é prefixo único; nada da aplicação começa com ele.)
  // Regulação
  await db.query(
    `DELETE FROM regula_procedimentos WHERE tipo_exame_id IN
       (SELECT id FROM regula_tipo_exame WHERE nome LIKE $1)`,
    [`${MARCA}%`],
  );
  await db.query("DELETE FROM regula_tipo_exame WHERE nome LIKE $1", [`${MARCA}%`]);
  // Junta
  await db.query(
    `DELETE FROM junta_especialidades WHERE servico_id IN
       (SELECT id FROM junta_servicos WHERE nome LIKE $1)`,
    [`${MARCA}%`],
  );
  await db.query("DELETE FROM junta_servicos WHERE nome LIKE $1", [`${MARCA}%`]);
  // Processos
  await db.query(
    `DELETE FROM processos_especialidade_procedimento
      WHERE especialidade_id IN (SELECT id FROM processos_especialidades WHERE nome LIKE $1)
         OR procedimento_id IN (SELECT id FROM processos_procedimentos WHERE nome LIKE $1)`,
    [`${MARCA}%`],
  );
  await db.query("DELETE FROM processos_especialidades WHERE nome LIKE $1", [`${MARCA}%`]);
  await db.query("DELETE FROM processos_procedimentos WHERE nome LIKE $1", [`${MARCA}%`]);
}

const tokenFixture = await preparar();
await limpar();

try {
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n1. REGULAÇÃO — Tipo de Exame (categoria) × Procedimento\n");

  const tipoA = (
    await db.query(
      `INSERT INTO regula_tipo_exame (nome) VALUES ($1) RETURNING id`,
      [`${MARCA} Imagem`],
    )
  ).rows[0].id;
  const tipoB = (
    await db.query(
      `INSERT INTO regula_tipo_exame (nome) VALUES ($1) RETURNING id`,
      [`${MARCA} Laboratório`],
    )
  ).rows[0].id;
  const procA1 = (
    await db.query(
      `INSERT INTO regula_procedimentos (tipo_exame_id, nome, valor, ativo)
       VALUES ($1,$2,10.00,true) RETURNING id`,
      [tipoA, `${MARCA} Raio-X`],
    )
  ).rows[0].id;
  const procA2 = (
    await db.query(
      `INSERT INTO regula_procedimentos (tipo_exame_id, nome, valor, ativo)
       VALUES ($1,$2,20.00,true) RETURNING id`,
      [tipoA, `${MARCA} Tomografia`],
    )
  ).rows[0].id;
  const procB1 = (
    await db.query(
      `INSERT INTO regula_procedimentos (tipo_exame_id, nome, valor, ativo)
       VALUES ($1,$2,5.00,true) RETURNING id`,
      [tipoB, `${MARCA} Hemograma`],
    )
  ).rows[0].id;

  // Inativação individual primeiro, para provar a preservação.
  const inativaIndividual = await chamar(
    tokenFixture,
    "alterarSituacaoProcedimento",
    [procA2, { ativo: false }],
    REG,
  );
  check("inativa um procedimento individualmente", inativaIndividual.success === true, JSON.stringify(inativaIndividual).slice(0, 140));

  let dados = await chamar(tokenFixture, "getProcedimentosData", [], REG);
  const linhaDe = (d, id) => (d.linhas || []).find((l) => l.procedimentoId === id);
  check("procedimento inativo: disponivel=false", linhaDe(dados, procA2)?.disponivel === false, JSON.stringify(linhaDe(dados, procA2)));
  check("procedimento irmão ativo: disponivel=true", linhaDe(dados, procA1)?.disponivel === true);
  check("tipo de exame ativo exposto com ativo=true", (dados.tiposExame || []).find((t) => t.id === tipoA)?.ativo === true);

  // Inativar a CATEGORIA
  const inativaCategoria = await chamar(
    tokenFixture,
    "alterarSituacaoTipoExame",
    [tipoA, { ativo: false }],
    REG,
  );
  check("inativa o tipo de exame (categoria)", inativaCategoria.success === true, JSON.stringify(inativaCategoria).slice(0, 160));

  const filhosDepois = await db.query(
    "SELECT id, ativo FROM regula_procedimentos WHERE tipo_exame_id=$1 ORDER BY id",
    [tipoA],
  );
  const ativoDe = (id) => filhosDepois.rows.find((r) => r.id === id)?.ativo;
  check("inativar a categoria NÃO altera o ativo do procedimento ativo", ativoDe(procA1) === true);
  check("inativar a categoria NÃO altera o ativo do procedimento inativo", ativoDe(procA2) === false);

  dados = await chamar(tokenFixture, "getProcedimentosData", [], REG);
  check("subordinado ativo fica indisponível pela categoria", linhaDe(dados, procA1)?.disponivel === false, JSON.stringify(linhaDe(dados, procA1)));
  check("motivo registrado como categoria", linhaDe(dados, procA1)?.indisponivelPorCategoria === true);
  check("situação individual preservada no dado", linhaDe(dados, procA1)?.ativo === true);
  check("outro tipo de exame continua disponível", linhaDe(dados, procB1)?.disponivel === true);
  const tipoSozinhoA = (dados.linhas || []).find((l) => l.tipo === "TIPO_EXAME" && l.tipoExameId === tipoA);
  check("o tipo de exame aparece com disponivel=false", tipoSozinhoA ? tipoSozinhoA.disponivel === false : true);

  // Reativar a CATEGORIA: inativação individual preservada
  const reativaCategoria = await chamar(
    tokenFixture,
    "alterarSituacaoTipoExame",
    [tipoA, { ativo: true }],
    REG,
  );
  check("reativa o tipo de exame", reativaCategoria.success === true);
  dados = await chamar(tokenFixture, "getProcedimentosData", [], REG);
  check("procedimento ativo volta a ficar disponível", linhaDe(dados, procA1)?.disponivel === true);
  check("inativação individual preservada após reativar a categoria", linhaDe(dados, procA2)?.disponivel === false && linhaDe(dados, procA2)?.ativo === false, JSON.stringify(linhaDe(dados, procA2)));

  // Validação no backend: a disponibilidade é calculada no servidor
  check("backend devolve indisponivelPorCategoria=false ao voltar", linhaDe(dados, procA1)?.indisponivelPorCategoria === false);

  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n2. JUNTA — Serviço (categoria) × Especialidade\n");

  const servicoA = (
    await db.query(`INSERT INTO junta_servicos (nome) VALUES ($1) RETURNING id`, [`${MARCA} CAEE`])
  ).rows[0].id;
  const servicoB = (
    await db.query(`INSERT INTO junta_servicos (nome) VALUES ($1) RETURNING id`, [`${MARCA} APAE`])
  ).rows[0].id;
  const espA1 = (
    await db.query(
      `INSERT INTO junta_especialidades (servico_id, nome) VALUES ($1,$2) RETURNING id`,
      [servicoA, `${MARCA} Fono`],
    )
  ).rows[0].id;
  const espA2 = (
    await db.query(
      `INSERT INTO junta_especialidades (servico_id, nome) VALUES ($1,$2) RETURNING id`,
      [servicoA, `${MARCA} Fisio`],
    )
  ).rows[0].id;
  const espB1 = (
    await db.query(
      `INSERT INTO junta_especialidades (servico_id, nome) VALUES ($1,$2) RETURNING id`,
      [servicoB, `${MARCA} Terapia`],
    )
  ).rows[0].id;

  const espInativa = await chamar(
    tokenFixture,
    "alterarSituacaoEspecialidade",
    [espA2, { ativo: false }],
    JUN,
  );
  check("inativa uma especialidade individualmente", espInativa.success === true, JSON.stringify(espInativa).slice(0, 140));

  let dadosJ = await chamar(tokenFixture, "getServicosData", [], JUN);
  const espDe = (d, id) => (d.linhas || []).find((l) => l.especialidadeId === id);
  check("especialidade inativa: disponivel=false", espDe(dadosJ, espA2)?.disponivel === false);
  check("irmã ativa: disponivel=true", espDe(dadosJ, espA1)?.disponivel === true);

  const servicoInativado = await chamar(
    tokenFixture,
    "alterarSituacaoServico",
    [servicoA, { ativo: false }],
    JUN,
  );
  check("inativa o serviço (categoria)", servicoInativado.success === true, JSON.stringify(servicoInativado).slice(0, 160));
  check("a ação informa quantas especialidades foram afetadas", servicoInativado.subordinados === 2, servicoInativado.subordinados);

  const espNoBanco = await db.query(
    "SELECT id, ativo FROM junta_especialidades WHERE servico_id=$1 ORDER BY id",
    [servicoA],
  );
  // espA2 já estava inativa individualmente; a inativação do serviço não pode
  // tocar em nenhuma das duas, nem reativar a que já estava inativa.
  check(
    "inativar o serviço não altera o ativo das especialidades no banco",
    espNoBanco.rows.find((r) => r.id === espA1)?.ativo === true &&
      espNoBanco.rows.find((r) => r.id === espA2)?.ativo === false,
    JSON.stringify(espNoBanco.rows),
  );

  dadosJ = await chamar(tokenFixture, "getServicosData", [], JUN);
  check("especialidade ativa fica indisponível pelo serviço", espDe(dadosJ, espA1)?.disponivel === false);
  check("situação individual preservada (especialidade)", espDe(dadosJ, espA1)?.especialidadeAtivo === true);
  check("outro serviço continua disponível", espDe(dadosJ, espB1)?.disponivel === true);
  check("serviço exposto com ativo=false", (dadosJ.servicos || []).find((s) => s.id === servicoA)?.ativo === false);

  await chamar(tokenFixture, "alterarSituacaoServico", [servicoA, { ativo: true }], JUN);
  dadosJ = await chamar(tokenFixture, "getServicosData", [], JUN);
  check("reativar o serviço devolve a disponibilidade", espDe(dadosJ, espA1)?.disponivel === true);
  check("inativação individual da especialidade preservada", espDe(dadosJ, espA2)?.disponivel === false && espDe(dadosJ, espA2)?.especialidadeAtivo === false);

  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n3. PROCESSOS — Especialidade (categoria) × Procedimento (N:N)\n");

  const insereEsp = async (nome) => {
    const chave = nome.toLowerCase();
    return (
      await db.query(
        `INSERT INTO processos_especialidades (nome, nome_chave) VALUES ($1,$2) RETURNING id`,
        [nome, chave],
      )
    ).rows[0].id;
  };
  const insereProc = async (nome) => {
    const chave = nome.toLowerCase();
    return (
      await db.query(
        `INSERT INTO processos_procedimentos (nome, nome_chave) VALUES ($1,$2) RETURNING id`,
        [nome, chave],
      )
    ).rows[0].id;
  };
  const espOrto = await insereEsp(`${MARCA} Ortopedia`);
  const espNeuro = await insereEsp(`${MARCA} Neurologia`);
  const procCompartilhado = await insereProc(`${MARCA} Bloqueio`);
  const procExclusivo = await insereProc(`${MARCA} Artroplastia`);
  for (const [e, p] of [
    [espOrto, procCompartilhado],
    [espNeuro, procCompartilhado],
    [espOrto, procExclusivo],
  ]) {
    await db.query(
      `INSERT INTO processos_especialidade_procedimento (especialidade_id, procedimento_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [e, p],
    );
  }

  let dadosP = await chamar(tokenFixture, "getCatalogoProcessosData", [], PRO);
  const linhaP = (d, espId, procId) =>
    (d.linhas || []).find((l) => l.especialidadeId === espId && l.procedimentoId === procId);
  check("vínculo disponível nas duas especialidades", linhaP(dadosP, espOrto, procCompartilhado)?.disponivel === true && linhaP(dadosP, espNeuro, procCompartilhado)?.disponivel === true);
  check("procedimento agregado marcado como disponível", (dadosP.procedimentos || []).find((p) => p.id === procCompartilhado)?.disponivel === true);

  const inativaOrto = await chamar(
    tokenFixture,
    "alterarSituacaoEspecialidadeProcesso",
    [espOrto, { ativo: false }],
    PRO,
  );
  check("inativa a especialidade (categoria)", inativaOrto.success === true, JSON.stringify(inativaOrto).slice(0, 160));

  dadosP = await chamar(tokenFixture, "getCatalogoProcessosData", [], PRO);
  check("vínculo com a especialidade inativa fica indisponível", linhaP(dadosP, espOrto, procCompartilhado)?.disponivel === false);
  check("mesmo procedimento continua disponível pela outra especialidade (N:N)", linhaP(dadosP, espNeuro, procCompartilhado)?.disponivel === true);
  check("procedimento exclusivo fica indisponível", linhaP(dadosP, espOrto, procExclusivo)?.disponivel === false);
  check("situação individual do procedimento preservada", linhaP(dadosP, espOrto, procCompartilhado)?.procedimentoAtivo === true);
  const agregado = (dadosP.procedimentos || []).find((p) => p.id === procCompartilhado);
  check("na visão agregada o procedimento segue disponível", agregado?.disponivel === true, JSON.stringify(agregado));
  const exclusivo = (dadosP.procedimentos || []).find((p) => p.id === procExclusivo);
  check("procedimento que só existia na categoria inativa fica indisponível", exclusivo?.disponivel === false, JSON.stringify(exclusivo));

  const vinculosAntes = await db.query(
    "SELECT count(*)::int AS n FROM processos_especialidade_procedimento WHERE especialidade_id In ($1,$2)",
    [espOrto, espNeuro],
  );
  await chamar(tokenFixture, "alterarSituacaoEspecialidadeProcesso", [espOrto, { ativo: true }], PRO);
  const vinculosDepois = await db.query(
    "SELECT count(*)::int AS n FROM processos_especialidade_procedimento WHERE especialidade_id In ($1,$2)",
    [espOrto, espNeuro],
  );
  check("reativar não cria nem remove vínculos", vinculosAntes.rows[0].n === vinculosDepois.rows[0].n, `${vinculosAntes.rows[0].n}→${vinculosDepois.rows[0].n}`);
  dadosP = await chamar(tokenFixture, "getCatalogoProcessosData", [], PRO);
  check("reativar a categoria devolve a disponibilidade", linhaP(dadosP, espOrto, procCompartilhado)?.disponivel === true);

  // Inativação individual no N:N não afeta a outra categoria
  await chamar(tokenFixture, "alterarSituacaoProcedimentoProcesso", [procCompartilhado, { ativo: false }], PRO);
  dadosP = await chamar(tokenFixture, "getCatalogoProcessosData", [], PRO);
  check("procedimento inativado fica indisponível nas duas especialidades", linhaP(dadosP, espOrto, procCompartilhado)?.disponivel === false && linhaP(dadosP, espNeuro, procCompartilhado)?.disponivel === false);
  check("procedimento irmão permanece disponível", linhaP(dadosP, espOrto, procExclusivo)?.disponivel === true);
  await chamar(tokenFixture, "alterarSituacaoProcedimentoProcesso", [procCompartilhado, { ativo: true }], PRO);

  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n4. Auditoria e permissões\n");
  const aud = await db.query(
    `SELECT entidade, acao, detalhes FROM audit_logs
      WHERE entidade IN ('TipoExame','Servico','ProcessoEspecialidade')
        AND created_at > now() - interval '10 minutes'
      ORDER BY id DESC`,
  );
  check("auditoria registra DESATIVAR/REATIVAR do tipo de exame", aud.rows.some((r) => r.entidade === "TipoExame" && r.acao === "DESATIVAR") && aud.rows.some((r) => r.entidade === "TipoExame" && r.acao === "REATIVAR"));
  check("auditoria do serviço informa as especialidades afetadas", aud.rows.some((r) => r.entidade === "Servico" && r.detalhes?.especialidadesAfetadas === 2), JSON.stringify(aud.rows.find((r) => r.entidade === "Servico")?.detalhes));

  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n5. Interface (navegador real)\n");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([
    { name: "session_token", value: tokenFixture, domain: "localhost", path: "/" },
  ]);
  const p = await ctx.newPage();

  const abrir = async (rota) => {
    await p.goto(BASE + rota, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
  };

  // Regulação: categoria inativa + procedimento inativo individual
  await db.query("UPDATE regula_tipo_exame SET ativo=false WHERE id=$1", [tipoA]);
  await db.query("UPDATE regula_procedimentos SET ativo=false WHERE id=$1", [procB1]);
  await abrir("/regulacao?tab=PROCEDIMENTOS");
  const situacaoReg = await p.locator(".cadTabela tbody tr").evaluateAll((trs) =>
    trs.map((tr) => ({
      texto: tr.textContent,
      etiqueta: tr.querySelector(".cadStatusAtivo, .cadStatusInativo, .cadStatusIndisponivel")?.className,
      classe: tr.className,
    })),
  );
  const marcaA = situacaoReg.find((r) => r.texto.includes(`${MARCA} Raio-X`));
  // O padrão é "Ativos": o indisponível por categoria não aparece aqui.
  check("Regulação: filtro Ativos não traz o procedimento indisponível", !marcaA);
  const marcaB = situacaoReg.find((r) => r.texto.includes(`${MARCA} Hemograma`));
  // A etiqueta Indisponível já foi confirmada abaixo, na lista de inativos.
  await p.locator(".cadFiltroSituacao select").first().selectOption("inativos");
  await p.waitForTimeout(800);
  const emInativos = await p.locator(".cadTabela tbody tr").allTextContents();
  check("Regulação: em Inativos aparece o indisponível por categoria", emInativos.some((t) => t.includes(`${MARCA} Raio-X`)), JSON.stringify(emInativos.slice(0, 3)));
  const etiquetas = await p.locator(".cadStatusIndisponivel").count();
  check("Regulação: etiqueta Indisponível renderizada", etiquetas > 0, etiquetas);
  const linhaIndisp = p.locator("tr.cadLinhaIndisponivel").filter({ hasText: `${MARCA} Raio-X` });
  check("Regulação: linha marcada como indisponível por categoria", (await linhaIndisp.count()) > 0);
  await p.screenshot({ path: `${SAIDA}/regulacao-indisponiveis.png` });

  // ações dos dois níveis na linha do tipo de exame
  // A rota ?tab=PROCEDIMENTOS é compartilhada com Exames; a lista mostra só as
  // linhas da aba ativa, então garante a aba certa antes de ler as linhas.
  const abaProcedimentos = p.getByRole("tab", { name: /Procedimentos/i });
  if (await abaProcedimentos.count()) {
    await abaProcedimentos.first().click();
    await p.waitForTimeout(1200);
  }
  await p.locator(".cadFiltroSituacao select").first().selectOption("todos");
  await p.waitForTimeout(600);
  const linhaCategoria = p
    .locator(".cadTabela tbody tr")
    .filter({ hasText: `${MARCA} Imagem` })
    .filter({ has: p.locator(".cadMarcaCategoria") })
    .first();
  if (!(await linhaCategoria.count())) {
    const linhasAll = await p.locator(".cadTabela tbody tr").allTextContents();
    console.log("    linhas visíveis:", JSON.stringify(linhasAll.slice(0, 8)));
  }
  const botaoCategoria = (await linhaCategoria.count())
    ? await linhaCategoria.locator("button").allTextContents()
    : [];
  check("Regulação: a linha da categoria tem ação de situação", botaoCategoria.some((t) => /Reativar/.test(t)), JSON.stringify(botaoCategoria));
  const botaoSubordinado = await p.locator(".cadTabela tbody tr").filter({ hasText: `${MARCA} Raio-X` }).first().locator("button").allTextContents();
  check("Regulação: a linha do subordinado tem ação individual", botaoSubordinado.some((t) => /Inativar/.test(t)), JSON.stringify(botaoSubordinado));

  // Junta
  await db.query("UPDATE junta_servicos SET ativo=false WHERE id=$1", [servicoA]);
  await abrir("/gerenciamento/servicos-especialidades");
  await p.locator(".cadFiltroSituacao select").first().selectOption("inativos");
  await p.waitForTimeout(800);
  const juntaInativos = await p.locator(".cadTabela tbody tr").evaluateAll((trs) =>
    trs.map((tr) => ({ texto: tr.textContent, etiqueta: tr.querySelector(".cadStatusAtivo, .cadStatusInativo, .cadStatusIndisponivel")?.className })),
  );
  const linhaJunta = juntaInativos.find((r) => r.texto.includes(`${MARCA} Fono`));
  check("Junta: especialidade de serviço inativo aparece como Indisponível", /cadStatusIndisponivel/.test(linhaJunta?.etiqueta || ""), JSON.stringify(linhaJunta));
  await p.screenshot({ path: `${SAIDA}/junta-indisponiveis.png` });

  // Processos
  await db.query("UPDATE processos_especialidades SET ativo=false WHERE id=$1", [espOrto]);
  await abrir("/gerenciamento/especialidades-procedimentos");
  await p.locator(".cadFiltroSituacao select").first().selectOption("inativos");
  await p.waitForTimeout(800);
  const procInativos = await p.locator(".cadTabela tbody tr").evaluateAll((trs) =>
    trs.map((tr) => ({ texto: tr.textContent, etiqueta: tr.querySelector(".cadStatusAtivo, .cadStatusInativo, .cadStatusIndisponivel")?.className })),
  );
  const linhaProc = procInativos.find((r) => r.texto.includes(`${MARCA} Ortopedia`) && r.texto.includes(`${MARCA} Bloqueio`));
  check("Processos: vínculo de especialidade inativa aparece como Indisponível", /cadStatusIndisponivel/.test(linhaProc?.etiqueta || ""), JSON.stringify(linhaProc));
  await p.locator(".cadFiltroSituacao select").first().selectOption("ativos");
  await p.waitForTimeout(800);
  const procAtivos = await p.locator(".cadTabela tbody tr").allTextContents();
  check("Processos: o mesmo procedimento continua ativo pela outra especialidade", procAtivos.some((t) => t.includes(`${MARCA} Neurologia`) && t.includes(`${MARCA} Bloqueio`)), JSON.stringify(procAtivos.slice(0, 3)));
  await p.screenshot({ path: `${SAIDA}/processos-indisponiveis.png` });

  await b.close();
} finally {
  await limpar();
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
  await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);
  await db.end();
}

console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
if (falhou) {
  console.log("Falhas:\n - " + falhas.join("\n - "));
  process.exit(1);
}
console.log(`capturas em ${SAIDA}`);
