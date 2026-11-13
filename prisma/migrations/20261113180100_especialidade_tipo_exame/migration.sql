-- ═══════════════════════════════════════════════════════════════════════════
-- ESPECIALIDADE → TIPO DE EXAME (vínculo usado pelo Processo Judicial)
-- ─────────────────────────────────────────────────────────────────────────
-- O processo judicial precisa garantir que o PROCEDIMENTO escolhido pertence
-- à ESPECIALIDADE escolhida. O vínculo entre os dois catálogos é o tipo de
-- exame (regula_procedimentos.tipo_exame_id).
--
-- A coluna nasce NULA e sem backfill: nenhuma especialidade existente é
-- alterada nem "adivinhada". Enquanto a gestão não classificar, o processo
-- pode ser gravado só com a especialidade (o procedimento é opcional).
--
-- Rollback: rollback.sql.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "junta_especialidades"
  ADD COLUMN IF NOT EXISTS "tipo_exame_id" INTEGER;

ALTER TABLE "junta_especialidades"
  ADD CONSTRAINT "fk_especialidade_tipo_exame"
  FOREIGN KEY ("tipo_exame_id") REFERENCES "regula_tipo_exame"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_especialidade_tipo_exame"
  ON "junta_especialidades" ("tipo_exame_id");
