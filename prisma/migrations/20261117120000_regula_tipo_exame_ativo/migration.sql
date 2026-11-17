-- Situação do Tipo de Exame (categoria superior da Regulação).
--
-- Necessária para a inativação HIERÁRQUICA em "Exames e Procedimentos": a
-- categoria precisa de situação própria para poder ser inativada sem tocar no
-- `ativo` de cada procedimento.
--
-- Segura e idempotente: a coluna só é criada se ainda não existir, com DEFAULT
-- true, então todos os tipos existentes continuam ativos e nenhum procedimento,
-- vínculo ou registro histórico muda de situação.
ALTER TABLE "regula_tipo_exame" ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "idx_regula_tipo_exame_ativo" ON "regula_tipo_exame" ("ativo");
