-- ═══════════════════════════════════════════════════════════════════════════
-- Escopo explícito de serviços no vínculo de acesso
-- ─────────────────────────────────────────────────────────────────────────
-- Antes: `servicos` vazio significava "todos os serviços" por omissão — o que
-- pode conceder acesso irrestrito por acidente.
-- Agora: o escopo é declarado.
--   TODOS       → todos os serviços do módulo (servicos vazio)
--   ESPECIFICOS → somente os listados (não pode ser vazio)
--   NENHUM      → nenhum serviço (servicos vazio)
--
-- Migração ADITIVA, com constraint de coerência. Nenhum dado é apagado.
-- Vínculos existentes ficam em TODOS, que é o comportamento que já tinham.
-- Reversão: rollback.sql nesta pasta.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscopoServico') THEN
    CREATE TYPE "EscopoServico" AS ENUM ('TODOS', 'ESPECIFICOS', 'NENHUM');
  END IF;
END
$$;

ALTER TABLE "user_acessos"
  ADD COLUMN IF NOT EXISTS "escopo" "EscopoServico" NOT NULL DEFAULT 'TODOS';

-- Coerência entre escopo e serviços, garantida pelo banco (não só pela app).
ALTER TABLE "user_acessos"
  DROP CONSTRAINT IF EXISTS "chk_acesso_escopo_servicos";

-- COALESCE é obrigatório: array_length() de um array vazio devolve NULL, e
-- qualquer comparação com NULL é NULL (nem verdadeira nem falsa). Sem o
-- COALESCE, a constraint aceitaria ESPECIFICOS com lista vazia.
ALTER TABLE "user_acessos"
  ADD CONSTRAINT "chk_acesso_escopo_servicos" CHECK (
    ("escopo" = 'ESPECIFICOS' AND COALESCE(array_length("servicos", 1), 0) >= 1)
    OR ("escopo" = 'TODOS'   AND COALESCE(array_length("servicos", 1), 0) = 0)
    OR ("escopo" = 'NENHUM'  AND COALESCE(array_length("servicos", 1), 0) = 0)
  );
