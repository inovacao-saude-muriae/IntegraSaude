-- Encerramento do acompanhamento da Leishmaniose.
-- Reutiliza a estrutura existente: a fiscalização (ccz_leishmaniose) passa a
-- carregar a situação do caso e, quando encerrada, o desfecho, a data e a
-- justificativa. Nenhuma fiscalização anterior é excluída ou reescrita.
ALTER TABLE "ccz_leishmaniose"
  ADD COLUMN IF NOT EXISTS "situacao_caso" VARCHAR(20) NOT NULL DEFAULT 'EM_ACOMPANHAMENTO',
  ADD COLUMN IF NOT EXISTS "desfecho" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "data_encerramento" DATE,
  ADD COLUMN IF NOT EXISTS "justificativa_encerramento" TEXT,
  ADD COLUMN IF NOT EXISTS "encerrado_por_cpf" VARCHAR(11),
  ADD COLUMN IF NOT EXISTS "encerrado_por_nome" VARCHAR(150),
  ADD COLUMN IF NOT EXISTS "encerrado_em" TIMESTAMPTZ(6);
