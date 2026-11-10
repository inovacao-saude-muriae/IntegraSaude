/**
 * Remove um usuário do banco de dados.
 *
 * Uso:
 *   node prisma/delete-user.js <CPF>
 *
 * Exemplo:
 *   node prisma/delete-user.js 12345678900
 *
 * ATENÇÃO:
 *   - Este script usa DELETE físico. Prefira desativar o usuário pela interface,
 *     que preserva o histórico de auditoria.
 *   - O script se recusa a apagar o último Gestor ativo para não bloquear o acesso
 *     ao sistema. Promova outro Gestor antes de remover este.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const readline = require("readline");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Argumento ────────────────────────────────────────────────────────────────
const [, , cpfArg] = process.argv;

if (!cpfArg) {
  console.error("Uso: node prisma/delete-user.js <CPF>");
  console.error("Exemplo: node prisma/delete-user.js 12345678900");
  process.exit(1);
}

const cpf = cpfArg.replace(/\D/g, "");

if (cpf.length !== 11) {
  console.error(`CPF inválido: "${cpfArg}" (deve ter 11 dígitos numéricos)`);
  process.exit(1);
}

// ─── Confirmação interativa ───────────────────────────────────────────────────
function confirmar(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pergunta, (resposta) => {
      rl.close();
      resolve(resposta.trim().toLowerCase());
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const usuario = await prisma.user.findUnique({ where: { cpf } });

  if (!usuario) {
    console.error(`❌ Usuário com CPF ${cpf} não encontrado.`);

    const usuarios = await prisma.user.findMany({
      select: { cpf: true, nome: true, role: true, ativo: true },
    });
    console.error("\n📋 Usuários cadastrados:");
    usuarios.forEach((u) =>
      console.error(`   - ${u.cpf}: ${u.nome} (${u.role}, ativo: ${u.ativo})`)
    );
    process.exit(1);
  }

  console.log(`📋 Usuário encontrado:`);
  console.log(`   Nome:  ${usuario.nome}`);
  console.log(`   CPF:   ${cpf}`);
  console.log(`   Role:  ${usuario.role}`);
  console.log(`   Ativo: ${usuario.ativo ? "Sim" : "Não"}`);
  console.log("");

  // ── Guarda: não apagar o último Gestor ativo ──────────────────────────────
  if (usuario.role === "GESTOR" && usuario.ativo) {
    const gestoresAtivos = await prisma.user.count({
      where: { role: "GESTOR", ativo: true },
    });

    if (gestoresAtivos <= 1) {
      console.error(
        "❌ Operação recusada: este é o único usuário Gestor ativo.\n" +
        "   Promova ou crie outro Gestor antes de remover este,\n" +
        "   ou use a interface para desativá-lo em vez de excluí-lo."
      );
      process.exit(1);
    }
  }

  // ── Confirmação ───────────────────────────────────────────────────────────
  const resposta = await confirmar(
    `⚠️  Deseja remover permanentemente o usuário "${usuario.nome}" (${cpf})? (s/N) `
  );

  if (resposta !== "s" && resposta !== "sim") {
    console.log("Operação cancelada.");
    process.exit(0);
  }

  // ── Exclusão ─────────────────────────────────────────────────────────────
  const sessoes = await prisma.session.deleteMany({ where: { userId: cpf } });
  console.log(`   ✓ ${sessoes.count} sessão(ões) removida(s)`);

  const acessos = await prisma.userAcesso.deleteMany({ where: { userCpf: cpf } });
  console.log(`   ✓ ${acessos.count} vínculo(s) de acesso removido(s)`);

  await prisma.user.delete({ where: { cpf } });
  console.log(`   ✓ Usuário removido do banco\n`);

  console.log(`✅ Usuário ${cpf} excluído com sucesso.`);
  console.log("   Atenção: o histórico de auditoria ainda referencia este CPF.");
}

main()
  .catch((err) => {
    const msg = (err?.message || String(err)).replace(/postgresql:\/\/[^\s"')]+/gi, "postgresql://***");
    console.error("Erro inesperado:", msg);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
