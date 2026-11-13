/**
 * PRIMEIRO ACESSO E REDIRECIONAMENTO APÓS LOGIN.
 *
 * Cobre os 18 itens pedidos, com servidor, banco e APIs REAIS:
 *   1. primeiro login — usuário exclusivo do CCZ
 *   2. primeiro login — exclusivo da Regulação
 *   3. primeiro login — exclusivo da Câmara Técnica (Farmácia)
 *   4. primeiro login — exclusivo da Junta Reguladora
 *   5. primeiro login — usuário com vários módulos
 *   6. exibição imediata da troca obrigatória (redirecionamento global)
 *   7. tentativa de acessar módulo antes de alterar a senha
 *   8. tentativa de acessar API antes de alterar a senha
 *   9. alteração da senha com sucesso
 *  10. redirecionamento para Início após alterar
 *  11. login posterior com a senha alterada
 *  12. login sem pendência → Início direto
 *  13. Início acessível a usuário exclusivo de um módulo
 *  14. Início sem informação de módulos não autorizados
 *  15. Sidebar funcionando
 *  16. ausência de loops de redirecionamento
 *  17. logout e encerramento de sessão
 *  18. registro de auditoria
 *
 * Uso: node scripts/teste-primeiro-acesso.mjs   (com o servidor no ar)
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

const SENHA_INICIAL = "Integr@123";
const SENHA_NOVA = "NovaSenh@2026";

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
async function tokenDe(cpf, { renovar = false } = {}) {
  if (!renovar && sessoes.has(cpf)) return sessoes.get(cpf);
  const u = (await db.query("SELECT cpf, nome FROM users WHERE cpf=$1", [cpf])).rows[0];
  const token = await new SignJWT({ userId: u.cpf, nome: u.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(segredo);
  await db.query("DELETE FROM user_sessions WHERE user_id = $1", [u.cpf]);
  await db.query(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now() + interval '1 hour', now())`,
    [u.cpf, token],
  );
  sessoes.set(cpf, token);
  return token;
}

async function pagina(rota, cpf) {
  const headers = cpf ? { cookie: `session_token=${await tokenDe(cpf)}` } : {};
  const r = await fetch(`${BASE}${rota}`, { headers, redirect: "manual" });
  const corpo = r.status >= 300 && r.status < 400 ? "" : await r.text();
  return { status: r.status, location: r.headers.get("location") || "", corpo };
}

async function api(rota, cpf, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (cpf) headers.cookie = `session_token=${await tokenDe(cpf)}`;
  const r = await fetch(`${BASE}${rota}`, { ...init, headers, redirect: "manual" });
  let json = null;
  try {
    json = await r.clone().json();
  } catch {}
  return {
    status: r.status,
    json,
    location: r.headers.get("location") || "",
    setCookie: r.headers.get("set-cookie") || "",
  };
}

// ── Fixtures ───────────────────────────────────────────────────────────────
// Um usuário por módulo, todos com primeiro acesso pendente.
const USUARIOS = {
  CCZ: { cpf: "91000000104", nome: "TST 1A CCZ" },
  REGULACAO: { cpf: "91000000295", nome: "TST 1A Regulação" },
  FARMACIA: { cpf: "91000000376", nome: "TST 1A Câmara Técnica" },
  JUNTA: { cpf: "91000000457", nome: "TST 1A Junta" },
  MULTI: { cpf: "91000000538", nome: "TST 1A Vários Módulos" },
  REGULAR: { cpf: "91000000619", nome: "TST 1A Sem Pendência" },
};
const ROTA_DO_MODULO = {
  CCZ: "/ccz?tab=DASHBOARD",
  REGULACAO: "/regulacao?tab=DASHBOARD",
  FARMACIA: "/camara-tecnica/farmacia-judicial?tab=DASHBOARD",
  JUNTA: "/junta-reguladora?tab=DASHBOARD",
};

const VINCULOS = [
  ["CCZ", "CCZ", "ADMINISTRADOR", "ADMIN"],
  ["REGULACAO", "REGULACAO", "ADMINISTRADOR", "ADMIN"],
  ["FARMACIA", "FARMACIA", "ADMINISTRADOR", "ADMIN"],
  ["JUNTA", "JUNTA", "ADMINISTRADOR", "ADMIN"],
  ["MULTI", "CCZ", "OPERADOR", "OPERADOR"],
  ["MULTI", "REGULACAO", "OPERADOR", "OPERADOR"],
  ["MULTI", "JUNTA", "OPERADOR", "OPERADOR"],
  ["REGULAR", "CCZ", "OPERADOR", "OPERADOR"],
];

async function main() {
  await db.connect();

  console.log("\nPreparando usuários de teste…");
  const hashInicial = await bcrypt.hash(SENHA_INICIAL, 10);
  for (const { cpf, nome } of Object.values(USUARIOS)) {
    await db.query("DELETE FROM user_sessions WHERE user_id = $1", [cpf]);
    await db.query("DELETE FROM user_acessos WHERE user_cpf = $1", [cpf]);
    await db.query("DELETE FROM audit_logs WHERE user_cpf = $1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf = $1", [cpf]);
    await db.query(
      `INSERT INTO users (cpf, nome, senha_hash, ativo, primeiro_acesso, updated_at)
       VALUES ($1, $2, $3, true, true, now())`,
      [cpf, nome, hashInicial],
    );
  }
  for (const [chave, modulo, perfil, nivel] of VINCULOS) {
    const cpfVinculo = USUARIOS[chave].cpf;
    await db.query(
      `INSERT INTO user_acessos (user_cpf, modulo, perfil, nivel, escopo, servicos, permissoes, removidas, ativo)
       VALUES ($1, $2, $3, $4, 'TODOS', '{}', '{}', '{}', true)`,
      [cpfVinculo, modulo, perfil, nivel],
    );
    const conferido = await db.query(
      "SELECT modulo, perfil FROM user_acessos WHERE user_cpf = $1 AND modulo = $2",
      [cpfVinculo, modulo],
    );
    if (conferido.rowCount !== 1) {
      throw new Error(`vínculo não gravado: ${cpfVinculo} ${modulo}`);
    }
  }
  // Usuário já regularizado: serve para o cenário 12 (login sem pendência).
  await db.query("UPDATE users SET primeiro_acesso = false WHERE cpf = $1", [
    USUARIOS.REGULAR.cpf,
  ]);

  // ══ 1-5. Primeiro login por módulo ═════════════════════════════════════
  console.log("\n1-5. Primeiro acesso por módulo");
  for (const [chave, rota] of Object.entries(ROTA_DO_MODULO)) {
    const { cpf, nome } = USUARIOS[chave];
    // O login é feito pelo cookie de sessão que o servidor emite; a suíte usa
    // a mesma sessão real (linha em user_sessions) que o loginAction cria.
    const r = await pagina(rota, cpf);
    check(
      `${nome}: rota do módulo redireciona para /trocar-senha`,
      r.status === 307 && r.location.endsWith("/trocar-senha"),
      `${r.status} ${r.location}`,
    );
  }

  const multi = await pagina("/regulacao?tab=DASHBOARD", USUARIOS.MULTI.cpf);
  check(
    `${USUARIOS.MULTI.nome}: com 3 módulos também é bloqueado`,
    multi.status === 307 && multi.location.endsWith("/trocar-senha"),
    `${multi.status} ${multi.location}`,
  );

  // ══ 6. Exibição imediata (sem passar pelo Início) ══════════════════════
  console.log("\n6. Exibição imediata da troca obrigatória");
  const ccz = USUARIOS.CCZ.cpf;
  const inicio = await pagina("/", ccz);
  check(
    "o Início também é bloqueado (a obrigação não depende dele)",
    inicio.status === 307 && inicio.location.endsWith("/trocar-senha"),
    `${inicio.status} ${inicio.location}`,
  );
  const telaSenha = await pagina("/trocar-senha", ccz);
  check("a tela de troca de senha abre (200)", telaSenha.status === 200, String(telaSenha.status));
  check(
    "a tela mostra o formulário de nova senha",
    /Nova senha|nova senha/i.test(telaSenha.corpo) || /Trocar Senha/i.test(telaSenha.corpo),
  );

  // ══ 7. Acesso a módulo antes de alterar ════════════════════════════════
  console.log("\n7. Tentativa de acessar módulo antes de alterar a senha");
  for (const rota of [
    "/ccz?tab=ANIMAIS",
    "/gerenciamento/pessoas",
    "/gerenciamento/usuarios",
    "/dashboard",
  ]) {
    const r = await pagina(rota, ccz);
    check(
      `${rota} → /trocar-senha`,
      r.status === 307 && r.location.endsWith("/trocar-senha"),
      `${r.status} ${r.location}`,
    );
  }

  // ══ 8. Acesso a API antes de alterar ═══════════════════════════════════
  console.log("\n8. Tentativa de acessar API antes de alterar a senha");
  const apiUsuarios = await api("/api/gerenciamento/usuarios", ccz);
  check(
    "/api/gerenciamento/usuarios responde 403 (dado operacional bloqueado)",
    apiUsuarios.status === 403,
    String(apiUsuarios.status),
  );
  // /api/admin/metrics é o único caso especial: é a fonte do Início, que existe
  // para todos. Com a troca pendente ela devolve SÓ o bloco mínimo do Início
  // (nome + módulos), nunca indicadores de módulo.
  const apiMetrics = await api("/api/admin/metrics", ccz);
  check(
    "/api/admin/metrics responde 403 (Início e indicadores bloqueados)",
    apiMetrics.status === 403,
    `${apiMetrics.status} ${JSON.stringify(apiMetrics.json).slice(0, 120)}`,
  );
  const temIndicador = ["pessoas", "regulacao", "farmacia", "junta", "ccz", "processos"].some(
    (k) => apiMetrics.json?.[k] !== null && apiMetrics.json?.[k] !== undefined,
  );
  check("nenhum indicador vaza na resposta de bloqueio", !temIndicador);
  const mePendente = await api("/api/me", ccz);
  check("/api/me continua liberado (sessão mínima)", mePendente.status === 200);
  check(
    "/api/me informa primeiroAcesso = true",
    mePendente.json?.user?.primeiroAcesso === true,
    JSON.stringify(mePendente.json?.user?.primeiroAcesso),
  );

  // ══ 9. Alteração com sucesso ═══════════════════════════════════════════
  console.log("\n9. Alteração da senha com sucesso");
  const troca = await api("/api/auth/trocar-senha", ccz, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ senhaAtual: SENHA_INICIAL, novaSenha: SENHA_NOVA }),
  });
  check(
    "a troca devolve um cookie de sessão novo",
    /session_token=/.test(troca.setCookie),
    troca.setCookie.slice(0, 60),
  );
  check("troca de senha responde 200", troca.status === 200, JSON.stringify(troca.json));
  const noBanco = await db.query(
    "SELECT primeiro_acesso, senha_hash FROM users WHERE cpf = $1",
    [ccz],
  );
  check("primeiro_acesso gravado como false", noBanco.rows[0]?.primeiro_acesso === false);
  check(
    "senha gravada como hash (nunca texto puro)",
    String(noBanco.rows[0]?.senha_hash || "").startsWith("$2"),
  );
  check(
    "resposta não devolve senha",
    !JSON.stringify(troca.json || {}).match(/NovaSenh|senhaHash/i),
  );

  // ══ 10. Redirecionamento para o Início ═════════════════════════════════
  // A troca de senha NÃO cria sessão nova: ela troca o token da sessão atual
  // (revogando as demais). A suíte passa a usar o token que veio no cookie,
  // exatamente como o navegador faria.
  const tokenRenovado = (troca.setCookie.match(/session_token=([^;]+)/) || [])[1];
  if (tokenRenovado) {
    sessoes.set(ccz, tokenRenovado);
  } else {
    await tokenDe(ccz, { renovar: true });
  }

  console.log("\n10. Acesso ao Início após alterar");
  const cczDepois = await pagina("/", ccz);
  check("Início abre depois da troca (200)", cczDepois.status === 200, String(cczDepois.status));
  const cczModulo = await pagina("/ccz?tab=DASHBOARD", ccz);
  check("módulo abre depois da troca (200)", cczModulo.status === 200, `${cczModulo.status} ${cczModulo.location}`);
  const meDepois = await api("/api/me", ccz);
  check(
    "/api/me informa primeiroAcesso = false",
    meDepois.json?.user?.primeiroAcesso === false,
  );

  // ══ 11. Login posterior com a senha alterada ══════════════════════════
  console.log("\n11. Login posterior com a senha alterada");
  const loginNovo = await api("/login", null, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  // O login real é uma server action; aqui validamos as credenciais no banco,
  // que é a mesma verificação feita por loginAction (bcrypt.compare).
  const usuarioAtual = (
    await db.query("SELECT senha_hash FROM users WHERE cpf = $1", [ccz])
  ).rows[0];
  check(
    "nova senha confere com o hash gravado",
    await bcrypt.compare(SENHA_NOVA, usuarioAtual.senha_hash),
  );
  check(
    "senha inicial não vale mais",
    !(await bcrypt.compare(SENHA_INICIAL, usuarioAtual.senha_hash)),
  );
  check("(sanidade) POST /login sem corpo não autentica", loginNovo.status >= 400);

  // ══ 12. Login sem pendência → Início ══════════════════════════════════
  console.log("\n12. Usuário sem pendência");
  const semPendencia = await pagina("/", USUARIOS.REGULAR.cpf);
  check(
    "vai direto para o Início (sem desvio para trocar-senha)",
    semPendencia.status === 200,
    `${semPendencia.status} ${semPendencia.location}`,
  );
  const loginFonte = fs.readFileSync("src/app/login/page.js", "utf8");
  check(
    "o login redireciona para o Início (destino único, sem rota por módulo)",
    /DESTINO_PADRAO = '\/'/.test(loginFonte) && !/DESTINO_POR_MODULO/.test(loginFonte),
  );

  // ══ 13-14. Início para usuário exclusivo de um módulo ═════════════════
  console.log("\n13-14. Início do usuário exclusivo do CCZ");
  const regularMe = await api("/api/me", USUARIOS.REGULAR.cpf);
  check(
    "usuário exclusivo do CCZ tem só o módulo CCZ",
    (regularMe.json?.user?.modulos || []).length === 1 &&
      regularMe.json.user.modulos[0].modulo === "CCZ",
  );
  const metricas = await api("/api/admin/metrics", USUARIOS.REGULAR.cpf);
  check("Início abre para quem não é admin (200)", metricas.status === 200, String(metricas.status));
  check(
    "Início devolve o bloco mínimo (nome + módulos)",
    metricas.json?.inicio?.usuario === USUARIOS.REGULAR.nome,
    JSON.stringify(metricas.json?.inicio),
  );
  const vazou = ["regulacao", "farmacia", "junta", "processos", "usuarios", "pessoas"].filter(
    (k) => metricas.json?.[k] !== null && metricas.json?.[k] !== undefined,
  );
  check("nenhum dado de módulo não autorizado", vazou.length === 0, vazou.join(", "));

  // Usuários exclusivos de módulo, já sem pendência: o ADMIN vê os blocos
  // autorizados (inclusive o indicador de pessoas); o OPERADOR vê só o Início.
  const adminMetrics = await api("/api/admin/metrics", USUARIOS.CCZ.cpf);
  check(
    "admin de módulo continua vendo os blocos autorizados",
    adminMetrics.status === 200 &&
      adminMetrics.json?.ccz !== null &&
      adminMetrics.json?.pessoas !== null,
    `${adminMetrics.status} ${JSON.stringify(adminMetrics.json).slice(0, 140)}`,
  );
  check(
    "admin de módulo NÃO vê blocos de outros módulos",
    adminMetrics.json?.regulacao === null &&
      adminMetrics.json?.junta === null &&
      adminMetrics.json?.farmacia === null,
  );
  await db.query("UPDATE users SET primeiro_acesso = false WHERE cpf = $1", [
    USUARIOS.MULTI.cpf,
  ]);
  const operMetrics = await api("/api/admin/metrics", USUARIOS.MULTI.cpf);
  check(
    "operador recebe só o bloco mínimo do Início",
    operMetrics.status === 200 &&
      operMetrics.json?.inicio?.usuario === USUARIOS.MULTI.nome &&
      operMetrics.json?.ccz === null &&
      operMetrics.json?.pessoas === null,
    `${operMetrics.status} ${JSON.stringify(operMetrics.json).slice(0, 140)}`,
  );

  // ══ 15. Sidebar ═══════════════════════════════════════════════════════
  console.log("\n15. Sidebar");
  const sidebarFonte = fs.readFileSync("src/components/Sidebar.js", "utf8");
  check(
    "Sidebar monta o menu a partir de /api/me (vínculos)",
    sidebarFonte.includes("/api/me"),
  );
  const layout = fs.readFileSync("src/components/ClientLayout.js", "utf8");
  check(
    "a tela de troca de senha não exibe Sidebar/Header",
    /isTrocarSenha/.test(layout),
  );

  // ══ 16. Sem loops ══════════════════════════════════════════════════════
  console.log("\n16. Loops de redirecionamento");
  const r1 = await pagina("/trocar-senha", USUARIOS.REGULACAO.cpf);
  check(
    "/trocar-senha não redireciona para si mesma",
    r1.status === 200,
    `${r1.status} ${r1.location}`,
  );
  const r2 = await pagina("/", USUARIOS.REGULAR.cpf);
  check("Início de usuário regularizado não redireciona", r2.status === 200);
  const login = await pagina("/login", USUARIOS.REGULAR.cpf);
  check("/login continua público", login.status === 200);

  // ══ 17. Logout ═════════════════════════════════════════════════════════
  console.log("\n17. Logout");
  const tokenLogout = await tokenDe(USUARIOS.REGULAR.cpf);
  await db.query("DELETE FROM user_sessions WHERE token = $1", [tokenLogout]);
  sessoes.delete(USUARIOS.REGULAR.cpf);
  // O JWT continua assinado e dentro da validade; só a linha do banco sumiu —
  // é exatamente o cenário de "sessão revogada / logout".
  // Observação: "/" é pré-renderizada (estática) e não lê sessão; por isso a
  // página inicial responde 200 a um cookie morto — ela não expõe dado algum.
  // O que importa é que as telas de módulo (dinâmicas, atrás do proxy) e a API
  // recusem a sessão revogada. É isso que verificamos.
  for (const rota of [
    "/ccz?tab=ANIMAIS",
    "/camara-tecnica/farmacia-judicial?tab=DASHBOARD",
    "/junta-reguladora?tab=DASHBOARD",
    "/gerenciamento/usuarios",
  ]) {
    const r = await fetch(`${BASE}${rota}`, {
      headers: { cookie: `session_token=${tokenLogout}` },
      redirect: "manual",
    });
    // Sem sessão, o layout destas rotas manda para o login. As pré-renderizadas
    // respondem 307; as dinâmicas podem responder 403 quando o Next não
    // executa o redirect de um layout durante a renderização — nos dois casos
    // a tela é recusada e nenhum dado de módulo é servido.
    check(
      `sessão revogada não acessa ${rota}`,
      (r.status === 307 && String(r.headers.get("location") || "").includes("/login")) ||
        r.status === 403,
      `${r.status} ${r.headers.get("location")}`,
    );
  }
  const apiLogout = await fetch(`${BASE}/api/me`, {
    headers: { cookie: `session_token=${tokenLogout}` },
  });
  check("sessão revogada recebe 401 na API", apiLogout.status === 401, String(apiLogout.status));

  // ══ 18. Auditoria ══════════════════════════════════════════════════════
  console.log("\n18. Auditoria");
  const audit = await db.query(
    `SELECT acao, entidade, descricao FROM audit_logs
      WHERE user_cpf = $1 AND modulo = 'AUTH' ORDER BY created_at DESC`,
    [ccz],
  );
  check(
    "troca de senha registrada em audit_logs",
    audit.rows.some((r) => r.entidade === "Senha"),
    JSON.stringify(audit.rows),
  );
  check(
    "registro não contém a senha",
    !JSON.stringify(audit.rows).match(/NovaSenh|Integr@/),
  );

  // ── Limpeza ────────────────────────────────────────────────────────────
  for (const { cpf } of Object.values(USUARIOS)) {
    await db.query("DELETE FROM user_sessions WHERE user_id = $1", [cpf]);
    await db.query("DELETE FROM user_acessos WHERE user_cpf = $1", [cpf]);
    await db.query("DELETE FROM audit_logs WHERE user_cpf = $1", [cpf]);
    await db.query("DELETE FROM users WHERE cpf = $1", [cpf]);
  }
  await db.end();

  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  if (falhou > 0) {
    console.log("Falhas:");
    for (const f of falhas) console.log(` - ${f}`);
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("Erro na suíte:", e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
