require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const cpf = "12912453674";
  
  console.log(`🗑️  Excluindo usuário com CPF ${cpf}...\n`);

  // Verifica se o usuário existe
  const usuario = await prisma.user.findUnique({
    where: { cpf },
  });

  if (!usuario) {
    console.log(`❌ Usuário com CPF ${cpf} não encontrado.`);
    return;
  }

  console.log(`📋 Usuário encontrado:`);
  console.log(`   Nome: ${usuario.nome}`);
  console.log(`   Role: ${usuario.role}`);
  console.log(`   Cargo: ${usuario.cargo}`);
  console.log('');

  // Deleta sessões (cascata automática, mas fazendo manualmente para mostrar)
  const sessoes = await prisma.session.deleteMany({
    where: { userId: cpf },
  });
  console.log(`   ✓ ${sessoes.count} sessão(ões) removida(s)`);

  // Deleta vínculos de acesso
  const acessos = await prisma.userAcesso.deleteMany({
    where: { userCpf: cpf },
  });
  console.log(`   ✓ ${acessos.count} vínculo(s) removido(s)`);

  // Deleta o usuário
  await prisma.user.delete({
    where: { cpf },
  });
  console.log(`   ✓ Usuário removido do banco\n`);

  console.log(`✅ Usuário ${cpf} excluído com sucesso!\n`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
