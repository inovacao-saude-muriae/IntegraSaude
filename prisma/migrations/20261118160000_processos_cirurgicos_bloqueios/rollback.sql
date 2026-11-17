-- Rollback dos processos cirúrgicos/bloqueios.
-- Os bloqueios são removidos primeiro (FK RESTRICT); o espelho de pasta em
-- processos_judiciais permanece intacto.
DROP TABLE IF EXISTS "processos_bloqueios";
DROP INDEX IF EXISTS "uq_pessoa_numero_pasta";
ALTER TABLE "pessoa" DROP COLUMN IF EXISTS "numero_pasta";
