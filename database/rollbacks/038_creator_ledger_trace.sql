-- Reversão de 038_creator_ledger_trace.sql
-- Não repõe linhas de crédito duplicadas que a migração tenha removido.
-- Essas linhas violavam a regra de um crédito por pessoa, filme e dia.

DROP INDEX IF EXISTS creator_earnings_trace_key_uidx;

ALTER TABLE creator_earnings
  DROP COLUMN IF EXISTS trace_key;
