-- ═══════════════════════════════════════════════════════════════════════════
-- Acesso por módulo: perfil, permissões, serviços e ativo
-- ─────────────────────────────────────────────────────────────────────────
-- Migração ADITIVA. Não há DROP, não há DELETE, não há alteração de dado
-- existente. O sistema antigo continua funcionando: as colunas que ele lê
-- (`modulo`, `nivel`, `servico_junta`) permanecem intactas e continuam sendo
-- escritas pela aplicação.
--
-- O que esta migração faz:
--   1. cria o enum PerfilModulo;
--   2. acrescenta 6 colunas em user_acessos, todas com default;
--   3. cria um índice para a leitura por (usuário, módulo).
--
-- O preenchimento dos valores por usuário NÃO acontece aqui: é feito por
-- `scripts/backfill-acessos.js`, separado e idempotente, para que possa ser
-- revisado e rodado em transação com relatório do que mudou.
--
-- Reversão: prisma/migrations/20261112120000_acesso_por_modulo/rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Enum de perfis por módulo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PerfilModulo') THEN
    CREATE TYPE "PerfilModulo" AS ENUM (
      'ADMINISTRADOR',
      'SUPERVISOR',
      'OPERADOR',
      'CONSULTA',
      'AUDITOR'
    );
  END IF;
END
$$;

-- 2. Colunas novas (todas com default; nenhuma NOT NULL sem valor)
ALTER TABLE "user_acessos"
  ADD COLUMN IF NOT EXISTS "perfil" "PerfilModulo" NOT NULL DEFAULT 'ADMINISTRADOR';

ALTER TABLE "user_acessos"
  ADD COLUMN IF NOT EXISTS "servicos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "user_acessos"
  ADD COLUMN IF NOT EXISTS "permissoes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "user_acessos"
  ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "user_acessos"
  ADD COLUMN IF NOT EXISTS "atualizado_por" VARCHAR(11);

ALTER TABLE "user_acessos"
  ADD COLUMN IF NOT EXISTS "atualizado_em" TIMESTAMPTZ(6);

-- 3. Índice para a leitura por usuário + módulo (a autorização passa a
--    consultar a permissão dentro do módulo).
CREATE INDEX IF NOT EXISTS "idx_user_acesso_cpf_modulo"
  ON "user_acessos" ("user_cpf", "modulo");
