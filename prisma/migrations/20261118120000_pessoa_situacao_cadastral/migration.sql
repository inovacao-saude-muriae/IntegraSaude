-- Situação cadastral da Pessoa central (EMPI).
--
-- Hoje a atividade da pessoa é um booleano (`ativo`), que acumula DOIS
-- significados: "cadastro inativado" e "cadastro absorvido por unificação".
-- Esta migração separa o conceito em um ENUM com três valores explícitos:
--
--   ATIVO    → cadastro em uso
--   INATIVO  → cadastro inativado por decisão administrativa
--   FALECIDO → óbito registrado
--
-- Segura e idempotente:
--   1. cria o tipo/enum e a coluna (só se ainda não existirem), com DEFAULT 'ATIVO';
--   2. transporta a situação dos registros existentes: `ativo = false` vira
--      'INATIVO' (inclui os unificados — que continuam com `ativo = false`);
--   3. mantém `ativo` como espelho técnico de disponibilidade do cadastro,
--      atualizado por trigger para nunca divergir da situação;
--   4. cria o índice de filtragem por situação.
-- Nenhum registro é apagado e nenhum vínculo é alterado.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SituacaoCadastral') THEN
    CREATE TYPE "SituacaoCadastral" AS ENUM ('ATIVO', 'INATIVO', 'FALECIDO');
  END IF;
END
$$;

ALTER TABLE "pessoa" ADD COLUMN IF NOT EXISTS "situacao" "SituacaoCadastral" NOT NULL DEFAULT 'ATIVO';

-- Transporte da situação existente (somente onde ainda não houve decisão nova).
UPDATE "pessoa"
   SET "situacao" = 'INATIVO'
 WHERE "ativo" = false
   AND "situacao" = 'ATIVO';

-- Espelho técnico: `ativo` = (situacao = 'ATIVO'). FALECIDO não é "ativo" para
-- novas operações assistenciais, mas o histórico permanece consultável.
CREATE OR REPLACE FUNCTION "fn_pessoa_situacao_ativo"() RETURNS trigger AS $$
BEGIN
  NEW."ativo" := (NEW."situacao" = 'ATIVO');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_pessoa_situacao_ativo" ON "pessoa";
CREATE TRIGGER "trg_pessoa_situacao_ativo"
  BEFORE INSERT OR UPDATE OF "situacao" ON "pessoa"
  FOR EACH ROW EXECUTE FUNCTION "fn_pessoa_situacao_ativo"();

-- Sincroniza os registros que já estavam corretos com o novo espelho.
UPDATE "pessoa" SET "ativo" = ("situacao" = 'ATIVO') WHERE "ativo" <> ("situacao" = 'ATIVO');

CREATE INDEX IF NOT EXISTS "idx_pessoa_situacao" ON "pessoa" ("situacao");
