import { getToken, logout } from './auth.js';

const API_BASE_URL = '/api';

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // Se o body for um objeto, enviar como JSON automaticamente.
  // Isso evita o bug "[object Object] is not valid JSON" no backend.
  let body = options.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const isString = typeof body === 'string';

  if (body !== undefined && body !== null && !isFormData && !isBlob && !isString) {
    body = JSON.stringify(body);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  // Para FormData, o browser define o Content-Type correto (multipart boundary)
  if (isFormData && headers['Content-Type']) {
    delete headers['Content-Type'];
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(API_BASE_URL + endpoint, {
    ...options,
    body,
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

  // Retornar o JSON completo (com success, data, pagination, etc)
  // Antes estava retornando apenas json.data, perdendo metadados importantes
  return json;
}


