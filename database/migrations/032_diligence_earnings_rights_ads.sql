-- Ledger + direitos fail-closed + ads facturáveis
-- Não depende das migrações 029–031 (tenants/MFA).

INSERT INTO content_rights (
  content_id, owner_name, territory, license_type, status, avod_allowed, svod_allowed, tvod_allowed
)
SELECT
  v.id,
  COALESCE(NULLIF(v.creator_name, ''), 'MinhaTela'),
  'AO',
  'legacy_backfill',
  'active',
  TRUE,
  TRUE,
  TRUE
FROM videos v
WHERE NOT EXISTS (
  SELECT 1 FROM content_rights r WHERE r.content_id = v.id
);

CREATE INDEX IF NOT EXISTS creator_earnings_view_dedupe_idx
  ON creator_earnings (creator_id, content_id, source, period_date);
