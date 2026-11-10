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

// CPF (PK de users) do gestor inicial: mantido o placeholder histórico do seed.
const CPF_GESTOR_INICIAL = "00000000000";

// Gestor inicial (bootstrap): só é criado quando NÃO existe nenhum GESTOR ativo.
// Nunca sobrescreve usuários existentes; execução manual (npx prisma db seed).
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

  // Já existe pelo menos um gestor ativo: não cria, não altera senha, não sobrescreve nada.
  const gestoresAtivos = await prisma.user.count({
    where: { role: "GESTOR", ativo: true },
  });
  if (gestoresAtivos > 0) {
    console.log(
      `ℹ️  Já existe ${gestoresAtivos} usuário(s) Gestor ativo(s). Nenhum usuário foi criado ou alterado.`
    );
    return;
  }

  const usernameAdmin = process.env.GESTOR_USERNAME || "admin_integra";
  const nomeAdmin = process.env.GESTOR_NOME || "Administrador do Sistema";
  const senhaAdmin = process.env.GESTOR_SENHA || "Admin@123";

  if (!process.env.GESTOR_USERNAME || !process.env.GESTOR_SENHA) {
    console.warn("⚠️  ATENÇÃO: Usando credenciais padrão!");
    console.warn("   Configure GESTOR_USERNAME, GESTOR_NOME e GESTOR_SENHA no arquivo .env\n");
  }

  // Colisão por username ou CPF com um usuário existente (que não é gestor ativo).
  const existentes = await prisma.user.findMany({
    where: { OR: [{ username: usernameAdmin }, { cpf: CPF_GESTOR_INICIAL }] },
    select: { cpf: true, username: true, role: true, ativo: true },
  });

  // Recuperação: só reaproveita se for inequivocamente o gestor inicial (mesmo CPF E mesmo username).
  // Qualquer outra colisão aborta para ação manual, sem alterar dados.
  const mesmoUsuario =
    existentes.length === 1 &&
    existentes[0].cpf === CPF_GESTOR_INICIAL &&
    existentes[0].username === usernameAdmin;
  if (existentes.length > 0 && !mesmoUsuario) {
    console.error(
      "❌ ERRO: Não há Gestor ativo, mas já existe outro usuário com o mesmo username ou CPF do gestor inicial. " +
        "Nada foi alterado. Escolha outro GESTOR_USERNAME ou resolva manualmente (prisma/README.md)."
    );
    process.exit(1);
  }

  const senhaHashAdmin = await bcrypt.hash(senhaAdmin, 10);
  const dadosGestor = {
    nome: nomeAdmin,
    senhaHash: senhaHashAdmin,
    cargo: "Administrador do Sistema",
    role: "GESTOR",
    ativo: true,
    primeiroAcesso: true, // senha trocada obrigatoriamente no primeiro login
  };

  const adminUser = mesmoUsuario
    ? await prisma.user.update({ where: { cpf: CPF_GESTOR_INICIAL }, data: dadosGestor })
    : await prisma.user.create({
        data: { cpf: CPF_GESTOR_INICIAL, username: usernameAdmin, ...dadosGestor },
      });

  console.log(
    mesmoUsuario
      ? "✅ Gestor inicial existente reativado/promovido (recuperação)."
      : "✅ Gestor inicial criado com sucesso!"
  );
  console.log(`👤 Nome: ${adminUser.nome}`);
  console.log(`🆔 Username/Login: ${adminUser.username}`);
  if (process.env.NODE_ENV !== "production") {
    console.log(`🔑 Senha: ${senhaAdmin}`);
  }
  console.log("🔐 A senha deve ser trocada no primeiro acesso.");
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