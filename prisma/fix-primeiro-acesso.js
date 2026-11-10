require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔧 Corrigindo campo primeiroAcesso...\n");

  // Todos os usuários não-GESTOR que ainda não mudaram a senha padrão
  // devem ter primeiroAcesso = true
  const result = await prisma.user.updateMany({
    where: {
      role: { not: "GESTOR" },
      primeiroAcesso: false, // ou null
    },
    data: {
      primeiroAcesso: true,
    },
  });

  console.log(`✅ ${result.count} usuário(s) atualizado(s) para primeiroAcesso = true\n`);

  // Lista todos os usuários
  const users = await prisma.user.findMany({
    select: {
      cpf: true,
      nome: true,
      role: true,
      primeiroAcesso: true,
    },
  });

  console.log("📋 Status atual de todos os usuários:\n");
  for (const user of users) {
    console.log(`   ${user.nome}`);
    console.log(`   CPF: ${user.cpf}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Primeiro Acesso: ${user.primeiroAcesso ? 'SIM (precisa trocar senha)' : 'NÃO (já trocou)'}`);
    console.log('');
  }
}

// Remove credenciais de URLs de conexão antes de imprimir erros.
function logErroSeguro(err) {
  const msg = (err?.message || String(err)).replace(/postgresql:\/\/[^\s"')]+/gi, "postgresql://***");
  console.error("❌ Erro:", msg);
}

main()
  .catch((err) => { logErroSeguro(err); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
