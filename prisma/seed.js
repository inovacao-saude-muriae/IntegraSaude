require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

if (!process.env.DATABASE_URL) {
  console.error("❌ ERRO: A variável DATABASE_URL não foi encontrada no arquivo .env");
  process.exit(1);
}

// 1. Criar o Pool de conexões do driver nativo pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// 2. Instanciar o Prisma Client passando o adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // Em produção, nunca usar credenciais padrão
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.GESTOR_USERNAME || !process.env.GESTOR_SENHA)
  ) {
    console.error(
      "❌ ERRO: Em produção (NODE_ENV=production) defina GESTOR_USERNAME e GESTOR_SENHA (e GESTOR_NOME) antes de executar o seed."
    );
    process.exit(1);
  }
  // Admin do Sistema (com username)
  const usernameAdmin = process.env.GESTOR_USERNAME || "admin_integra";
  const nomeAdmin = process.env.GESTOR_NOME || "Administrador IntegraSaúde";
  const senhaAdmin = process.env.GESTOR_SENHA || "Admin@123";

  if (!process.env.GESTOR_USERNAME || !process.env.GESTOR_SENHA) {
    console.warn("⚠️  ATENÇÃO: Usando credenciais padrão!");
    console.warn("   Configure GESTOR_USERNAME, GESTOR_NOME e GESTOR_SENHA no arquivo .env\n");
  }

  const senhaHashAdmin = await bcrypt.hash(senhaAdmin, 10);

  const adminUser = await prisma.user.upsert({
    where: { username: usernameAdmin },
    update: {
      nome: nomeAdmin,
      senhaHash: senhaHashAdmin,
      role: "GESTOR",
      cargo: "Administrador do Sistema",
      ativo: true,
      primeiroAcesso: false,
    },
    create: {
      cpf: "00000000000", // CPF placeholder para usuário de sistema
      username: usernameAdmin,
      nome: nomeAdmin,
      senhaHash: senhaHashAdmin,
      cargo: "Administrador do Sistema",
      role: "GESTOR",
      ativo: true,
      primeiroAcesso: false,
    },
  });

  console.log("✅ Admin do Sistema configurado com sucesso!");
  console.log(`👤 Nome: ${adminUser.nome}`);
  console.log(`🆔 Username/Login: ${adminUser.username}`);
  if (process.env.NODE_ENV !== "production") {
    console.log(`🔑 Senha: ${senhaAdmin}`);
  }
  console.log(`🎯 Permissão: ${adminUser.role} (Acesso Total)\n`);

  console.log("🎉 Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao executar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Fecha a pilha de conexões do driver pg
  });