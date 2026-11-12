BEGIN;
ALTER TABLE "user_acessos" DROP CONSTRAINT IF EXISTS "chk_acesso_escopo_servicos";
ALTER TABLE "user_acessos" DROP COLUMN IF EXISTS "escopo";
DROP TYPE IF EXISTS "EscopoServico";
COMMIT;
