-- Encerramento do acompanhamento da Esporotricose.
-- Reaproveita a estrutura existente: a conclusão continua no campo `encerrado`
-- (boolean) e as colunas data_encerramento / encerrado_por seguem em uso.
-- Entram apenas os campos complementares do encerramento, no mesmo padrão da
-- Leishmaniose. Nenhum registro é excluído ou reescrito.
ALTER TABLE "ccz_esporotricose"
  ADD COLUMN IF NOT EXISTS "desfecho" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "justificativa_encerramento" TEXT,
  ADD COLUMN IF NOT EXISTS "encerrado_por_cpf" VARCHAR(11),
  ADD COLUMN IF NOT EXISTS "encerrado_em" TIMESTAMPTZ(6);

-- Registros já encerrados recebem a data do encerramento existente e o
-- desfecho histórico preservado (incineração) quando houver.
UPDATE "ccz_esporotricose"
   SET "encerrado_em" = "data_encerramento"
 WHERE "encerrado" IS TRUE AND "data_encerramento" IS NOT NULL AND "encerrado_em" IS NULL;

UPDATE "ccz_esporotricose"
   SET "desfecho" = 'Incinerado'
 WHERE "encerrado" IS TRUE AND LOWER(TRIM(COALESCE("incinerado", ''))) IN ('sim', 'incinerado') AND "desfecho" IS NULL;
