-- Rollback: recria o perfil legado (enum Role + users.role).
-- ATENÇÃO: o valor gravado será o padrão REGULACAO_COMUM para todos — a
-- informação original não existe mais. Os vínculos (user_acessos) NÃO são
-- tocados por esta migração nem pelo rollback.

CREATE TYPE "Role" AS ENUM (
  'GESTOR',
  'REGULACAO_ADMIN',
  'REGULACAO_COMUM',
  'FARMACIA_ADMIN',
  'PROCESSO_ADMIN',
  'JUNTA_ADMIN',
  'JUNTA_CAEE',
  'JUNTA_EDUCACAO',
  'JUNTA_SAUDE',
  'JUNTA_ASSISTENCIA',
  'CCZ_ADMIN',
  'CCZ_COMUM'
);

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'REGULACAO_COMUM';
