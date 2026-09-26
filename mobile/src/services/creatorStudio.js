import api from './api';

export async function registerCreator(payload) {
  return api.post('/api/creator-studio/register', payload);
}

export async function fetchCreatorStudio() {
  return api.get('/api/creator-studio/home');
}

export async function createCreatorContent(payload) {
  return api.post('/api/creator-studio/contents', payload);
}

export async function submitCreatorContent(contentId) {
  return api.post(`/api/creator-studio/contents/${contentId}/submit`, {});
}

export default {
  registerCreator,
  fetchCreatorStudio,
  createCreatorContent,
  submitCreatorContent,
};
