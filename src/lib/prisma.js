import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { validateEnv } from "./env";

// Validar variáveis de ambiente na inicialização
validateEnv();

const globalForPrisma = globalThis;

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 10000, // 10 segundos para timeout de conexão
  idleTimeoutMillis: 30000, // 30 segundos de idle
  max: 20, // máximo de 20 conexões no pool
});
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
