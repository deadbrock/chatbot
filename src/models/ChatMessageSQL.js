const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Mensagens de Chat
 * Armazena todas as mensagens trocadas entre usuários e contatos
 */
const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  messageId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'ID único da mensagem (WhatsApp)'
  },
  
  // Relacionamentos
  ticketId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Ticket associado (somente durante atendimento humano)'
  },

  conversationId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Conversa do inbox WhatsApp'
  },
  
  contactId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Contato associado'
  },
  
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Usuário/Atendente que enviou (se interno)'
  },
  
  // Direção
  direction: {
    type: DataTypes.ENUM('incoming', 'outgoing'),
    allowNull: false,
    comment: 'Direção da mensagem'
  },
  
  // Remetente/Destinatário
  from: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Número do remetente (formato WhatsApp)'
  },
  
  to: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Número do destinatário (formato WhatsApp)'
  },
  
  fromName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome do remetente'
  },
  
  // Conteúdo
  body: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Corpo da mensagem (texto)'
  },
  
  type: {
    type: DataTypes.ENUM(
      'text',
      'image',
      'video',
      'audio',
      'voice',
      'document',
      'sticker',
      'location',
      'contact',
      'ptt',
      'revoked',
      'system'
    ),
    defaultValue: 'text',
    comment: 'Tipo de mensagem'
  },
  
  // Mídia
  hasMedia: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica se tem mídia anexada'
  },
  
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL da mídia (se houver)'
  },
  
  mediaType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Tipo MIME da mídia'
  },
  
  mediaSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tamanho da mídia em bytes'
  },
  
  mediaFilename: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome do arquivo de mídia'
  },
  
  mediaDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Duração (para áudio/vídeo) em segundos'
  },
  
  thumbnail: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Thumbnail base64 (para imagem/vídeo)'
  },
  
  // Localização (se type = location)
  location: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Coordenadas e descrição da localização'
  },
  // Exemplo: { latitude: -23.5505, longitude: -46.6333, description: 'São Paulo' }
  
  // Contato (se type = contact)
  contactCard: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Dados do cartão de contato'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM(
      'pending',
      'sent',
      'delivered',
      'read',
      'failed',
      'deleted'
    ),
    defaultValue: 'pending',
    comment: 'Status da mensagem'
  },
  
  ack: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'ACK do WhatsApp (0=erro, 1=enviado, 2=entregue, 3=lido, 4=played)'
  },
  
  // Citação/Resposta
  quotedMessageId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID da mensagem citada/respondida'
  },
  
  quotedMessage: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Conteúdo da mensagem citada'
  },
  
  // Reações
  reactions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de reações (emoji)'
  },
  
  // Flags
  isForwarded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Mensagem encaminhada'
  },
  
  isStarred: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Mensagem marcada como favorita'
  },
  
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Mensagem deletada'
  },
  
  fromMe: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Enviada por mim (sistema)'
  },
  
  // Timestamps
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Timestamp da mensagem'
  },
  
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora de envio'
  },
  
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora de entrega'
  },
  
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora de leitura'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  rawData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Dados brutos do WhatsApp (para debug)'
  },
  
  // Erro (se houver)
  error: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Informações de erro (se falhou)'
  }
}, {
  tableName: 'chat_messages',
  timestamps: true,
  indexes: [
    { fields: ['messageId'], unique: true },
    { fields: ['ticketId'] },
    { fields: ['conversationId'] },
    { fields: ['contactId'] },
    { fields: ['userId'] },
    { fields: ['direction'] },
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['timestamp'] },
    { fields: ['from'] },
    { fields: ['to'] },
    { fields: ['createdAt'] }
  ]
});

/**
 * Atualiza status da mensagem
 */
ChatMessage.prototype.updateStatus = async function(newStatus, ack = null) {
  const updates = { status: newStatus };
  
  if (ack !== null) {
    updates.ack = ack;
  }
  
  // Atualizar timestamps baseado no status
  const now = new Date();
  
  switch (newStatus) {
    case 'sent':
      if (!this.sentAt) updates.sentAt = now;
      break;
    case 'delivered':
      if (!this.deliveredAt) updates.deliveredAt = now;
      break;
    case 'read':
      if (!this.readAt) updates.readAt = now;
      break;
  }
  
  await this.update(updates);
};

/**
 * Adiciona reação à mensagem
 */
ChatMessage.prototype.addReaction = async function(emoji, userId) {
  const reactions = this.reactions || [];
  
  // Verificar se usuário já reagiu
  const existingIndex = reactions.findIndex(r => r.userId === userId);
  
  if (existingIndex >= 0) {
    // Atualizar reação existente
    reactions[existingIndex].emoji = emoji;
    reactions[existingIndex].timestamp = new Date();
  } else {
    // Adicionar nova reação
    reactions.push({
      emoji,
      userId,
      timestamp: new Date()
    });
  }
  
  await this.update({ reactions });
};

/**
 * Remove reação da mensagem
 */
ChatMessage.prototype.removeReaction = async function(userId) {
  const reactions = (this.reactions || []).filter(r => r.userId !== userId);
  await this.update({ reactions });
};

/**
 * Marca mensagem como lida
 */
ChatMessage.prototype.markAsRead = async function() {
  if (this.status !== 'read') {
    await this.updateStatus('read', 3);
  }
};

/**
 * Marca mensagem como favorita
 */
ChatMessage.prototype.toggleStar = async function() {
  await this.update({ isStarred: !this.isStarred });
};

/**
 * Deleta mensagem (soft delete)
 */
ChatMessage.prototype.softDelete = async function() {
  await this.update({
    isDeleted: true,
    body: '[Mensagem deletada]',
    mediaUrl: null
  });
};

/**
 * Busca mensagens de um ticket
 */
ChatMessage.findByTicket = async function(ticketId, options = {}) {
  const { limit = 50, offset = 0 } = options;
  
  return await ChatMessage.findAll({
    where: { ticketId, isDeleted: false },
    order: [['timestamp', 'DESC']],
    limit,
    offset
  });
};

ChatMessage.findByConversation = async function(conversationId, options = {}) {
  const { limit = 50, offset = 0 } = options;
  
  return await ChatMessage.findAll({
    where: { conversationId, isDeleted: false },
    order: [['timestamp', 'DESC']],
    limit,
    offset
  });
};

/**
 * Busca mensagens entre duas datas
 */
ChatMessage.findByDateRange = async function(startDate, endDate, filters = {}) {
  const where = {
    timestamp: {
      [sequelize.Sequelize.Op.between]: [startDate, endDate]
    },
    isDeleted: false,
    ...filters
  };
  
  return await ChatMessage.findAll({
    where,
    order: [['timestamp', 'DESC']]
  });
};

/**
 * Busca mensagens por contato
 */
ChatMessage.findByContact = async function(contactId, options = {}) {
  const { limit = 50, offset = 0 } = options;
  
  return await ChatMessage.findAll({
    where: { contactId, isDeleted: false },
    order: [['timestamp', 'DESC']],
    limit,
    offset
  });
};

/**
 * Conta mensagens não lidas de um ticket
 */
ChatMessage.countUnread = async function(conversationOrTicketId, { by = 'conversation' } = {}) {
  const field = by === 'ticket' ? 'ticketId' : 'conversationId';
  return await ChatMessage.count({
    where: {
      [field]: conversationOrTicketId,
      direction: 'incoming',
      status: { [sequelize.Sequelize.Op.ne]: 'read' },
      isDeleted: false
    }
  });
};

/**
 * Busca últimas mensagens (para lista de conversas)
 */
ChatMessage.getLastMessages = async function(limit = 10) {
  return await sequelize.query(`
    SELECT DISTINCT ON (ticket_id) *
    FROM chat_messages
    WHERE is_deleted = false
    ORDER BY ticket_id, timestamp DESC
    LIMIT :limit
  `, {
    replacements: { limit },
    type: sequelize.QueryTypes.SELECT,
    model: ChatMessage,
    mapToModel: true
  });
};

module.exports = ChatMessage;

