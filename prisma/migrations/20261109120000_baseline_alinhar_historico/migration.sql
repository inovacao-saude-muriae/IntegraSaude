-- Migration corretiva (baseline): alinha o histórico de migrations com o banco real.
-- A tabela regula_pedidos_historico (model PedidoExameHistorico) foi criada no banco
-- real fora das migrations. Esta migration é ADITIVA e IDEMPOTENTE:
--   * no banco real (onde a tabela já existe) é um NO-OP;
--   * num banco vazio cria a tabela, a sequence (SERIAL), a PK e os índices,
--     com definição idêntica à do pg_dump do banco real.
-- Não há FK nesta tabela no banco real nem no schema.prisma.

-- CreateTable
CREATE TABLE IF NOT EXISTS "regula_pedidos_historico" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "usuario_cpf" VARCHAR(11) NOT NULL,
    "usuario_nome" VARCHAR(150) NOT NULL,
    "acao" VARCHAR(50) NOT NULL,
    "campo_alterado" VARCHAR(100),
    "valor_anterior" TEXT,
    "valor_novo" TEXT,
    "observacao" TEXT,
    "data_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "regula_pedidos_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_historico_pedido" ON "regula_pedidos_historico"("pedido_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_historico_data" ON "regula_pedidos_historico"("data_hora");
