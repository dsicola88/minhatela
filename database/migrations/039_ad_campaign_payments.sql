-- Publicidade paga de verdade: orçamento = transação. IBAN agora; WeFrame no mesmo checkout.
-- Pendente não entrega. Recusa/reembolso tira o financiamento.

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'ad_campaign';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_campaign_idx ON transactions(campaign_id);

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS funded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS funded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

-- Campanhas já no ar antes desta regra não saem do ecrã.
UPDATE campaigns
SET funded = TRUE, funded_at = COALESCE(funded_at, NOW())
WHERE status IN ('active', 'paused', 'completed')
  AND funded = FALSE;

CREATE OR REPLACE FUNCTION fund_ad_campaign_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'ad_campaign' AND NEW.campaign_id IS NOT NULL THEN
    IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
      UPDATE campaigns
      SET funded = TRUE,
          funded_at = COALESCE(NEW.paid_at, NOW()),
          transaction_id = NEW.id,
          updated_at = NOW()
      WHERE id = NEW.campaign_id;
    ELSIF NEW.status IN ('rejeitado', 'reembolsado') THEN
      UPDATE campaigns
      SET funded = FALSE,
          status = CASE
            WHEN status = 'active' THEN 'paused'::campaign_status
            ELSE status
          END,
          updated_at = NOW()
      WHERE id = NEW.campaign_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fund_ad_campaign ON transactions;
CREATE TRIGGER trg_fund_ad_campaign
AFTER UPDATE OF status ON transactions
FOR EACH ROW EXECUTE PROCEDURE fund_ad_campaign_on_payment();
