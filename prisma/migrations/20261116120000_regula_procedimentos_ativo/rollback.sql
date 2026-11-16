-- Reversão da migração 20261116120000_regula_procedimentos_ativo.
DROP INDEX IF EXISTS "idx_regula_procedimentos_ativo";
ALTER TABLE "regula_procedimentos" DROP COLUMN IF EXISTS "ativo";
