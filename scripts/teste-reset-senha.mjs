/**
 * Redefinição de senha (Gerenciamento de Usuários) — ponta a ponta pela API.
 * Sobe o servidor de build e roda contra ele. Contas fictícias 910000009xx.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
import fs from "node:fs";
import { Client } from "pg";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

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

const GESTOR = "91000000901";   // Gestão Geral, administrador (com resetar_senha)
const SEM_PERM = "91000000902"; // Gestão Geral, supervisor (sem resetar_senha)
const MODULO_ADM = "91000000903"; // Administrador de módulo CCZ (sem Gestão Geral)
const ALVO_REG = "91000000904";  // usuário só de Regulação
const ALVO_MULTI = "91000000905"; // usuário de vários módulos
const SENHA_ANTIGA = "Antig@12345";

async function limpar(cpf) {
  await db.query("DELETE FROM user_sessions WHERE user_id=$1", [cpf]);
  await db.query("DELETE FROM user_acessos WHERE user_cpf=$1", [cpf]);
  await db.query("DELETE FROM users WHERE cpf=$1", [cpf]);
}
async function criar(cpf, nome, acessos, ativo = true) {
  await limpar(cpf);
  const h = await bcrypt.hash(SENHA_ANTIGA, 10);
  await db.query(
    `INSERT INTO users (cpf,nome,senha_hash,ativo,primeiro_acesso,updated_at)
     VALUES ($1,$2,$3,$4,false,now())`,
    [cpf, nome, h, ativo],
  );
  for (const a of acessos) {
    await db.query(
      `INSERT INTO user_acessos (user_cpf,modulo,perfil,nivel,escopo,servicos,permissoes,removidas,ativo)
       VALUES ($1,$2,$3,$4,$5,'{}','{}','{}',true)`,
      [cpf, a.modulo, a.perfil, a.nivel || "ADMIN", a.escopo || "TODOS"],
    );
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

const resetar = (cpf, t) =>
  fetch(`${BASE}/api/gerenciamento/usuarios/redefinir-senha`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...cookie(t) },
    body: JSON.stringify({ cpf }),
  });
// O login do sistema é a server action `loginAction(formData)`, que não é
// chamável por HTTP simples. Aqui o mesmo caminho dela é reproduzido com as
// mesmas peças: bcrypt sobre `users.senha_hash`, `users.ativo` e a sessão
// gravada em `user_sessions` (o cookie é o próprio token).
const login = async (cpf, senha) => {
  const u = (await db.query(
    "SELECT senha_hash, ativo FROM users WHERE cpf=$1", [cpf])).rows[0];
  if (!u || !u.ativo) {
    return { ok: false, resultado: { error: "Usuário não encontrado ou inativo no sistema." } };
  }
  if (!(await bcrypt.compare(senha, u.senha_hash))) {
    return { ok: false, resultado: { error: "Senha incorreta. Tente novamente." } };
  }
  const tokenNovo = await token(cpf, "login");
  return { ok: true, resultado: { success: true }, token: tokenNovo };
};
const trocar = (t, senhaAtual, novaSenha) =>
  fetch(`${BASE}/api/auth/trocar-senha`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cookie(t) },
    body: JSON.stringify({ senhaAtual, novaSenha }),
  });

// ── preparo ────────────────────────────────────────────────────────────────
await criar(GESTOR, "TESTE Gestor Reset", [{ modulo: "GESTAO", perfil: "ADMINISTRADOR" }]);
await criar(SEM_PERM, "TESTE Supervisor Gestao", [{ modulo: "GESTAO", perfil: "SUPERVISOR" }]);
await criar(MODULO_ADM, "TESTE Admin CCZ", [{ modulo: "CCZ", perfil: "ADMINISTRADOR" }]);
await criar(ALVO_REG, "TESTE Alvo Regulacao", [{ modulo: "REGULACAO", perfil: "OPERADOR" }]);
await criar(ALVO_MULTI, "TESTE Alvo Multi", [
  { modulo: "REGULACAO", perfil: "OPERADOR" },
  { modulo: "FARMACIA", perfil: "OPERADOR" },
  { modulo: "GESTAO", perfil: "CONSULTA" },
]);

const tGestor = await token(GESTOR, "TESTE Gestor Reset");
const tSemPerm = await token(SEM_PERM, "TESTE Supervisor Gestao");
const tModuloAdm = await token(MODULO_ADM, "TESTE Admin CCZ");
const sessaoAntigaAlvo = await token(ALVO_REG, "TESTE Alvo Regulacao");
const tAlvoMulti = await token(ALVO_MULTI, "TESTE Alvo Multi");

// foto dos vínculos antes da operação (perfil, módulos, permissões, situação)
const vinculosAntes = (await db.query(
  "SELECT modulo,perfil,nivel,escopo,permissoes,removidas,ativo FROM user_acessos WHERE user_cpf=$1 ORDER BY modulo",
  [ALVO_MULTI])).rows;
const contaAntes = (await db.query("SELECT ativo FROM users WHERE cpf=$1", [ALVO_MULTI])).rows[0];

// ── 1. sem permissão ──────────────────────────────────────────────────────
console.log("\n1) Sem permissão");
let r = await resetar(ALVO_REG, tSemPerm);
check("supervisor da Gestão Geral recebe 403", r.status === 403, `(${r.status})`);
r = await resetar(ALVO_REG, tModuloAdm);
check("administrador de módulo (CCZ) recebe 403", r.status === 403, `(${r.status})`);
r = await fetch(`${BASE}/api/gerenciamento/usuarios/redefinir-senha`, {
  method: "PUT", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cpf: ALVO_REG }) });
check("sem sessão recebe 401/403", [401, 403].includes(r.status), `(${r.status})`);
check("senha do alvo continua a antiga",
  await bcrypt.compare(SENHA_ANTIGA, (await db.query("SELECT senha_hash FROM users WHERE cpf=$1", [ALVO_REG])).rows[0].senha_hash));

// ── 2. autorizado ─────────────────────────────────────────────────────────
console.log("\n2) Redefinição por administrador autorizado");
r = await resetar(ALVO_REG, tGestor);
const corpo = await r.json().catch(() => ({}));
check("200 com sucesso", r.status === 200 && corpo.success === true, `(${r.status})`);
check("devolve senha temporária", typeof corpo.senhaTemporaria === "string" && corpo.senhaTemporaria.length >= 12);
check("senha temporária atende a política",
  /[A-Z]/.test(corpo.senhaTemporaria) && /[a-z]/.test(corpo.senhaTemporaria) &&
  /[0-9]/.test(corpo.senhaTemporaria) && /[!@#$%&*]/.test(corpo.senhaTemporaria));
check("não é a senha padrão fixa", corpo.senhaTemporaria !== "Integr@123");

// ── 3. persistência do hash ───────────────────────────────────────────────
console.log("\n3) Persistência");
const hashDb = (await db.query("SELECT senha_hash, primeiro_acesso FROM users WHERE cpf=$1", [ALVO_REG])).rows[0];
check("hash gravado em bcrypt", /^\$2[aby]\$/.test(hashDb.senha_hash));
check("hash confere com a senha temporária", await bcrypt.compare(corpo.senhaTemporaria, hashDb.senha_hash));
check("primeiro_acesso marcado", hashDb.primeiro_acesso === true);
check("a senha antiga não confere mais", !(await bcrypt.compare(SENHA_ANTIGA, hashDb.senha_hash)));
check("nenhuma senha em texto no banco", !hashDb.senha_hash.includes(corpo.senhaTemporaria));

// ── 4. sessões anteriores ─────────────────────────────────────────────────
console.log("\n4) Sessões anteriores");
const sessoes = (await db.query("SELECT count(*)::int c FROM user_sessions WHERE user_id=$1", [ALVO_REG])).rows[0].c;
check("sessões do alvo revogadas", sessoes === 0, `(restam ${sessoes})`);
const meAntigo = await fetch(`${BASE}/api/me`, { headers: cookie(sessaoAntigaAlvo) });
check("cookie antigo não autentica mais", [401, 403].includes(meAntigo.status), `(${meAntigo.status})`);

// ── 5. login com a senha anterior / temporária ────────────────────────────
console.log("\n5) Login");
r = await login(ALVO_REG, SENHA_ANTIGA);
check("senha anterior é recusada", !r.ok, JSON.stringify(r.resultado));
r = await login(ALVO_REG, corpo.senhaTemporaria);
check("senha temporária autentica", r.ok && !!r.token, JSON.stringify(r.resultado));
const tokenTmp = r.token;

// ── 6. troca obrigatória antes de liberar os módulos ─────────────────────
console.log("\n6) Troca obrigatória");
r = await fetch(`${BASE}/api/me`, { headers: cookie(tokenTmp) });
const mePend = await r.json().catch(() => ({}));
check("login responde com pendência de troca",
  mePend?.user?.primeiroAcesso === true,
  JSON.stringify(mePend?.user?.primeiroAcesso));
const paginaModulo = await fetch(`${BASE}/regulacao`, { headers: cookie(tokenTmp), redirect: "manual" });
const loc = paginaModulo.headers.get("location") || "";
check("navegação para módulo é barrada (redirect/403)",
  paginaModulo.status === 307 || paginaModulo.status === 403 || loc.includes("trocar-senha"),
  `(${paginaModulo.status} ${loc})`);
const apiModulo = await fetch(`${BASE}/api/me`, { headers: cookie(tokenTmp) });
check("/api/me continua acessível (rota liberada)", [200, 403].includes(apiModulo.status));

// ── 7. nova senha ─────────────────────────────────────────────────────────
console.log("\n7) Nova senha");
const NOVA = "Nov@Senha2026";
// Sessões existentes antes da troca (todas devem cair, menos a da própria troca).
const sessoesAntesDaTroca = (await db.query(
  "SELECT count(*)::int c FROM user_sessions WHERE user_id=$1", [ALVO_REG])).rows[0].c;
check("existe sessão ativa antes da troca", sessoesAntesDaTroca >= 1, `(${sessoesAntesDaTroca})`);
r = await trocar(tokenTmp, corpo.senhaTemporaria, NOVA);
check("troca aceita", r.ok, `(${r.status})`);
// A troca devolve o NOVO token no cookie da própria resposta.
const setCookie = (r.headers.getSetCookie?.() || []).find((c) => c.startsWith("session_token="));
const tokenNovo = setCookie ? setCookie.split(";")[0].slice("session_token=".length) : tokenTmp;

// A troca revoga as OUTRAS sessões e mantém apenas a que fez a troca.
const sessoesDepois = (await db.query(
  "SELECT token FROM user_sessions WHERE user_id=$1", [ALVO_REG])).rows.map((x) => x.token);
check("sessões paralelas foram revogadas na troca",
  sessoesDepois.length === 1 && sessoesDepois[0] === tokenNovo,
  `(${sessoesDepois.length} sessão(ões))`);

r = await login(ALVO_REG, corpo.senhaTemporaria);
check("senha temporária deixa de funcionar", !r.ok, JSON.stringify(r.resultado));
r = await login(ALVO_REG, NOVA);
check("nova senha autentica", r.ok && !!r.token, JSON.stringify(r.resultado));
const tokenFinal = r.token;
const pendDepois = (await db.query("SELECT primeiro_acesso FROM users WHERE cpf=$1", [ALVO_REG])).rows[0].primeiro_acesso;
check("primeiro_acesso zerado após a troca", pendDepois === false);

// ── 8. permissões preservadas (usuário multi-módulo) ─────────────────────
console.log("\n8) Preservação de acessos");
r = await resetar(ALVO_MULTI, tGestor);
const corpoMulti = await r.json().catch(() => ({}));
check("reset do usuário multi-módulo", r.ok && corpoMulti.success === true, `(${r.status})`);
const vinculosDepois = (await db.query(
  "SELECT modulo,perfil,nivel,escopo,permissoes,removidas,ativo FROM user_acessos WHERE user_cpf=$1 ORDER BY modulo",
  [ALVO_MULTI])).rows;
check("vínculos idênticos (módulos, perfis, escopos, permissões)",
  JSON.stringify(vinculosAntes) === JSON.stringify(vinculosDepois));
const contaDepois = (await db.query("SELECT ativo FROM users WHERE cpf=$1", [ALVO_MULTI])).rows[0];
check("situação cadastral preservada", contaAntes.ativo === contaDepois.ativo);
const meMulti = await fetch(`${BASE}/api/me`, { headers: cookie(tAlvoMulti) });
check("sessão antiga do multi-módulo invalidada", [401, 403].includes(meMulti.status), `(${meMulti.status})`);
r = await login(ALVO_MULTI, corpoMulti.senhaTemporaria);
check("login com a temporária do multi-módulo", r.ok && !!r.token, JSON.stringify(r.resultado));

// ── 9. senhas distintas ───────────────────────────────────────────────────
console.log("\n9) Aleatoriedade");
const outra = await (await resetar(ALVO_MULTI, tGestor)).json();
check("cada redefinição gera senha diferente",
  outra.senhaTemporaria !== corpoMulti.senhaTemporaria);

// ── 10. recusas de negócio ────────────────────────────────────────────────
console.log("\n10) Recusas");
r = await resetar(GESTOR, tGestor);
check("não redefine a própria senha pela administração", r.status === 409, `(${r.status})`);
r = await resetar("99999999999", tGestor);
check("CPF inexistente recebe 404", r.status === 404, `(${r.status})`);
r = await resetar("", tGestor);
check("CPF vazio recebe 400", r.status === 400, `(${r.status})`);

// ── 11. auditoria ─────────────────────────────────────────────────────────
console.log("\n11) Auditoria");
const log = (await db.query(
  `SELECT user_cpf, acao, modulo, entidade, entidade_id, descricao, detalhes
     FROM audit_logs
    WHERE entidade='Senha' AND entidade_id=$1
      AND modulo='GESTAO' AND detalhes->>'operacao'='redefinir_senha'
    ORDER BY id DESC LIMIT 1`,
  [ALVO_REG])).rows[0];
check("registro de auditoria criado", !!log);
check("identifica o administrador", log?.user_cpf === GESTOR);
check("identifica o usuário afetado", log?.entidade_id === ALVO_REG);
check("registra a operação e o resultado",
  log?.detalhes?.operacao === "redefinir_senha" && log?.detalhes?.resultado === "sucesso");
check("registra as sessões revogadas", typeof log?.detalhes?.sessoesRevogadas === "number");
const todoLog = JSON.stringify(log || {});
check("nenhuma senha/hash na auditoria",
  !todoLog.includes(corpo.senhaTemporaria) && !todoLog.includes(hashDb.senha_hash) && !todoLog.includes(SENHA_ANTIGA));

// ── limpeza ───────────────────────────────────────────────────────────────
for (const cpf of [GESTOR, SEM_PERM, MODULO_ADM, ALVO_REG, ALVO_MULTI]) await limpar(cpf);
await db.end();

console.log(`\n${ok} verificações OK, ${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
