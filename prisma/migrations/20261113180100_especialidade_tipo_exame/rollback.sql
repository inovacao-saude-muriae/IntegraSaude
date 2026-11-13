-- Rollback: remove só o vínculo especialidade → tipo de exame.
ALTER TABLE "junta_especialidades" DROP CONSTRAINT IF EXISTS "fk_especialidade_tipo_exame";
DROP INDEX IF EXISTS "idx_especialidade_tipo_exame";
ALTER TABLE "junta_especialidades" DROP COLUMN IF EXISTS "tipo_exame_id";
