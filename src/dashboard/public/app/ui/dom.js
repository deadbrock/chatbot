export function debounce(fn, delayMs) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delayMs);
  };
}

export function setNavBadge(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  const num = Number(value);
  const count = Number.isFinite(num) ? num : parseInt(String(value ?? '0'), 10) || 0;
  el.textContent = count > 99 ? '99+' : count;
  el.classList.toggle('is-zero', count === 0);
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}


