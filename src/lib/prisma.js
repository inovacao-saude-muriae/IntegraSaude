import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { validateEnv } from "./env";

// Validar variáveis de ambiente na inicialização
validateEnv();

const globalForPrisma = globalThis;

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000, // 10 segundos para timeout de conexão
    idleTimeoutMillis: 30000, // 30 segundos de idle
    max: 20, // máximo de 20 conexões no pool
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    // Logs de query somente em desenvolvimento
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

// Singleton: pool e client são criados uma única vez (inclusive entre reloads em dev)
export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}