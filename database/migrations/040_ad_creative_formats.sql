-- 040 · Formato do criativo: imagem, vídeo ou carrossel (além do MP4 por ligação).

ALTER TABLE ad_creatives
  ADD COLUMN IF NOT EXISTS media_kind VARCHAR(20) NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS cards JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE ad_creatives DROP CONSTRAINT IF EXISTS ad_creatives_media_kind_check;
ALTER TABLE ad_creatives
  ADD CONSTRAINT ad_creatives_media_kind_check
  CHECK (media_kind IN ('image', 'video', 'carousel'));
