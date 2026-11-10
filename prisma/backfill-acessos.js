// Mesma ordem de carregamento de env do prisma.config.js: .env.local tem
// prioridade (dotenv não sobrescreve por padrão), com fallback para .env.
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("❌ ERRO: A variável DATABASE_URL não foi encontrada no arquivo .env");
  process.exit(1);
}

// 1. Criar o Pool de conexões do driver nativo pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// 2. Instanciar o Prisma Client passando o adapter
const prisma = new PrismaClient({ adapter });

/**
 * Função pura: converte um `role` legado (enum Role) na lista de vínculos
 * UserAcesso correspondentes (design.md §9.3). Não acessa o banco.
 *
 * Retorno: array de { modulo, nivel, servicoJunta|null }.
 *   - GESTOR -> [] (GESTOR deriva de User.role, não de UserAcesso).
 *   - Roles da Junta sem sub-serviço 1:1 (JUNTA_EDUCACAO/SAUDE/ASSISTENCIA)
 *     retornam {JUNTA, OPERADOR, servicoJunta:null} — INCERTO (§9.4), tratado
 *     com console.warn no backfill. NÃO inventamos correspondência.
 */
function mapearRoleParaAcessos(role) {
  switch (role) {
    // GESTOR: acesso total via role, nenhum vínculo em UserAcesso.
    case "GESTOR":
      return [];

    // REGULAÇÃO
    case "REGULACAO_ADMIN":
      return [{ modulo: "REGULACAO", nivel: "ADMIN", servicoJunta: null }];
    case "REGULACAO_COMUM":
      return [{ modulo: "REGULACAO", nivel: "OPERADOR", servicoJunta: null }];

    // CÂMARA TÉCNICA
    case "FARMACIA_ADMIN":
      return [{ modulo: "FARMACIA", nivel: "ADMIN", servicoJunta: null }];
    case "PROCESSO_ADMIN":
      return [{ modulo: "PROCESSOS", nivel: "ADMIN", servicoJunta: null }];

    // JUNTA REGULADORA
    case "JUNTA_ADMIN":
      return [{ modulo: "JUNTA", nivel: "ADMIN", servicoJunta: null }];
    case "JUNTA_CAEE":
      return [{ modulo: "JUNTA", nivel: "OPERADOR", servicoJunta: "CAEE" }];

    // Roles da Junta com mapeamento específico de sub-serviço:
    case "JUNTA_EDUCACAO":
      return [{ modulo: "JUNTA", nivel: "OPERADOR", servicoJunta: "APAE" }];
    case "JUNTA_SAUDE":
      return [{ modulo: "JUNTA", nivel: "OPERADOR", servicoJunta: "AMBULATORIO" }];
    case "JUNTA_ASSISTENCIA":
      return [{ modulo: "JUNTA", nivel: "OPERADOR", servicoJunta: "ESPECIALIDADES" }];

    // CCZ
    case "CCZ_ADMIN":
      return [{ modulo: "CCZ", nivel: "ADMIN", servicoJunta: null }];
    case "CCZ_COMUM":
      return [{ modulo: "CCZ", nivel: "OPERADOR", servicoJunta: null }];

    default:
      // Role desconhecido: não inventar vínculo (fail-closed).
      return [];
  }
}

// Roles da Junta cujo sub-serviço foi AJUSTADO (anteriormente incertos - §9.4).
const ROLES_JUNTA_INCERTOS = new Set([
  // Vazios - já foram mapeados corretamente
]);

async function main() {
  console.log("🔁 Iniciando backfill de UserAcesso a partir de User.role...\n");

  const usuarios = await prisma.user.findMany({
    select: { cpf: true, role: true, nome: true },
  });

  console.log(`👥 ${usuarios.length} usuário(s) encontrado(s).\n`);

  let totalCriados = 0;
  let totalIgnorados = 0;
  const incertos = [];

  for (const user of usuarios) {
    const vinculos = mapearRoleParaAcessos(user.role);
    if (vinculos.length === 0) continue;

    if (ROLES_JUNTA_INCERTOS.has(user.role)) {
      incertos.push({ cpf: user.cpf, nome: user.nome, role: user.role });
      console.warn(
        `⚠️  INCERTO: usuário ${user.cpf} (${user.nome}) com role ${user.role} ` +
          `recebeu {JUNTA, OPERADOR} SEM servicoJunta (ajuste manual pendente — §9.4).`
      );
    }

    // Separa vínculos com servicoJunta não-nulo (idempotentes via @@unique +
    // skipDuplicates) dos com servicoJunta null (check-then-insert explícito,
    // pois Postgres trata NULL como distinto no índice único — §9.5).
    const comServico = vinculos.filter((v) => v.servicoJunta !== null);
    const semServico = vinculos.filter((v) => v.servicoJunta === null);

    if (comServico.length > 0) {
      const res = await prisma.userAcesso.createMany({
        data: comServico.map((v) => ({
          userCpf: user.cpf,
          modulo: v.modulo,
          nivel: v.nivel,
          servicoJunta: v.servicoJunta,
        })),
        skipDuplicates: true,
      });
      totalCriados += res.count;
      totalIgnorados += comServico.length - res.count;
    }

    for (const v of semServico) {
      const jaExiste = await prisma.userAcesso.findFirst({
        where: {
          userCpf: user.cpf,
          modulo: v.modulo,
          nivel: v.nivel,
          servicoJunta: null,
        },
      });
      if (!jaExiste) {
        await prisma.userAcesso.create({
          data: {
            userCpf: user.cpf,
            modulo: v.modulo,
            nivel: v.nivel,
            servicoJunta: null,
          },
        });
        totalCriados += 1;
      } else {
        totalIgnorados += 1;
      }
    }
  }

  const totalFinal = await prisma.userAcesso.count();

  console.log("\n📊 Resumo do backfill:");
  console.log(`   ✅ Vínculos criados nesta execução: ${totalCriados}`);
  console.log(`   ⏭️  Vínculos já existentes (ignorados): ${totalIgnorados}`);
  console.log(`   📦 Total de vínculos em user_acessos: ${totalFinal}`);

  if (incertos.length > 0) {
    console.log(`\n⚠️  ${incertos.length} vínculo(s) INCERTO(S) (ajuste manual — §9.4):`);
    for (const i of incertos) {
      console.log(`   - ${i.cpf} (${i.nome}) [${i.role}]`);
    }
    // AJUSTE MANUAL (incerto — validar com o cliente antes de aplicar):
    //   JUNTA_EDUCACAO    -> CAEE?            (educação especial ~ CAEE)
    //   JUNTA_SAUDE       -> AMBULATORIO?     (saúde ~ ambulatório)
    //   JUNTA_ASSISTENCIA -> APAE?            (assistência ~ APAE)
    // Enquanto não validado, fica {JUNTA, OPERADOR} sem servicoJunta.
  }

  console.log("\n🎉 Backfill concluído com sucesso!");
}

// Remove credenciais de URLs de conexão antes de imprimir erros.
function logErroSeguro(err) {
  const msg = (err?.message || String(err)).replace(/postgresql:\/\/[^\s"')]+/gi, "postgresql://***");
  console.error("❌ Erro:", msg);
}

main()
  .catch((e) => { logErroSeguro(e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Fecha a pilha de conexões do driver pg
  });
