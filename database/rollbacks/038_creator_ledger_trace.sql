-- Reversão de 038_creator_ledger_trace.sql
-- A 038 já não apaga linhas. Esta reversão só remove índice e coluna.

DROP INDEX IF EXISTS creator_earnings_trace_key_uidx;

ALTER TABLE creator_earnings
  DROP COLUMN IF EXISTS trace_key;
