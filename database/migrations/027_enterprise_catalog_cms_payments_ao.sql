-- MinhaTela · Fase 28c: enterprise parity · catalog CMS · payments bank AO · packs admin

-- Enrich payments config with Angola bank details (editável no Console)
UPDATE app_settings
SET value = value || '{
  "bankName": "Banco Angolano (exemplo)",
  "bankAccountName": "MinhaTela, Lda",
  "iban": "AO06 0000 0000 0000 0000 0000 0",
  "multicaixaEntity": "00000",
  "multicaixaReferenceHint": "Usar referência da transação MinhaTela",
  "supportWhatsapp": "+244900000000"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'payments';

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
(
  'catalog_cms_admin_enabled',
  TRUE,
  'CMS de catálogo no Console (publicar, featured, monetização)',
  '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
