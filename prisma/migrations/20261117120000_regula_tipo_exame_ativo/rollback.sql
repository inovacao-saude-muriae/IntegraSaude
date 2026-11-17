-- Desfaz a situação do Tipo de Exame. Procedimentos e vínculos não são tocados.
DROP INDEX IF EXISTS "idx_regula_tipo_exame_ativo";
ALTER TABLE "regula_tipo_exame" DROP COLUMN IF EXISTS "ativo";
