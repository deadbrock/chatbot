import { getToken, logout } from './auth.js';

// Detectar URL da API baseado no ambiente
// Em produção (Vercel), usar variável de ambiente ou detectar automaticamente
// Em desenvolvimento, usar /api (proxy local)
function getApiBaseUrl() {
  // Se estiver em produção (domínio Vercel), usar URL do Railway
  const hostname = window.location.hostname;
  
  // Se não for localhost, assumir que está em produção
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.includes('192.168')) {
    // IMPORTANTE: Configure esta variável no Vercel!
    // Vá em Settings > Environment Variables e adicione:
    // NOME: API_URL
    // VALOR: https://seu-projeto.up.railway.app/api
    
    // Tentar ler de um script tag ou meta tag (configurado no HTML)
    const apiUrlMeta = document.querySelector('meta[name="api-url"]');
    if (apiUrlMeta) {
      const url = apiUrlMeta.getAttribute('content');
      return url.endsWith('/api') ? url : `${url}/api`;
    }
    
    // Fallback: você precisará configurar manualmente aqui
    // Substitua pela URL do seu Railway após o deploy
    // Descomente e substitua:
    // return 'https://seu-projeto.up.railway.app/api';
    
    // Por enquanto, retornar relativo (não funcionará em produção até configurar)
    console.warn('⚠️ API_URL não configurada. Configure no Vercel ou descomente a linha acima.');
  }
  
  // Desenvolvimento local: usar proxy relativo
  return '/api';
}

const API_BASE_URL = getApiBaseUrl();

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


