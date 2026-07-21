const ChatMessage = require('../models/ChatMessageSQL');
const Attachment = require('../models/AttachmentSQL');
const Ticket = require('../models/TicketSQL');
const jwt = require('jsonwebtoken');
const userPresenceService = require('./userPresenceService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const STAFF_ROLES = new Set(userPresenceService.STAFF_ROLES);

/**
 * Serviço de Socket.IO para Chat em Tempo Real
 * Gerencia conexões, salas e eventos de chat
 */

class ChatSocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socket.id (última conexão)
    this.userSockets = new Map(); // socket.id -> userData
    this.userConnections = new Map(); // userId -> Set<socketId>
  }

  /**
   * Inicializa os event listeners do Socket.IO
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`📱 Cliente conectado ao chat: ${socket.id}`);
      
      // Autenticação
      socket.on('authenticate', (data) => this.handleAuthentication(socket, data));
      
      socket.on('join_conversation', (conversationId) => this.handleJoinConversation(socket, conversationId));
      socket.on('leave_conversation', (conversationId) => this.handleLeaveConversation(socket, conversationId));
      
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
      
      // Away/Busy (somente enquanto conectado)
      socket.on('set_status', (status) => this.handleStatusChange(socket, status));
      
      // Desconexão
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
    
    console.log('✅ Socket.IO Chat Service inicializado');
  }

  addUserConnection(userId, socketId) {
    const key = String(userId);
    if (!this.userConnections.has(key)) {
      this.userConnections.set(key, new Set());
    }
    this.userConnections.get(key).add(socketId);
    return this.userConnections.get(key).size;
  }

  removeUserConnection(userId, socketId) {
    const key = String(userId);
    const connections = this.userConnections.get(key);
    if (!connections) return 0;

    connections.delete(socketId);
    if (!connections.size) {
      this.userConnections.delete(key);
    }

    return connections.size;
  }

  async broadcastStaffPresence(changedUser = null) {
    const summary = await userPresenceService.getStaffPresenceSummary();
    this.io.emit('staff_presence_updated', {
      ...summary,
      changedUser
    });
  }

  async markUserOnline(userData) {
    if (!STAFF_ROLES.has(userData.role)) return;

    await userPresenceService.setUserPresence(userData.userId, 'online');
    await this.broadcastStaffPresence({
      userId: userData.userId,
      name: userData.name,
      status: 'online'
    });
  }

  async markUserOffline(userData) {
    if (!STAFF_ROLES.has(userData.role)) return;

    await userPresenceService.setUserPresence(userData.userId, 'offline');
    await this.broadcastStaffPresence({
      userId: userData.userId,
      name: userData.name,
      status: 'offline'
    });
  }

  /**
   * Autentica usuário via JWT e marca online na primeira conexão ativa
   */
  async handleAuthentication(socket, data) {
    try {
      const { token, userId, name, role } = data || {};

      if (!token || !userId) {
        socket.emit('auth_error', { message: 'Token e usuário são obrigatórios' });
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        socket.emit('auth_error', { message: 'Token inválido ou expirado' });
        return;
      }

      if (String(decoded.id) !== String(userId)) {
        socket.emit('auth_error', { message: 'Usuário não corresponde ao token' });
        return;
      }

      const resolvedUserId = decoded.id;
      const resolvedName = name || decoded.name || decoded.email || 'Usuário';
      const resolvedRole = role || decoded.role || 'agent';

      const userData = {
        userId: resolvedUserId,
        name: resolvedName,
        role: resolvedRole,
        status: 'online',
        connectedAt: new Date()
      };

      this.userSockets.set(socket.id, userData);
      this.connectedUsers.set(String(resolvedUserId), socket.id);

      const activeConnections = this.addUserConnection(resolvedUserId, socket.id);
      const becameOnline = activeConnections === 1;

      if (becameOnline) {
        await this.markUserOnline(userData);
        this.io.emit('user_online', {
          userId: resolvedUserId,
          name: resolvedName,
          role: resolvedRole
        });
      }

      const presence = await userPresenceService.getStaffPresenceSummary();

      socket.emit('authenticated', {
        success: true,
        userId: resolvedUserId,
        connectedUsers: this.getOnlineUsers(),
        presence
      });

      console.log(`✅ Usuário autenticado: ${resolvedName} (${resolvedUserId})`);
    } catch (error) {
      console.error('❌ Erro na autenticação do socket:', error);
      socket.emit('auth_error', { message: 'Falha na autenticação' });
    }
  }

  handleJoinConversation(socket, conversationId) {
    const userData = this.userSockets.get(socket.id);
    if (!userData) {
      socket.emit('error', { message: 'Não autenticado' });
      return;
    }

    const room = `conversation_${conversationId}`;
    socket.join(room);
    socket.emit('joined_conversation', { conversationId, room });
    console.log(`✅ ${userData.name} entrou na conversa ${conversationId}`);
  }

  handleLeaveConversation(socket, conversationId) {
    const room = `conversation_${conversationId}`;
    socket.leave(room);
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
    
    socket.emit('joined_ticket', { ticketId, room });
    console.log(`✅ ${userData.name} entrou no ticket ${ticketId}`);
  }

  /**
   * Sair de sala de ticket
   */
  handleLeaveTicket(socket, ticketId) {
    const room = `ticket_${ticketId}`;
    socket.leave(room);
  }

  /**
   * Usuário está digitando
   */
  handleTyping(socket, data) {
    const userData = this.userSockets.get(socket.id);
    if (!userData) return;

    const { ticketId, conversationId } = data || {};
    const room = conversationId
      ? `conversation_${conversationId}`
      : `ticket_${ticketId}`;

    socket.to(room).emit('user_typing', {
      userId: userData.userId,
      name: userData.name,
      ticketId,
      conversationId
    });
  }

  /**
   * Usuário parou de digitar
   */
  handleStopTyping(socket, data) {
    const userData = this.userSockets.get(socket.id);
    if (!userData) return;

    const { ticketId, conversationId } = data || {};
    const room = conversationId
      ? `conversation_${conversationId}`
      : `ticket_${ticketId}`;

    socket.to(room).emit('user_stop_typing', {
      userId: userData.userId,
      ticketId,
      conversationId
    });
  }

  /**
   * Enviar mensagem via socket (opcional)
   */
  async handleSendMessage(socket, data) {
    const userData = this.userSockets.get(socket.id);
    if (!userData) return;

    const room = data.conversationId
      ? `conversation_${data.conversationId}`
      : `ticket_${data.ticketId}`;

    this.io.to(room).emit('message_sent', {
      ...data,
      userId: userData.userId,
      userName: userData.name
    });
  }

  /**
   * Mensagem lida
   */
  handleReadMessage(socket, data) {
    const userData = this.userSockets.get(socket.id);
    if (!userData) return;

    const room = data.conversationId
      ? `conversation_${data.conversationId}`
      : `ticket_${data.ticketId}`;

    this.io.to(room).emit('message_read', {
      ...data,
      userId: userData.userId
    });
  }

  /**
   * Reação em mensagem
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
   * Mudar status (away/busy) enquanto conectado
   */
  async handleStatusChange(socket, status) {
    const userData = this.userSockets.get(socket.id);
    
    if (!userData) return;

    if (!['away', 'busy'].includes(status)) return;
    
    userData.status = status;
    await userPresenceService.setUserPresence(userData.userId, status);
    
    this.io.emit('user_status_change', {
      userId: userData.userId,
      name: userData.name,
      status
    });

    await this.broadcastStaffPresence({
      userId: userData.userId,
      name: userData.name,
      status
    });
  }

  /**
   * Desconexão
   */
  async handleDisconnect(socket) {
    const userData = this.userSockets.get(socket.id);
    
    if (userData) {
      const remaining = this.removeUserConnection(userData.userId, socket.id);
      this.connectedUsers.delete(String(userData.userId));
      this.userSockets.delete(socket.id);

      if (remaining === 0) {
        await this.markUserOffline(userData);
        this.io.emit('user_offline', {
          userId: userData.userId,
          name: userData.name,
          role: userData.role
        });
      }
      
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
    
    for (const [, userData] of this.userSockets) {
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
    const key = String(userId);
    const connections = this.userConnections.get(key);
    let delivered = false;

    if (connections?.size) {
      for (const socketId of connections) {
        this.io.to(socketId).emit(event, data);
        delivered = true;
      }
    } else {
      const socketId = this.connectedUsers.get(key);
      if (socketId) {
        this.io.to(socketId).emit(event, data);
        delivered = true;
      }
    }

    return delivered;
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
