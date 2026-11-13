-- ═══════════════════════════════════════════════════════════════════════════
-- PROCESSOS JUDICIAIS — Câmara Técnica > Processos
-- ─────────────────────────────────────────────────────────────────────────
-- Nova tabela própria. NÃO altera `pessoa` (cadastro único/EMPI): o processo
-- aponta para o CPF. Especialidade e Procedimento usam os catálogos que já
-- existem, e guardam o NOME do momento do cadastro para o processo continuar
-- legível se o catálogo mudar.
--
-- Sem cascata: `pessoa` com processo não pode ser apagada (ON DELETE RESTRICT),
-- e as futuras tabelas de documentos/movimentações referenciarão este id.
-- Rollback: rollback.sql (dropa a tabela; não toca em nenhuma outra).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "processos_judiciais" (
  "id"                 SERIAL PRIMARY KEY,
  "pessoa_cpf"         VARCHAR(11)  NOT NULL,
  "numero_processo"    VARCHAR(100) NOT NULL,
  "numero_pasta"       VARCHAR(50)  NOT NULL,
  "especialidade_id"   INTEGER,
  "procedimento_id"    INTEGER,
  "especialidade_nome" VARCHAR(150),
  "procedimento_nome"  VARCHAR(150),
  "status"             VARCHAR(20)  NOT NULL DEFAULT 'ATIVO',
  "criado_por"         VARCHAR(11),
  "atualizado_por"     VARCHAR(11),
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Um número de processo é único no município.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_processo_numero"
  ON "processos_judiciais" ("numero_processo");

CREATE INDEX IF NOT EXISTS "idx_processo_pessoa"
  ON "processos_judiciais" ("pessoa_cpf");

CREATE INDEX IF NOT EXISTS "idx_processo_pasta"
  ON "processos_judiciais" ("numero_pasta");

CREATE INDEX IF NOT EXISTS "idx_processo_data"
  ON "processos_judiciais" ("created_at");

-- FKs: pessoa com RESTRICT (integridade do titular), catálogos com SET NULL
-- (o nome espelhado preserva a leitura).
ALTER TABLE "processos_judiciais"
  ADD CONSTRAINT "fk_processo_pessoa"
  FOREIGN KEY ("pessoa_cpf") REFERENCES "pessoa"("cpf")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "processos_judiciais"
  ADD CONSTRAINT "fk_processo_especialidade"
  FOREIGN KEY ("especialidade_id") REFERENCES "junta_especialidades"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "processos_judiciais"
  ADD CONSTRAINT "fk_processo_procedimento"
  FOREIGN KEY ("procedimento_id") REFERENCES "regula_procedimentos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
