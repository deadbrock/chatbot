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

const authFooter = document.getElementById('authFooter');
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.includes('192.168');

if (authFooter) {
  authFooter.textContent = isLocalHost
    ? 'Ambiente local — SQLite'
    : 'Ambiente de produção';
}

if (isLocalHost && defaultCreds) {
  defaultCreds.classList.remove('d-none');
}

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
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  togglePassword.textContent = isPassword ? 'Ocultar' : 'Mostrar';
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
    // Detectar URL da API
    function getApiBaseUrl() {
      const hostname = window.location.hostname;
      const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.includes('192.168') ||
        hostname.endsWith('.local');

      if (isLocal) {
        return '/api';
      }

      // 1. Tentar meta tag
      const apiUrlMeta = document.querySelector('meta[name="api-url"]');
      if (apiUrlMeta) {
        const url = apiUrlMeta.getAttribute('content');
        if (url && url.trim()) {
          return url.endsWith('/api') ? url : `${url}/api`;
        }
      }
      
      // 2. Tentar script tag
      const apiConfigScript = document.getElementById('api-config');
      if (apiConfigScript) {
        if (apiConfigScript.dataset.apiUrl) {
          const url = apiConfigScript.dataset.apiUrl;
          return url.endsWith('/api') ? url : `${url}/api`;
        }
        if (apiConfigScript.textContent) {
          try {
            const config = JSON.parse(apiConfigScript.textContent);
            if (config.apiUrl) {
              const url = config.apiUrl;
              return url.endsWith('/api') ? url : `${url}/api`;
            }
          } catch (e) {
            console.warn('Erro ao parsear api-config:', e);
          }
        }
      }
      
      // 3. Detecção automática (produção)
      console.warn('⚠️ URL da API não configurada. Usando fallback.');
      return '/api';
    }

    const apiBaseUrl = getApiBaseUrl();
    const loginUrl = `${apiBaseUrl}/users/login`;
    
    console.log('🔍 Tentando fazer login em:', loginUrl);

    const resp = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    console.log('📊 Resposta recebida:');
    console.log('   - Status:', resp.status);
    console.log('   - Status Text:', resp.statusText);
    console.log('   - Content-Type:', resp.headers.get('content-type'));
    console.log('   - Todas as Headers:');
    resp.headers.forEach((value, key) => {
      console.log(`     ${key}: ${value}`);
    });

    // Tentar ler o corpo da resposta como texto primeiro
    const text = await resp.text();
    console.log('   - Corpo da resposta (texto, primeiros 500 chars):', text.substring(0, 500));
    console.log('   - Tamanho da resposta:', text.length);

    const contentType = resp.headers.get('content-type');
    let json;
    
    if (text.trim() === '') {
      console.error('❌ Resposta vazia do servidor!');
      console.error('   - Isso pode indicar que o backend crashou ou não está processando a rota corretamente');
      console.error('   - Verifique os logs do Railway');
      throw new Error(`Resposta vazia do servidor. Status: ${resp.status}. Verifique se o backend está rodando.`);
    }
    
    // Tentar parsear como JSON
    try {
      json = JSON.parse(text);
      console.log('✅ JSON parseado com sucesso:', json);
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      console.error('   - Texto recebido completo:', text);
      console.error('   - Isso pode ser HTML ou texto simples em vez de JSON');
      throw new Error(`Resposta não é JSON válido. Status: ${resp.status}. Conteúdo: ${text.substring(0, 200)}...`);
    }
    
    if (contentType && !contentType.includes('application/json')) {
      console.warn('⚠️ Content-Type não é application/json:', contentType);
    }

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


