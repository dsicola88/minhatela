import api from './api';

export async function listMyGifts() {
  return api.get('/api/gifts');
}

export async function purchaseGift(body) {
  return api.post('/api/gifts', body);
}

export async function redeemGift(code) {
  return api.post('/api/gifts/redeem', { code });
}

export async function getHousehold() {
  return api.get('/api/household');
}

export async function createHousehold() {
  return api.post('/api/household', {});
}

export async function inviteHousehold(email) {
  return api.post('/api/household/invite', { email });
}

export async function acceptHousehold(code) {
  return api.post('/api/household/accept', { code });
}

export async function removeHouseholdMember(userId) {
  return api.delete(`/api/household/members/${userId}`);
}

export async function leaveHousehold() {
  return api.post('/api/household/leave', {});
}

export async function listPremieres() {
  return api.get('/api/premieres');
}

export async function remindPremiere(eventId) {
  return api.post(`/api/premieres/${eventId}/remind`, {});
}

export async function unremindPremiere(eventId) {
  return api.delete(`/api/premieres/${eventId}/remind`);
}

export async function fetchMoreLikeThis(contentId) {
  return api.get(`/api/catalog/content/${contentId}/more-like-this`);
}

export default {
  listMyGifts,
  purchaseGift,
  redeemGift,
  getHousehold,
  createHousehold,
  inviteHousehold,
  acceptHousehold,
  removeHouseholdMember,
  leaveHousehold,
  listPremieres,
  remindPremiere,
  unremindPremiere,
  fetchMoreLikeThis,
};
