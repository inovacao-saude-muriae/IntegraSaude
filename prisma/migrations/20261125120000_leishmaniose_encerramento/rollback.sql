ALTER TABLE "ccz_leishmaniose"
  DROP COLUMN IF EXISTS "situacao_caso",
  DROP COLUMN IF EXISTS "desfecho",
  DROP COLUMN IF EXISTS "data_encerramento",
  DROP COLUMN IF EXISTS "justificativa_encerramento",
  DROP COLUMN IF EXISTS "encerrado_por_cpf",
  DROP COLUMN IF EXISTS "encerrado_por_nome",
  DROP COLUMN IF EXISTS "encerrado_em";
