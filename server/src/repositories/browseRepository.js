'use strict';

const { query } = require('../config/database');
const trendingRepository = require('./trendingRepository');
const engagementRepository = require('./engagementRepository');

function mapCard(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    synopsisShort: row.synopsis_short,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    monetization: row.monetization,
    rentalPriceKz: row.rental_price_kz,
    releaseYear: row.release_year,
    maturityRating: row.maturity_rating,
    kind: row.kind,
    genre: row.genre || null,
    badge: row.badge || null,
    comingSoonAt: row.coming_soon_at || null,
    releasedAt: row.released_at || null,
    rank: row.rank || null,
  };
}

async function listGenres() {
  const result = await query(
    `SELECT genre AS name, COUNT(*)::int AS count
     FROM videos
     WHERE is_published = TRUE
       AND workflow_status = 'published'
       AND kind IN ('movie', 'series')
       AND genre IS NOT NULL
       AND genre <> ''
     GROUP BY genre
     ORDER BY count DESC, genre ASC
     LIMIT 40`
  );
  return result.rows.map((r) => ({
    name: r.name,
    slug: String(r.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),
    count: r.count,
  }));
}

async function listByGenre(genre, maturityMax = 18, limit = 40) {
  const raw = String(genre || '').trim();
  const asName = raw.replace(/-/g, ' ');
  const result = await query(
    `SELECT id, title, slug, synopsis_short, poster_url, backdrop_url,
            monetization, rental_price_kz, release_year, maturity_rating,
            kind, genre
     FROM videos
     WHERE is_published = TRUE
       AND workflow_status = 'published'
       AND kind IN ('movie', 'series')
       AND maturity_rating <= $3
       AND (
         genre ILIKE $1
         OR genre ILIKE $2
       )
     ORDER BY COALESCE(released_at, created_at) DESC
     LIMIT $4`,
    [raw, asName, maturityMax, Math.min(60, Number(limit) || 40)]
  );
  return result.rows.map(mapCard);
}

async function getNewAndHot(maturityMax = 18) {
  const [comingSoon, newReleases, top10, worth] = await Promise.all([
    engagementRepository.listComingSoon(maturityMax, 20),
    engagementRepository.listNewReleases(maturityMax, 20),
    trendingRepository.listTopAngola(maturityMax, 10, 7),
    query(
      `SELECT id, title, slug, synopsis_short, poster_url, backdrop_url,
              monetization, rental_price_kz, release_year, maturity_rating,
              kind, genre
       FROM videos
       WHERE is_published = TRUE
         AND workflow_status = 'published'
         AND kind IN ('movie', 'series')
         AND maturity_rating <= $1
         AND is_featured = TRUE
       ORDER BY updated_at DESC
       LIMIT 12`,
      [maturityMax]
    ).then((r) => r.rows.map((row) => mapCard({ ...row, badge: 'DESTAQUE' }))),
  ]);

  return {
    tabs: [
      {
        id: 'coming-soon',
        title: 'Em breve',
        subtitle: 'Estreias angolanas a caminho',
        items: comingSoon,
      },
      {
        id: 'everyone-watching',
        title: 'Toda a gente está a ver',
        subtitle: 'Top 10 em Angola esta semana',
        items: top10,
      },
      {
        id: 'new-releases',
        title: 'Novidades',
        subtitle: 'Lançados nos últimos 45 dias',
        items: newReleases,
      },
      {
        id: 'worth-the-wait',
        title: 'Vale a pena esperar',
        subtitle: 'Destaques da MinhaTela',
        items: worth,
      },
    ],
  };
}

async function browseHome(maturityMax = 18) {
  const genres = await listGenres();
  const rows = [];
  for (const g of genres.slice(0, 8)) {
    const videos = await listByGenre(g.name, maturityMax, 16);
    if (videos.length) {
      rows.push({
        id: `genre-${g.slug}`,
        slug: g.slug,
        title: g.name,
        videos,
      });
    }
  }
  return { genres, rows };
}

module.exports = {
  listGenres,
  listByGenre,
  getNewAndHot,
  browseHome,
  mapCard,
};
