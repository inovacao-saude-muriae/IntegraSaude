/**
 * Inativação/reativação HIERÁRQUICA nos três cadastros.
 *
 *   Regulação → Tipo de Exame      → Procedimento
 *   Junta     → Serviço            → Especialidade
 *   Processos → Especialidade      → Procedimento (N:N)
 *
 * Em todos os três, CADA linha da listagem tem seu próprio botão: a linha da
 * categoria e a linha de cada registro subordinado.
 *
 * Valida, no backend e na tela, que:
 *  - inativar a categoria deixa os subordinados indisponíveis SEM mudar o
 *    `ativo` deles;
 *  - reativar a categoria devolve cada subordinado ao estado anterior
 *    (as inativações individuais são preservadas);
 *  - inativar um subordinado não afeta os irmãos;
 *  - no N:N, a inativação de uma categoria não afeta a disponibilidade do
 *    procedimento pela outra categoria ativa;
 *  - registros históricos e vínculos são preservados;
 *  - o catálogo usado pelo cadastro do módulo só oferece registro disponível;
 *  - cada linha da listagem (categoria e subordinado) tem seu próprio botão,
 *    clicável de forma independente, no navegador real.
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

  const inativaIndividual = await chamar(
    tokenFixture,
    "alterarSituacaoProcedimento",
    [procA2, { ativo: false }],
    REG,
  );
  check("inativa um procedimento individualmente", inativaIndividual.success === true, JSON.stringify(inativaIndividual).slice(0, 140));

  let dados = await chamar(tokenFixture, "getProcedimentosData", [], REG);
  const linhaDe = (d, id) => (d.linhas || []).find((l) => l.procedimentoId === id);
  const categoriaDe = (d, tipoId) =>
    (d.linhas || []).find((l) => l.tipo === "TIPO_EXAME" && l.tipoExameId === tipoId);
  check("o tipo de exame tem linha própria (categoria)", Boolean(categoriaDe(dados, tipoA)));
  check("procedimento inativo: disponivel=false", linhaDe(dados, procA2)?.disponivel === false);
  check("procedimento irmão ativo: disponivel=true", linhaDe(dados, procA1)?.disponivel === true);

  const inativaCategoria = await chamar(
    tokenFixture,
    "alterarSituacaoTipoExame",
    [tipoA, { ativo: false }],
    REG,
  );
  check("inativa o tipo de exame (categoria)", inativaCategoria.success === true, JSON.stringify(inativaCategoria).slice(0, 160));
  check("a ação informa quantos procedimentos foram afetados", inativaCategoria.subordinados === 2, inativaCategoria.subordinados);

  const filhos = await db.query(
    "SELECT id, ativo FROM regula_procedimentos WHERE tipo_exame_id=$1 ORDER BY id",
    [tipoA],
  );
  const ativoDe = (id) => filhos.rows.find((r) => r.id === id)?.ativo;
  check("inativar a categoria NÃO altera o ativo do procedimento ativo", ativoDe(procA1) === true);
  check("inativar a categoria NÃO altera o ativo do procedimento inativo", ativoDe(procA2) === false);

  dados = await chamar(tokenFixture, "getProcedimentosData", [], REG);
  check("subordinado ativo fica indisponível pela categoria", linhaDe(dados, procA1)?.disponivel === false);
  check("motivo registrado como categoria", linhaDe(dados, procA1)?.indisponivelPorCategoria === true);
  check("situação individual preservada no dado", linhaDe(dados, procA1)?.ativo === true);
  check("outro tipo de exame continua disponível", linhaDe(dados, procB1)?.disponivel === true);
  check("a categoria fica indisponível", categoriaDe(dados, tipoA)?.disponivel === false);

  await chamar(tokenFixture, "alterarSituacaoTipoExame", [tipoA, { ativo: true }], REG);
  dados = await chamar(tokenFixture, "getProcedimentosData", [], REG);
  check("reativar a categoria devolve a disponibilidade", linhaDe(dados, procA1)?.disponivel === true);
  check("inativação individual preservada após reativar a categoria", linhaDe(dados, procA2)?.disponivel === false && linhaDe(dados, procA2)?.ativo === false);

  // Catálogo do formulário do módulo: só procedimento disponível.
  const aux = await chamar(tokenFixture, "getAuxiliaryData", [], {
    rota: "/regulacao",
    arquivo: "regulacao/actions",
  });
  check("catálogo do pedido marca o procedimento inativo como indisponível", (aux.procedimentos || []).find((x) => x.id === procA2)?.disponivel === false);
  check("catálogo do pedido mantém o procedimento ativo disponível", (aux.procedimentos || []).find((x) => x.id === procA1)?.disponivel === true);

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
      WHERE entidade IN ('TipoExame','Procedimento','Servico','ProcessoEspecialidade')
        AND created_at > now() - interval '10 minutes'
      ORDER BY id DESC`,
  );
  // `alterarSituacaoProcedimento` audita com a entidade do PROCEDIMENTO
  check(
    "auditoria registra DESATIVAR/REATIVAR do procedimento (Regulação)",
    // Inativação e reativação foram gravadas como DESATIVAR e REATIVAR (nunca
    // INATIVAR) sobre um procedimento da Regulação.
    aud.rows.some((r) => r.entidade === "Procedimento" && r.acao === "DESATIVAR") &&
      aud.rows.some((r) => r.entidade === "Procedimento" && r.acao === "REATIVAR"),
    JSON.stringify(aud.rows.filter((r) => r.entidade === "Procedimento").slice(0, 3)),
  );
  check("auditoria registra DESATIVAR/REATIVAR do tipo de exame", aud.rows.some((r) => r.entidade === "TipoExame" && r.acao === "DESATIVAR") && aud.rows.some((r) => r.entidade === "TipoExame" && r.acao === "REATIVAR"));
  check("auditoria do tipo de exame informa os procedimentos afetados", aud.rows.some((r) => r.entidade === "TipoExame" && r.detalhes?.procedimentosAfetados === 2), JSON.stringify(aud.rows.find((r) => r.entidade === "TipoExame")?.detalhes));
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

  // Regulação: cadastro de um nível — procedimento inativo individual
  await db.query("UPDATE regula_procedimentos SET ativo=false WHERE id=$1", [procB1]);
  // A rota ?tab=PROCEDIMENTOS é compartilhada com Exames; garante a aba certa.
  const abaProcedimentos = p.getByRole("tab", { name: /Procedimentos/i });
  if (await abaProcedimentos.count()) {
    await abaProcedimentos.first().click();
    await p.waitForTimeout(1200);
  }
  await abrir("/regulacao?tab=PROCEDIMENTOS");
  await p.locator(".cadFiltroSituacao select").first().selectOption("todos");
  await p.waitForTimeout(900);

  // Cada linha tem o SEU botão: categoria (Inativar/Reativar tipo) e
  // subordinado (Inativar/Reativar). Lê o botão de cada linha da hierarquia.
  const linhasReg = await p.locator(".cadTabela tbody tr").evaluateAll(
    (trs, marca) =>
      trs
        .map((tr) => ({
          texto: tr.textContent,
          botoes: [...tr.querySelectorAll("button")].map((b) => b.textContent.trim()),
        }))
        .filter((l) => l.texto.includes(marca)),
    MARCA,
  );
  const linhaCategoriaReg = linhasReg.find(
    (l) => l.texto.includes(`${MARCA} Imagem`) && l.texto.includes("categoria"),
  );
  const linhaProc1 = linhasReg.find(
    (l) => l.texto.includes(`${MARCA} Raio-X`) && !l.texto.includes("categoria"),
  );
  const linhaProc2 = linhasReg.find(
    (l) => l.texto.includes(`${MARCA} Tomografia`) && !l.texto.includes("categoria"),
  );
  check("Regulação: linha da categoria tem botão próprio", linhaCategoriaReg?.botoes.length === 1, JSON.stringify(linhaCategoriaReg));
  check("Regulação: linha do procedimento 1 tem botão próprio", linhaProc1?.botoes.length === 1, JSON.stringify(linhaProc1));
  check("Regulação: linha do procedimento 2 tem botão próprio", linhaProc2?.botoes.length === 1, JSON.stringify(linhaProc2));

  // Clique real na categoria e no subordinado, de forma independente.
  const linhaCategoria = p
    .locator(".cadTabela tbody tr")
    .filter({ hasText: `${MARCA} Imagem` })
    .filter({ has: p.locator(".cadMarcaCategoria") })
    .first();
  await linhaCategoria.locator("button").first().click();
  const modal = p.locator('[role="dialog"]');
  await modal.waitFor({ state: "visible", timeout: 8000 });
  check("Regulação: o botão da categoria abre a confirmação", true);
  const textoModal = await modal.textContent();
  check("Regulação: a confirmação menciona o tipo de exame", /tipo de exame/i.test(textoModal), textoModal.slice(0, 120));
  await modal.locator("button").filter({ hasText: /^Inativar$/ }).first().click();
  await p.waitForTimeout(2000);
  const aviso = p.locator('[role="alertdialog"]');
  if (await aviso.count()) {
    await aviso.locator("button").last().click();
    await p.waitForTimeout(600);
  }
  const tipoInativado = await db.query("SELECT ativo FROM regula_tipo_exame WHERE id=$1", [tipoA]);
  check("Regulação: o clique na categoria inativa o tipo de exame", tipoInativado.rows[0].ativo === false);

  await abrir("/regulacao?tab=PROCEDIMENTOS");
  const aba2 = p.getByRole("tab", { name: /Procedimentos/i });
  if (await aba2.count()) {
    await aba2.first().click();
    await p.waitForTimeout(1200);
  }
  await p.locator(".cadFiltroSituacao select").first().selectOption("todos");
  await p.waitForTimeout(900);
  const marcaIndisp = await p.locator(".cadStatusIndisponivel").count();
  check("Regulação: procedimento ativo de categoria inativa aparece como Indisponível", marcaIndisp > 0, marcaIndisp);
  const procNoBanco = await db.query("SELECT ativo FROM regula_procedimentos WHERE id=$1", [procA1]);
  check("Regulação: o procedimento ativo continua ativo no banco", procNoBanco.rows[0].ativo === true);
  await p.screenshot({ path: `${SAIDA}/regulacao-todos-1440.png`, fullPage: true });

  // Clique individual: reativa só o procedimento já inativo
  const aba3 = p.getByRole("tab", { name: /Procedimentos/i });
  if (await aba3.count()) {
    await aba3.first().click();
    await p.waitForTimeout(1000);
  }
  const linhaSubordinado = p
    .locator(".cadTabela tbody tr")
    .filter({ hasText: `${MARCA} Raio-X` })
    .filter({ hasNot: p.locator(".cadMarcaCategoria") })
    .first();
  await linhaSubordinado.locator("button").first().click();
  const modal2 = p.locator('[role="dialog"]');
  await modal2.waitFor({ state: "visible", timeout: 8000 });
  const textoModal2 = await modal2.textContent();
  check("Regulação: a confirmação do subordinado cita o procedimento", /Raio-X/.test(textoModal2), textoModal2.slice(0, 120));
  await modal2.locator("button").filter({ hasText: /^Inativar$/ }).first().click();
  await p.waitForTimeout(2000);
  const aviso2 = p.locator('[role="alertdialog"]');
  if (await aviso2.count()) {
    await aviso2.locator("button").last().click();
    await p.waitForTimeout(600);
  }
  const proc1Depois = await db.query("SELECT ativo FROM regula_procedimentos WHERE id=$1", [procA1]);
  const tipoDepois = await db.query("SELECT ativo FROM regula_tipo_exame WHERE id=$1", [tipoA]);
  check("Regulação: inativar o subordinado não mexe na categoria", tipoDepois.rows[0].ativo === false);
  check("Regulação: o subordinado fica inativo individualmente", proc1Depois.rows[0].ativo === false);

  // Restaura a categoria e o procedimento para o fim da suíte
  await chamar(tokenFixture, "alterarSituacaoTipoExame", [tipoA, { ativo: true }], REG);
  await chamar(tokenFixture, "alterarSituacaoProcedimento", [procA1, { ativo: true }], REG);

  // ── Junta: botão em cada linha e clique independente ────────────────────
  await db.query("UPDATE junta_servicos SET ativo=false WHERE id=$1", [servicoA]);
  await abrir("/gerenciamento/servicos-especialidades");
  await p.locator(".cadFiltroSituacao select").first().selectOption("todos");
  await p.waitForTimeout(900);
  const linhasJunta = await p.locator(".cadTabela tbody tr").evaluateAll(
    (trs, marca) =>
      trs
        .map((tr) => ({
          texto: tr.textContent,
          botoes: [...tr.querySelectorAll("button")].map((b) => b.textContent.trim()),
        }))
        .filter((l) => l.texto.includes(marca)),
    MARCA,
  );
  const jCat = linhasJunta.find((l) => l.texto.includes(`${MARCA} CAEE`) && l.texto.includes("categoria"));
  const jEsp = linhasJunta.find((l) => l.texto.includes(`${MARCA} Fono`) && !l.texto.includes("categoria"));
  check("Junta: linha do serviço tem botão próprio", jCat?.botoes.length === 1, JSON.stringify(jCat));
  check("Junta: linha da especialidade tem botão próprio", jEsp?.botoes.length === 1, JSON.stringify(jEsp));
  check("Junta: especialidade de serviço inativo aparece como Indisponível", /Indisponível/.test(jEsp?.texto || ""), JSON.stringify(jEsp?.texto));

  const linhaEsp = p
    .locator(".cadTabela tbody tr")
    .filter({ hasText: `${MARCA} Fono` })
    .filter({ hasNot: p.locator(".cadMarcaCategoria") })
    .first();
  await linhaEsp.locator("button").first().click();
  const modalJ = p.locator('[role="dialog"]');
  await modalJ.waitFor({ state: "visible", timeout: 8000 });
  const textoModalJ = await modalJ.textContent();
  check("Junta: a confirmação cita a especialidade", /Fono/.test(textoModalJ), textoModalJ.slice(0, 120));
  await modalJ.locator("button").filter({ hasText: /^Inativar$/ }).first().click();
  await p.waitForTimeout(2000);
  const avisoJ = p.locator('[role="alertdialog"]');
  if (await avisoJ.count()) {
    await avisoJ.locator("button").last().click();
    await p.waitForTimeout(600);
  }
  const espDepois = await db.query("SELECT ativo FROM junta_especialidades WHERE id=$1", [espA1]);
  const servicoDepois = await db.query("SELECT ativo FROM junta_servicos WHERE id=$1", [servicoA]);
  check("Junta: inativar a especialidade não mexe no serviço", servicoDepois.rows[0].ativo === false);
  check("Junta: a especialidade fica inativa individualmente", espDepois.rows[0].ativo === false);
  await p.screenshot({ path: `${SAIDA}/junta-todos-1440.png`, fullPage: true });

  // ── Processos: botão em cada linha e clique independente ────────────────
  await db.query("UPDATE processos_especialidades SET ativo=false WHERE id=$1", [espOrto]);
  await abrir("/gerenciamento/especialidades-procedimentos");
  await p.locator(".cadFiltroSituacao select").first().selectOption("todos");
  await p.waitForTimeout(900);
  const linhasProcTela = await p.locator(".cadTabela tbody tr").evaluateAll(
    (trs, marca) =>
      trs
        .map((tr) => ({
          texto: tr.textContent,
          botoes: [...tr.querySelectorAll("button")].map((b) => b.textContent.trim()),
        }))
        .filter((l) => l.texto.includes(marca)),
    MARCA,
  );
  const pCat = linhasProcTela.find((l) => l.texto.includes(`${MARCA} Ortopedia`) && l.texto.includes("categoria"));
  // O mesmo procedimento aparece em duas especialidades (N:N): a linha que
  // interessa é a do vínculo com a especialidade INATIVA (Ortopedia).
  const pVinc = linhasProcTela.find(
    (l) =>
      l.texto.includes(`${MARCA} Ortopedia`) &&
      l.texto.includes(`${MARCA} Bloqueio`) &&
      !l.texto.includes("categoria"),
  );
  check("Processos: linha da especialidade tem botão próprio", pCat?.botoes.length === 1, JSON.stringify(pCat));
  check("Processos: linha do vínculo tem botão próprio", pVinc?.botoes.length === 1, JSON.stringify(pVinc));
  check("Processos: vínculo de especialidade inativa aparece como Indisponível", /Indisponível/.test(pVinc?.texto || ""), JSON.stringify(pVinc?.texto));

  const linhaVinc = p
    .locator(".cadTabela tbody tr")
    .filter({ hasText: `${MARCA} Ortopedia` })
    .filter({ hasText: `${MARCA} Bloqueio` })
    .filter({ hasNot: p.locator(".cadMarcaCategoria") })
    .first();
  await linhaVinc.locator("button").first().click();
  const modalP = p.locator('[role="dialog"]');
  await modalP.waitFor({ state: "visible", timeout: 8000 });
  const textoModalP = await modalP.textContent();
  check("Processos: a confirmação cita o procedimento", /Bloqueio/.test(textoModalP), textoModalP.slice(0, 120));
  await modalP.locator("button").filter({ hasText: /^Inativar$/ }).first().click();
  await p.waitForTimeout(2000);
  const avisoP = p.locator('[role="alertdialog"]');
  if (await avisoP.count()) {
    await avisoP.locator("button").last().click();
    await p.waitForTimeout(600);
  }
  const procDepoisP = await db.query("SELECT ativo FROM processos_procedimentos WHERE id=$1", [procCompartilhado]);
  const espDepoisP = await db.query("SELECT ativo FROM processos_especialidades WHERE id=$1", [espOrto]);
  check("Processos: o procedimento fica inativo individualmente", procDepoisP.rows[0].ativo === false);
  check("Processos: a especialidade (categoria) continua como estava", espDepoisP.rows[0].ativo === false);
  await p.screenshot({ path: `${SAIDA}/processos-todos-1440.png`, fullPage: true });

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
