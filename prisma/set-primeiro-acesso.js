require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const cpf = "12912453674"; // O CPF correto é 12912453674, não 12312453674
  const SENHA_PADRAO = "Integr@123";
  
  console.log(`🔄 Configurando usuário ${cpf} para primeiro acesso...\n`);

  // Verifica se o usuário existe
  const usuario = await prisma.user.findUnique({
    where: { cpf },
  });

  if (!usuario) {
    console.log(`❌ Usuário com CPF ${cpf} não encontrado.`);
    console.log(`\n📋 Usuários cadastrados:`);
    
    const usuarios = await prisma.user.findMany({
      select: { cpf: true, nome: true, role: true },
    });
    
    usuarios.forEach(u => {
      console.log(`   - ${u.cpf}: ${u.nome} (${u.role})`);
    });
    
    return;
  }

  // Reseta a senha para a padrão e marca como primeiro acesso
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  
  await prisma.user.update({
    where: { cpf },
    data: {
      senhaHash,
      primeiroAcesso: true,
    },
  });

  // Remove todas as sessões do usuário para forçar novo login
  await prisma.session.deleteMany({
    where: { userId: cpf },
  });

  console.log(`✅ Usuário atualizado com sucesso!`);
  console.log(`   Nome: ${usuario.nome}`);
  console.log(`   CPF: ${usuario.cpf}`);
  console.log(`   Senha resetada para: ${SENHA_PADRAO}`);
  console.log(`   Primeiro Acesso: SIM`);
  console.log(`   Sessões removidas: O usuário precisará fazer login novamente\n`);
  console.log(`🧪 Para testar:`);
  console.log(`   1. Faça login com CPF: ${cpf}`);
  console.log(`   2. Use senha: ${SENHA_PADRAO}`);
  console.log(`   3. O modal de troca de senha deve aparecer automaticamente\n`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
