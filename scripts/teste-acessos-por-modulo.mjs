// Teste ponta a ponta do gerenciamento de acessos por modulo.
// Uso: npm run start (em outro terminal) e depois `node scripts/teste-acessos-por-modulo.mjs`.
// Cria sessoes temporarias em user_sessions para o GESTOR e para um usuario comum.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
import fs from "node:fs";

const pick = (arquivo, k) => {
  const env = fs.readFileSync(arquivo, "utf8");
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
};
const url = pick(".env.local", "DATABASE_URL");
const secret = pick(".env.local", "JWT_SECRET");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const key = new TextEncoder().encode(secret);

async function sessao(cpf) {
  const token = await new SignJWT({ userId: cpf }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("2h").sign(key);
  const exp = new Date(Date.now() + 2 * 3600e3);
  await prisma.$executeRawUnsafe(
    `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, now())`, cpf, token, exp);
  return token;
}

const base = "http://localhost:3000";
const get = (p, t) => fetch(base + p, { headers: { cookie: `session_token=${t}` } });
let ok = 0, fail = 0;
const check = (nome, cond, extra = "") => {
  if (cond) { ok++; console.log(`  OK   ${nome}`); }
  else { fail++; console.log(`  FALHA ${nome} ${extra}`); }
};

const tGestor = await sessao("00000000000");
const tComum = await sessao("12912453674");

// 1. Catálogo
let r = await get("/api/gerenciamento/permissoes/catalogo", tGestor);
let cat = await r.json();
check("catálogo 200 para GESTOR", r.status === 200, r.status);
check("catálogo tem 6 módulos", (cat.modulos || []).length === 6, (cat.modulos||[]).length);
check("catálogo tem 5 perfis", (cat.perfis || []).length === 5, (cat.perfis||[]).length);
check("catálogo tem 3 escopos", (cat.escopos || []).length === 3, (cat.escopos||[]).length);

// 2. Catálogo negado para quem não é gestão geral
r = await get("/api/gerenciamento/permissoes/catalogo", tComum);
check("catálogo 403 para REGULACAO_SUPERVISOR", r.status === 403, r.status);

// 3. Lista de usuários
r = await get("/api/gerenciamento/usuarios", tGestor);
const lista = await r.json();
check("lista de usuários 200", r.status === 200, r.status);
check("lista traz os 2 usuários", (lista.data || []).length === 2, (lista.data||[]).length);
check("lista traz resumo por módulo", (lista.data?.[0]?.modulos || []).length > 0);
r = await get("/api/gerenciamento/usuarios", tComum);
check("lista 403 para quem não é GESTOR", r.status === 403, r.status);

// 4. Acessos de um usuário
r = await get("/api/gerenciamento/usuarios/12912453674/acessos", tGestor);
const det = await r.json();
check("acessos 200", r.status === 200, r.status);
check("vínculo traz perfil/escopo/servicos", !!det.vinculos?.[0]?.perfil && !!det.vinculos?.[0]?.escopo);
check("vínculo traz efetivas e herdadas", Array.isArray(det.vinculos?.[0]?.efetivas) && Array.isArray(det.vinculos?.[0]?.herdadas));

const put = (cpf, body, t) => fetch(`${base}/api/gerenciamento/usuarios/${cpf}/acessos`, {
  method: "PUT", headers: { "Content-Type": "application/json", cookie: `session_token=${t}` },
  body: JSON.stringify(body),
});

// 5. ESPECIFICOS sem serviço → 400
r = await put("12912453674", { vinculos: [{ modulo: "REGULACAO", perfil: "OPERADOR", escopo: "ESPECIFICOS", servicos: [], permissoes: [], removidas: [] }] }, tGestor);
check("ESPECIFICOS vazio recusado (400)", r.status === 400, r.status + " " + (await r.text()).slice(0, 120));

// 6. NENHUM com permissão operacional no pacote → 400
r = await put("12912453674", { vinculos: [{ modulo: "REGULACAO", perfil: "OPERADOR", escopo: "NENHUM", servicos: [], permissoes: [], removidas: [] }] }, tGestor);
check("NENHUM com permissão operacional recusado (400)", r.status === 400, r.status);
// 6b. NENHUM sem nenhuma permissão operacional → aceito
r = await put("12912453674", { vinculos: [{ modulo: "REGULACAO", perfil: "CONSULTA", escopo: "NENHUM", servicos: [], permissoes: [], removidas: [] }] }, tGestor);
check("NENHUM sem permissão operacional aceito (200)", r.status === 200, r.status);

// 7. Autoelevação: gestor tentando conceder o que não tem
r = await put("00000000000", { vinculos: [{ modulo: "REGULACAO", perfil: "ADMINISTRADOR", escopo: "TODOS", servicos: [], permissoes: ["funcionalidade_inventada:excluir"], removidas: [] }] }, tGestor);
check("permissão fora do catálogo recusada (400)", r.status === 400, r.status);

// 8. Salvar configuração válida e conferir estado relido
r = await put("12912453674", { vinculos: [{ modulo: "REGULACAO", perfil: "OPERADOR", escopo: "TODOS", servicos: [], permissoes: [], removidas: ["financeiro:editar"] }] }, tGestor);
const salvo = await r.json();
check("PUT válido 200", r.status === 200, r.status + " " + JSON.stringify(salvo).slice(0,150));
const v = (salvo.vinculos || [])[0];
check("perfil gravado OPERADOR", v?.perfil === "OPERADOR", v?.perfil);
check("retirada gravada", (v?.removidas || []).includes("financeiro:editar"));
check("efetivas não contém a retirada", !(v?.efetivas || []).includes("financeiro:editar"));
check("resposta traz estado relido do banco", Array.isArray(v?.efetivas));

// 9. Efeito imediato em /api/me
r = await get("/api/me", tComum);
const me = await r.json();
const listaMods = me.modulos || me.user?.modulos || [];
const modReg = listaMods.find((m) => m.modulo === "REGULACAO");
const permsMod = modReg?.permissoes || me.permissoes || [];
check("/api/me reflete o novo perfil", modReg?.perfis?.includes("OPERADOR"), JSON.stringify(modReg?.perfis));
check("/api/me não tem financeiro:editar", !permsMod.includes("financeiro:editar"), JSON.stringify(permsMod).slice(0, 80));

// 10. Restaurar estado original
r = await put("12912453674", { vinculos: [{ modulo: "REGULACAO", perfil: "SUPERVISOR", escopo: "TODOS", servicos: [], permissoes: [], removidas: [] }] }, tGestor);
check("restauração 200", r.status === 200, r.status);
r = await get("/api/me", tComum);
const me2 = await r.json();
const lista2 = me2.modulos || me2.user?.modulos || [];
const mod2 = lista2.find((m) => m.modulo === "REGULACAO") || lista2[0];
check("restaurado para SUPERVISOR", mod2?.perfis?.includes("SUPERVISOR"), JSON.stringify(mod2?.perfis));

// 11. Sem sessão
r = await fetch(base + "/api/gerenciamento/usuarios");
check("sem sessão 401", r.status === 401, r.status);

console.log(`\nRESULTADO: ${ok} passaram, ${fail} falharam`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
