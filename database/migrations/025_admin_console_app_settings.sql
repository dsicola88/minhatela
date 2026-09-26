-- MinhaTela · Fase 28: Admin Console · app_settings · onboarding · suporte ops

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value, description) VALUES
(
  'onboarding',
  '{
    "enabled": true,
    "slides": [
      {
        "id": "welcome",
        "title": "Bem-vindo à MinhaTela",
        "subtitle": "Cinema e séries feitos para Angola.",
        "cta": "Continuar"
      },
      {
        "id": "plans",
        "title": "Assista como quiser",
        "subtitle": "AVOD gratuito, Premium ou packs TVOD.",
        "cta": "Ver planos"
      },
      {
        "id": "profiles",
        "title": "Quem está a ver?",
        "subtitle": "Perfis pessoais com Continue Watching sincronizado.",
        "cta": "Começar"
      }
    ]
  }'::jsonb,
  'Slides de onboarding da app'
),
(
  'support',
  '{
    "email": "support@minhatela.net",
    "whatsapp": "+244900000000",
    "hours": "Seg–Sex 09:00–18:00 (WAT)",
    "slaHours": 24,
    "channels": ["app", "email", "whatsapp"]
  }'::jsonb,
  'Contactos e SLA de atendimento'
),
(
  'branding',
  '{
    "tagline": "A tua tela. A nossa Angola.",
    "homeAnnouncement": null,
    "maintenanceMessage": "MinhaTela em manutenção. Voltamos em breve."
  }'::jsonb,
  'Mensagens de marca e home'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
(
  'admin_console_v2_enabled',
  TRUE,
  'Command Center completo (atendimento, flags, editorial, config)',
  '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
