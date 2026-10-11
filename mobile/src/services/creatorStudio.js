import api from './api';

export async function registerCreator(payload) {
  return api.post('/api/creator-studio/register', payload);
}

export async function fetchCreatorStudio(period = 'all') {
  const query = period && period !== 'all' ? `?period=${encodeURIComponent(period)}` : '';
  return api.get(`/api/creator-studio/home${query}`);
}

export async function createCreatorContent(payload) {
  return api.post('/api/creator-studio/contents', payload);
}

export async function submitCreatorContent(contentId, body = {}) {
  return api.post(`/api/creator-studio/contents/${contentId}/submit`, body);
}

export async function fetchCreatorLedger() {
  return api.get('/api/creator-studio/ledger');
}

export async function updateCreatorBank(payload) {
  return api.patch('/api/creator-studio/bank', payload);
}

export async function createBunnyVideoSlot(payload) {
  return api.post('/api/creator-studio/bunny/videos', payload);
}

export default {
  registerCreator,
  fetchCreatorStudio,
  createCreatorContent,
  submitCreatorContent,
  fetchCreatorLedger,
  updateCreatorBank,
  createBunnyVideoSlot,
};
