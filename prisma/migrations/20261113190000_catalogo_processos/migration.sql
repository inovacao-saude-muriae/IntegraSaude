-- ═══════════════════════════════════════════════════════════════════════════
-- CATÁLOGO PRÓPRIO DA ÁREA PROCESSOS (Câmara Técnica)
-- ─────────────────────────────────────────────────────────────────────────
-- 1. Desfaz o vínculo indevido criado em `junta_especialidades`
--    (`tipo_exame_id`), que pertence à Junta Reguladora.
-- 2. Cria o catálogo próprio de Processos: especialidades, procedimentos e o
--    vínculo N:N entre eles.
-- 3. Repontar os processos judiciais para o novo catálogo, PRESERVANDO o que já
--    estava gravado (os nomes continuam no próprio processo).
--
-- Nada da Junta Reguladora é apagado: só sai a coluna criada para a integração
-- indevida. Rollback em rollback.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Remove o vínculo indevido com a Junta Reguladora ────────────────────
ALTER TABLE "processos_judiciais" DROP CONSTRAINT IF EXISTS "fk_processo_especialidade";
ALTER TABLE "processos_judiciais" DROP CONSTRAINT IF EXISTS "fk_processo_procedimento";

ALTER TABLE "junta_especialidades" DROP CONSTRAINT IF EXISTS "fk_especialidade_tipo_exame";
DROP INDEX IF EXISTS "idx_especialidade_tipo_exame";
ALTER TABLE "junta_especialidades" DROP COLUMN IF EXISTS "tipo_exame_id";

-- ── 2. Catálogo próprio de Processos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "processos_especialidades" (
  "id"         SERIAL PRIMARY KEY,
  "nome"       VARCHAR(150) NOT NULL,
  "nome_chave" VARCHAR(150) NOT NULL,
  "ativo"      BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "processos_especialidades_nome_chave_key"
  ON "processos_especialidades" ("nome_chave");
CREATE INDEX IF NOT EXISTS "idx_proc_especialidade_ativo"
  ON "processos_especialidades" ("ativo");

CREATE TABLE IF NOT EXISTS "processos_procedimentos" (
  "id"         SERIAL PRIMARY KEY,
  "nome"       VARCHAR(150) NOT NULL,
  "nome_chave" VARCHAR(150) NOT NULL,
  "ativo"      BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "processos_procedimentos_nome_chave_key"
  ON "processos_procedimentos" ("nome_chave");
CREATE INDEX IF NOT EXISTS "idx_proc_procedimento_ativo"
  ON "processos_procedimentos" ("ativo");

CREATE TABLE IF NOT EXISTS "processos_especialidade_procedimento" (
  "id"               SERIAL PRIMARY KEY,
  "especialidade_id" INTEGER NOT NULL,
  "procedimento_id"  INTEGER NOT NULL,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "fk_pep_especialidade" FOREIGN KEY ("especialidade_id")
    REFERENCES "processos_especialidades"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_pep_procedimento" FOREIGN KEY ("procedimento_id")
    REFERENCES "processos_procedimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pep_par"
  ON "processos_especialidade_procedimento" ("especialidade_id", "procedimento_id");
CREATE INDEX IF NOT EXISTS "idx_pep_procedimento"
  ON "processos_especialidade_procedimento" ("procedimento_id");

-- ── 3. Migra o que existia nos processos para o catálogo próprio ───────────
-- Aproveita o NOME já gravado no processo (fonte confiável: foi o que o
-- usuário escolheu). Ids antigos da Junta são zerados — nunca apontam para
-- tabela de outro módulo.
INSERT INTO "processos_especialidades" ("nome", "nome_chave")
SELECT DISTINCT ON (lower(btrim("especialidade_nome")))
       btrim("especialidade_nome"),
       lower(btrim("especialidade_nome"))
  FROM "processos_judiciais"
 WHERE "especialidade_nome" IS NOT NULL AND btrim("especialidade_nome") <> ''
 ORDER BY lower(btrim("especialidade_nome"))
ON CONFLICT ("nome_chave") DO NOTHING;

INSERT INTO "processos_procedimentos" ("nome", "nome_chave")
SELECT DISTINCT ON (lower(btrim("procedimento_nome")))
       btrim("procedimento_nome"),
       lower(btrim("procedimento_nome"))
  FROM "processos_judiciais"
 WHERE "procedimento_nome" IS NOT NULL AND btrim("procedimento_nome") <> ''
 ORDER BY lower(btrim("procedimento_nome"))
ON CONFLICT ("nome_chave") DO NOTHING;

-- Vínculo: quando o processo tem especialidade e procedimento, o par passa a
-- existir no catálogo novo.
INSERT INTO "processos_especialidade_procedimento" ("especialidade_id", "procedimento_id")
SELECT DISTINCT e."id", p."id"
  FROM "processos_judiciais" pj
  JOIN "processos_especialidades" e
    ON e."nome_chave" = lower(btrim(pj."especialidade_nome"))
  JOIN "processos_procedimentos" p
    ON p."nome_chave" = lower(btrim(pj."procedimento_nome"))
 WHERE pj."especialidade_nome" IS NOT NULL
   AND pj."procedimento_nome" IS NOT NULL
ON CONFLICT ("especialidade_id", "procedimento_id") DO NOTHING;

-- Repontar os processos (por nome), sem perder nenhum registro.
UPDATE "processos_judiciais" pj
   SET "especialidade_id" = e."id"
  FROM "processos_especialidades" e
 WHERE e."nome_chave" = lower(btrim(pj."especialidade_nome"));

UPDATE "processos_judiciais" pj
   SET "procedimento_id" = p."id"
  FROM "processos_procedimentos" p
 WHERE p."nome_chave" = lower(btrim(pj."procedimento_nome"));

-- Qualquer id que não tenha casado com o catálogo novo é zerado (o nome do
-- processo continua guardado).
UPDATE "processos_judiciais" pj
   SET "especialidade_id" = NULL
 WHERE "especialidade_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "processos_especialidades" e WHERE e."id" = pj."especialidade_id");

UPDATE "processos_judiciais" pj
   SET "procedimento_id" = NULL
 WHERE "procedimento_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "processos_procedimentos" p WHERE p."id" = pj."procedimento_id");

-- ── 4. Novas chaves estrangeiras para o catálogo próprio ───────────────────
ALTER TABLE "processos_judiciais"
  ADD CONSTRAINT "fk_processo_especialidade"
  FOREIGN KEY ("especialidade_id") REFERENCES "processos_especialidades"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "processos_judiciais"
  ADD CONSTRAINT "fk_processo_procedimento"
  FOREIGN KEY ("procedimento_id") REFERENCES "processos_procedimentos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_processo_especialidade"
  ON "processos_judiciais" ("especialidade_id");
CREATE INDEX IF NOT EXISTS "idx_processo_procedimento"
  ON "processos_judiciais" ("procedimento_id");
