-- Justificativa da inativação do PROCESSO JUDICIAL.
--
-- `processos_judiciais.status` é a situação do próprio processo (ATIVO/INATIVO),
-- independente da Situação Cadastral da pessoa. Ao inativar, a justificativa é
-- obrigatória; ao reativar, o texto anterior é PRESERVADO como histórico da
-- última inativação — nada é apagado.
--
-- Segura e idempotente: apenas adiciona a coluna. Nenhum status existente é
-- migrado ou convertido.
ALTER TABLE "processos_judiciais"
  ADD COLUMN IF NOT EXISTS "justificativa_inativacao" VARCHAR(500);
