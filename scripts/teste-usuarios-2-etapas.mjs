/**
 * Gerenciar Usuários — área única, cadastro em 2 etapas e acessos opcionais.
 *
 * Verifica, com as rotas HTTP reais e sessões reais:
 *   1. cadastro sem nenhum módulo            10. acessos abertos pelo botão da lista
 *   2. cadastro com um módulo                11. permissões do usuário selecionado
 *   3. cadastro com vários módulos           12. edição de vínculos existentes
 *   4. perfis diferentes por módulo          13. inclusão posterior de módulos
 *   5. "Configurar depois"                   14. remoção de módulos
 *   6. senha temporária apresentada          15. permissões personalizadas preservadas
 *   7. primeiro acesso sem vínculos          16. reset de senha
 *   8. operações não autorizadas bloqueadas  17. desativação e reativação
 *   9. nenhuma aba "Acessos por módulo"      18. auditoria + segurança sem regressão
 *
 * Uso: node scripts/teste-usuarios-2-etapas.mjs   (com o servidor no ar)
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

// ── Contas de fixture ─────────────────────────────────────────────────────
const GESTOR = "91000000971"; // GESTAO/ADMINISTRADOR (configura acessos)
const OPERADOR = "91000000972"; // REGULACAO/OPERADOR (não configura acessos)
const NOVOS = ["91000000973", "91000000974", "91000000975", "91000000976", "91000000977"];

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
       VALUES ($1,$2,$3,'ADMIN','TODOS','{}','{}','{}',true)`,
      [cpf, a.modulo, a.perfil],
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
  return { status: r.status, dados, cache: r.headers.get("cache-control") };
};

async function main() {
  await db.connect();

  console.log("\nPreparando…");
  for (const cpf of NOVOS) {
    await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
  }
  // Poder de concessão: ninguém concede o que não tem — o gestor de fixture
  // recebe também os módulos que vai atribuir.
  await garantirUsuario(GESTOR, "TESTE Gestor Usuários", [
    { modulo: "GESTAO", perfil: "ADMINISTRADOR" },
    { modulo: "REGULACAO", perfil: "ADMINISTRADOR" },
    { modulo: "JUNTA", perfil: "ADMINISTRADOR" },
    { modulo: "CCZ", perfil: "ADMINISTRADOR" },
    { modulo: "PROCESSOS", perfil: "ADMINISTRADOR" },
  ]);
  await garantirUsuario(OPERADOR, "TESTE Operador Regulação", [
    { modulo: "REGULACAO", perfil: "OPERADOR" },
  ]);
  check("contas de fixture prontas", true);

  // ── 9. Página sem a aba independente ────────────────────────────────────
  console.log("\n9) Página Gerenciar Usuários sem aba de acessos");
  const pagina = await fetch(`${BASE}/gerenciamento/usuarios`, {
    headers: { cookie: `session_token=${await tokenDe(GESTOR)}` },
  });
  const html = await pagina.text();
  check("página responde 200", pagina.status === 200, pagina.status);
  check("não há aba 'Acessos por módulo'", !/Acessos por módulo/.test(html));
  check("não há aba 'Contas'", !/>\s*Contas\s*</.test(html));
  check("há o botão Novo Usuário", /Novo Usu[aá]rio/.test(html));
  check("a lista aparece direto", /Usu[aá]rios do Sistema/.test(html));

  // ── 1. Cadastro SEM nenhum módulo ──────────────────────────────────────
  console.log("\n1) Cadastro sem nenhum módulo");
  const semModulo = await req("POST", "/api/gerenciamento/usuarios", GESTOR, {
    cpf: NOVOS[0],
    nomeCompleto: "TESTE Sem Modulos",
    cargo: "Sem acesso",
    vinculos: [],
  });
  check("cadastro conclui sem módulos", semModulo.status === 201 && semModulo.dados?.success, JSON.stringify(semModulo.dados).slice(0, 120));
  check("resposta traz senha temporária", typeof semModulo.dados?.senhaTemporaria === "string" && semModulo.dados.senhaTemporaria.length >= 12);
  check("resposta não é cacheável", /no-store/.test(semModulo.cache || ""));
  check("totalModulos = 0", semModulo.dados?.totalModulos === 0);
  const zeroVinculos = (await db.query("SELECT count(*)::int c FROM user_acessos WHERE user_cpf=$1", [NOVOS[0]])).rows[0].c;
  check("zero vínculos no banco", zeroVinculos === 0);
  const contaNova = (await db.query("SELECT primeiro_acesso, ativo FROM users WHERE cpf=$1", [NOVOS[0]])).rows[0];
  check("conta ativa e com primeiro acesso pendente", contaNova?.ativo === true && contaNova?.primeiro_acesso === true);

  // ── 2. Cadastro com UM módulo ──────────────────────────────────────────
  console.log("\n2) Cadastro com um módulo");
  const umModulo = await req("POST", "/api/gerenciamento/usuarios", GESTOR, {
    cpf: NOVOS[1],
    nomeCompleto: "TESTE Um Modulo",
    cargo: "Operador",
    vinculos: [{ modulo: "REGULACAO", perfil: "OPERADOR", escopo: "TODOS", servicos: [], permissoes: [], removidas: [] }],
  });
  check("cadastro com 1 módulo", umModulo.status === 201 && umModulo.dados?.totalModulos === 1, JSON.stringify(umModulo.dados).slice(0, 140));
  const vinculo1 = (await db.query("SELECT modulo, perfil FROM user_acessos WHERE user_cpf=$1", [NOVOS[1]])).rows;
  check("vínculo gravado com o perfil escolhido", vinculo1.length === 1 && vinculo1[0].modulo === "REGULACAO" && vinculo1[0].perfil === "OPERADOR");

  // ── 3 e 4. Vários módulos, perfis diferentes ───────────────────────────
  console.log("\n3-4) Vários módulos com perfis diferentes");
  const varios = await req("POST", "/api/gerenciamento/usuarios", GESTOR, {
    cpf: NOVOS[2],
    nomeCompleto: "TESTE Varios Modulos",
    cargo: "Supervisora",
    vinculos: [
      { modulo: "REGULACAO", perfil: "SUPERVISOR", escopo: "TODOS", servicos: [], permissoes: [], removidas: [] },
      { modulo: "JUNTA", perfil: "OPERADOR", escopo: "TODOS", servicos: [], permissoes: [], removidas: [] },
      { modulo: "CCZ", perfil: "CONSULTA", escopo: "NENHUM", servicos: [], permissoes: [], removidas: [] },
    ],
  });
  check("cadastro com 3 módulos", varios.status === 201 && varios.dados?.totalModulos === 3, JSON.stringify(varios.dados).slice(0, 140));
  const perfis = (await db.query("SELECT modulo, perfil FROM user_acessos WHERE user_cpf=$1 ORDER BY modulo", [NOVOS[2]])).rows;
  const mapa = Object.fromEntries(perfis.map((p) => [p.modulo, p.perfil]));
  check("perfis diferentes por módulo", mapa.REGULACAO === "SUPERVISOR" && mapa.JUNTA === "OPERADOR" && mapa.CCZ === "CONSULTA", JSON.stringify(mapa));

  // ── 5. Configurar depois ───────────────────────────────────────────────
  console.log("\n5) Conclusão com 'Configurar depois'");
  const depois = await req("POST", "/api/gerenciamento/usuarios", GESTOR, {
    cpf: NOVOS[3],
    nomeCompleto: "TESTE Configurar Depois",
    cargo: null,
    // o botão "Configurar depois" simplesmente não envia vínculos
  });
  check("conclui sem enviar vínculos", depois.status === 201 && depois.dados?.success, JSON.stringify(depois.dados).slice(0, 120));
  check("conta criada sem acessos", (await db.query("SELECT count(*)::int c FROM user_acessos WHERE user_cpf=$1", [NOVOS[3]])).rows[0].c === 0);

  // ── 6. Senha temporária ────────────────────────────────────────────────
  console.log("\n6) Senha temporária");
  const senha = depois.dados?.senhaTemporaria || "";
  check("senha tem 14 caracteres", senha.length === 14, senha.length);
  check("senha sem caracteres ambíguos", !/[0Oo1lI]/.test(senha));
  const hash = (await db.query("SELECT senha_hash FROM users WHERE cpf=$1", [NOVOS[3]])).rows[0]?.senha_hash || "";
  check("banco guarda apenas o hash", hash.startsWith("$2") && !hash.includes(senha));
  const auditoriaSenha = (await db.query(
    "SELECT detalhes::text d FROM audit_logs WHERE entidade_id=$1 AND entidade='Usuario'",
    [NOVOS[3]],
  )).rows.map((r) => r.d).join(" ");
  check("auditoria não guarda a senha", !auditoriaSenha.includes(senha));

  // ── 7. Primeiro acesso de usuário sem vínculos ─────────────────────────
  console.log("\n7) Primeiro acesso sem vínculos");
  // O login é server action; aqui o que importa é o estado que ele entrega.
  const senhaOk = await bcrypt.compare(
    semModulo.dados.senhaTemporaria,
    (await db.query("SELECT senha_hash FROM users WHERE cpf=$1", [NOVOS[0]])).rows[0].senha_hash,
  );
  check("senha temporária confere com o hash gravado", senhaOk === true);
  const meNovo = await req("GET", "/api/me", NOVOS[0]);
  check("/api/me responde para conta sem vínculos", meNovo.status === 200, meNovo.status);
  check("primeiro acesso pendente no /api/me", meNovo.dados?.user?.primeiroAcesso === true);
  check("nenhum módulo efetivo", (meNovo.dados?.user?.modulos || []).length === 0, JSON.stringify(meNovo.dados?.user?.modulos));
  const inicio = await fetch(`${BASE}/`, {
    headers: { cookie: `session_token=${await tokenDe(NOVOS[0])}` },
    redirect: "manual",
  });
  const htmlInicio = await inicio.text();
  check("Início acessível para quem não tem módulos", [200, 307].includes(inicio.status), inicio.status);
  check("Início é servido para a conta sem módulos", htmlInicio.length > 0);

  // ── 8. Operações não autorizadas ───────────────────────────────────────
  console.log("\n8) Operações não autorizadas");
  const semPoder = await req("POST", "/api/gerenciamento/usuarios", OPERADOR, {
    cpf: NOVOS[4],
    nomeCompleto: "TESTE Proibido",
    vinculos: [],
  });
  check("quem não é Gestão Geral não cadastra (403)", semPoder.status === 403, semPoder.status);
  const semPoderAcessos = await req("PUT", `/api/gerenciamento/usuarios/${NOVOS[1]}/acessos`, OPERADOR, { vinculos: [] });
  check("quem não é Gestão Geral não grava acessos (403)", semPoderAcessos.status === 403, semPoderAcessos.status);
  const moduloInventado = await req("POST", "/api/gerenciamento/usuarios", GESTOR, {
    cpf: NOVOS[4],
    nomeCompleto: "TESTE Modulo Inventado",
    vinculos: [{ modulo: "INVENTADO", perfil: "OPERADOR", escopo: "TODOS", servicos: [], permissoes: [], removidas: [] }],
  });
  check("módulo fora do catálogo é recusado (400)", moduloInventado.status === 400, moduloInventado.status);
  const contaFantasma = (await db.query("SELECT cpf FROM users WHERE cpf=$1", [NOVOS[4]])).rows[0];
  check("conta NÃO foi criada quando o vínculo é inválido", !contaFantasma);
  const especificoSemServico = await req("POST", "/api/gerenciamento/usuarios", GESTOR, {
    cpf: NOVOS[4],
    nomeCompleto: "TESTE Escopo Vazio",
    vinculos: [{ modulo: "JUNTA", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos: [], permissoes: [], removidas: [] }],
  });
  check("escopo ESPECÍFICOS sem serviço é recusado (400)", especificoSemServico.status === 400, especificoSemServico.status);
  check("nenhuma conta órfã ficou no banco", !(await db.query("SELECT cpf FROM users WHERE cpf=$1", [NOVOS[4]])).rows[0]);

  // ── 10 e 11. Acessos abertos pelo botão da lista ───────────────────────
  console.log("\n10-11) Acessos do usuário selecionado");
  const lista = await req("GET", "/api/gerenciamento/usuarios", GESTOR);
  const naLista = (lista.dados?.data || []).find((u) => u.cpf === NOVOS[2]);
  check("lista traz os módulos do usuário", (naLista?.modulos || []).length === 3);
  const semAcessoNaLista = (lista.dados?.data || []).find((u) => u.cpf === NOVOS[0]);
  check("usuário sem vínculos aparece com 0 módulos", (semAcessoNaLista?.modulos || []).length === 0);
  const detalhe = await req("GET", `/api/gerenciamento/usuarios/${NOVOS[2]}/acessos`, GESTOR);
  check("GET de acessos responde 200", detalhe.status === 200, `${detalhe.status} ${JSON.stringify(detalhe.dados).slice(0, 200)}`);
  check("traz perfil, escopo e serviços", Boolean(detalhe.dados?.vinculos?.[0]?.perfil && detalhe.dados?.vinculos?.[0]?.escopo));
  check("traz efetivas e herdadas", Array.isArray(detalhe.dados?.vinculos?.[0]?.efetivas) && Array.isArray(detalhe.dados?.vinculos?.[0]?.herdadas));

  // ── 12 e 15. Edição preservando personalizações ────────────────────────
  console.log("\n12-15) Edição de vínculos e permissões personalizadas");
  const antes = detalhe.dados.vinculos.find((v) => v.modulo === "REGULACAO");
  const retirada = (antes?.herdadas || [])[0];
  const edicao = await req("PUT", `/api/gerenciamento/usuarios/${NOVOS[2]}/acessos`, GESTOR, {
    vinculos: detalhe.dados.vinculos.map((v) =>
      v.modulo === "REGULACAO"
        ? { modulo: v.modulo, perfil: "OPERADOR", escopo: v.escopo, servicos: v.servicos, permissoes: v.permissoes, removidas: v.removidas }
        : { modulo: v.modulo, perfil: v.perfil, escopo: v.escopo, servicos: v.servicos, permissoes: v.permissoes, removidas: v.removidas },
    ),
  });
  check("edição do perfil grava", edicao.status === 200, JSON.stringify(edicao.dados).slice(0, 120));
  const regDepois = (edicao.dados?.vinculos || []).find((v) => v.modulo === "REGULACAO");
  check("perfil alterado para OPERADOR", regDepois?.perfil === "OPERADOR", regDepois?.perfil);
  const comRetirada = await req("PUT", `/api/gerenciamento/usuarios/${NOVOS[2]}/acessos`, GESTOR, {
    vinculos: (edicao.dados?.vinculos || []).map((v) =>
      v.modulo === "REGULACAO"
        ? { modulo: v.modulo, perfil: v.perfil, escopo: v.escopo, servicos: v.servicos, permissoes: v.permissoes, removidas: [retirada] }
        : { modulo: v.modulo, perfil: v.perfil, escopo: v.escopo, servicos: v.servicos, permissoes: v.permissoes, removidas: v.removidas },
    ),
  });
  const comRet = (comRetirada.dados?.vinculos || []).find((v) => v.modulo === "REGULACAO");
  check("retirada gravada", (comRet?.removidas || []).includes(retirada), JSON.stringify(comRet?.removidas));
  check("retirada não está nas efetivas", !(comRet?.efetivas || []).includes(retirada));

  // ── 13. Inclusão posterior de módulos ──────────────────────────────────
  console.log("\n13) Inclusão posterior de módulos");
  const comMais = await req("PUT", `/api/gerenciamento/usuarios/${NOVOS[0]}/acessos`, GESTOR, {
    vinculos: [{ modulo: "PROCESSOS", perfil: "CONSULTA", escopo: "TODOS", servicos: [], permissoes: [], removidas: [] }],
  });
  check("inclui módulo em usuário que não tinha nenhum", comMais.status === 200 && (comMais.dados?.vinculos || []).length === 1, JSON.stringify(comMais.dados).slice(0, 120));

  // ── 14. Remoção de módulos ─────────────────────────────────────────────
  console.log("\n14) Remoção de módulos");
  const atuais = comMais.dados?.vinculos || [];
  const semProcessos = await req("PUT", `/api/gerenciamento/usuarios/${NOVOS[0]}/acessos`, GESTOR, { vinculos: [] });
  check("remover o último módulo devolve 0 vínculos", (semProcessos.dados?.vinculos || []).length === 0);
  const restou = (await db.query("SELECT count(*)::int c FROM user_acessos WHERE user_cpf=$1", [NOVOS[0]])).rows[0].c;
  check("nenhum vínculo ativo sobrou", restou === 0, `${restou} (antes: ${atuais.length})`);

  // ── 16. Reset de senha ─────────────────────────────────────────────────
  console.log("\n16) Reset de senha");
  const reset = await req("PUT", "/api/gerenciamento/usuarios/redefinir-senha", GESTOR, { cpf: NOVOS[1] });
  check("reset devolve nova senha temporária", reset.status === 200 && typeof reset.dados?.senhaTemporaria === "string");
  check("reset exige troca no próximo acesso", (await db.query("SELECT primeiro_acesso FROM users WHERE cpf=$1", [NOVOS[1]])).rows[0].primeiro_acesso === true);
  check("reset não altera vínculos", (await db.query("SELECT count(*)::int c FROM user_acessos WHERE user_cpf=$1", [NOVOS[1]])).rows[0].c === 1);

  // ── 17. Desativação e reativação ───────────────────────────────────────
  console.log("\n17) Desativação e reativação");
  const off = await req("PUT", "/api/gerenciamento/usuarios/desativar", GESTOR, { cpf: NOVOS[1] });
  check("desativa", off.status === 200 && (await db.query("SELECT ativo FROM users WHERE cpf=$1", [NOVOS[1]])).rows[0].ativo === false);
  const on = await req("PUT", "/api/gerenciamento/usuarios/reativar", GESTOR, { cpf: NOVOS[1] });
  check("reativa", on.status === 200 && (await db.query("SELECT ativo FROM users WHERE cpf=$1", [NOVOS[1]])).rows[0].ativo === true);
  const autoOff = await req("PUT", "/api/gerenciamento/usuarios/desativar", GESTOR, { cpf: GESTOR });
  check("não desativa a própria conta (409)", autoOff.status === 409, autoOff.status);

  // ── 18. Auditoria e regressões ─────────────────────────────────────────
  console.log("\n18) Auditoria e segurança");
  const criados = (await db.query(
    "SELECT count(*)::int c FROM audit_logs WHERE acao='CRIAR' AND entidade='Usuario' AND entidade_id = ANY($1)",
    [NOVOS.slice(0, 4)],
  )).rows[0].c;
  check("cada cadastro auditado", criados >= 4, criados);
  const vinculosAuditados = (await db.query(
    "SELECT count(*)::int c FROM audit_logs WHERE entidade='UserAcesso' AND entidade_id LIKE $1",
    [`${NOVOS[2]}:%`],
  )).rows[0].c;
  check("vínculos auditados", vinculosAuditados > 0, vinculosAuditados);
  const desativados = (await db.query(
    "SELECT count(*)::int c FROM audit_logs WHERE acao='DESATIVAR' AND entidade='UserAcesso' AND entidade_id LIKE $1",
    [`${NOVOS[0]}:%`],
  )).rows[0].c;
  check("remoção de vínculo auditada como DESATIVAR", desativados > 0, desativados);
  const semSessao = await fetch(`${BASE}/api/gerenciamento/usuarios`);
  check("lista sem sessão responde 401", semSessao.status === 401, semSessao.status);
  const paginaOperador = await fetch(`${BASE}/gerenciamento/usuarios`, {
    headers: { cookie: `session_token=${await tokenDe(OPERADOR)}` },
  });
  check("operador sem Gestão Geral não abre a tela", [403, 307].includes(paginaOperador.status), paginaOperador.status);

  // Limpeza das contas criadas pela suíte
  for (const cpf of NOVOS) {
    await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
    await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
  }
  for (const cpf of [GESTOR, OPERADOR]) {
    await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
    await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
    await db.query("DELETE FROM pessoa WHERE cpf=$1", [cpf]);
  }
  await db.end();

  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  if (falhou) {
    console.log("Falhas:", falhas.join(" | "));
    process.exitCode = 1;
  }
}

main().catch(async (e) => {
  console.error("Erro na suíte:", e.message);
  try {
    await db.end();
  } catch {}
  process.exitCode = 1;
});
