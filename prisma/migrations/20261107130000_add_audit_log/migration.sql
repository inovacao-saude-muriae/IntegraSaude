CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_cpf" VARCHAR(11) NOT NULL,
    "user_nome" VARCHAR(150) NOT NULL,
    "acao" VARCHAR(30) NOT NULL,
    "modulo" VARCHAR(40) NOT NULL,
    "entidade" VARCHAR(60) NOT NULL,
    "entidade_id" VARCHAR(100),
    "descricao" VARCHAR(500),
    "detalhes" JSONB,
    "ip" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_audit_user_data" ON "audit_logs"("user_cpf", "created_at");

CREATE INDEX "idx_audit_modulo_data" ON "audit_logs"("modulo", "created_at");

CREATE INDEX "idx_audit_data" ON "audit_logs"("created_at");