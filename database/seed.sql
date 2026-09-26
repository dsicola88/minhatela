-- Seed de demonstração · MinhaTela
-- Executar após schema.sql (substituir bunny_video_id reais)

INSERT INTO videos (
  title, slug, synopsis_short, synopsis_full, cast_text, creator_name,
  poster_url, backdrop_url, bunny_video_id, monetization, rental_price_kz,
  duration_seconds, release_year, is_featured
) VALUES
(
  'Luanda Nights',
  'luanda-nights',
  'Uma noite em Luanda muda o destino de três estranhos.',
  'Numa Luanda pulsante, três vidas cruzam-se entre música, risco e redenção. Um thriller urbano angolano com ritmo de cidade e alma de cinema.',
  'Aisha Mendes, João Neto, Carla dos Santos',
  'Estúdios Baía',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800',
  'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1600',
  'demo-bunny-luanda',
  'avod',
  NULL,
  6420,
  2024,
  TRUE
),
(
  'Independência',
  'independencia',
  'A luta que forjou uma nação, contada sem filtros.',
  'Documentário épico sobre a independência de Angola, com arquivos raros e depoimentos exclusivos.',
  'Narrado por Miguel Ângelo',
  'Arquivo Nacional Cinema',
  'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600',
  'demo-bunny-independencia',
  'svod',
  NULL,
  5400,
  2023,
  FALSE
),
(
  'O Último Cineasta',
  'o-ultimo-cineasta',
  'Um realizador independente arrisca tudo por um filme.',
  'Drama sobre a persistência do cinema independente angolano. Disponível em aluguer por 48 horas.',
  'Pedro Vemba, Nádia Cruz',
  'Casa da Imagem',
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600',
  'demo-bunny-cineasta',
  'tvod',
  1500,
  5880,
  2025,
  FALSE
);

INSERT INTO video_categories (video_id, category_id)
SELECT v.id, c.id
FROM videos v
CROSS JOIN categories c
WHERE (v.slug = 'luanda-nights' AND c.slug IN ('cinema-angolano', 'destaques'))
   OR (v.slug = 'independencia' AND c.slug IN ('documentarios', 'destaques'))
   OR (v.slug = 'o-ultimo-cineasta' AND c.slug IN ('cinema-angolano', 'web-series'));
