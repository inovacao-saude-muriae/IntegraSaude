// Teste ponta a ponta das guardas de autorizacao (negativas).
// Uso: npm run start (em outro terminal) e depois `node scripts/teste-seguranca-acessos.mjs`.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
import fs from "node:fs";
const pick = (f, k) => (fs.readFileSync(f, "utf8").match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: pick(".env.local", "DATABASE_URL") }) });
const key = new TextEncoder().encode(pick(".env.local", "JWT_SECRET"));
async function sessao(cpf) {
  const token = await new SignJWT({ userId: cpf }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(key);
  await prisma.$executeRawUnsafe(`INSERT INTO user_sessions (id,user_id,token,expires_at,created_at) VALUES (gen_random_uuid(),$1,$2,$3,now())`, cpf, token, new Date(Date.now()+72e5));
  return token;
}
const base = "http://localhost:3000";
const get = (p, t) => fetch(base + p, { headers: { cookie: `session_token=${t}` } });
let ok = 0, fail = 0;
const check = (n, c, e = "") => { if (c) { ok++; console.log(`  OK   ${n}`); } else { fail++; console.log(`  FALHA ${n} ${e}`); } };
const tG = await sessao("00000000000");
const tC = await sessao("12912453674");
const put = (cpf, body, t) => fetch(`${base}/api/gerenciamento/usuarios/${cpf}/acessos`, { method: "PUT", headers: { "Content-Type": "application/json", cookie: `session_token=${t}` }, body: JSON.stringify(body) });

// 1. Não-GESTOR não grava acessos
let r = await put("12912453674", { vinculos: [] }, tC);
check("não-GESTOR não grava acessos (403)", r.status === 403, r.status);

// 2. Autoelevação: gestor não concede a si um módulo que não possui perfil acima do seu poder
r = await put("00000000000", { vinculos: [{ modulo: "REGULACAO", perfil: "ADMINISTRADOR", escopo: "TODOS", servicos: [], permissoes: ["financeiro:excluir"], removidas: [] }] }, tG);
check("autoelevação bloqueada (400)", r.status === 400, r.status + " " + (await r.text()).slice(0, 140));

// 3. Regulação: cancelar pedido exige motivo
const cancelar = await import("./src/app/regulacao/actions.js").catch(() => null);
// (a action tem server-only; testamos pela rota do navegador — pulamos a importação direta)

// 4. CCZ: arquivar denúncia sem permissão
r = await fetch(`${base}/api/ccz/denuncias/1`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: `session_token=${tC}` }, body: JSON.stringify({ motivo: "teste de permissao" }) });
check("CCZ arquivar negado a quem não tem CCZ (403)", r.status === 403, r.status);

// 5. CCZ: arquivar denúncia com motivo curto é recusado
r = await fetch(`${base}/api/ccz/denuncias/1`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: `session_token=${tG}` }, body: JSON.stringify({ motivo: "ab" }) });
check("CCZ motivo curto recusado (400)", r.status === 400, r.status);

// 6. CCZ: excluir animal exige permissão (gestor tem animais:excluir)
r = await fetch(`${base}/api/ccz/denuncias/1`, { method: "DELETE", headers: { cookie: `session_token=${tC}` } });
check("CCZ excluir denúncia negado sem permissão (403)", r.status === 403, r.status);

// 7. Token com assinatura inválida
const falso = await new SignJWT({ userId: "00000000000" }).setProtectedHeader({ alg: "HS256" })
  .setIssuedAt().setExpirationTime("2h").sign(new TextEncoder().encode("x".repeat(48)));
r = await get("/api/me", falso);
check("token com assinatura inválida 401", r.status === 401, r.status);

console.log(`\nRESULTADO: ${ok} passaram, ${fail} falharam`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
