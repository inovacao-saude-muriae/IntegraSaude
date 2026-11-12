-- ═══════════════════════════════════════════════════════════════════════════
-- CCZ: arquivamento de denúncias
-- ─────────────────────────────────────────────────────────────────────────
-- Migração ADITIVA. Não há DROP, DELETE ou UPDATE de dados.
--
-- Motivo: a denúncia de animal agressivo pode carregar histórico de
-- investigação e atendimento, por isso não pode ser apagada para "sair da
-- lista". Com estas colunas a denúncia passa a ser ARQUIVADA — continua no
-- banco, rastreável, e some apenas das listagens operacionais.
--
-- `situacao`:  "Ativa" (padrão) | "Arquivada"
-- `motivo_arquivamento`, `arquivada_em`, `arquivada_por`: rastreabilidade.
--
-- O animal NÃO precisa de coluna nova: usa `ccz_animais.situacao`, que já
-- existe (varchar(20)) — arquivamento grava "Arquivado".
--
-- Reversão: rollback.sql nesta mesma pasta.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "ccz_denuncias"
  ADD COLUMN IF NOT EXISTS "situacao" VARCHAR(20) NOT NULL DEFAULT 'Ativa';

ALTER TABLE "ccz_denuncias"
  ADD COLUMN IF NOT EXISTS "motivo_arquivamento" TEXT;

ALTER TABLE "ccz_denuncias"
  ADD COLUMN IF NOT EXISTS "arquivada_em" TIMESTAMPTZ(6);

ALTER TABLE "ccz_denuncias"
  ADD COLUMN IF NOT EXISTS "arquivada_por" VARCHAR(150);

-- Índice para as listagens que passam a filtrar por situação.
CREATE INDEX IF NOT EXISTS "idx_denuncias_situacao"
  ON "ccz_denuncias" ("situacao");
