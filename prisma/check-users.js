require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("👥 Usuários cadastrados:\n");
  
  const users = await prisma.user.findMany({
    include: { acessos: true },
    orderBy: { createdAt: 'desc' }
  });

  for (const user of users) {
    console.log(`📌 ${user.nome}`);
    console.log(`   CPF: ${user.cpf}`);
    console.log(`   Username: ${user.username || '(não tem)'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Ativo: ${user.ativo ? 'Sim' : 'Não'}`);
    console.log(`   Primeiro Acesso: ${user.primeiroAcesso ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Vínculos (UserAcesso): ${user.acessos.length}`);
    user.acessos.forEach(a => {
      console.log(`      → ${a.modulo} / ${a.nivel}${a.servicoJunta ? ` / ${a.servicoJunta}` : ''}`);
    });
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
