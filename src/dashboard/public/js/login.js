const form = document.getElementById('loginForm');
const errorBox = document.getElementById('errorBox');
const submitBtn = document.getElementById('submitBtn');
const togglePassword = document.getElementById('togglePassword');
const showDefaultCreds = document.getElementById('showDefaultCreds');
const defaultCreds = document.getElementById('defaultCreds');

// Tema (light/dark) — compartilhado com o dashboard
function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
}

function initTheme() {
  const t = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  applyTheme(t);
}

initTheme();

function setLoading(isLoading) {
  if (isLoading) {
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
  } else {
    submitBtn.classList.remove('is-loading');
    submitBtn.disabled = false;
  }
}

function showError(message) {
  errorBox.textContent = message || 'Erro ao autenticar. Tente novamente.';
  errorBox.classList.remove('d-none');
}

function clearError() {
  errorBox.classList.add('d-none');
  errorBox.textContent = '';
}

togglePassword?.addEventListener('click', () => {
  const input = document.getElementById('password');
  const icon = togglePassword.querySelector('i');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  icon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
});

showDefaultCreds?.addEventListener('click', (e) => {
  e.preventDefault();
  defaultCreds.classList.toggle('d-none');
});

// Se já tiver token, manda pro dashboard
if (localStorage.getItem('token')) {
  window.location.href = '/admin';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');

  // validação simples
  const email = (emailEl.value || '').trim();
  const password = passEl.value || '';

  let valid = true;
  if (!email || !email.includes('@')) {
    emailEl.classList.add('is-invalid');
    valid = false;
  } else {
    emailEl.classList.remove('is-invalid');
  }
  if (!password) {
    passEl.classList.add('is-invalid');
    valid = false;
  } else {
    passEl.classList.remove('is-invalid');
  }
  if (!valid) return;

  setLoading(true);

  try {
    const resp = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const json = await resp.json();

    if (!resp.ok || !json.success) {
      throw new Error(json?.error || 'Credenciais inválidas');
    }

    const { token, user } = json.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    const remember = document.getElementById('rememberMe')?.checked;
    localStorage.setItem('rememberMe', remember ? '1' : '0');

    window.location.href = '/admin';
  } catch (err) {
    showError(err?.message);
  } finally {
    setLoading(false);
  }
});


