-- Proofs duráveis (sobrevive a disco efémero), reembolso interno, índices de jobs.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS proof_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS proof_bytes BYTEA,
  ADD COLUMN IF NOT EXISTS proof_mime TEXT;

ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'reembolsado';

CREATE INDEX IF NOT EXISTS idx_users_premium_expiry
  ON users (premium_expires_at)
  WHERE subscription_status = 'premium_active'
    AND premium_expires_at IS NOT NULL
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_proof_url
  ON transactions (proof_url)
  WHERE proof_url IS NOT NULL;
