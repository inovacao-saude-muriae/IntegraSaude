-- Situação da denúncia (Ativa/Inativa): justificativa obrigatória ao inativar,
-- preservada como histórico da última inativação após a reativação.
ALTER TABLE "ccz_denuncias"
  ADD COLUMN IF NOT EXISTS "justificativa_inativacao" VARCHAR(500);
