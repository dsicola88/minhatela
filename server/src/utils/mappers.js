'use strict';

function mapContentPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    synopsisShort: row.synopsis_short ?? row.synopsisShort,
    synopsisFull: row.synopsis_full ?? row.synopsisFull,
    cast: row.cast_text ?? row.cast,
    creatorName: row.creator_name ?? row.creatorName,
    posterUrl: row.poster_url ?? row.posterUrl,
    backdropUrl: row.backdrop_url ?? row.backdropUrl,
    trailerUrl: row.trailer_url ?? row.trailerUrl,
    monetization: row.monetization,
    rentalPriceKz: row.rental_price_kz ?? row.rentalPriceKz,
    durationSeconds: row.duration_seconds ?? row.durationSeconds,
    releaseYear: row.release_year ?? row.releaseYear,
    isFeatured: row.is_featured ?? row.isFeatured,
    isOriginal: Boolean(row.is_original ?? row.isOriginal),
    maturityRating: row.maturity_rating ?? row.maturityRating ?? 12,
    kind: row.kind || 'movie',
    seriesId: row.series_id ?? row.seriesId ?? null,
    seasonNumber: row.season_number ?? row.seasonNumber ?? null,
    episodeNumber: row.episode_number ?? row.episodeNumber ?? null,
    episodeTitle: row.episode_title ?? row.episodeTitle ?? null,
    introEndSeconds: row.intro_end_seconds ?? row.introEndSeconds ?? null,
    recapEndSeconds: row.recap_end_seconds ?? row.recapEndSeconds ?? null,
    creditsStartSeconds: row.credits_start_seconds ?? row.creditsStartSeconds ?? null,
    postCreditsStartSeconds:
      row.post_credits_start_seconds ?? row.postCreditsStartSeconds ?? null,
    comingSoonAt: row.coming_soon_at ?? row.comingSoonAt ?? null,
    releasedAt: row.released_at ?? row.releasedAt ?? null,
    advisories: Array.isArray(row.advisories)
      ? row.advisories
      : row.advisories
        ? [row.advisories]
        : [],
    languages: Array.isArray(row.languages) ? row.languages : row.languages ? [row.languages] : ['pt'],
    subtitleLanguages: Array.isArray(row.subtitle_languages)
      ? row.subtitle_languages
      : row.subtitleLanguages || ['pt'],
    categories: row.categories || [],
  };
}

function mapContentInternal(row) {
  const pub = mapContentPublic(row);
  return {
    ...pub,
    bunnyVideoId: row.bunny_video_id ?? row.bunnyVideoId,
    isPublished: row.is_published ?? row.isPublished,
  };
}

function mapContentCard(item) {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    synopsisShort: item.synopsisShort || item.synopsis_short,
    posterUrl: item.posterUrl || item.poster_url,
    backdropUrl: item.backdropUrl || item.backdrop_url,
    trailerUrl: item.trailerUrl || item.trailer_url || null,
    monetization: item.monetization,
    rentalPriceKz: item.rentalPriceKz ?? item.rental_price_kz,
    releaseYear: item.releaseYear ?? item.release_year,
    kind: item.kind || 'movie',
    maturityRating: item.maturityRating ?? item.maturity_rating,
  };
}

function mapEpisodeCard(row, progress) {
  const base = mapContentPublic(row);
  const label = `T${row.season_number}:E${row.episode_number}`;
  return {
    ...base,
    label,
    displayTitle: row.episode_title || row.title,
    progress: progress
      ? {
          positionSeconds: progress.position_seconds,
          durationSeconds: progress.duration_seconds,
          completed: progress.completed,
          percentage:
            progress.duration_seconds > 0
              ? Math.min(
                  99,
                  Math.round((progress.position_seconds / progress.duration_seconds) * 100)
                )
              : 0,
        }
      : null,
  };
}

module.exports = {
  mapContentPublic,
  mapContentInternal,
  mapContentCard,
  mapEpisodeCard,
};
