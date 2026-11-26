-- Leishmaniose: complementos das perguntas condicionais (Outros animais e
-- pessoas na residência) e o encaminhamento ao Ministério Público.
-- Aditivo: nenhuma coluna existente é alterada e nenhum dado é perdido.

ALTER TABLE "ccz_leishmaniose"
  ADD COLUMN IF NOT EXISTS "outros_com_lesoes_desc" TEXT,
  ADD COLUMN IF NOT EXISTS "pessoas_com_lesoes_desc" TEXT,
  ADD COLUMN IF NOT EXISTS "pessoas_orientadas_desc" TEXT,
  ADD COLUMN IF NOT EXISTS "enc_ministerio_publico" BOOLEAN DEFAULT false;
