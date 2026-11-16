/**
 * Senha inicial do CADASTRO de conta: gerador único, temporária individual,
 * só hash no banco, exibida uma vez e troca obrigatória no primeiro acesso.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { gerarSenhaTemporaria } from "../src/lib/senhaTemporaria.js";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z_]+)="?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
}
const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const segredo = new TextEncoder().encode(env.JWT_SECRET);

let ok = 0, falhas = 0;
const check = (nome, cond, extra = "") => {
  if (cond) { ok += 1; console.log(`  OK   ${nome}`); }
  else { falhas += 1; console.log(`  FALHA ${nome} ${extra}`); }
};

const GESTOR = "91000000901";
const SEM_CRIAR = "91000000902";
const MODULO_ADM = "91000000903";
const NOVO_A = "91000000906";
const NOVO_B = "91000000907";
const TODOS = [GESTOR, SEM_CRIAR, MODULO_ADM, NOVO_A, NOVO_B];

async function limpar(cpf) {
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
  await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
}
async function criar(cpf, nome, acessos) {
  await limpar(cpf);
  const h = await bcrypt.hash("Fixture@2026", 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,$2,$3,true,false,now())`, [cpf, nome, h]);
  for (const a of acessos) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,$3,'ADMIN','TODOS','{}','{}','{}',true)`, [cpf, a.modulo, a.perfil]);
  }
}
async function token(cpf, nome) {
  const t = await new SignJWT({ userId: cpf, nome })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(segredo);
  await db.query(
    `INSERT INTO user_sessions (id,user_id,token,expires_at,created_at)
     VALUES (gen_random_uuid(),$1,$2,now()+interval '1 hour',now())`, [cpf, t]);
  return t;
}
const cookie = (t) => ({ Cookie: `session_token=${t}` });
const criarConta = (corpo, t) =>
  fetch(`${BASE}/api/gerenciamento/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cookie(t) },
    body: JSON.stringify(corpo),
  });

// ── 1. gerador único ──────────────────────────────────────────────────────
console.log("\n1) Gerador de senha temporária");
const amostras = Array.from({ length: 300 }, () => gerarSenhaTemporaria());
check("14 caracteres", amostras.every((s) => s.length === 14));
check("atende a política em todas as amostras",
  amostras.every((s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s) && /[!@#$%&*]/.test(s)));
check("sem caracteres ambíguos (0 O o 1 l I)",
  amostras.every((s) => !/[0Oo1lI]/.test(s)));
check("todas diferentes entre si", new Set(amostras).size === amostras.length);
check("não é a antiga senha fixa", !amostras.includes("Integr@123"));

// ── preparo ───────────────────────────────────────────────────────────────
await criar(GESTOR, "TESTE Gestor Senha Inicial", [{ modulo: "GESTAO", perfil: "ADMINISTRADOR" }]);
await criar(SEM_CRIAR, "TESTE Supervisor Gestao", [{ modulo: "GESTAO", perfil: "SUPERVISOR" }]);
await criar(MODULO_ADM, "TESTE Admin CCZ", [{ modulo: "CCZ", perfil: "ADMINISTRADOR" }]);
const tGestor = await token(GESTOR, "TESTE Gestor Senha Inicial");
const tSem = await token(SEM_CRIAR, "TESTE Supervisor Gestao");
const tModulo = await token(MODULO_ADM, "TESTE Admin CCZ");

// ── 2. autorização ────────────────────────────────────────────────────────
console.log("\n2) Autorização");
let r = await criarConta({ cpf: NOVO_A, nomeCompleto: "TESTE Novo A" }, tSem);
check("supervisor (sem criar) recebe 403", r.status === 403, `(${r.status})`);
r = await criarConta({ cpf: NOVO_A, nomeCompleto: "TESTE Novo A" }, tModulo);
check("administrador de módulo recebe 403", r.status === 403, `(${r.status})`);
r = await fetch(`${BASE}/api/gerenciamento/usuarios`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cpf: NOVO_A, nomeCompleto: "TESTE Novo A" }) });
check("sem sessão recebe 401/403", [401, 403].includes(r.status), `(${r.status})`);
const existeA = (await db.query("SELECT 1 FROM users WHERE cpf=$1", [NOVO_A])).rowCount;
check("nenhuma conta foi criada nas recusas", existeA === 0);

// ── 3. cadastro ───────────────────────────────────────────────────────────
console.log("\n3) Cadastro com senha temporária");
r = await criarConta({ cpf: NOVO_A, nomeCompleto: "TESTE Novo A" }, tGestor);
const a = await r.json().catch(() => ({}));
check("201 criado", r.status === 201 && a.criado === true, `(${r.status})`);
check("devolve senha temporária", typeof a.senhaTemporaria === "string" && a.senhaTemporaria.length === 14);
check("senha atende a política",
  /[A-Z]/.test(a.senhaTemporaria) && /[a-z]/.test(a.senhaTemporaria) &&
  /[0-9]/.test(a.senhaTemporaria) && /[!@#$%&*]/.test(a.senhaTemporaria));
check("resposta não é cacheável", /no-store/.test(r.headers.get("cache-control") || ""),
  r.headers.get("cache-control"));

r = await criarConta({ cpf: NOVO_B, nomeCompleto: "TESTE Novo B" }, tGestor);
const b = await r.json().catch(() => ({}));
check("segunda conta criada", r.status === 201);
check("senhas diferentes para usuários distintos", a.senhaTemporaria !== b.senhaTemporaria);

// ── 4. persistência ───────────────────────────────────────────────────────
console.log("\n4) Persistência");
const linha = (await db.query(
  "SELECT senha_hash, primeiro_acesso FROM users WHERE cpf=$1", [NOVO_A])).rows[0];
check("hash bcrypt gravado", /^\$2[aby]\$/.test(linha.senha_hash));
check("hash confere com a senha devolvida", await bcrypt.compare(a.senhaTemporaria, linha.senha_hash));
check("primeiro_acesso marcado", linha.primeiro_acesso === true);
check("senha não está em texto no banco", !linha.senha_hash.includes(a.senhaTemporaria));

// ── 5. auditoria ──────────────────────────────────────────────────────────
console.log("\n5) Auditoria");
const log = (await db.query(
  `SELECT user_cpf, acao, entidade, entidade_id, detalhes FROM audit_logs
    WHERE entidade='Usuario' AND entidade_id=$1 ORDER BY id DESC LIMIT 1`, [NOVO_A])).rows[0];
check("criação registrada", !!log && log.acao === "CRIAR");
check("administrador identificado", log?.user_cpf === GESTOR);
const logTxt = JSON.stringify(log || {});
check("nenhuma senha/hash na auditoria",
  !logTxt.includes(a.senhaTemporaria) && !logTxt.includes(linha.senha_hash));

// ── 6. login e primeiro acesso ────────────────────────────────────────────
console.log("\n6) Login e troca obrigatória");
const login = async (cpf, senha) => {
  const u = (await db.query("SELECT senha_hash, ativo FROM users WHERE cpf=$1", [cpf])).rows[0];
  if (!u || !u.ativo) return { ok: false };
  if (!(await bcrypt.compare(senha, u.senha_hash))) return { ok: false };
  return { ok: true, token: await token(cpf, "login") };
};
r = await login(NOVO_A, a.senhaTemporaria);
check("login com a senha temporária", r.ok && !!r.token);
const me = await (await fetch(`${BASE}/api/me`, { headers: cookie(r.token) })).json();
check("/api/me informa pendência de troca", me?.user?.primeiroAcesso === true);
const mod = await fetch(`${BASE}/regulacao`, { headers: cookie(r.token), redirect: "manual" });
const loc = mod.headers.get("location") || "";
check("módulo bloqueado antes da troca",
  [307, 403].includes(mod.status) || loc.includes("trocar-senha"), `(${mod.status} ${loc})`);

const troca = await fetch(`${BASE}/api/auth/trocar-senha`, {
  method: "POST", headers: { "Content-Type": "application/json", ...cookie(r.token) },
  body: JSON.stringify({ senhaAtual: a.senhaTemporaria, novaSenha: "Nov@Senha2026" }) });
check("troca aceita", troca.ok, `(${troca.status})`);
check("senha temporária deixa de funcionar", !(await login(NOVO_A, a.senhaTemporaria)).ok);
const depois = await login(NOVO_A, "Nov@Senha2026");
check("nova senha autentica", depois.ok);
const me2 = await (await fetch(`${BASE}/api/me`, { headers: cookie(depois.token) })).json();
check("pendência zerada", me2?.user?.primeiroAcesso === false);

// ── 7. permissões preservadas / reset continua funcionando ───────────────
console.log("\n7) Vínculos e reset existente");
await db.query(
  `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
   VALUES ($1,'REGULACAO','OPERADOR','ADMIN','TODOS','{}','{}','{}',true)`, [NOVO_A]);
const vinculos = (await db.query(
  "SELECT modulo,perfil,escopo FROM user_acessos WHERE user_cpf=$1 ORDER BY modulo", [NOVO_A])).rows;
check("vínculo do usuário criado íntegro", vinculos.length === 1 && vinculos[0].modulo === "REGULACAO");
r = await fetch(`${BASE}/api/gerenciamento/usuarios/redefinir-senha`, {
  method: "PUT", headers: { "Content-Type": "application/json", ...cookie(tGestor) },
  body: JSON.stringify({ cpf: NOVO_A }) });
const reset = await r.json().catch(() => ({}));
check("resetar senha continua funcionando", r.ok && reset.success === true, `(${r.status})`);
check("reset também não é cacheável", /no-store/.test(r.headers.get("cache-control") || ""));
const vinculosDepois = (await db.query(
  "SELECT modulo,perfil,escopo FROM user_acessos WHERE user_cpf=$1 ORDER BY modulo", [NOVO_A])).rows;
check("reset não altera vínculos", JSON.stringify(vinculos) === JSON.stringify(vinculosDepois));

for (const cpf of TODOS) await limpar(cpf);
await db.end();
console.log(`\n${ok} verificações OK, ${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
