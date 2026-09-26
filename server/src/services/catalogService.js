'use strict';

const contentRepository = require('../repositories/contentRepository');
const playbackRepository = require('../repositories/playbackRepository');
const profileRepository = require('../repositories/profileRepository');
const seriesRepository = require('../repositories/seriesRepository');
const accessControlService = require('./accessControlService');
const recommendationService = require('./recommendationService');
const discoveryRepository = require('../repositories/discoveryRepository');
const discoveryService = require('./discoveryService');
const engagementRepository = require('../repositories/engagementRepository');
const { mapContentPublic, mapEpisodeCard } = require('../utils/mappers');
const { createError } = require('../utils/errors');
const { env } = require('../config/env');

async function resolveMaturityMax(userId, profileId) {
  if (!profileId || !userId) return 18;
  const profile = await profileRepository.findOwned(profileId, userId);
  return profile?.maturity_max ?? 18;
}

async function getHome({ userId, profileId, deviceId } = {}) {
  const maturityMax = await resolveMaturityMax(userId, profileId);
  const featuredRow = await contentRepository.findFeatured(maturityMax);
  const rows = await contentRepository.findHomeRows(maturityMax);

  let continueWatching = [];
  if (profileId) {
    const progress = await playbackRepository.listContinueWatching(
      profileId,
      12,
      maturityMax
    );
    const syncBadge = await require('./featureFlagService').isEnabled(
      'cw_sync_badge_enabled',
      true
    );
    continueWatching = progress.map((item) => {
      const isEpisode = item.kind === 'episode';
      const syncedFromOtherDevice =
        syncBadge &&
        Boolean(item.last_device_id) &&
        deviceId &&
        String(item.last_device_id) !== String(deviceId);
      return {
        id: item.id,
        title: isEpisode
          ? `${item.series_title || item.title} · T${item.season_number}:E${item.episode_number}`
          : item.title,
        slug: item.slug,
        synopsisShort: item.synopsis_short,
        posterUrl: item.poster_url,
        backdropUrl: item.backdrop_url,
        monetization: item.monetization,
        rentalPriceKz: item.rental_price_kz,
        releaseYear: item.release_year,
        maturityRating: item.maturity_rating,
        kind: item.kind || 'movie',
        seriesId: item.series_id || null,
        progress: {
          positionSeconds: item.position_seconds,
          durationSeconds: item.duration_seconds,
          percentage:
            item.duration_seconds > 0
              ? Math.min(99, Math.round((item.position_seconds / item.duration_seconds) * 100))
              : 0,
        },
        syncedFromOtherDevice: Boolean(syncedFromOtherDevice),
        lastDeviceName: item.last_device_name || null,
        lastSyncedAt: item.last_synced_at || item.updated_at,
      };
    });
  }

  const [forYou, because, favorites, newReleases, comingSoon, top10] = await Promise.all([
    recommendationService.forProfile(profileId, 16),
    recommendationService.becauseYouWatched(profileId, 12),
    profileId ? discoveryRepository.listFavorites(profileId) : Promise.resolve([]),
    engagementRepository.listNewReleases(maturityMax, 16),
    engagementRepository.listComingSoon(maturityMax, 12),
    require('../repositories/trendingRepository')
      .listTopAngola(maturityMax, 10, 7)
      .catch(() => []),
  ]);

  const filterMaturity = (list) =>
    (list || []).filter((v) => (v.maturityRating ?? v.maturity_rating ?? 12) <= maturityMax);

  const parentalRepository = require('../repositories/parentalRepository');
  const blockedIds = profileId
    ? new Set(await parentalRepository.listBlockedIds(profileId))
    : new Set();
  const filterBlocked = (list) =>
    (list || []).filter((v) => !blockedIds.has(v.id) && !blockedIds.has(v.seriesId));

  const catalogRows = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    videos: filterBlocked(row.videos),
  }));

  const prepend = [];

  const continueSafe = filterBlocked(continueWatching);
  if (continueSafe.length) {
    prepend.push({
      id: 'continue-watching',
      slug: 'continuar-a-assistir',
      title: 'Continuar a assistir',
      videos: continueSafe,
    });
  }

  const top10Safe = filterBlocked(top10);
  if (top10Safe.length) {
    prepend.push({
      id: 'top10-angola',
      slug: 'top-10-angola',
      title: 'Top 10 em Angola',
      videos: top10Safe,
      ranked: true,
    });
  }

  const forYouSafe = filterBlocked(filterMaturity(forYou));
  // Aplicar «não tenho interesse»
  let notInterestedSet = new Set();
  try {
    const forYouService = require('./forYouService');
    const filteredForYou = await forYouService.filterNotInterested(profileId, forYouSafe);
    const niIds = await require('../repositories/forYouRepository').listNotInterestedIds(profileId);
    notInterestedSet = new Set(niIds);
    if (filteredForYou.length) {
      prepend.push({
        id: 'for-you',
        slug: 'recomendados-para-si',
        title: 'Recomendados para si',
        videos: filteredForYou,
      });
    }
  } catch {
    if (forYouSafe.length) {
      prepend.push({
        id: 'for-you',
        slug: 'recomendados-para-si',
        title: 'Recomendados para si',
        videos: forYouSafe,
      });
    }
  }

  try {
    const forYouService = require('./forYouService');
    const originals = await forYouService.listOriginalsRow(maturityMax);
    const originalsSafe = filterBlocked(
      originals.filter((v) => !notInterestedSet.has(v.id))
    );
    if (originalsSafe.length) {
      prepend.push({
        id: 'originals',
        slug: 'originais-minhatela',
        title: 'Originais MinhaTela',
        videos: originalsSafe,
      });
    }
  } catch {
    /* optional */
  }

  const favoritesSafe = filterBlocked(
    filterMaturity(favorites).filter((v) => !notInterestedSet.has(v.id))
  );  if (favoritesSafe.length) {
    prepend.push({
      id: 'my-list',
      slug: 'a-minha-lista',
      title: 'A Minha Lista',
      videos: favoritesSafe,
    });
  }

  if (newReleases.length) {
    prepend.push({
      id: 'new-releases',
      slug: 'novidades',
      title: 'Novidades',
      videos: filterBlocked(newReleases),
    });
  }

  if (comingSoon.length) {
    prepend.push({
      id: 'coming-soon',
      slug: 'em-breve',
      title: 'Em breve',
      videos: filterBlocked(comingSoon),
      comingSoon: true,
    });
  }

  const assembled = [...prepend, ...catalogRows].map((row) => ({
    ...row,
    videos: filterBlocked(row.videos || []),
  })).filter((row) => (row.videos || []).length > 0 || row.id === 'coming-soon');

  if (because?.items?.length) {
    let becauseSafe = filterBlocked(filterMaturity(because.items));
    try {
      const forYouService = require('./forYouService');
      becauseSafe = await forYouService.filterNotInterested(profileId, becauseSafe);
    } catch {
      /* optional */
    }
    if (becauseSafe.length) {
      assembled.push({
        id: 'because-you-watched',
        slug: 'porque-assistiu',
        title: `Porque assistiu a ${because.seedTitle}`,
        videos: becauseSafe,
      });
    }
  }

  const seen = new Set();
  const freeVideos = [];
  for (const row of assembled) {
    for (const video of row.videos || []) {
      if (video.monetization === 'avod' && !seen.has(video.id)) {
        seen.add(video.id);
        freeVideos.push(video);
      }
    }
  }

  if (freeVideos.length) {
    assembled.push({
      id: 'free-avod',
      slug: 'conteudo-gratuito',
      title: 'Conteúdo gratuito',
      videos: freeVideos.slice(0, 16),
    });
  }

  const featured =
    featuredRow && !blockedIds.has(featuredRow.id)
      ? mapContentPublic(featuredRow)
      : null;

  // Colecções editoriais (Só na MinhaTela, campanhas, etc.)
  try {
    const editorialService = require('./editorialService');
    const editorial = await editorialService.listForHome(maturityMax);
    const editorialRows = editorial
      .map((col) => ({
        id: `editorial-${col.slug}`,
        slug: col.slug,
        title: col.title,
        subtitle: col.subtitle,
        videos: filterBlocked(col.videos || []),
        editorial: true,
      }))
      .filter((row) => (row.videos || []).length > 0);
    // Inserir após Top 10 / Continuar a assistir (início das filas montadas)
    if (editorialRows.length) {
      const insertAt = Math.min(2, assembled.length);
      assembled.splice(insertAt, 0, ...editorialRows);
    }
  } catch {
    /* editorial opcional */
  }

  return {
    featured,
    rows: assembled,
    maturityMax,
  };
}

async function buildSeriesPayload(seriesRow, profileId, userId) {
  const episodes = await seriesRepository.findSeriesEpisodes(seriesRow.id);
  const progressMap = await seriesRepository.findEpisodeProgress(profileId, seriesRow.id);

  let hideSpoilers = false;
  if (profileId && userId) {
    try {
      const profile = await profileRepository.findOwned(profileId, userId);
      hideSpoilers = Boolean(profile?.hide_spoilers);
      const flagOn = await require('./featureFlagService').isEnabled('spoilers_enabled');
      if (!flagOn) hideSpoilers = false;
    } catch {
      hideSpoilers = false;
    }
  }

  const seasonsMap = new Map();
  for (const ep of episodes) {
    const season = ep.season_number;
    if (!seasonsMap.has(season)) seasonsMap.set(season, []);
    let card = mapEpisodeCard(ep, progressMap.get(ep.id));
    const watched = (progressMap.get(ep.id)?.percentage || 0) >= 90;
    if (hideSpoilers && !watched) {
      const stillsOn = await require('./featureFlagService')
        .isEnabled('spoiler_stills_enabled', true)
        .catch(() => true);
      // Nunca fallback para poster/backdrop spoiler — só stills explicitamente seguros
      const safePoster = ep.spoiler_safe_poster_url || null;
      const safeStill = ep.spoiler_safe_still_url || null;
      const posterIsDistinct =
        safePoster &&
        safePoster !== ep.poster_url &&
        safePoster !== ep.backdrop_url;
      const stillIsDistinct =
        safeStill && safeStill !== ep.poster_url && safeStill !== ep.backdrop_url;
      card = {
        ...card,
        spoilerHidden: true,
        synopsisShort: null,
        synopsisFull: null,
        displayTitle: `Episódio ${ep.episode_number}`,
        episodeTitle: null,
        title: `Episódio ${ep.episode_number}`,
        posterUrl: stillsOn && posterIsDistinct ? safePoster : null,
        backdropUrl: stillsOn && stillIsDistinct ? safeStill : null,
      };
    }
    seasonsMap.get(season).push(card);
  }

  const seasons = [...seasonsMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seasonNumber, items]) => ({
      seasonNumber,
      episodeCount: items.length,
      episodes: items,
    }));

  let playTarget = null;
  if (profileId) {
    playTarget = await seriesRepository.findContinueEpisode(profileId, seriesRow.id);
  } else {
    playTarget = await seriesRepository.findFirstEpisode(seriesRow.id);
  }

  const content = mapContentPublic(seriesRow);
  const accessSource = playTarget || seriesRow;
  const access = await accessControlService.resolveAccess(
    userId,
    mapContentPublic(accessSource)
  );

  return {
    content: {
      ...content,
      seasons,
      episodeCount: episodes.length,
      seasonCount: seasons.length,
      hideSpoilers,
    },
    playEpisode: playTarget ? mapContentPublic(playTarget) : null,
    access: playTarget
      ? {
          ...access,
          label:
            access.action === 'watch'
              ? `Assistir T${playTarget.season_number}:E${playTarget.episode_number}`
              : access.label,
        }
      : access,
  };
}

async function getContentDetails(userId, contentId, profileId) {
  const row = await contentRepository.findPublishedById(contentId);
  if (!row) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }

  const maturityMax = await resolveMaturityMax(userId, profileId);
  if ((row.maturity_rating ?? 12) > maturityMax) {
    throw createError(
      403,
      'Este título não está disponível neste perfil',
      'MATURITY_BLOCKED'
    );
  }

  const parentalService = require('./parentalService');
  await parentalService.assertNotBlocked(profileId, contentId);

  const comingSoon =
    row.coming_soon_at &&
    new Date(row.coming_soon_at) > new Date() &&
    !(row.is_published && row.workflow_status === 'published');

  const [related, favorited, social] = await Promise.all([
    discoveryRepository.related(contentId),
    profileId ? discoveryRepository.isFavorite(profileId, contentId) : false,
    discoveryService.getSocialState(userId, profileId, contentId),
  ]);

  if (comingSoon) {
    const content = mapContentPublic(row);
    return {
      content: { ...content, comingSoon: true },
      access: {
        canWatch: false,
        action: 'remind',
        label: social.reminded ? 'Lembrete activo' : 'Lembrar-me',
        message: `Estreia prevista: ${new Date(row.coming_soon_at).toLocaleDateString('pt-AO')}`,
        denialCode: 'COMING_SOON',
      },
      playEpisode: null,
      related,
      favorited,
      social,
    };
  }
  if (row.kind === 'series') {
    const series = await buildSeriesPayload(row, profileId, userId);
    return {
      content: series.content,
      access: series.access,
      playEpisode: series.playEpisode,
      related,
      favorited,
      social,
    };
  }

  if (row.kind === 'episode' && row.series_id) {
    const series = await seriesRepository.findSeriesById(row.series_id);
    const content = mapContentPublic(row);
    const access = await accessControlService.resolveAccess(userId, content);
    const next = await seriesRepository.findNextEpisode(row.id);
    return {
      content: {
        ...content,
        series: series ? mapContentPublic(series) : null,
      },
      access,
      nextEpisode: next ? mapContentPublic(next) : null,
      related,
      favorited,
      social,
    };
  }

  const content = mapContentPublic(row);
  const access = await accessControlService.resolveAccess(userId, content);

  let cast = [];
  let chapters = [];
  let preference = { notInterested: false, markedWatched: false };
  try {
    const peopleFeedbackRepository = require('../repositories/peopleFeedbackRepository');
    [cast, chapters] = await Promise.all([
      peopleFeedbackRepository.listByContent(content.id),
      peopleFeedbackRepository.listChapters(content.id),
    ]);
  } catch {
    /* optional enrichment */
  }
  if (profileId) {
    try {
      const pref = await require('../repositories/forYouRepository').getPreference(
        profileId,
        content.id
      );
      preference = require('./forYouService').mapPref(pref);
    } catch {
      /* optional */
    }
  }

  return {
    content: { ...content, castPeople: cast, chapters },
    access,
    related,
    favorited,
    social,
    cast,
    chapters,
    preference,
    playEpisode: null,
    nextEpisode: null,
  };
}

async function getShareCard(contentId) {
  const row = await contentRepository.findPublishedById(contentId);
  if (!row) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }
  const content = mapContentPublic(row);
  const base = env.appPublicUrl;
  return {
    id: content.id,
    title: content.title,
    synopsis: content.synopsisShort,
    posterUrl: content.posterUrl,
    backdropUrl: content.backdropUrl,
    kind: content.kind,
    monetization: content.monetization,
    releaseYear: content.releaseYear,
    shareUrl: `${base}/title/${content.id}`,
    og: {
      title: `${content.title} · MinhaTela`,
      description: content.synopsisShort,
      image: content.backdropUrl || content.posterUrl,
      url: `${base}/title/${content.id}`,
    },
  };
}

/**
 * Pré-visualização Netflix-style: apenas trailer público.
 * NUNCA devolve bunnyVideoId nem URL de playback completo.
 */
async function getTrailerPreview(contentId, userId, profileId) {
  const maturityMax = await resolveMaturityMax(userId, profileId);
  const row = await contentRepository.findPublishedById(contentId);
  if (!row) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }
  if ((row.maturity_rating || 12) > maturityMax) {
    throw createError(403, 'Conteúdo acima da maturidade do perfil', 'MATURITY_BLOCKED');
  }
  if (profileId) {
    const parentalRepository = require('../repositories/parentalRepository');
    const blocked = await parentalRepository.listBlockedIds(profileId);
    if (blocked.includes(row.id) || (row.series_id && blocked.includes(row.series_id))) {
      throw createError(403, 'Título bloqueado neste perfil', 'TITLE_BLOCKED');
    }
  }
  const content = mapContentPublic(row);
  return {
    id: content.id,
    title: content.title,
    synopsisShort: content.synopsisShort,
    posterUrl: content.posterUrl,
    backdropUrl: content.backdropUrl,
    trailerUrl: content.trailerUrl,
    maturityRating: content.maturityRating,
    kind: content.kind,
    monetization: content.monetization,
    previewOnly: true,
  };
}

module.exports = { getHome, getContentDetails, getShareCard, getTrailerPreview };
