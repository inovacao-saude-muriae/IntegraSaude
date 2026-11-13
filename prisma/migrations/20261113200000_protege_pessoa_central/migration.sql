-- ═══════════════════════════════════════════════════════════════════════════
-- PROTEÇÃO DO CADASTRO CENTRAL (pessoa)
-- ---------------------------------------------------------------------------
-- A exclusão de uma pessoa NÃO pode mais arrastar registros operacionais de
-- outros módulos. Onde o vínculo precisa ser preservado, a FK passa a RESTRICT
-- (o banco recusa a exclusão) — defesa em profundidade, além da checagem que a
-- server action faz antes.
--
-- O que NÃO muda (relacionamentos de propriedade da própria pessoa):
--   pessoa_endereco.pessoa_cpf      → CASCADE  (endereço é dado da pessoa)
--   pessoa.unificado_em_cpf         → RESTRICT (já estava)
--   auditoria_unificacoes           → RESTRICT (já estava)
--   processos_judiciais.pessoa_cpf  → RESTRICT (já estava)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Regulação: pedidos de exame são histórico do paciente.
ALTER TABLE "regula_pedidos_exames" DROP CONSTRAINT IF EXISTS "fk_pedidos_pessoa";
ALTER TABLE "regula_pedidos_exames"
  ADD CONSTRAINT "fk_pedidos_pessoa" FOREIGN KEY ("pessoa_cpf")
  REFERENCES "pessoa"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Farmácia Judicial: pasta do paciente (com dispensações e tratamentos).
ALTER TABLE "farmacia_pacientes" DROP CONSTRAINT IF EXISTS "farmacia_pacientes_pessoa_cpf_fkey";
ALTER TABLE "farmacia_pacientes"
  ADD CONSTRAINT "farmacia_pacientes_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf")
  REFERENCES "pessoa"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Junta Reguladora: paciente da Junta (com agendamentos e atendimentos).
ALTER TABLE "junta_pacientes" DROP CONSTRAINT IF EXISTS "junta_pacientes_pessoa_cpf_fkey";
ALTER TABLE "junta_pacientes"
  ADD CONSTRAINT "junta_pacientes_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf")
  REFERENCES "pessoa"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. CCZ: vínculo de tutor. A exclusão do vínculo é operação própria
--    (excluirTutor), não efeito colateral da exclusão da pessoa.
ALTER TABLE "ccz_tutores" DROP CONSTRAINT IF EXISTS "ccz_tutores_pessoa_cpf_fkey";
ALTER TABLE "ccz_tutores"
  ADD CONSTRAINT "ccz_tutores_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf")
  REFERENCES "pessoa"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;
