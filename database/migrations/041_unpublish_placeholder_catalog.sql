-- Tira do catálogo filmes e episódios de demonstração ou sem vídeo real.
-- Séries-mãe sem asset continuam válidas se tiverem um episódio com GUID Bunny.

UPDATE videos
SET
  is_published = FALSE,
  is_featured = FALSE,
  coming_soon_at = NULL,
  workflow_status = CASE
    WHEN workflow_status = 'published' THEN 'approved'::content_workflow
    ELSE workflow_status
  END,
  updated_at = NOW()
WHERE kind IN ('movie', 'episode')
  AND (
    bunny_video_id IS NULL
    OR btrim(bunny_video_id) = ''
    OR bunny_video_id ILIKE 'pending-%'
    OR bunny_video_id ILIKE 'demo-bunny-%'
    OR bunny_video_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

UPDATE videos AS series
SET
  is_published = FALSE,
  is_featured = FALSE,
  coming_soon_at = NULL,
  workflow_status = CASE
    WHEN series.workflow_status = 'published' THEN 'approved'::content_workflow
    ELSE series.workflow_status
  END,
  updated_at = NOW()
WHERE series.kind = 'series'
  AND (
    series.slug IN ('kazukuta', 'luanda-nights', 'independencia', 'o-ultimo-cineasta', 'baia-vermelha')
    OR series.bunny_video_id ILIKE 'demo-bunny-%'
    OR series.bunny_video_id ILIKE 'pending-%'
  );

-- Remove o catálogo de demonstração. Rascunhos reais (pending- de um criador) ficam.
DELETE FROM videos
WHERE slug IN ('kazukuta', 'luanda-nights', 'independencia', 'o-ultimo-cineasta', 'baia-vermelha')
   OR slug ILIKE 'kazukuta-%'
   OR bunny_video_id ILIKE 'demo-bunny-%';

DELETE FROM production_companies
WHERE name ILIKE '%e2e%';

DELETE FROM users
WHERE email ILIKE '%e2e%@minhatela.ao'
   OR email ILIKE '%@minhatela.test'
   OR email ILIKE 'hls-e2e-%';
