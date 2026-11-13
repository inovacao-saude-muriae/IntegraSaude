/**
 * Testa a camada de ENTRADA (proxy.js): sessão + vínculo com o módulo da rota.
 *
 * Usa as mesmas fontes de verdade do sistema:
 *   lib/mapaRotasModulos  → rota → módulo
 *   user_acessos          → vínculos do usuário
 *
 * Cobre: sem sessão, módulo autorizado/negado, URL digitada, Gestão Geral sem
 * acesso operacional, revogação com sessão ativa, desativação de conta,
 * ausência de loop de redirecionamento e auditoria NEGAR sem duplicidade.
 *
 * Uso: node scripts/teste-proxy-modulos.mjs
 */
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function envLocal() {
  const env = {};
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = envLocal();
const db = new Client({ connectionString: env.DATABASE_URL });
const segredo = new TextEncoder().encode(env.JWT_SECRET);
let ok = 0;
let falhou = 0;

function check(nome, condicao, extra = "") {
  if (condicao) {
    ok += 1;
    console.log(`  OK   ${nome}`);
  } else {
    falhou += 1;
    console.log(`  FALHA ${nome} ${extra}`);
  }
}

async function sessao(cpf) {
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
  return token;
}

async function get(pathname, token) {
  const r = await fetch(BASE + pathname, {
    redirect: "manual",
    headers: token ? { cookie: `session_token=${token}` } : {},
  });
  return { status: r.status, location: r.headers.get("location"), corpo: await r.text() };
}

async function main() {
  await db.connect();

  const GESTOR = "00000000000";
  const JEFINNY = "12912453674"; // REGULACAO/SUPERVISOR

  console.log("\n1. Sem sessão");
  for (const rota of ["/regulacao", "/ccz", "/camara-tecnica/processos", "/gerenciamento/usuarios"]) {
    const r = await get(rota);
    check(
      `${rota} → 307 para /login com redirect`,
      r.status === 307 && (r.location || "").includes("/login") && (r.location || "").includes("redirect"),
      `${r.status} ${r.location}`,
    );
  }
  const apiAnon = await get("/api/me");
  check("/api/me sem sessão → 401 (API não é redirecionada)", apiAnon.status === 401, String(apiAnon.status));

  const jef = await sessao(JEFINNY);
  const gest = await sessao(GESTOR);

  console.log("\n2. Módulo autorizado");
  for (const rota of ["/regulacao", "/dashboard"]) {
    const r = await get(rota, jef);
    check(`${rota} (Regulação) → 200`, r.status === 200, String(r.status));
  }

  console.log("\n3. Módulo NÃO autorizado (URL digitada)");
  for (const rota of ["/ccz", "/junta-reguladora", "/camara-tecnica/processos", "/camara-tecnica/farmacia-judicial", "/gerenciamento/animais", "/gerenciamento/medicamentos", "/gerenciamento/servicos-especialidades"]) {
    const r = await get(rota, jef);
    check(`${rota} → 403 sem conteúdo`, r.status === 403 && !r.corpo.includes("Paciente"), `${r.status}`);
  }

  console.log("\n4. Gestão Geral é módulo próprio (sem acesso operacional automático)");
  const rAdmin = await get("/gerenciamento/usuarios", jef);
  check("/gerenciamento/usuarios sem vínculo GESTAO → 403", rAdmin.status === 403, String(rAdmin.status));
  const rGest = await get("/gerenciamento/usuarios", gest);
  check("/gerenciamento/usuarios com vínculo GESTAO → 200", rGest.status === 200, String(rGest.status));

  console.log("\n5. Sem loop de redirecionamento");
  const rNegado = await get("/acesso-negado?rota=/ccz", jef);
  check("/acesso-negado acessível ao usuário logado (200)", rNegado.status === 200, String(rNegado.status));

  console.log("\n6. Revogação de vínculo com sessão ativa");
  await db.query("UPDATE user_acessos SET ativo=false WHERE user_cpf=$1 AND modulo='REGULACAO'", [JEFINNY]);
  const rRevogado = await get("/regulacao", jef);
  check("/regulacao com vínculo desativado → 403 na requisição seguinte", rRevogado.status === 403, String(rRevogado.status));
  await db.query("UPDATE user_acessos SET ativo=true WHERE user_cpf=$1 AND modulo='REGULACAO'", [JEFINNY]);
  const rVolta = await get("/regulacao", jef);
  check("/regulacao com vínculo reativado → 200", rVolta.status === 200, String(rVolta.status));

  console.log("\n7. Desativação de usuário");
  await db.query("UPDATE users SET ativo=false WHERE cpf=$1", [JEFINNY]);
  const rInativo = await get("/regulacao", jef);
  check(
    "conta desativada → volta ao login e limpa cookie",
    rInativo.status === 307 && (rInativo.location || "").includes("session_expired"),
    `${rInativo.status} ${rInativo.location}`,
  );
  await db.query("UPDATE users SET ativo=true WHERE cpf=$1", [JEFINNY]);

  console.log("\n8. APIs e server actions seguem protegidas no backend");
  const apiJef = await get("/api/gerenciamento/usuarios", jef);
  check("/api/gerenciamento/usuarios sem GESTAO → 403", apiJef.status === 403, String(apiJef.status));

  console.log("\n9. Auditoria NEGAR: uma tentativa por acesso negado");
  const antes = await db.query(
    `SELECT COUNT(*)::int AS n FROM audit_logs
      WHERE user_cpf=$1 AND acao='NEGAR' AND created_at > now() - interval '10 seconds'`,
    [JEFINNY],
  );
  await get("/gerenciamento/usuarios", jef);
  const depois = await db.query(
    `SELECT COUNT(*)::int AS n FROM audit_logs
      WHERE user_cpf=$1 AND acao='NEGAR' AND created_at > now() - interval '10 seconds'`,
    [JEFINNY],
  );
  check(
    "bloqueio do proxy não duplica NEGAR (0 ou 1 registro)",
    depois.rows[0].n - antes.rows[0].n <= 1,
    `${antes.rows[0].n} → ${depois.rows[0].n}`,
  );

  await db.query("DELETE FROM user_sessions WHERE token = ANY($1)", [[jef, gest]]);
  await db.end();

  console.log(`\nRESULTADO: ${ok} passaram, ${falhou} falharam`);
  process.exit(falhou === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  try { await db.end(); } catch {}
  process.exit(1);
});
