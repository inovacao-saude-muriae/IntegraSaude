/**
 * Reset de senha de emergência para um usuário.
 *
 * Uso:
 *   node prisma/set-primeiro-acesso.js <CPF> <NOVA_SENHA>
 *
 * Exemplo:
 *   node prisma/set-primeiro-acesso.js 12345678900 MinhaSenha@2026
 *
 * O usuário será obrigado a trocar a senha no próximo login.
 * Nunca rode este script em produção sem substituir a senha logo em seguida.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// ─── Argumentos ──────────────────────────────────────────────────────────────
const [, , cpfArg, senhaArg] = process.argv;

if (!cpfArg || !senhaArg) {
  console.error("Uso: node prisma/set-primeiro-acesso.js <CPF> <NOVA_SENHA>");
  console.error("Exemplo: node prisma/set-primeiro-acesso.js 12345678900 MinhaSenha@2026");
  process.exit(1);
}

const cpf = cpfArg.replace(/\D/g, ""); // aceita CPF com ou sem máscara

if (cpf.length !== 11) {
  console.error(`CPF inválido: "${cpfArg}" (deve ter 11 dígitos numéricos)`);
  process.exit(1);
}

if (senhaArg.length < 8) {
  console.error("A senha deve ter pelo menos 8 caracteres.");
  process.exit(1);
}

// ─── Conexão ─────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔄 Resetando senha do usuário ${cpf}...\n`);

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

  const senhaHash = await bcrypt.hash(senhaArg, 10);

  await prisma.user.update({
    where: { cpf },
    data: { senhaHash, primeiroAcesso: true },
  });

  await prisma.session.deleteMany({ where: { userId: cpf } });

  // Nunca imprime a senha — só confirma que o reset aconteceu.
  console.log(`✅ Senha resetada com sucesso.`);
  console.log(`   Nome:            ${usuario.nome}`);
  console.log(`   CPF:             ${cpf}`);
  console.log(`   Primeiro acesso: SIM (troca de senha obrigatória no próximo login)`);
  console.log(`   Sessões:         encerradas`);
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
