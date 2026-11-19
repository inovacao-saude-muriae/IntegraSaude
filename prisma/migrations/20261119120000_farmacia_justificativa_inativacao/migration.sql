-- Justificativa da inativação operacional do paciente da Farmácia Judicial.
--
-- `farmacia_pacientes.status` é a SITUAÇÃO NA FARMÁCIA JUDICIAL (ATIVO/INATIVO),
-- independente da Situação Cadastral da pessoa central (`pessoa.situacao`).
-- Ao inativar, a justificativa passa a ser obrigatória e fica registrada aqui
-- (e na auditoria). Ao reativar, o texto anterior é PRESERVADO como histórico
-- da última inativação — nada é apagado.
--
-- Segura e idempotente: apenas adiciona a coluna, sem tocar em nenhum registro.
-- Nenhum status existente é migrado ou convertido.
ALTER TABLE "farmacia_pacientes"
  ADD COLUMN IF NOT EXISTS "justificativa_inativacao" VARCHAR(500);
