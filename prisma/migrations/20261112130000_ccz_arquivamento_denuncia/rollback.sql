-- Reversão da migração 20261112130000_ccz_arquivamento_denuncia.
-- Seguro: as colunas não existiam antes e nada mais no código depende delas
-- depois de revertida a aplicação.

BEGIN;

DROP INDEX IF EXISTS "idx_denuncias_situacao";

ALTER TABLE "ccz_denuncias" DROP COLUMN IF EXISTS "arquivada_por";
ALTER TABLE "ccz_denuncias" DROP COLUMN IF EXISTS "arquivada_em";
ALTER TABLE "ccz_denuncias" DROP COLUMN IF EXISTS "motivo_arquivamento";
ALTER TABLE "ccz_denuncias" DROP COLUMN IF EXISTS "situacao";

COMMIT;
