-- Processos Cirúrgicos (Câmara Técnica › Processos Judiciais)
--
-- Duas necessidades novas, sem duplicar dado pessoal:
--
--   1. NÚMERO DE PASTA por PESSOA. A pasta é do paciente, não do processo:
--      o mesmo paciente pode ter vários processos judiciais compartilhando a
--      mesma pasta. A coluna vive na tabela central `pessoa` (cadastro único)
--      e é única quando informada — nunca há duas pessoas com a mesma pasta.
--      `processos_judiciais.numero_pasta` é mantido como espelho histórico do
--      processo (preserva o valor do momento do cadastro).
--
--   2. BLOQUEIO JUDICIAL vinculado ao PROCESSO (não ao paciente), com valor
--      monetário em NUMERIC(14,2) — decimal exato, nunca ponto flutuante.
--
-- Segura e idempotente: nenhum registro é apagado e nenhum vínculo é alterado.
ALTER TABLE "pessoa" ADD COLUMN IF NOT EXISTS "numero_pasta" VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_pessoa_numero_pasta"
  ON "pessoa" ("numero_pasta")
  WHERE "numero_pasta" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "processos_bloqueios" (
  "id"              SERIAL PRIMARY KEY,
  "processo_id"     INTEGER NOT NULL,
  "data_bloqueio"   DATE NOT NULL,
  "valor"           NUMERIC(14,2) NOT NULL,
  "observacao"      VARCHAR(255),
  "criado_por"      VARCHAR(11),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "ck_processo_bloqueio_valor" CHECK ("valor" > 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_processo_bloqueio_processo'
  ) THEN
    ALTER TABLE "processos_bloqueios"
      ADD CONSTRAINT "fk_processo_bloqueio_processo"
      FOREIGN KEY ("processo_id") REFERENCES "processos_judiciais" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "idx_processo_bloqueio_processo"
  ON "processos_bloqueios" ("processo_id");
CREATE INDEX IF NOT EXISTS "idx_processo_bloqueio_data"
  ON "processos_bloqueios" ("data_bloqueio");
