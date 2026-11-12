-- ═══════════════════════════════════════════════════════════════════════════
-- REVERSÃO da migração 20261112120000_acesso_por_modulo
-- ─────────────────────────────────────────────────────────────────────────
-- Use quando for necessário voltar o banco ao estado anterior à evolução do
-- controle de acesso.
--
-- Seguro por construção: o código antigo nunca leu estas colunas, então
-- derrubá-las não perde nada que a aplicação ainda use. O que é perdido é
-- apenas a configuração nova (perfil/permissões/serviços por vínculo).
--
-- ANTES de rodar: exporte a configuração atual para poder reaplicar depois.
--
--   COPY (
--     SELECT id, user_cpf, modulo, nivel, servico_junta,
--            perfil, servicos, permissoes, ativo, atualizado_por, atualizado_em
--     FROM user_acessos
--   ) TO '/caminho/backup_acessos.csv' WITH (FORMAT csv, HEADER true);
--
-- Depois:  psql -f rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DROP INDEX IF EXISTS "idx_user_acesso_cpf_modulo";

ALTER TABLE "user_acessos" DROP COLUMN IF EXISTS "atualizado_em";
ALTER TABLE "user_acessos" DROP COLUMN IF EXISTS "atualizado_por";
ALTER TABLE "user_acessos" DROP COLUMN IF EXISTS "ativo";
ALTER TABLE "user_acessos" DROP COLUMN IF EXISTS "permissoes";
ALTER TABLE "user_acessos" DROP COLUMN IF EXISTS "servicos";
ALTER TABLE "user_acessos" DROP COLUMN IF EXISTS "perfil";

-- O enum só pode ser removido se nenhuma coluna o usar (já removemos a única).
DROP TYPE IF EXISTS "PerfilModulo";

COMMIT;
