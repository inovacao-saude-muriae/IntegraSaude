-- Situação do Tipo de Exame (categoria superior da Regulação).
--
-- Necessária para a inativação HIERÁRQUICA: sem uma situação própria do tipo,
-- não há como inativar a categoria e deixar os procedimentos dela
-- operacionalmente indisponíveis sem tocar no `ativo` de cada um.
--
-- Os registros existentes continuam ativos. Nada é apagado, nenhum vínculo é
-- reescrito e nenhum procedimento muda de situação: a inativação do tipo é
-- apenas mais um fator de disponibilidade, combinado no backend.
ALTER TABLE "regula_tipo_exame" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "idx_regula_tipo_exame_ativo" ON "regula_tipo_exame" ("ativo");
