-- Rascunho de filme no estúdio pode existir sem ficheiro; só o catálogo (publicado) exige o vídeo.

ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_kind_series_check;
ALTER TABLE videos ADD CONSTRAINT videos_kind_series_check CHECK (
  (kind = 'movie' AND series_id IS NULL AND (bunny_video_id IS NOT NULL OR is_published IS NOT TRUE))
  OR (kind = 'series' AND series_id IS NULL)
  OR (
    kind = 'episode'
    AND series_id IS NOT NULL
    AND season_number IS NOT NULL
    AND episode_number IS NOT NULL
    AND bunny_video_id IS NOT NULL
  )
);
