-- MinhaTela · PostgreSQL Schema (Enterprise)
-- Mercado: Angola | Monetização: AVOD / SVOD / TVOD

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE monetization_model AS ENUM ('avod', 'svod', 'tvod');
CREATE TYPE subscription_status AS ENUM ('none', 'premium_active', 'premium_expired');
CREATE TYPE transaction_status AS ENUM ('pendente', 'pago', 'rejeitado', 'expirado');
CREATE TYPE payment_method AS ENUM ('iban', 'multicaixa');
CREATE TYPE transaction_type AS ENUM ('subscription', 'rental');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  subscription_status subscription_status NOT NULL DEFAULT 'none',
  premium_expires_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  avatar_url TEXT,
  is_kids BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_per_user_limit CHECK (sort_order BETWEEN 0 AND 3)
);

CREATE UNIQUE INDEX profiles_user_sort_uidx ON profiles(user_id, sort_order);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  synopsis_short TEXT NOT NULL,
  synopsis_full TEXT NOT NULL,
  cast_text TEXT,
  creator_name VARCHAR(180),
  poster_url TEXT NOT NULL,
  backdrop_url TEXT NOT NULL,
  trailer_url TEXT,
  bunny_video_id VARCHAR(120) NOT NULL,
  monetization monetization_model NOT NULL DEFAULT 'avod',
  rental_price_kz INTEGER,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  release_year SMALLINT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tvod_requires_price CHECK (
    monetization <> 'tvod' OR rental_price_kz IS NOT NULL
  )
);

CREATE TABLE video_categories (
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, category_id)
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  payment_method payment_method NOT NULL,
  amount_kz INTEGER NOT NULL CHECK (amount_kz > 0),
  status transaction_status NOT NULL DEFAULT 'pendente',
  proof_url TEXT,
  admin_notes TEXT,
  paid_at TIMESTAMPTZ,
  access_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX transactions_user_status_idx ON transactions(user_id, status);
CREATE INDEX transactions_video_status_idx ON transactions(video_id, status);

CREATE TABLE rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_window_valid CHECK (expires_at > starts_at)
);

CREATE UNIQUE INDEX rentals_active_uidx ON rentals(user_id, video_id);

CREATE TABLE watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, video_id)
);

CREATE TABLE ad_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  placement VARCHAR(40) NOT NULL DEFAULT 'pre_roll',
  provider VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER videos_updated_at
BEFORE UPDATE ON videos
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE OR REPLACE FUNCTION activate_paid_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    NEW.paid_at = COALESCE(NEW.paid_at, NOW());

    IF NEW.type = 'subscription' THEN
      UPDATE users
      SET subscription_status = 'premium_active',
          premium_expires_at = NOW() + INTERVAL '30 days'
      WHERE id = NEW.user_id;
    END IF;

    IF NEW.type = 'rental' AND NEW.video_id IS NOT NULL THEN
      NEW.access_expires_at = NEW.paid_at + INTERVAL '48 hours';

      INSERT INTO rentals (user_id, video_id, transaction_id, starts_at, expires_at)
      VALUES (NEW.user_id, NEW.video_id, NEW.id, NEW.paid_at, NEW.paid_at + INTERVAL '48 hours')
      ON CONFLICT (user_id, video_id)
      DO UPDATE SET
        transaction_id = EXCLUDED.transaction_id,
        starts_at = EXCLUDED.starts_at,
        expires_at = EXCLUDED.expires_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_activate_paid
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE PROCEDURE activate_paid_transaction();

INSERT INTO categories (slug, title, sort_order) VALUES
  ('cinema-angolano', 'Cinema Angolano', 1),
  ('web-series', 'Web-séries', 2),
  ('humor', 'Humor', 3),
  ('documentarios', 'Documentários', 4),
  ('destaques', 'Em Destaque', 5);
