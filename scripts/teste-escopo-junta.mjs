/**
 * Escopo de acesso só na Junta Reguladora, com serviços carregados do cadastro.
 *
 * Verifica, com as rotas HTTP reais, sessões reais e o banco de desenvolvimento:
 *   1. catálogo marca escopo por serviço SÓ na Junta
 *   2. demais módulos não expõem serviços
 *   3. serviços vêm do banco (junta_servicos), não do código
 *   4. serviço recém-cadastrado aparece automaticamente
 *   5. renomear o serviço não rompe o vínculo
 *   6. serviço inativo não recebe atribuição nova
 *   7. serviço reativado volta a ficar disponível
 *   8. escopo TODOS
 *   9. escopo ESPECIFICOS
 *  10. escopo NENHUM
 *  11. identificadores inválidos recusados
 *  12. cadastro de usuário com essa configuração
 *  13. alteração posterior pelo botão Acessos (PUT)
 *  14. permissões dos demais módulos preservadas
 *  15. revogação durante sessão ativa
 *  16. restrição aplicada no backend (não só na tela)
 *
 * Uso: node scripts/teste-escopo-junta.mjs   (com o servidor no ar)
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

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
  if (cond) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhou += 1;
    falhas.push(nome);
    console.log(`  FALHA ${nome} ${extra}`);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────
const GESTOR = "91000000991"; // GESTAO/ADMINISTRADOR — configura acessos
const OPERADOR = "91000000992"; // JUNTA/OPERADOR — sofre as restrições
const NOVO = "91000000993"; // criado pelo cadastro com escopo ESPECIFICOS
const SERVICO_TESTE = "SERVICO TESTE ESCOPO";
const SERVICO_TESTE_RENOMEADO = "SERVICO TESTE ESCOPO RENOMEADO";

async function garantirUsuario(cpf, nome, acessos = []) {
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
  await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
  await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
  const h = await bcrypt.hash("Fixture@2026", 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,$2,$3,true,false,now())`,
    [cpf, nome, h],
  );
  for (const a of acessos) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,$3,'ADMIN',$4,$5::text[],'{}','{}',true)`,
      [cpf, a.modulo, a.perfil, a.escopo || "TODOS", a.servicos || []],
    );
  }
}

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

const req = async (metodo, rota, cpf, corpo) => {
  const token = await tokenDe(cpf);
  const r = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: { cookie: `session_token=${token}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let dados = null;
  try {
    dados = await r.json();
  } catch {
    dados = null;
  }
  return { status: r.status, dados };
};

const catalogo = async (cpf) => req("GET", "/api/gerenciamento/permissoes/catalogo", cpf);
const moduloDe = (cat, chave) => (cat?.dados?.modulos || []).find((m) => m.chave === chave);

const servicoDoBanco = async (nome) =>
  (await db.query("SELECT id, nome, ativo FROM junta_servicos WHERE nome=$1", [nome])).rows[0];

const vinculosDoUsuario = async (cpf) =>
  (await db.query(
    "SELECT modulo, perfil, escopo, servicos, permissoes, ativo FROM user_acessos WHERE user_cpf=$1 ORDER BY modulo",
    [cpf],
  )).rows;

async function main() {
  await db.connect();

  console.log("\nPreparando…");
  // Limpa o serviço de teste (e as especialidades dele) de execuções anteriores.
  await db.query("DELETE FROM junta_especialidades WHERE servico_id IN (SELECT id FROM junta_servicos WHERE nome LIKE 'SERVICO TESTE ESCOPO%')");
  await db.query("DELETE FROM junta_servicos WHERE nome LIKE 'SERVICO TESTE ESCOPO%'");
  for (const cpf of [NOVO]) {
    await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
    await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
  }
  await garantirUsuario(GESTOR, "TESTE Gestor Escopo Junta", [
    { modulo: "GESTAO", perfil: "ADMINISTRADOR" },
    { modulo: "JUNTA", perfil: "ADMINISTRADOR" },
    { modulo: "REGULACAO", perfil: "ADMINISTRADOR" },
    { modulo: "CCZ", perfil: "ADMINISTRADOR" },
  ]);
  await garantirUsuario(OPERADOR, "TESTE Operador Junta", [
    { modulo: "JUNTA", perfil: "OPERADOR", escopo: "TODOS" },
  ]);

  const caee = await servicoDoBanco("CAEE");
  check("serviço CAEE existe no cadastro", !!caee, "crie CAEE em Serviços e Especialidades");
  if (!caee) {
    console.log("\nSem o serviço CAEE não é possível seguir. Abortando.");
    await db.end();
    process.exit(1);
  }

  // ── 1 e 2. Onde o escopo aparece ────────────────────────────────────────
  console.log("\n1/2) Escopo por serviço só na Junta");
  const cat = await catalogo(GESTOR);
  check("catálogo responde 200", cat.status === 200, cat.status);
  const junta = moduloDe(cat, "JUNTA");
  const regulacao = moduloDe(cat, "REGULACAO");
  const farmacia = moduloDe(cat, "FARMACIA");
  const processos = moduloDe(cat, "PROCESSOS");
  const ccz = moduloDe(cat, "CCZ");
  const gestao = moduloDe(cat, "GESTAO");
  check("Junta declara escopo por serviço", !!junta?.servicosDoModulo);
  check("Regulação NÃO declara", !regulacao?.servicosDoModulo);
  check("Farmácia NÃO declara", !farmacia?.servicosDoModulo);
  check("Processos NÃO declara", !processos?.servicosDoModulo);
  check("CCZ NÃO declara", !ccz?.servicosDoModulo);
  check("Gestão Geral NÃO declara", !gestao?.servicosDoModulo);
  check(
    "só a Junta expõe lista de serviços",
    [regulacao, farmacia, processos, ccz, gestao].every((m) => m?.servicosDoModulo == null),
  );

  // ── 3. Serviços vêm do banco ────────────────────────────────────────────
  console.log("\n3) Serviços carregados do banco");
  const servicosApi = junta.servicosDoModulo.servicos;
  check("lista não está vazia", servicosApi.length > 0, servicosApi.length);
  const noBanco = (await db.query("SELECT count(*)::int c FROM junta_servicos")).rows[0].c;
  check("a lista tem exatamente os serviços cadastrados", servicosApi.length === noBanco, `${servicosApi.length} vs ${noBanco}`);
  check("cada item traz id, nome e ativo", servicosApi.every((s) => s.id && s.nome && typeof s.ativo === "boolean"));
  check("CAEE aparece com o id do banco", servicosApi.some((s) => s.id === String(caee.id) && s.nome === "CAEE"));
  check("ativos listados à parte", Array.isArray(junta.servicosDoModulo.ativos));

  // ── 4. Novo serviço aparece automaticamente ─────────────────────────────
  console.log("\n4) Serviço recém-cadastrado aparece sem mexer em código");
  const novo = (await db.query(
    "INSERT INTO junta_servicos (nome, ativo, created_at) VALUES ($1, true, now()) RETURNING id",
    [SERVICO_TESTE],
  )).rows[0];
  const catDepois = await catalogo(GESTOR);
  const servicosDepois = moduloDe(catDepois, "JUNTA").servicosDoModulo;
  check("o novo serviço está na lista", servicosDepois.servicos.some((s) => s.id === String(novo.id)));
  check("o novo serviço está entre os ativos", servicosDepois.ativos.includes(String(novo.id)));
  check("CAEE continua na lista", servicosDepois.servicos.some((s) => s.id === String(caee.id)));

  // ── 8/12. Cadastro com ESPECIFICOS usando o novo serviço ────────────────
  console.log("\n8/12) Cadastro de usuário com escopo ESPECIFICOS (serviço novo)");
  const cadastro = await req("POST", "/api/gerenciamento/usuarios", GESTOR, {
    cpf: NOVO,
    nomeCompleto: "TESTE Escopo Junta",
    cargo: "Operador Junta",
    vinculos: [
      { modulo: "JUNTA", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos: [String(novo.id)] },
      { modulo: "REGULACAO", perfil: "OPERADOR", escopo: "TODOS", servicos: [] },
    ],
  });
  check("cadastro conclui", cadastro.status === 201 && cadastro.dados?.success, JSON.stringify(cadastro.dados).slice(0, 160));
  const vinculosNovo = await vinculosDoUsuario(NOVO);
  const vJunta = vinculosNovo.find((v) => v.modulo === "JUNTA");
  check("vínculo da Junta gravado", !!vJunta);
  check("escopo gravado como ESPECIFICOS", vJunta?.escopo === "ESPECIFICOS", vJunta?.escopo);
  check("guardou o ID do serviço", JSON.stringify(vJunta?.servicos) === JSON.stringify([String(novo.id)]), vJunta?.servicos);
  check("não guardou nome do serviço", !JSON.stringify(vJunta?.servicos || []).includes("SERVICO"));
  const vReg = vinculosNovo.find((v) => v.modulo === "REGULACAO");
  check("Regulação gravada com escopo interno TODOS", vReg?.escopo === "TODOS", vReg?.escopo);
  check("Regulação sem lista de serviços", (vReg?.servicos || []).length === 0);

  // ── 5. Renomear não rompe o vínculo ─────────────────────────────────────
  console.log("\n5) Renomear o serviço mantém o vínculo");
  await db.query("UPDATE junta_servicos SET nome=$1 WHERE id=$2", [SERVICO_TESTE_RENOMEADO, novo.id]);
  const catRenomeado = await catalogo(GESTOR);
  const listaRenomeada = moduloDe(catRenomeado, "JUNTA").servicosDoModulo.servicos;
  check(
    "a lista mostra o novo nome",
    listaRenomeada.some((s) => s.id === String(novo.id) && s.nome === SERVICO_TESTE_RENOMEADO),
  );
  const vinculosAposRenomear = await vinculosDoUsuario(NOVO);
  check(
    "o vínculo continua com o mesmo id",
    JSON.stringify(vinculosAposRenomear.find((v) => v.modulo === "JUNTA")?.servicos) ===
      JSON.stringify([String(novo.id)]),
  );
  // A Junta reconhece o serviço renomeado para quem tem o vínculo (backend).
  const pageJunta = await fetch(`${BASE}/junta-reguladora?tab=SERVICOS&subTab=${encodeURIComponent(SERVICO_TESTE_RENOMEADO)}`, {
    headers: { cookie: `session_token=${await tokenDe(NOVO)}` },
  });
  check("usuário do serviço acessa a tela do serviço renomeado", pageJunta.status === 200, pageJunta.status);

  // ── 6. Serviço inativo não recebe atribuição nova ───────────────────────
  console.log("\n6) Serviço inativo recusa atribuição nova");
  await db.query("UPDATE junta_servicos SET ativo=false WHERE id=$1", [novo.id]);
  const catInativo = await catalogo(GESTOR);
  const servicosInativo = moduloDe(catInativo, "JUNTA").servicosDoModulo;
  check("serviço inativo continua listado (vínculo identificável)", servicosInativo.servicos.some((s) => s.id === String(novo.id) && s.ativo === false));
  check("serviço inativo sai da lista de ativos", !servicosInativo.ativos.includes(String(novo.id)));

  const atribuicaoNova = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [
      { modulo: "JUNTA", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos: [String(novo.id)] },
    ],
  });
  check("PUT com serviço inativo é recusado", atribuicaoNova.status === 400, atribuicaoNova.status);
  check(
    "a mensagem explica a inativação",
    /inativo/i.test(atribuicaoNova.dados?.error || ""),
    atribuicaoNova.dados?.error,
  );
  const operadorAposRecusa = await vinculosDoUsuario(OPERADOR);
  check("nada foi gravado para o operador", operadorAposRecusa.every((v) => !(v.servicos || []).includes(String(novo.id))));

  // O vínculo ANTIGO com o serviço agora inativo continua válido: salvar de novo
  // a mesma configuração do usuário NOVO não é bloqueado.
  const remantido = await req("PUT", `/api/gerenciamento/usuarios/${NOVO}/acessos`, GESTOR, {
    vinculos: [
      { modulo: "JUNTA", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos: [String(novo.id)] },
      { modulo: "REGULACAO", perfil: "OPERADOR", escopo: "TODOS", servicos: [] },
    ],
  });
  check("vínculo existente com serviço inativo é preservado", remantido.status === 200, JSON.stringify(remantido.dados).slice(0, 160));

  // ── 7. Reativação volta a permitir ──────────────────────────────────────
  console.log("\n7) Serviço reativado volta a ficar disponível");
  await db.query("UPDATE junta_servicos SET ativo=true WHERE id=$1", [novo.id]);
  const catReativado = await catalogo(GESTOR);
  check(
    "serviço volta à lista de ativos",
    moduloDe(catReativado, "JUNTA").servicosDoModulo.ativos.includes(String(novo.id)),
  );
  const atribuicaoAposReativar = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [
      { modulo: "JUNTA", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos: [String(novo.id)] },
    ],
  });
  check("atribuição volta a ser aceita", atribuicaoAposReativar.status === 200, JSON.stringify(atribuicaoAposReativar.dados).slice(0, 160));

  // ── 9. ESPECIFICOS ──────────────────────────────────────────────────────
  console.log("\n9) Escopo ESPECIFICOS");
  const vOperador = (await vinculosDoUsuario(OPERADOR)).find((v) => v.modulo === "JUNTA");
  check("gravado ESPECIFICOS", vOperador?.escopo === "ESPECIFICOS");
  check("com o id do serviço", JSON.stringify(vOperador?.servicos) === JSON.stringify([String(novo.id)]));

  // ── 10. NENHUM ──────────────────────────────────────────────────────────
  console.log("\n10) Escopo NENHUM");
  const nenhum = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [
      // NENHUM exige que não sobre permissão operacional: CONSULTA não tem.
      { modulo: "JUNTA", perfil: "CONSULTA", escopo: "NENHUM", servicos: [] },
    ],
  });
  check("escopo NENHUM aceito com perfil de consulta", nenhum.status === 200, JSON.stringify(nenhum.dados).slice(0, 200));
  const vNenhum = (await vinculosDoUsuario(OPERADOR)).find((v) => v.modulo === "JUNTA");
  check("gravado NENHUM", vNenhum?.escopo === "NENHUM", vNenhum?.escopo);
  check("NENHUM não lista serviços", (vNenhum?.servicos || []).length === 0);
  const nenhumOperador = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [{ modulo: "JUNTA", perfil: "OPERADOR", escopo: "NENHUM", servicos: [] }],
  });
  check(
    "NENHUM com permissões operacionais é recusado",
    nenhumOperador.status === 400,
    nenhumOperador.status,
  );

  // ── 8. TODOS ────────────────────────────────────────────────────────────
  console.log("\n8) Escopo TODOS");
  const todos = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [{ modulo: "JUNTA", perfil: "OPERADOR", escopo: "TODOS", servicos: [] }],
  });
  check("escopo TODOS aceito", todos.status === 200, JSON.stringify(todos.dados).slice(0, 160));
  check("TODOS não guarda lista", ((await vinculosDoUsuario(OPERADOR)).find((v) => v.modulo === "JUNTA")?.servicos || []).length === 0);

  // ── 11. Identificadores inválidos ───────────────────────────────────────
  console.log("\n11) Identificadores inválidos recusados");
  const casos = [
    ["id inexistente", ["999999"]],
    ["nome em vez de id", ["CAEE"]],
    ["id negativo", ["-1"]],
    ["id com letra", ["1abc"]],
    ["lista vazia com ESPECIFICOS", []],
  ];
  for (const [rotulo, servicos] of casos) {
    const r = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
      vinculos: [{ modulo: "JUNTA", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos }],
    });
    check(`recusa ${rotulo}`, r.status === 400, `${r.status} ${r.dados?.error || ""}`);
  }
  // Módulo sem escopo (Regulação): a lista é ignorada e o escopo gravado é
  // TODOS — nunca ESPECIFICOS com serviço de outro módulo.
  const servicoEmModuloErrado = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [{ modulo: "REGULACAO", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos: [String(caee.id)] }],
  });
  const vinReg = servicoEmModuloErrado.dados?.vinculos?.find((v) => v.modulo === "REGULACAO");
  check(
    "Regulação ignora a lista e grava TODOS sem serviços",
    servicoEmModuloErrado.status === 200 &&
      vinReg?.escopo === "TODOS" &&
      (vinReg?.servicos || []).length === 0,
    `${servicoEmModuloErrado.status} ${JSON.stringify(vinReg?.escopo)} ${JSON.stringify(vinReg?.servicos)}`,
  );

  // ── 13. Alteração pelo botão Acessos (PUT) ──────────────────────────────
  console.log("\n13) Alteração posterior pelo botão Acessos");
  const alterar = await req("PUT", `/api/gerenciamento/usuarios/${NOVO}/acessos`, GESTOR, {
    vinculos: [
      { modulo: "JUNTA", perfil: "SUPERVISOR", escopo: "ESPECIFICOS", servicos: [String(caee.id), String(novo.id)] },
      { modulo: "REGULACAO", perfil: "OPERADOR", escopo: "TODOS", servicos: [] },
    ],
  });
  check("alteração aceita", alterar.status === 200, JSON.stringify(alterar.dados).slice(0, 160));
  const vAlterado = (await vinculosDoUsuario(NOVO)).find((v) => v.modulo === "JUNTA");
  check("perfil alterado", vAlterado?.perfil === "SUPERVISOR", vAlterado?.perfil);
  check(
    "dois serviços vinculados",
    (vAlterado?.servicos || []).length === 2,
    JSON.stringify(vAlterado?.servicos),
  );
  const leitura = await req("GET", `/api/gerenciamento/usuarios/${NOVO}/acessos`, GESTOR);
  const vLido = (leitura.dados?.vinculos || []).find((v) => v.modulo === "JUNTA");
  check("a leitura devolve os ids", JSON.stringify((vLido?.servicos || []).slice().sort()) === JSON.stringify([String(caee.id), String(novo.id)].sort()));
  check("a leitura preserva o escopo", vLido?.escopo === "ESPECIFICOS", vLido?.escopo);

  // ── 14. Permissões dos demais módulos preservadas ───────────────────────
  console.log("\n14) Permissões dos demais módulos preservadas");
  const vRegFinal = (await vinculosDoUsuario(NOVO)).find((v) => v.modulo === "REGULACAO");
  check("Regulação mantém perfil", vRegFinal?.perfil === "OPERADOR", vRegFinal?.perfil);
  check("Regulação mantém escopo TODOS", vRegFinal?.escopo === "TODOS");
  check("Regulação continua sem lista", (vRegFinal?.servicos || []).length === 0);
  const juntaSemEscopo = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [
      { modulo: "JUNTA", perfil: "OPERADOR", escopo: "TODOS", servicos: [] },
      { modulo: "CCZ", perfil: "OPERADOR", escopo: "TODOS", servicos: [] },
    ],
  });
  check("CCZ aceito com escopo interno", juntaSemEscopo.status === 200, JSON.stringify(juntaSemEscopo.dados).slice(0, 160));
  const vCcz = (await vinculosDoUsuario(OPERADOR)).find((v) => v.modulo === "CCZ");
  check("CCZ gravado como TODOS", vCcz?.escopo === "TODOS", vCcz?.escopo);
  check("CCZ sem serviços", (vCcz?.servicos || []).length === 0);

  // ── 16. Restrição aplicada no backend ───────────────────────────────────
  console.log("\n16) Restrição no backend (não só na tela)");
  // Operador com acesso SÓ ao serviço CAEE: a tela do outro serviço é negada.
  const soCaee = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [{ modulo: "JUNTA", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos: [String(caee.id)] }],
  });
  check("configuração aplicada", soCaee.status === 200, JSON.stringify(soCaee.dados).slice(0, 160));
  const tokenOperador = await tokenDe(OPERADOR);
  const telaCaee = await fetch(
    `${BASE}/junta-reguladora?tab=SERVICOS&subTab=${encodeURIComponent("CAEE")}`,
    { headers: { cookie: `session_token=${tokenOperador}` } },
  );
  check("acessa o serviço vinculado", telaCaee.status === 200, telaCaee.status);
  const telaOutro = await fetch(
    `${BASE}/junta-reguladora?tab=SERVICOS&subTab=${encodeURIComponent(SERVICO_TESTE_RENOMEADO)}`,
    { headers: { cookie: `session_token=${tokenOperador}` } },
  );
  const htmlOutro = await telaOutro.text();
  check(
    "serviço fora do vínculo é bloqueado na tela",
    telaOutro.status === 403 || /negad|sem acesso|não autorizado/i.test(htmlOutro),
    telaOutro.status,
  );

  // ── 15. Revogação durante sessão ativa ──────────────────────────────────
  console.log("\n15) Revogação durante sessão ativa");
  const antes = await fetch(`${BASE}/junta-reguladora?tab=SERVICOS&subTab=CAEE`, {
    headers: { cookie: `session_token=${tokenOperador}` },
  });
  check("antes da revogação tem acesso", antes.status === 200, antes.status);
  const revogar = await req("PUT", `/api/gerenciamento/usuarios/${OPERADOR}/acessos`, GESTOR, {
    vinculos: [{ modulo: "JUNTA", perfil: "CONSULTA", escopo: "NENHUM", servicos: [] }],
  });
  check("revogação aceita", revogar.status === 200, JSON.stringify(revogar.dados).slice(0, 160));
  const depois = await fetch(`${BASE}/junta-reguladora?tab=SERVICOS&subTab=CAEE`, {
    headers: { cookie: `session_token=${tokenOperador}` },
  });
  const htmlDepois = await depois.text();
  check(
    "a mesma sessão perde o acesso ao serviço",
    depois.status === 403 || /negad|sem acesso|não autorizado/i.test(htmlDepois),
    depois.status,
  );

  // ── Auditoria ───────────────────────────────────────────────────────────
  console.log("\nAuditoria das alterações");
  const audit = await db.query(
    `SELECT acao, descricao FROM audit_logs
     WHERE user_cpf=$1 AND modulo='GESTAO' ORDER BY id DESC LIMIT 12`,
    [GESTOR],
  );
  check("há registros de auditoria", audit.rows.length > 0, audit.rows.length);
  const texto = JSON.stringify(audit.rows);
  check("a auditoria cita o NOME do serviço, não o id cru", /SERVICO TESTE ESCOPO|CAEE/.test(texto));
  check("a auditoria não vaza o id como referência principal", !/"servicos":\["\d+"\]/.test(texto));

  // ── Limpeza ─────────────────────────────────────────────────────────────
  await db.query("DELETE FROM junta_especialidades WHERE servico_id=$1", [novo.id]);
  await db.query("DELETE FROM junta_servicos WHERE id=$1", [novo.id]);
  for (const cpf of [NOVO, OPERADOR]) {
    await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
    await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
  }
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [GESTOR]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [GESTOR]);
  await db.query("DELETE FROM users WHERE cpf=$1", [GESTOR]);

  await db.end();
  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log("Falhas:\n - " + falhas.join("\n - "));
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("\nERRO FATAL:", e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
