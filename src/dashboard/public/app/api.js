import { getToken, logout } from './auth.js';

// Detectar URL da API baseado no ambiente
// Em produção (Vercel), usar variável de ambiente ou detectar automaticamente
// Em desenvolvimento, usar /api (proxy local)
function getApiBaseUrl() {
  // 1. Tentar ler de variável de ambiente do Vercel (via script injetado)
  // O Vercel injeta variáveis de ambiente em window.__ENV__ ou similar
  if (typeof window !== 'undefined') {
    // Tentar window.ENV (comum em alguns setups)
    if (window.ENV && window.ENV.API_URL) {
      const url = window.ENV.API_URL;
      return url.endsWith('/api') ? url : `${url}/api`;
    }
    
    // Tentar process.env (se disponível no browser)
    if (typeof process !== 'undefined' && process.env && process.env.API_URL) {
      const url = process.env.API_URL;
      return url.endsWith('/api') ? url : `${url}/api`;
    }
  }
  
  // 2. Tentar ler de meta tag (configurado no HTML)
  const apiUrlMeta = document.querySelector('meta[name="api-url"]');
  if (apiUrlMeta) {
    const url = apiUrlMeta.getAttribute('content');
    if (url && url.trim()) {
      return url.endsWith('/api') ? url : `${url}/api`;
    }
  }
  
  // 3. Tentar ler de script tag com id="api-config"
  const apiConfigScript = document.getElementById('api-config');
  if (apiConfigScript && apiConfigScript.textContent) {
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
  
  // 4. Detectar automaticamente baseado no hostname
  const hostname = window.location.hostname;
  const isProduction = hostname !== 'localhost' && 
                       hostname !== '127.0.0.1' && 
                       !hostname.includes('192.168') &&
                       !hostname.includes('.local');
  
  if (isProduction) {
    // Em produção, tentar construir URL baseado no domínio atual
    // Se estiver em vercel.app, assumir que a API está em Railway
    // Você pode configurar isso via meta tag ou variável de ambiente
    console.warn('⚠️ API_URL não configurada. Configure via meta tag ou variável de ambiente.');
    console.warn('   Adicione no HTML: <meta name="api-url" content="https://seu-projeto.up.railway.app">');
    // Retornar relativo pode funcionar se houver proxy reverso configurado
  }
  
  // 5. Desenvolvimento local: usar proxy relativo
  return '/api';
}

const API_BASE_URL = getApiBaseUrl();

// Log da URL detectada (apenas em desenvolvimento)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('🔗 API Base URL:', API_BASE_URL);
}

// Flag para evitar múltiplos logouts simultâneos
let isLoggingOut = false;

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // Tratar parâmetros de query (params)
  let url = API_BASE_URL + endpoint;
  if (options.params && typeof options.params === 'object') {
    const queryParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        queryParams.append(key, String(value));
      }
    });
    const queryString = queryParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

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
  } else {
    // Se não houver token, verificar se é uma rota que requer autenticação
    // Se for, redirecionar para login antes de fazer a requisição
    console.warn('Token não encontrado ao fazer requisição para:', endpoint);
  }

  const resp = await fetch(url, {
    ...options,
    body,
    headers
  });

  if (resp.status === 401) {
    // token ausente/expirado
    const jsonError = await resp.json().catch(() => ({}));
    const errorMessage = jsonError?.message || jsonError?.error || 'Sessão expirada. Faça login novamente.';
    
    // Verificar se já estamos fazendo logout para evitar múltiplos logouts simultâneos
    if (isLoggingOut) {
      console.warn('⚠️ [apiFetch] Logout já em andamento. Ignorando logout duplicado.', { endpoint });
      throw new Error(errorMessage);
    }
    
    // Verificar se realmente é um problema de autenticação
    // Se não houver token, pode ser que a rota não precise de autenticação
    if (!token) {
      console.warn('⚠️ [apiFetch] Acesso não autorizado sem token. Redirecionando para login...', { endpoint });
      isLoggingOut = true;
      logout();
      throw new Error(errorMessage);
    }
    
    // Verificar se o token ainda existe no localStorage (pode ter sido removido por outra requisição)
    const currentToken = getToken();
    if (!currentToken || currentToken !== token) {
      console.warn('⚠️ [apiFetch] Token foi removido durante a requisição. Não fazendo logout novamente.', { endpoint });
      throw new Error(errorMessage);
    }
    
    // Verificar se já estamos na página de login para evitar loop
    if (window.location.pathname === '/login.html' || window.location.pathname.includes('/login')) {
      console.warn('⚠️ [apiFetch] Já estamos na página de login. Não redirecionando novamente.');
      throw new Error(errorMessage);
    }
    
    // Se houver token mas retornou 401, o token está inválido ou expirado
    console.warn('⚠️ [apiFetch] Token inválido ou expirado. Redirecionando para login...', {
      endpoint,
      hasToken: !!token,
      tokenLength: token?.length,
      errorMessage,
      errorDetails: jsonError
    });
    
    isLoggingOut = true;
    logout();
    throw new Error(errorMessage);
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


