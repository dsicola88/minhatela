-- MinhaTela · Fase 20: Watch Together · cast/people · feedback · chapters · still watching

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) NOT NULL UNIQUE,
  full_name VARCHAR(180) NOT NULL,
  role_default VARCHAR(40) NOT NULL DEFAULT 'actor',
  bio TEXT,
  photo_url TEXT,
  nationality VARCHAR(80) DEFAULT 'AO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_people (
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role VARCHAR(40) NOT NULL DEFAULT 'actor',
  character_name VARCHAR(120),
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (content_id, person_id, role)
);

CREATE INDEX IF NOT EXISTS content_people_person_idx ON content_people(person_id);

CREATE TABLE IF NOT EXISTS content_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  start_seconds INT NOT NULL CHECK (start_seconds >= 0),
  end_seconds INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_chapters_content_idx
  ON content_chapters(content_id, sort_order);

CREATE TABLE IF NOT EXISTS watch_party_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  playback_session_id UUID,
  position_seconds INT NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended')),
  max_members INT NOT NULL DEFAULT 8,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS watch_party_active_idx
  ON watch_party_rooms(status, last_sync_at DESC)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS watch_party_members (
  room_id UUID NOT NULL REFERENCES watch_party_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  display_name VARCHAR(80),
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS playback_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  session_id UUID,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  nps SMALLINT CHECK (nps BETWEEN 0 AND 10),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, content_id, session_id)
);

CREATE INDEX IF NOT EXISTS playback_feedback_content_idx
  ON playback_feedback(content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS still_watching_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  content_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  challenged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'expired', 'ended'))
);

CREATE INDEX IF NOT EXISTS still_watching_pending_idx
  ON still_watching_challenges(user_id, status)
  WHERE status = 'pending';

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('watch_together_enabled', TRUE, 'Salas Watch Together', '{}'),
  ('playback_feedback_enabled', TRUE, 'Feedback pós-créditos', '{}'),
  ('still_watching_enabled', TRUE, 'Desafio Ainda a ver?', '{}')
ON CONFLICT (key) DO NOTHING;

-- Seed people from cast_text (best-effort split)
INSERT INTO people (slug, full_name, role_default, nationality)
SELECT
  lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')),
  trim(name),
  'actor',
  'AO'
FROM (
  SELECT DISTINCT unnest(string_to_array(cast_text, ',')) AS name
  FROM videos
  WHERE cast_text IS NOT NULL AND length(trim(cast_text)) > 2
) s
WHERE length(trim(name)) > 1
ON CONFLICT (slug) DO NOTHING;

INSERT INTO content_people (content_id, person_id, role, sort_order)
SELECT v.id, p.id, 'actor', row_number() OVER (PARTITION BY v.id ORDER BY p.full_name)
FROM videos v
JOIN LATERAL unnest(string_to_array(v.cast_text, ',')) WITH ORDINALITY AS t(name, ord) ON TRUE
JOIN people p ON p.slug = lower(regexp_replace(trim(t.name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE v.cast_text IS NOT NULL
ON CONFLICT DO NOTHING;

-- Demo chapters for published movies/episodes with duration
INSERT INTO content_chapters (content_id, title, start_seconds, end_seconds, sort_order)
SELECT v.id, 'Abertura', 0, LEAST(90, COALESCE(v.duration_seconds/10, 90)), 0
FROM videos v
WHERE v.is_published = TRUE
  AND v.kind IN ('movie', 'episode')
  AND COALESCE(v.duration_seconds, 0) > 120
  AND NOT EXISTS (SELECT 1 FROM content_chapters c WHERE c.content_id = v.id)
ON CONFLICT DO NOTHING;

INSERT INTO content_chapters (content_id, title, start_seconds, end_seconds, sort_order)
SELECT v.id, 'Meio', GREATEST(120, v.duration_seconds/2 - 30),
       LEAST(v.duration_seconds - 60, v.duration_seconds/2 + 120), 1
FROM videos v
WHERE v.is_published = TRUE
  AND v.kind IN ('movie', 'episode')
  AND COALESCE(v.duration_seconds, 0) > 600
  AND (SELECT COUNT(*) FROM content_chapters c WHERE c.content_id = v.id) = 1
ON CONFLICT DO NOTHING;
