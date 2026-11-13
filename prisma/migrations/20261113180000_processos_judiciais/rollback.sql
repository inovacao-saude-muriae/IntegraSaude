-- Rollback: remove apenas a tabela de processos judiciais.
-- Nenhuma outra estrutura é afetada (pessoa, catálogos e vínculos ficam).
DROP TABLE IF EXISTS "processos_judiciais";
