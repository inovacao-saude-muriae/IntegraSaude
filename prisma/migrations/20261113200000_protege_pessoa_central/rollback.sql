-- Rollback: volta as FKs para CASCADE (comportamento anterior).
ALTER TABLE "regula_pedidos_exames" DROP CONSTRAINT IF EXISTS "fk_pedidos_pessoa";
ALTER TABLE "regula_pedidos_exames"
  ADD CONSTRAINT "fk_pedidos_pessoa" FOREIGN KEY ("pessoa_cpf")
  REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "farmacia_pacientes" DROP CONSTRAINT IF EXISTS "farmacia_pacientes_pessoa_cpf_fkey";
ALTER TABLE "farmacia_pacientes"
  ADD CONSTRAINT "farmacia_pacientes_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf")
  REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "junta_pacientes" DROP CONSTRAINT IF EXISTS "junta_pacientes_pessoa_cpf_fkey";
ALTER TABLE "junta_pacientes"
  ADD CONSTRAINT "junta_pacientes_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf")
  REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ccz_tutores" DROP CONSTRAINT IF EXISTS "ccz_tutores_pessoa_cpf_fkey";
ALTER TABLE "ccz_tutores"
  ADD CONSTRAINT "ccz_tutores_pessoa_cpf_fkey" FOREIGN KEY ("pessoa_cpf")
  REFERENCES "pessoa"("cpf") ON DELETE CASCADE ON UPDATE CASCADE;
