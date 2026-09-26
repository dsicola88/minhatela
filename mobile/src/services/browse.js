import api from './api';

export async function fetchNewAndHot() {
  return api.get('/api/browse/new-and-hot');
}

export async function fetchGenres() {
  return api.get('/api/browse/genres');
}

export async function fetchGenre(genre) {
  return api.get(`/api/browse/genre/${encodeURIComponent(genre)}`);
}

export async function fetchBrowseRows() {
  return api.get('/api/browse/rows');
}

export default {
  fetchNewAndHot,
  fetchGenres,
  fetchGenre,
  fetchBrowseRows,
};
