-- Livro rastreável e índice único dos créditos.
-- Aplicar só com o plano de reversão em database/rollbacks/038_creator_ledger_trace.sql
-- Colapsa créditos de visualização ou anúncio duplicados (mesma pessoa/filme/dia ou mesma impressão), ficando o mais antigo.

ALTER TABLE creator_earnings
  ADD COLUMN IF NOT EXISTS trace_key TEXT;

DELETE FROM creator_earnings
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY creator_id, content_id, source, period_date,
                          COALESCE(metadata->>'userId', metadata->>'impressionId', id::text)
             ORDER BY created_at, id
           ) AS n
    FROM creator_earnings
    WHERE source IN ('view', 'ad_share')
  ) ranked
  WHERE n > 1
);

UPDATE creator_earnings
SET trace_key = CASE
  WHEN source = 'view' AND metadata ? 'userId'
    THEN 'view:' || content_id::text || ':' || period_date::text || ':' || (metadata->>'userId')
  WHEN source = 'ad_share' AND metadata ? 'impressionId'
    THEN 'ad:' || (metadata->>'impressionId')
  ELSE trace_key
END
WHERE trace_key IS NULL
  AND source IN ('view', 'ad_share');

CREATE UNIQUE INDEX IF NOT EXISTS creator_earnings_trace_key_uidx
  ON creator_earnings (trace_key)
  WHERE trace_key IS NOT NULL;
