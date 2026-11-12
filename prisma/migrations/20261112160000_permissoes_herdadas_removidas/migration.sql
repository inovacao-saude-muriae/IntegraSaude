-- ═══════════════════════════════════════════════════════════════════════════
-- Permissões herdadas × concedidas × removidas
-- ─────────────────────────────────────────────────────────────────────────
-- PROBLEMA CORRIGIDO: com uma única lista `permissoes` não é possível saber se
-- a configuração de um vínculo é "o pacote do perfil" ou "uma personalização".
-- Gravar a lista inteira sempre que o administrador mexe em uma permissão faz
-- a alteração futura do pacote do perfil não chegar a ninguém — e o
-- administrador não vê o que foi pessoalmente concedido ou retirado.
--
-- AGORA:
--   permissoes      → CONCESSÕES ADICIONAIS (fora do pacote do perfil)
--   removidas       → RETIRADAS do pacote do perfil
--   efetivas        = (pacote do perfil ∪ permissoes) − removidas
--
-- Vínculo sem nenhuma das duas listas = usa o pacote do perfil integralmente
-- (herança pura). Segue sendo fail-closed: permissão fora do catálogo não
-- autoriza, e `removidas` não consegue retirar algo que não exista no pacote.
--
-- Migração ADITIVA. Reversão: rollback.sql nesta pasta.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "user_acessos"
  ADD COLUMN IF NOT EXISTS "removidas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Migra os vínculos existentes: a lista antiga `permissoes` era o pacote
-- completo do perfil (backfill de 12/11). Sem esta limpeza, esses vínculos
-- ficariam "congelados" no pacote do dia em que foram convertidos.
--
-- Como o pacote é definido em código (lib/permissoesCatalogo.js) e não no
-- banco, a comparação fica no script `scripts/migrar-permissoes-para-pacote.js`
-- (idempotente, com --dry-run), que roda logo após esta migração.
CREATE INDEX IF NOT EXISTS "idx_user_acesso_removidas"
  ON "user_acessos" USING GIN ("removidas");
