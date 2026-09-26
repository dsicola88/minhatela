-- Unpublish / hold titles without a real Bunny Stream GUID.
-- Safe for production: keeps rows, stops broken play on demo/pending IDs.
UPDATE videos
SET
  is_published = FALSE,
  workflow_status = CASE
    WHEN workflow_status = 'published' THEN 'approved'::content_workflow
    ELSE workflow_status
  END,
  updated_at = NOW()
WHERE
  bunny_video_id IS NULL
  OR bunny_video_id ILIKE 'pending-%'
  OR bunny_video_id ILIKE 'demo-bunny-%';
