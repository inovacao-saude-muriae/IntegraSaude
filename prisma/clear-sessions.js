require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 Limpando todas as sessões...\n");

  const result = await prisma.session.deleteMany({});

  console.log(`✅ ${result.count} sessão(ões) removida(s)\n`);
  console.log("ℹ️  Todos os usuários precisarão fazer login novamente.");
  console.log("   Isso garante que o novo sistema de primeiro acesso funcione corretamente.\n");
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
