BEGIN;
DROP INDEX IF EXISTS "idx_user_acesso_removidas";
ALTER TABLE "user_acessos" DROP COLUMN IF EXISTS "removidas";
COMMIT;
