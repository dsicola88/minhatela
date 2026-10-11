-- Checkout GPO EMIS WeFrame (iFrame) — método sem comprovativo; o webhook liberta o acesso.

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'weframe';
