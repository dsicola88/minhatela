-- MinhaTela · Séries / Temporadas / Episódios (nível Netflix)

DO $$ BEGIN
  CREATE TYPE content_kind AS ENUM ('movie', 'series', 'episode');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS kind content_kind NOT NULL DEFAULT 'movie',
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS season_number SMALLINT,
  ADD COLUMN IF NOT EXISTS episode_number SMALLINT,
  ADD COLUMN IF NOT EXISTS episode_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS intro_end_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS credits_start_seconds INTEGER;

-- Séries-mãe não precisam de asset Bunny
ALTER TABLE videos ALTER COLUMN bunny_video_id DROP NOT NULL;

ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_kind_series_check;
ALTER TABLE videos ADD CONSTRAINT videos_kind_series_check CHECK (
  (kind = 'movie' AND series_id IS NULL AND bunny_video_id IS NOT NULL)
  OR (kind = 'series' AND series_id IS NULL)
  OR (
    kind = 'episode'
    AND series_id IS NOT NULL
    AND season_number IS NOT NULL
    AND episode_number IS NOT NULL
    AND bunny_video_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS videos_episode_uidx
  ON videos(series_id, season_number, episode_number)
  WHERE kind = 'episode';

CREATE INDEX IF NOT EXISTS videos_series_kind_idx ON videos(kind, series_id);
CREATE INDEX IF NOT EXISTS videos_series_list_idx ON videos(series_id, season_number, episode_number);

-- Seed: web-série demo "Kazukuta" (AVOD)
INSERT INTO videos (
  title, slug, synopsis_short, synopsis_full, cast_text, creator_name,
  poster_url, backdrop_url, bunny_video_id, monetization,
  duration_seconds, release_year, is_featured, is_published, workflow_status,
  kind, maturity_rating
)
SELECT
  'Kazukuta',
  'kazukuta',
  'Ritmo, rua e sobrevivência numa Luanda que nunca dorme.',
  'Web-série angolana sobre um colectivo de artistas que luta por espaço, identidade e futuro na capital.',
  'Aisha Mendes, João Neto, Carla dos Santos',
  'Estúdios Baía',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600',
  NULL,
  'avod',
  0,
  2025,
  TRUE,
  TRUE,
  'published',
  'series',
  12
WHERE NOT EXISTS (SELECT 1 FROM videos WHERE slug = 'kazukuta');

INSERT INTO videos (
  title, slug, synopsis_short, synopsis_full, cast_text, creator_name,
  poster_url, backdrop_url, bunny_video_id, monetization,
  duration_seconds, release_year, is_featured, is_published, workflow_status,
  kind, series_id, season_number, episode_number, episode_title,
  intro_end_seconds, credits_start_seconds, maturity_rating, rental_price_kz
)
SELECT
  'Kazukuta · T1E' || e.ep,
  'kazukuta-s1e' || e.ep,
  e.synopsis,
  e.synopsis || ' Episódio da web-série Kazukuta.',
  'Aisha Mendes, João Neto',
  'Estúdios Baía',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600',
  'demo-bunny-kazukuta-s1e' || e.ep,
  'avod',
  e.duration,
  2025,
  FALSE,
  TRUE,
  'published',
  'episode',
  s.id,
  1,
  e.ep,
  e.ep_title,
  45,
  e.duration - 90,
  12,
  NULL
FROM videos s
CROSS JOIN (
  VALUES
    (1, 'Primeiro Beat', 'O colectivo encontra o seu primeiro palco — e o primeiro conflito.', 1320),
    (2, 'Som da Baía', 'Um show na Marginal força escolhas que ninguém queria fazer.', 1410),
    (3, 'Noite Longa', 'Traição no estúdio. A música continua, a confiança não.', 1500)
) AS e(ep, ep_title, synopsis, duration)
WHERE s.slug = 'kazukuta'
  AND NOT EXISTS (
    SELECT 1 FROM videos v
    WHERE v.series_id = s.id AND v.season_number = 1 AND v.episode_number = e.ep
  );

INSERT INTO video_categories (video_id, category_id)
SELECT v.id, c.id
FROM videos v
CROSS JOIN categories c
WHERE v.slug = 'kazukuta'
  AND c.slug IN ('web-series', 'destaques', 'cinema-angolano')
ON CONFLICT DO NOTHING;
