-- MinhaTela · Fase 18: colecções editoriais · QoE · legendas · recibos

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_audio VARCHAR(10) NOT NULL DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS preferred_subtitles VARCHAR(10) NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS subtitle_size VARCHAR(10) NOT NULL DEFAULT 'medium';

CREATE TABLE IF NOT EXISTS editorial_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(240),
  sort_order INT NOT NULL DEFAULT 100,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  placement VARCHAR(40) NOT NULL DEFAULT 'home'
    CHECK (placement IN ('home', 'browse', 'new_hot')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS editorial_collections_home_idx
  ON editorial_collections(placement, sort_order)
  WHERE is_published = TRUE;

CREATE TABLE IF NOT EXISTS editorial_collection_items (
  collection_id UUID NOT NULL REFERENCES editorial_collections(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  badge VARCHAR(40),
  PRIMARY KEY (collection_id, content_id)
);

CREATE INDEX IF NOT EXISTS editorial_collection_items_content_idx
  ON editorial_collection_items(content_id);

CREATE TABLE IF NOT EXISTS playback_qoe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  session_id UUID,
  event_type VARCHAR(40) NOT NULL
    CHECK (event_type IN (
      'startup', 'buffering_start', 'buffering_end',
      'error', 'bitrate_change', 'ended', 'seek'
    )),
  startup_ms INT,
  bitrate_kbps INT,
  buffer_ms INT,
  error_code VARCHAR(80),
  quality VARCHAR(20),
  platform VARCHAR(40),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playback_qoe_created_idx
  ON playback_qoe_events(created_at DESC);

CREATE INDEX IF NOT EXISTS playback_qoe_content_idx
  ON playback_qoe_events(content_id, created_at DESC);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('editorial_collections_enabled', TRUE, 'Filas editoriais na Home', '{}'),
  ('search_suggest_enabled', TRUE, 'Autocomplete de pesquisa', '{}'),
  ('qoe_ingest_enabled', TRUE, 'Ingestão de métricas QoE do player', '{}')
ON CONFLICT (key) DO NOTHING;

-- Seed: colecção editorial Angola
INSERT INTO editorial_collections (slug, title, subtitle, sort_order, is_published, placement)
VALUES (
  'so-na-minhatela',
  'Só na MinhaTela',
  'Originais e exclusivos angolanos',
  10,
  TRUE,
  'home'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO editorial_collection_items (collection_id, content_id, sort_order, badge)
SELECT c.id, v.id, row_number() OVER (ORDER BY v.updated_at DESC), 'ORIGINAL'
FROM editorial_collections c
CROSS JOIN LATERAL (
  SELECT id, updated_at
  FROM videos
  WHERE is_published = TRUE
    AND workflow_status = 'published'
    AND kind IN ('movie', 'series')
  ORDER BY is_featured DESC, updated_at DESC
  LIMIT 12
) v
WHERE c.slug = 'so-na-minhatela'
ON CONFLICT DO NOTHING;
