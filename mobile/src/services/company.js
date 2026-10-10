import api from './api';

export async function fetchCompanyPortal() {
  return api.get('/api/company');
}

export async function registerCompany(payload) {
  return api.post('/api/company/register', payload);
}

export async function addCompanyMember({ email, role }) {
  return api.post('/api/company/members', { email, role });
}

export async function removeCompanyMember(userId) {
  return api.delete(`/api/company/members/${userId}`);
}
