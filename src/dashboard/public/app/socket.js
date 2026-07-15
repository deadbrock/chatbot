/**
 * Socket.IO singleton — conexão global do painel
 */

let socket = null;
let authenticated = false;
const listeners = {
  new_message: new Set(),
  ticket_updated: new Set(),
  new_ticket: new Set(),
  new_session: new Set()
};

function isLocalHost() {
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('192.168') ||
    hostname.endsWith('.local')
  );
}

function getServerBaseUrl() {
  // Em desenvolvimento local, API e Socket devem usar o mesmo servidor (api.js usa /api).
  if (isLocalHost()) {
    return window.location.origin;
  }

  const apiUrlMeta = document.querySelector('meta[name="api-url"]');
  if (apiUrlMeta) {
    const url = apiUrlMeta.getAttribute('content');
    if (url && url.trim()) {
      return url.replace(/\/api\/?$/, '');
    }
  }

  const apiConfigScript = document.getElementById('api-config');
  if (apiConfigScript && apiConfigScript.textContent) {
    try {
      const config = JSON.parse(apiConfigScript.textContent);
      if (config.apiUrl) {
        return config.apiUrl.replace(/\/api\/?$/, '');
      }
    } catch {
      // ignore
    }
  }

  return window.location.origin;
}

function authenticateSocket() {
  if (!socket?.connected) return;

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user?.id) return;

  socket.emit('authenticate', {
    token,
    userId: user.id,
    name: user.name,
    role: user.role
  });
}

function bindCoreEvents() {
  if (!socket || socket.__coreBound) return;
  socket.__coreBound = true;

  socket.on('connect', () => {
    console.log('✅ Socket.IO conectado:', socket.id);
    authenticateSocket();
  });

  socket.on('authenticated', () => {
    authenticated = true;
    console.log('✅ Socket.IO autenticado');
  });

  socket.on('disconnect', (reason) => {
    authenticated = false;
    console.warn('❌ Socket.IO desconectado:', reason);
  });

  socket.on('reconnect', () => {
    authenticateSocket();
  });

  socket.on('new_message', (data) => {
    listeners.new_message.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(e); }
    });
    window.dispatchEvent(new CustomEvent('realtime:new_message', { detail: data }));
  });

  socket.on('ticket_updated', (data) => {
    listeners.ticket_updated.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(e); }
    });
    window.dispatchEvent(new CustomEvent('realtime:ticket_updated', { detail: data }));
  });

  socket.on('new_ticket', (data) => {
    listeners.new_ticket.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(e); }
    });
  });

  socket.on('new_session', (data) => {
    listeners.new_session.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(e); }
    });
  });
}

export function connectSocket({
  onNewTicket,
  onTicketUpdated,
  onNewSession,
  onNewMessage
} = {}) {
  if (onNewTicket) listeners.new_ticket.add(onNewTicket);
  if (onTicketUpdated) listeners.ticket_updated.add(onTicketUpdated);
  if (onNewSession) listeners.new_session.add(onNewSession);
  if (onNewMessage) listeners.new_message.add(onNewMessage);

  if (socket) {
    bindCoreEvents();
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  if (!window.io) {
    console.warn('⚠️ Socket.IO não carregado');
    return null;
  }

  const serverUrl = getServerBaseUrl();
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const socketUrl = serverUrl.startsWith('http') ? serverUrl : `${protocol}//${serverUrl}`;

  console.log('🔌 Conectando Socket.IO em:', socketUrl);

  socket = window.io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity
  });

  bindCoreEvents();
  return socket;
}

export function getSocket() {
  return socket;
}

export function onSocketEvent(event, handler) {
  if (!listeners[event]) return () => {};
  listeners[event].add(handler);
  return () => listeners[event].delete(handler);
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
