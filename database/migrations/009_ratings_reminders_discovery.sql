-- MinhaTela · Ratings, Remind Me, discovery facets

CREATE TABLE IF NOT EXISTS content_ratings (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, content_id)
);

CREATE INDEX IF NOT EXISTS content_ratings_content_idx
  ON content_ratings(content_id, rating);

CREATE TABLE IF NOT EXISTS content_reminders (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS content_reminders_user_idx
  ON content_reminders(user_id, created_at DESC);

-- Trailers demo (YouTube public embeds — substituir por Bunny em produção)
UPDATE videos
SET trailer_url = 'https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1'
WHERE slug = 'luanda-nights' AND (trailer_url IS NULL OR trailer_url = '');

UPDATE videos
SET trailer_url = 'https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1&mute=1'
WHERE slug = 'kazukuta' AND (trailer_url IS NULL OR trailer_url = '');

UPDATE videos
SET trailer_url = 'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1&mute=1'
WHERE slug = 'baia-vermelha' AND (trailer_url IS NULL OR trailer_url = '');

UPDATE videos
SET genre = COALESCE(NULLIF(genre, ''), 'Cinema Angolano')
WHERE kind IN ('movie', 'series') AND (genre IS NULL OR genre = '');

UPDATE videos SET genre = 'Web-série' WHERE slug = 'kazukuta';
UPDATE videos SET genre = 'Documentário' WHERE slug = 'independencia';
UPDATE videos SET genre = 'Thriller' WHERE slug IN ('baia-vermelha', 'luanda-nights');
