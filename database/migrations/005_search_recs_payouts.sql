-- 005 · Search, recommendations support, favorites, payouts enrichment

CREATE TABLE IF NOT EXISTS favorites (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, content_id)
);

CREATE INDEX IF NOT EXISTS favorites_profile_idx ON favorites(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_queries_created_idx ON search_queries(created_at DESC);

-- Full-text search support (Portuguese)
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE videos
SET search_vector =
  setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('portuguese', coalesce(synopsis_short, '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(genre, '')), 'C') ||
  setweight(to_tsvector('portuguese', coalesce(cast_text, '')), 'C') ||
  setweight(to_tsvector('portuguese', coalesce(creator_name, '')), 'C')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS videos_search_idx ON videos USING GIN (search_vector);

CREATE OR REPLACE FUNCTION videos_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.synopsis_short, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.genre, '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.cast_text, '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.creator_name, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS videos_search_vector_trigger ON videos;
CREATE TRIGGER videos_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, synopsis_short, genre, cast_text, creator_name
ON videos
FOR EACH ROW EXECUTE PROCEDURE videos_search_vector_update();

ALTER TABLE creator_payouts
  ADD COLUMN IF NOT EXISTS method VARCHAR(40) DEFAULT 'iban',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
