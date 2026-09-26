import api from './api';

export async function createWatchParty({ contentId, sessionId, displayName }) {
  return api.post('/api/watch-together/rooms', { contentId, sessionId, displayName });
}

export async function joinWatchParty({ code, displayName }) {
  return api.post('/api/watch-together/rooms/join', { code, displayName });
}

export async function getWatchPartyState(roomId) {
  return api.get(`/api/watch-together/rooms/${roomId}`);
}

export async function syncWatchParty(roomId, { positionSeconds, isPlaying }) {
  return api.post(`/api/watch-together/rooms/${roomId}/sync`, {
    positionSeconds,
    isPlaying,
  });
}

export async function endWatchParty(roomId) {
  return api.post(`/api/watch-together/rooms/${roomId}/end`, {});
}

export async function leaveWatchParty(roomId) {
  return api.post(`/api/watch-together/rooms/${roomId}/leave`, {});
}

export async function submitPlaybackFeedback(body) {
  return api.post('/api/watch-together/feedback', body);
}

export async function challengeStillWatching({ sessionId, contentId }) {
  return api.post('/api/watch-together/still-watching', { sessionId, contentId });
}

export async function confirmStillWatching(challengeId) {
  return api.post(`/api/watch-together/still-watching/${challengeId}/confirm`, {});
}

export async function fetchPerson(slug) {
  return api.get(`/api/catalog/people/${slug}`);
}

export default {
  createWatchParty,
  joinWatchParty,
  getWatchPartyState,
  syncWatchParty,
  endWatchParty,
  leaveWatchParty,
  submitPlaybackFeedback,
  challengeStillWatching,
  confirmStillWatching,
  fetchPerson,
};
