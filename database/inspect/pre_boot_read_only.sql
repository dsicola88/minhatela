-- Só SELECT. Não aplicar no arranque da API.
-- Correr numa sessão de leitura (Railway Postgres) ANTES de qualquer limpeza manual.

-- 1. Migrações já aplicadas
SELECT id, applied_at
FROM schema_migrations
WHERE id IN ('037_ads_manager.sql', '038_creator_ledger_trace.sql')
ORDER BY id;

-- 2. Duplicados de cliques (037 · índice único)
SELECT impression_id, COUNT(*)::int AS n
FROM ad_clicks
GROUP BY impression_id
HAVING COUNT(*) > 1
ORDER BY n DESC;

SELECT COALESCE(SUM(n - 1), 0)::int AS extra_click_rows
FROM (
  SELECT COUNT(*)::int AS n FROM ad_clicks GROUP BY impression_id HAVING COUNT(*) > 1
) d;

-- 3. Linhas de livro que a 038 ANTIGA teria apagado (n>1, fica o mais antigo)
-- Critério: mesma source view|ad_share e a mesma chave
--   view:{content_id}:{period_date}:{userId}
--   ad:{impressionId}
WITH ranked AS (
  SELECT
    e.id,
    e.creator_id,
    c.display_name,
    e.content_id,
    v.title,
    e.source,
    e.amount_kz,
    e.period_date,
    e.created_at,
    CASE
      WHEN e.source = 'view' AND e.metadata ? 'userId'
        THEN 'view:' || e.content_id::text || ':' || e.period_date::text || ':' || (e.metadata->>'userId')
      WHEN e.source = 'ad_share' AND e.metadata ? 'impressionId'
        THEN 'ad:' || (e.metadata->>'impressionId')
      ELSE NULL
    END AS trace_candidate,
    ROW_NUMBER() OVER (
      PARTITION BY
        CASE
          WHEN e.source = 'view' AND e.metadata ? 'userId'
            THEN 'view:' || e.content_id::text || ':' || e.period_date::text || ':' || (e.metadata->>'userId')
          WHEN e.source = 'ad_share' AND e.metadata ? 'impressionId'
            THEN 'ad:' || (e.metadata->>'impressionId')
          ELSE 'row:' || e.id::text
        END
      ORDER BY e.created_at, e.id
    ) AS n
  FROM creator_earnings e
  LEFT JOIN creators c ON c.id = e.creator_id
  LEFT JOIN videos v ON v.id = e.content_id
  WHERE e.source IN ('view', 'ad_share')
)
SELECT *
FROM ranked
WHERE n > 1
ORDER BY created_at, id;

SELECT
  COUNT(*)::int AS extra_rows,
  COALESCE(SUM(amount_kz), 0)::int AS extra_kz,
  COUNT(DISTINCT creator_id)::int AS creators
FROM (
  SELECT
    e.creator_id,
    e.amount_kz,
    ROW_NUMBER() OVER (
      PARTITION BY
        CASE
          WHEN e.source = 'view' AND e.metadata ? 'userId'
            THEN 'view:' || e.content_id::text || ':' || e.period_date::text || ':' || (e.metadata->>'userId')
          WHEN e.source = 'ad_share' AND e.metadata ? 'impressionId'
            THEN 'ad:' || (e.metadata->>'impressionId')
          ELSE 'row:' || e.id::text
        END
      ORDER BY e.created_at, e.id
    ) AS n
  FROM creator_earnings e
  WHERE e.source IN ('view', 'ad_share')
) ranked
WHERE n > 1;

-- 4. Índice único do livro (depois da 038 nova)
SELECT indexname
FROM pg_indexes
WHERE tablename = 'creator_earnings'
  AND indexname = 'creator_earnings_trace_key_uidx';
