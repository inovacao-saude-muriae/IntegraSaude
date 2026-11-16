-- ═══════════════════════════════════════════════════════════════════════════
-- Escopo da Junta Reguladora passa a referenciar o ID do serviço cadastrado
-- (junta_servicos.id) em vez do enum fixo ServicoJunta.
--
-- Motivo: os serviços da Junta são dados (Gerenciamento → Serviços e
-- Especialidades). O vínculo de acesso precisa sobreviver a renomear, inativar
-- e reativar o serviço, e novos serviços têm de ficar disponíveis para
-- configuração de acesso sem alteração de código.
--
-- Não há mudança de tipo: user_acessos.servicos já é text[]. Esta migração só
-- converte os valores existentes e documenta o novo significado.
--   CAEE                  -> id do serviço de nome CAEE
--   APAE                  -> id do serviço de nome APAE
--   AMBULATORIO           -> id do serviço de nome Ambulatório
--   ESPECIALIDADES        -> id do serviço de nome Centro de Especialidades
-- Valor que não corresponder a nenhum serviço cadastrado é removido (o vínculo
-- fica vazio e o escopo é rebaixado para NENHUM, jamais para TODOS: nada de
-- privilégio por omissão).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Converte os valores do enum legado para o id do serviço correspondente.
UPDATE user_acessos ua
SET servicos = sub.novos
FROM (
  SELECT
    ua2.id,
    COALESCE(
      array_agg(DISTINCT s.id::text) FILTER (WHERE s.id IS NOT NULL),
      ARRAY[]::text[]
    ) AS novos
  FROM user_acessos ua2
  CROSS JOIN LATERAL unnest(ua2.servicos) AS antigo(valor)
  LEFT JOIN junta_servicos s ON (
    (antigo.valor = 'CAEE'                  AND s.nome = 'CAEE') OR
    (antigo.valor = 'APAE'                  AND s.nome = 'APAE') OR
    (antigo.valor = 'AMBULATORIO'           AND s.nome = 'Ambulatório') OR
    (antigo.valor = 'ESPECIALIDADES'        AND s.nome = 'Centro de Especialidades')
  )
  WHERE ua2.modulo = 'JUNTA'
  GROUP BY ua2.id
) sub
WHERE ua.id = sub.id;

-- 2. Vínculo ESPECIFICOS que perdeu todas as referências: rebaixa para NENHUM.
UPDATE user_acessos
SET escopo = 'NENHUM'
WHERE modulo = 'JUNTA'
  AND escopo = 'ESPECIFICOS'
  AND cardinality(servicos) = 0;

-- 3. Módulos que não são organizados por serviço nunca guardam lista.
UPDATE user_acessos
SET servicos = ARRAY[]::text[]
WHERE modulo <> 'JUNTA'
  AND cardinality(servicos) > 0;

COMMIT;
