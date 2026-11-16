-- Reverte para os valores do enum legado ServicoJunta.
BEGIN;
UPDATE user_acessos ua
SET servicos = sub.antigos
FROM (
  SELECT
    ua2.id,
    COALESCE(
      array_agg(DISTINCT CASE s.nome
        WHEN 'CAEE' THEN 'CAEE'
        WHEN 'APAE' THEN 'APAE'
        WHEN 'Ambulatório' THEN 'AMBULATORIO'
        WHEN 'Centro de Especialidades' THEN 'ESPECIALIDADES'
      END) FILTER (WHERE s.id IS NOT NULL),
      ARRAY[]::text[]
    ) AS antigos
  FROM user_acessos ua2
  CROSS JOIN LATERAL unnest(ua2.servicos) AS atual(valor)
  LEFT JOIN junta_servicos s ON s.id::text = atual.valor
  WHERE ua2.modulo = 'JUNTA'
  GROUP BY ua2.id
) sub
WHERE ua.id = sub.id;
COMMIT;
