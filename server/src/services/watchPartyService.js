'use strict';

const watchPartyRepository = require('../repositories/watchPartyRepository');
const contentRepository = require('../repositories/contentRepository');
const featureFlagService = require('./featureFlagService');
const accessControlService = require('./accessControlService');
const { mapContentPublic } = require('../utils/mappers');
const { createError } = require('../utils/errors');
const { env } = require('../config/env');

function mapRoom(row, members = []) {
  return {
    id: row.id,
    code: row.code,
    contentId: row.content_id,
    contentTitle: row.content_title,
    posterUrl: row.poster_url,
    kind: row.kind,
    positionSeconds: row.position_seconds,
    isPlaying: row.is_playing,
    status: row.status,
    maxMembers: row.max_members,
    lastSyncAt: row.last_sync_at,
    hostUserId: row.host_user_id,
    shareUrl: `${env.appPublicUrl}/watch-together?code=${row.code}`,
    members: members.map((m) => ({
      userId: m.user_id,
      profileId: m.profile_id,
      displayName: m.display_name,
      isHost: m.is_host,
      lastSeenAt: m.last_seen_at,
    })),
  };
}

async function create(userId, body, meta = {}) {
  await featureFlagService.assertEnabled(
    'watch_together_enabled',
    'Watch Together temporariamente indisponível'
  );
  if (!body?.contentId) {
    throw createError(400, 'contentId obrigatório', 'VALIDATION');
  }

  const row = await contentRepository.findPublishedById(body.contentId);
  if (!row) throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  const content = mapContentPublic(row);
  if (content.kind === 'series') {
    throw createError(400, 'Escolha um episódio ou filme', 'SERIES_NOT_PLAYABLE');
  }

  const access = await accessControlService.resolveAccess(userId, content);
  if (!access.canWatch) {
    throw createError(403, access.message || 'Sem acesso para criar sala', 'NO_ACCESS');
  }

  const room = await watchPartyRepository.createRoom({
    hostUserId: userId,
    hostProfileId: meta.profileId || body.profileId,
    contentId: content.id,
    playbackSessionId: body.sessionId,
    displayName: body.displayName || 'Anfitrião',
  });
  const members = await watchPartyRepository.listMembers(room.id);
  return mapRoom({ ...room, content_title: content.title, poster_url: content.posterUrl, kind: content.kind }, members);
}

async function join(userId, code, body = {}, meta = {}) {
  await featureFlagService.assertEnabled(
    'watch_together_enabled',
    'Watch Together temporariamente indisponível'
  );
  const room = await watchPartyRepository.findActiveByCode(String(code || '').trim());
  if (!room) throw createError(404, 'Sala não encontrada ou terminada', 'ROOM_NOT_FOUND');

  const content = mapContentPublic(
    await contentRepository.findPublishedById(room.content_id)
  );
  const access = await accessControlService.resolveAccess(userId, content);
  if (!access.canWatch) {
    throw createError(403, 'Precisa de acesso ao título para entrar na sala', 'NO_ACCESS');
  }

  const joined = await watchPartyRepository.joinRoom({
    roomId: room.id,
    userId,
    profileId: meta.profileId || body.profileId,
    displayName: body.displayName,
  });
  if (joined.error === 'FULL') throw createError(409, 'Sala cheia', 'ROOM_FULL');
  if (joined.error === 'ENDED') throw createError(410, 'Sala terminada', 'ROOM_ENDED');

  const members = await watchPartyRepository.listMembers(room.id);
  return mapRoom(room, members);
}

async function state(userId, roomId) {
  const room = await watchPartyRepository.findById(roomId);
  if (!room) throw createError(404, 'Sala não encontrada', 'ROOM_NOT_FOUND');
  await watchPartyRepository.touchMember(roomId, userId);
  const members = await watchPartyRepository.listMembers(roomId);
  return mapRoom(room, members);
}

async function sync(userId, roomId, body) {
  const updated = await watchPartyRepository.syncHost({
    roomId,
    hostUserId: userId,
    positionSeconds: body?.positionSeconds,
    isPlaying: body?.isPlaying,
  });
  if (!updated) {
    throw createError(403, 'Apenas o anfitrião sincroniza a sala', 'NOT_HOST');
  }
  const members = await watchPartyRepository.listMembers(roomId);
  const room = await watchPartyRepository.findById(roomId);
  return mapRoom(room, members);
}

async function end(userId, roomId) {
  const row = await watchPartyRepository.endRoom(roomId, userId);
  if (!row) throw createError(403, 'Apenas o anfitrião pode terminar', 'NOT_HOST');
  return { ended: true, id: row.id };
}

async function leave(userId, roomId) {
  await watchPartyRepository.leaveRoom(roomId, userId);
  return { left: true };
}

module.exports = { create, join, state, sync, end, leave };
