/**
 * Obtém a URL base do servidor (para Socket.IO)
 * Usa a mesma lógica do api.js para detectar ambiente
 */
function getServerBaseUrl() {
  // 1. Tentar ler de meta tag
  const apiUrlMeta = document.querySelector('meta[name="api-url"]');
  if (apiUrlMeta) {
    const url = apiUrlMeta.getAttribute('content');
    if (url && url.trim()) {
      // Remover /api do final se existir
      return url.replace(/\/api\/?$/, '');
    }
  }
  
  // 2. Tentar ler de script tag
  const apiConfigScript = document.getElementById('api-config');
  if (apiConfigScript && apiConfigScript.textContent) {
    try {
      const config = JSON.parse(apiConfigScript.textContent);
      if (config.apiUrl) {
        return config.apiUrl.replace(/\/api\/?$/, '');
      }
    } catch (e) {
      // Ignorar erro
    }
  }
  
  // 3. Detectar automaticamente
  const hostname = window.location.hostname;
  const isProduction = hostname !== 'localhost' && 
                       hostname !== '127.0.0.1' && 
                       !hostname.includes('192.168') &&
                       !hostname.includes('.local');
  
  if (isProduction) {
    // Em produção, usar o mesmo hostname (assumindo que está no mesmo domínio ou proxy)
    // Se estiver em Vercel, você precisa configurar a URL do Railway via meta tag
    console.warn('⚠️ Socket.IO: URL do servidor não configurada. Configure via meta tag.');
  }
  
  // 4. Desenvolvimento: usar hostname atual
  return window.location.origin;
}

export function connectSocket({ onNewTicket, onTicketUpdated, onNewSession } = {}) {
  if (!window.io) {
    console.warn('⚠️ Socket.IO não carregado');
    return null;
  }

  // Obter URL do servidor
  const serverUrl = getServerBaseUrl();
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const socketUrl = serverUrl.startsWith('http') ? serverUrl : `${protocol}//${serverUrl}`;
  
  console.log('🔌 Conectando Socket.IO em:', socketUrl);

  const socket = window.io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ Socket.IO conectado:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('❌ Socket.IO desconectado:', reason);
  });

  socket.on('new_ticket', (data) => onNewTicket?.(data));
  socket.on('ticket_updated', (data) => onTicketUpdated?.(data));
  socket.on('new_session', (data) => onNewSession?.(data));

  return socket;
}


