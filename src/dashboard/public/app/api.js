import { getToken, logout } from './auth.js';

const API_BASE_URL = '/api';

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(API_BASE_URL + endpoint, {
    ...options,
    headers
  });

  if (resp.status === 401) {
    // token ausente/expirado
    logout();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const json = await resp.json().catch(() => null);

  if (!resp.ok) {
    const msg = json?.error || json?.message || `HTTP ${resp.status}`;
    throw new Error(msg);
  }

  return json?.data ?? json;
}


