-- EMPI: CPF provisório + unificação de cadastros de pessoa.
-- Todas as FKs que referenciam pessoa(cpf) / ccz_tutores(pessoa_cpf) já são
-- ON UPDATE CASCADE (verificado no catálogo), portanto não são recriadas.
BEGIN;

ALTER TABLE "pessoa"
    ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "unificado_em_cpf" VARCHAR(11),
    ADD COLUMN "data_unificacao" TIMESTAMPTZ(6),
    ADD COLUMN "unificado_por_usuario_id" VARCHAR(11);

ALTER TABLE "pessoa"
    ADD CONSTRAINT "fk_pessoa_unificado_em" FOREIGN KEY ("unificado_em_cpf") REFERENCES "pessoa"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "fk_pessoa_unificado_por" FOREIGN KEY ("unificado_por_usuario_id") REFERENCES "users"("cpf") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "chk_pessoa_unificado_inativo" CHECK ("unificado_em_cpf" IS NULL OR "ativo" = false);

CREATE INDEX "idx_pessoa_ativo" ON "pessoa"("ativo");
CREATE INDEX "idx_pessoa_unificado_em" ON "pessoa"("unificado_em_cpf");

CREATE SEQUENCE "seq_cpf_provisorio" START 1;

CREATE FUNCTION "gerar_cpf_provisorio"() RETURNS varchar LANGUAGE sql AS
$$ SELECT 'T' || lpad(nextval('seq_cpf_provisorio')::text, 10, '0') $$;

CREATE TABLE "auditoria_unificacoes" (
    "id" SERIAL NOT NULL,
    "pessoa_principal_cpf" VARCHAR(11) NOT NULL,
    "pessoas_absorvidas_cpfs" JSONB NOT NULL,
    "motivo" TEXT,
    "usuario_id" VARCHAR(11),
    "snapshot_anterior" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_unificacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_auditoria_unif_principal" FOREIGN KEY ("pessoa_principal_cpf") REFERENCES "pessoa"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_auditoria_unif_usuario" FOREIGN KEY ("usuario_id") REFERENCES "users"("cpf") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "idx_auditoria_unif_principal" ON "auditoria_unificacoes"("pessoa_principal_cpf");
CREATE INDEX "idx_auditoria_unif_data" ON "auditoria_unificacoes"("created_at");

COMMIT;
