-- Livro rastreável. Não apaga linhas.
-- Só a linha mais antiga de cada grupo de visualização/anúncio recebe trace_key.
-- Duplicados ficam com trace_key NULL para inspecção (npm run inspect-pre-boot).
-- A limpeza dessas linhas é um passo à parte, nunca deste ficheiro.
-- Reversão: database/rollbacks/038_creator_ledger_trace.sql (não recria linhas).

ALTER TABLE creator_earnings
  ADD COLUMN IF NOT EXISTS trace_key TEXT;

UPDATE creator_earnings e
SET trace_key = ranked.key
FROM (
  SELECT
    id,
    CASE
      WHEN source = 'view' AND metadata ? 'userId'
        THEN 'view:' || content_id::text || ':' || period_date::text || ':' || (metadata->>'userId')
      WHEN source = 'ad_share' AND metadata ? 'impressionId'
        THEN 'ad:' || (metadata->>'impressionId')
      ELSE NULL
    END AS key,
    ROW_NUMBER() OVER (
      PARTITION BY
        CASE
          WHEN source = 'view' AND metadata ? 'userId'
            THEN 'view:' || content_id::text || ':' || period_date::text || ':' || (metadata->>'userId')
          WHEN source = 'ad_share' AND metadata ? 'impressionId'
            THEN 'ad:' || (metadata->>'impressionId')
          ELSE 'row:' || id::text
        END
      ORDER BY created_at, id
    ) AS n
  FROM creator_earnings
  WHERE source IN ('view', 'ad_share')
) ranked
WHERE e.id = ranked.id
  AND e.trace_key IS NULL
  AND ranked.n = 1
  AND ranked.key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creator_earnings_trace_key_uidx
  ON creator_earnings (trace_key)
  WHERE trace_key IS NOT NULL;
