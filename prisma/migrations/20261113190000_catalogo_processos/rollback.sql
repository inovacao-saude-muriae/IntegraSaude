-- Rollback: volta Processos a apontar para os catálogos antigos e remove o
-- catálogo próprio. Os nomes gravados nos processos são preservados.
ALTER TABLE "processos_judiciais" DROP CONSTRAINT IF EXISTS "fk_processo_especialidade";
ALTER TABLE "processos_judiciais" DROP CONSTRAINT IF EXISTS "fk_processo_procedimento";
DROP INDEX IF EXISTS "idx_processo_especialidade";
DROP INDEX IF EXISTS "idx_processo_procedimento";

UPDATE "processos_judiciais" SET "especialidade_id" = NULL, "procedimento_id" = NULL;

ALTER TABLE "processos_judiciais"
  ADD CONSTRAINT "fk_processo_especialidade"
  FOREIGN KEY ("especialidade_id") REFERENCES "junta_especialidades"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "processos_judiciais"
  ADD CONSTRAINT "fk_processo_procedimento"
  FOREIGN KEY ("procedimento_id") REFERENCES "regula_procedimentos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "processos_especialidade_procedimento";
DROP TABLE IF EXISTS "processos_procedimentos";
DROP TABLE IF EXISTS "processos_especialidades";

ALTER TABLE "junta_especialidades" ADD COLUMN IF NOT EXISTS "tipo_exame_id" INTEGER;
ALTER TABLE "junta_especialidades"
  ADD CONSTRAINT "fk_especialidade_tipo_exame"
  FOREIGN KEY ("tipo_exame_id") REFERENCES "regula_tipo_exame"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "idx_especialidade_tipo_exame"
  ON "junta_especialidades" ("tipo_exame_id");
