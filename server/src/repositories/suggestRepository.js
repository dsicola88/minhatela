'use strict';

const { query } = require('../config/database');
const { videoTenantSql } = require('../utils/tenantScope');

async function suggest({ q, limit = 8, maturityMax = 18 }) {
  const term = String(q || '').trim();
  if (term.length < 1) return { titles: [], genres: [], creators: [], people: [] };

  const [titles, genres, creators, people] = await Promise.all([
    query(
      `SELECT id, title, slug, kind, poster_url, monetization, release_year
       FROM videos v
       WHERE v.kind IN ('movie', 'series')
         AND ${videoTenantSql('v')}
         AND (
           (v.is_published = TRUE AND v.workflow_status = 'published')
           OR (v.coming_soon_at IS NOT NULL AND v.coming_soon_at > NOW())
         )
         AND v.maturity_rating <= $2
         AND (
           v.title ILIKE $1 || '%'
           OR v.title ILIKE '%' || $1 || '%'
           OR v.search_vector @@ plainto_tsquery('portuguese', $1)
         )
       ORDER BY
         CASE WHEN lower(v.title) LIKE lower($1) || '%' THEN 0 ELSE 1 END,
         v.updated_at DESC
       LIMIT $3`,
      [term, maturityMax, Math.min(12, Number(limit) || 8)]
    ),
    query(
      `SELECT DISTINCT v.genre
       FROM videos v
       WHERE v.genre IS NOT NULL
         AND v.genre ILIKE '%' || $1 || '%'
         AND v.is_published = TRUE
         AND ${videoTenantSql('v')}
       ORDER BY genre
       LIMIT 6`,
      [term]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT DISTINCT v.creator_name
       FROM videos v
       WHERE v.creator_name IS NOT NULL
         AND v.creator_name ILIKE '%' || $1 || '%'
         AND v.is_published = TRUE
         AND ${videoTenantSql('v')}
       ORDER BY creator_name
       LIMIT 6`,
      [term]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT full_name
       FROM people
       WHERE full_name ILIKE '%' || $1 || '%'
       ORDER BY full_name
       LIMIT 6`,
      [term]
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    query: term,
    titles: titles.rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      kind: r.kind,
      posterUrl: r.poster_url,
      monetization: r.monetization,
      releaseYear: r.release_year,
      type: 'title',
    })),
    genres: genres.rows.map((r) => ({ label: r.genre, type: 'genre' })),
    creators: creators.rows.map((r) => ({ label: r.creator_name, type: 'creator' })),
    people: (people.rows || []).map((r) => ({ label: r.full_name, type: 'person' })),
  };
}

module.exports = { suggest };
