const STORAGE_KEY = 'theme';

export function getTheme() {
  const t = localStorage.getItem(STORAGE_KEY);
  return t === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  localStorage.setItem(STORAGE_KEY, t);
}

export function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function initThemeToggle() {
  // aplica tema inicial
  applyTheme(getTheme());

  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleTheme();
    syncThemeIcon(btn);
  });
  syncThemeIcon(btn);
}

function syncThemeIcon(btn) {
  const icon = btn.querySelector('i');
  if (!icon) return;
  const isDark = getTheme() === 'dark';
  icon.className = isDark ? 'bi bi-sun' : 'bi bi-moon-stars';
  btn.title = isDark ? 'Tema claro' : 'Tema escuro';
}


