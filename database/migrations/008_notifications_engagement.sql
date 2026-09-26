-- MinhaTela · Notificações, histórico, coming soon / novidades

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS coming_soon_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

UPDATE videos
SET released_at = COALESCE(released_at, created_at)
WHERE released_at IS NULL
  AND is_published = TRUE
  AND workflow_status = 'published'
  AND kind IN ('movie', 'series');

-- Coming soon demo (ainda não publicado para play — aparece em Em Breve)
INSERT INTO videos (
  title, slug, synopsis_short, synopsis_full, cast_text, creator_name,
  poster_url, backdrop_url, bunny_video_id, monetization,
  duration_seconds, release_year, is_featured, is_published, workflow_status,
  kind, maturity_rating, coming_soon_at, released_at
)
SELECT
  'Baía Vermelha',
  'baia-vermelha',
  'Um thriller costeiro que estreia em breve na MinhaTela.',
  'Quando um cargueiro desaparece ao largo de Luanda, uma investigadora confronta redes que ninguém ousa nomear.',
  'Nádia Cruz, Miguel Ângelo',
  'Casa da Imagem',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1600',
  'demo-bunny-baia',
  'svod',
  7200,
  2026,
  FALSE,
  FALSE,
  'approved',
  'movie',
  16,
  NOW() + INTERVAL '14 days',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM videos WHERE slug = 'baia-vermelha');

INSERT INTO video_categories (video_id, category_id)
SELECT v.id, c.id
FROM videos v
CROSS JOIN categories c
WHERE v.slug = 'baia-vermelha'
  AND c.slug IN ('cinema-angolano', 'destaques')
ON CONFLICT DO NOTHING;
