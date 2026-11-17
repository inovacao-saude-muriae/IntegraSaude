-- Rollback da situação cadastral: devolve a pessoa ao controle booleano.
-- `ativo` já é o espelho de `situacao`, então nenhuma informação de atividade
-- se perde; apenas o valor FALECIDO deixa de existir (volta a INATIVO/ativo=false).
DROP TRIGGER IF EXISTS "trg_pessoa_situacao_ativo" ON "pessoa";
DROP FUNCTION IF EXISTS "fn_pessoa_situacao_ativo"();
DROP INDEX IF EXISTS "idx_pessoa_situacao";
ALTER TABLE "pessoa" DROP COLUMN IF EXISTS "situacao";
DROP TYPE IF EXISTS "SituacaoCadastral";
