import { disconnectSocket } from './socket.js';

export function ensureAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

export function getToken() {
  return localStorage.getItem('token');
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (!user) {
    localStorage.removeItem('user');
    return;
  }
  localStorage.setItem('user', JSON.stringify(user));
}

export function updateStoredUser(partial = {}) {
  const current = getStoredUser() || {};
  setStoredUser({ ...current, ...partial });
}

export function logout() {
  disconnectSocket();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}
