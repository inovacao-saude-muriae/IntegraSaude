require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { jwtVerify } = require("jose");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Verificando sessões ativas...\n");

  const sessions = await prisma.session.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });

  if (sessions.length === 0) {
    console.log("❌ Nenhuma sessão ativa encontrada.\n");
    return;
  }

  for (const session of sessions) {
    console.log(`📌 Sessão de: ${session.user.nome}`);
    console.log(`   CPF: ${session.user.cpf}`);
    console.log(`   Expira em: ${session.expiresAt}`);
    
    // Decodifica o JWT para ver o payload
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(session.token, secret);
      
      console.log(`   JWT Payload:`);
      console.log(`      - userId: ${payload.userId}`);
      console.log(`      - role: ${payload.role}`);
      console.log(`      - primeiroAcesso: ${payload.primeiroAcesso !== undefined ? payload.primeiroAcesso : '❌ NÃO EXISTE NO JWT'}`);
    } catch (err) {
      console.log(`   ⚠️ Erro ao decodificar JWT: ${err.message}`);
    }
    
    console.log('');
  }

  console.log(`\n💡 Se o JWT não tem 'primeiroAcesso', você precisa fazer logout e login novamente!`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
