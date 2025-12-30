const ChatMessage = require('../models/ChatMessageSQL');
const Attachment = require('../models/AttachmentSQL');
const Ticket = require('../models/TicketSQL');

/**
 * Serviço de Socket.IO para Chat em Tempo Real
 * Gerencia conexões, salas e eventos de chat
 */

class ChatSocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socket.id
    this.userSockets = new Map(); // socket.id -> userData
  }

  /**
   * Inicializa os event listeners do Socket.IO
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`📱 Cliente conectado ao chat: ${socket.id}`);
      
      // Autenticação
      socket.on('authenticate', (data) => this.handleAuthentication(socket, data));
      
      // Entrar em sala de ticket
      socket.on('join_ticket', (ticketId) => this.handleJoinTicket(socket, ticketId));
      
      // Sair de sala de ticket
      socket.on('leave_ticket', (ticketId) => this.handleLeaveTicket(socket, ticketId));
      
      // Digitando...
      socket.on('typing', (data) => this.handleTyping(socket, data));
      socket.on('stop_typing', (data) => this.handleStopTyping(socket, data));
      
      // Nova mensagem
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));
      
      // Mensagem lida
      socket.on('read_message', (data) => this.handleReadMessage(socket, data));
      
      // Reação
      socket.on('react_message', (data) => this.handleReaction(socket, data));
      
      // Online/Offline
      socket.on('set_status', (status) => this.handleStatusChange(socket, status));
      
      // Desconexão
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
    
    console.log('✅ Socket.IO Chat Service inicializado');
  }

  /**
   * Autentica usuário
   */
  handleAuthentication(socket, data) {
    const { userId, name, role } = data;
    
    if (!userId) {
      socket.emit('auth_error', { message: 'User ID é obrigatório' });
      return;
    }
    
    // Armazenar dados do usuário
    this.userSockets.set(socket.id, {
      userId,
      name,
      role,
      status: 'online',
      connectedAt: new Date()
    });
    
    this.connectedUsers.set(userId, socket.id);
    
    socket.emit('authenticated', {
      success: true,
      userId,
      connectedUsers: this.getOnlineUsers()
    });
    
    // Notificar outros usuários
    this.io.emit('user_online', { userId, name });
    
    console.log(`✅ Usuário autenticado: ${name} (${userId})`);
  }

  /**
   * Entrar em sala de ticket
   */
  handleJoinTicket(socket, ticketId) {
    const userData = this.userSockets.get(socket.id);
    
    if (!userData) {
      socket.emit('error', { message: 'Não autenticado' });
      return;
    }
    
    const room = `ticket_${ticketId}`;
    socket.join(room);
    
    socket.emit('joined_ticket', {
      ticketId,
      room
    });
    
    // Notificar outros na sala
    socket.to(room).emit('user_joined_ticket', {
      ticketId,
      userId: userData.userId,
      name: userData.name
    });
    
    console.log(`✅ ${userData.name} entrou no ticket ${ticketId}`);
  }

  /**
   * Sair de sala de ticket
   */
  handleLeaveTicket(socket, ticketId) {
    const userData = this.userSockets.get(socket.id);
    const room = `ticket_${ticketId}`;
    
    socket.leave(room);
    
    if (userData) {
      socket.to(room).emit('user_left_ticket', {
        ticketId,
        userId: userData.userId,
        name: userData.name
      });
    }
    
    console.log(`👋 ${userData?.name || 'Usuário'} saiu do ticket ${ticketId}`);
  }

  /**
   * Usuário está digitando
   */
  handleTyping(socket, data) {
    const { ticketId } = data;
    const userData = this.userSockets.get(socket.id);
    
    if (!userData || !ticketId) return;
    
    const room = `ticket_${ticketId}`;
    socket.to(room).emit('user_typing', {
      ticketId,
      userId: userData.userId,
      name: userData.name
    });
  }

  /**
   * Usuário parou de digitar
   */
  handleStopTyping(socket, data) {
    const { ticketId } = data;
    const userData = this.userSockets.get(socket.id);
    
    if (!userData || !ticketId) return;
    
    const room = `ticket_${ticketId}`;
    socket.to(room).emit('user_stop_typing', {
      ticketId,
      userId: userData.userId
    });
  }

  /**
   * Enviar mensagem (via Socket.IO)
   */
  async handleSendMessage(socket, data) {
    const userData = this.userSockets.get(socket.id);
    
    if (!userData) {
      socket.emit('message_error', { message: 'Não autenticado' });
      return;
    }
    
    try {
      const { ticketId, body, type = 'text', quotedMessageId } = data;
      
      // TODO: Criar mensagem no banco e enviar via WhatsApp
      // Por enquanto, apenas emitir para a sala
      
      const room = `ticket_${ticketId}`;
      this.io.to(room).emit('new_message', {
        ticketId,
        messageId: `msg_${Date.now()}`,
        from: userData.userId,
        fromName: userData.name,
        body,
        type,
        timestamp: new Date(),
        quotedMessageId
      });
      
      socket.emit('message_sent', { success: true });
    } catch (error) {
      console.error('Erro ao enviar mensagem via socket:', error);
      socket.emit('message_error', { message: error.message });
    }
  }

  /**
   * Marcar mensagem como lida
   */
  async handleReadMessage(socket, data) {
    const { ticketId, messageId } = data;
    const userData = this.userSockets.get(socket.id);
    
    if (!userData) return;
    
    // Notificar sala
    const room = `ticket_${ticketId}`;
    this.io.to(room).emit('message_read', {
      ticketId,
      messageId,
      readBy: userData.userId,
      readAt: new Date()
    });
  }

  /**
   * Adicionar reação
   */
  async handleReaction(socket, data) {
    const { ticketId, messageId, emoji } = data;
    const userData = this.userSockets.get(socket.id);
    
    if (!userData) return;
    
    // Notificar sala
    const room = `ticket_${ticketId}`;
    this.io.to(room).emit('message_reaction', {
      ticketId,
      messageId,
      emoji,
      userId: userData.userId,
      userName: userData.name
    });
  }

  /**
   * Mudar status (online/away/busy)
   */
  handleStatusChange(socket, status) {
    const userData = this.userSockets.get(socket.id);
    
    if (!userData) return;
    
    userData.status = status;
    
    // Notificar todos
    this.io.emit('user_status_change', {
      userId: userData.userId,
      name: userData.name,
      status
    });
  }

  /**
   * Desconexão
   */
  handleDisconnect(socket) {
    const userData = this.userSockets.get(socket.id);
    
    if (userData) {
      this.connectedUsers.delete(userData.userId);
      this.userSockets.delete(socket.id);
      
      // Notificar outros usuários
      this.io.emit('user_offline', {
        userId: userData.userId,
        name: userData.name
      });
      
      console.log(`👋 ${userData.name} desconectado`);
    } else {
      console.log(`👋 Cliente desconectado: ${socket.id}`);
    }
  }

  /**
   * Obtém lista de usuários online
   */
  getOnlineUsers() {
    const users = [];
    
    for (const [socketId, userData] of this.userSockets) {
      users.push({
        userId: userData.userId,
        name: userData.name,
        status: userData.status,
        connectedAt: userData.connectedAt
      });
    }
    
    return users;
  }

  /**
   * Emite evento para um usuário específico
   */
  emitToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    
    return false;
  }

  /**
   * Emite evento para uma sala (ticket)
   */
  emitToTicket(ticketId, event, data) {
    this.io.to(`ticket_${ticketId}`).emit(event, data);
  }

  /**
   * Emite evento para todos
   */
  emitToAll(event, data) {
    this.io.emit(event, data);
  }
}

module.exports = ChatSocketService;

