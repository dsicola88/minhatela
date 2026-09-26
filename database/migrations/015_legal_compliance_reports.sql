-- MinhaTela · Fase 17: legal · consentimentos · compliance · denúncias

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type VARCHAR(40) NOT NULL,
  version VARCHAR(20) NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt-AO',
  title VARCHAR(200) NOT NULL,
  body_md TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doc_type, version, locale)
);

CREATE INDEX IF NOT EXISTS legal_documents_current_idx
  ON legal_documents(doc_type, locale)
  WHERE is_current = TRUE;

CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type VARCHAR(40) NOT NULL,
  doc_version VARCHAR(20) NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt-AO',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip VARCHAR(64),
  user_agent TEXT,
  UNIQUE (user_id, doc_type, doc_version)
);

CREATE INDEX IF NOT EXISTS user_consents_user_idx
  ON user_consents(user_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS account_data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ready',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS account_data_exports_user_idx
  ON account_data_exports(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason VARCHAR(40) NOT NULL,
  details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_user_id, content_id, reason)
);

CREATE INDEX IF NOT EXISTS content_reports_open_idx
  ON content_reports(status, created_at DESC)
  WHERE status = 'open';

-- Seed legal documents (versão 1.0 · Angola)
INSERT INTO legal_documents (doc_type, version, locale, title, body_md, is_current)
VALUES
(
  'terms',
  '1.0',
  'pt-AO',
  'Termos de Utilização · MinhaTela',
  E'# Termos de Utilização\n\n**Versão 1.0 · Efectiva em Angola**\n\n## 1. Serviço\nA MinhaTela Lda presta um serviço de streaming sob demanda (OTT) no mercado angolano, com conteúdos AVOD, SVOD e TVOD.\n\n## 2. Conta\nÉ responsável por manter a confidencialidade das credenciais e por toda a actividade na sua conta. Pode ter até 4 perfis.\n\n## 3. Pagamentos\nAssinaturas Premium e alugueres TVOD são pagos em Kwanzas (Kz) via IBAN ou Multicaixa Express, sujeitos a confirmação administrativa antes da activação.\n\n## 4. Licença de visualização\nO acesso é pessoal e intransferível. Downloads offline, quando disponíveis, são device-bound e expiram conforme o plano.\n\n## 5. Conduta\nÉ proibido partilhar credenciais comercialmente, contornar DRM/tokens, ou utilizar a plataforma para fins ilícitos.\n\n## 6. Cancelamento\nPode solicitar eliminação da conta com período de graça. Conteúdos alugados/assinaturas não são reembolsados após confirmação, salvo lei aplicável.\n\n## 7. Lei aplicável\nEstes termos regem-se pela legislação da República de Angola. Foro: Luanda.\n\nContacto: suporte@minhatela.ao',
  TRUE
),
(
  'privacy',
  '1.0',
  'pt-AO',
  'Política de Privacidade · MinhaTela',
  E'# Política de Privacidade\n\n**Versão 1.0 · Protecção de dados · Angola**\n\n## Dados que recolhemos\n- Identidade: nome, email, palavra-passe (hash)\n- Perfis: nome, preferências, maturidade, PIN (hash)\n- Utilização: progresso de visualização, pesquisas, dispositivos, sessões\n- Pagamentos: comprovativos IBAN/Multicaixa, valor em Kz\n- Técnicos: IP, user-agent, tokens push\n\n## Finalidades\nPrestação do serviço, autenticação, monetização, recomendações, prevenção de fraude, suporte e obrigações legais.\n\n## Bases legais\nExecução do contrato, consentimento (marketing/push quando aplicável) e interesse legítimo de segurança.\n\n## Partilha\nBunny.net (CDN/vídeo), processadores de email/push. Não vendemos dados pessoais.\n\n## Os seus direitos\nAceder, rectificar, exportar e solicitar eliminação da conta. Pedidos via Conta → Privacidade ou suporte@minhatela.ao.\n\n## Retenção\nDados activos enquanto a conta existir. Após eliminação definitiva, purga em até 30 dias (salvo retenção legal de facturação).\n\n## Contacto DPO\nprivacidade@minhatela.ao',
  TRUE
)
ON CONFLICT (doc_type, version, locale) DO NOTHING;

-- Admin reports queue flag (reuse feature_flags if present)
INSERT INTO feature_flags (key, enabled, description, payload)
VALUES ('content_reports_enabled', TRUE, 'Denúncias de conteúdo pelos utilizadores', '{}')
ON CONFLICT (key) DO NOTHING;
