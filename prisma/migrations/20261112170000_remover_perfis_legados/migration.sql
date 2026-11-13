-- ═══════════════════════════════════════════════════════════════════════════
-- REMOÇÃO DOS 12 PERFIS LEGADOS (users.role + enum Role)
-- ─────────────────────────────────────────────────────────────────────────
-- A autorização passou a ser exclusivamente por vínculo de módulo
-- (user_acessos: perfil, escopo, servicos, permissoes, removidas). Nada mais
-- lê `users.role`: as guardas usam requirePermissao/temPermissaoPura, a
-- Sidebar e as páginas usam /api/me, e Gestão Geral é o módulo GESTAO.
--
-- PRESERVA: usuários, senhas, vínculos (user_acessos), sessões, auditoria.
-- Só remove a coluna e o tipo que ninguém mais consulta.
--
-- Verificação prévia: scripts/verificar-dependencias-role.js
-- Rollback: rollback.sql (recria a coluna e o tipo, com valor padrão).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Rede de segurança: nenhum vínculo pode ficar órfão de perfil.
--    (Se algum vínculo estiver com perfil nulo, a migração falha aqui e nada
--    é removido — melhor parar do que perder a configuração de acesso.)
DO $$
DECLARE
  sem_perfil integer;
BEGIN
  SELECT COUNT(*) INTO sem_perfil FROM "user_acessos" WHERE "perfil" IS NULL;
  IF sem_perfil > 0 THEN
    RAISE EXCEPTION
      'Migração abortada: % vínculo(s) em user_acessos sem perfil. Corrija antes de remover users.role.',
      sem_perfil;
  END IF;
END $$;

-- 2. Contagem antes, para conferência no log.
DO $$
DECLARE
  total_users integer;
  total_vinculos integer;
BEGIN
  SELECT COUNT(*) INTO total_users FROM "users";
  SELECT COUNT(*) INTO total_vinculos FROM "user_acessos";
  RAISE NOTICE 'Preservados: % usuário(s) e % vínculo(s).', total_users, total_vinculos;
END $$;

-- 3. Remove a coluna e o tipo do perfil legado.
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
DROP TYPE IF EXISTS "Role";
