-- Situação (ativa/inativa) dos procedimentos da Regulação.
--
-- Aditiva e segura: a coluna nasce com DEFAULT true, então todos os registros
-- existentes continuam ativos. Nada é apagado e nenhum vínculo é reescrito —
-- procedimentos inativos seguem visíveis em pedidos de exame já criados.
ALTER TABLE "regula_procedimentos" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "idx_regula_procedimentos_ativo" ON "regula_procedimentos" ("ativo");
