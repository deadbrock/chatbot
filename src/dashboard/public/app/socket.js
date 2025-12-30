export function connectSocket({ onNewTicket, onTicketUpdated, onNewSession } = {}) {
  if (!window.io) return null;

  const socket = window.io();

  socket.on('connect', () => {
    // ok
  });

  socket.on('new_ticket', (data) => onNewTicket?.(data));
  socket.on('ticket_updated', (data) => onTicketUpdated?.(data));
  socket.on('new_session', (data) => onNewSession?.(data));

  return socket;
}


