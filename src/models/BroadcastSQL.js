const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Transmissões (Broadcast)
 * Sistema de envio rápido de mensagens para listas específicas
 * Diferente de campanhas, transmissões são mais simples e imediatas
 */
const Broadcast = sequelize.define('Broadcast', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome da transmissão'
  },
  
  // Conteúdo
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Mensagem a ser transmitida'
  },
  
  // Mídia
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL da mídia anexada'
  },
  
  mediaType: {
    type: DataTypes.ENUM('image', 'video', 'audio', 'document'),
    allowNull: true,
    comment: 'Tipo de mídia'
  },
  
  // Lista de destinatários
  recipients: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de IDs de contatos ou números de telefone'
  },
  
  recipientType: {
    type: DataTypes.ENUM('contacts', 'phones', 'list'),
    defaultValue: 'contacts',
    comment: 'Tipo de destinatários'
  },
  
  // Lista de transmissão (se usar listas salvas)
  listId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID da lista de transmissão salva'
  },
  
  listName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome da lista de transmissão'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('draft', 'sending', 'completed', 'failed'),
    defaultValue: 'draft',
    comment: 'Status da transmissão'
  },
  
  // Estatísticas
  totalRecipients: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de destinatários'
  },
  
  sentCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantidade enviada'
  },
  
  deliveredCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantidade entregue'
  },
  
  readCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantidade lida'
  },
  
  failedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantidade com falha'
  },
  
  // Datas
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora de envio'
  },
  
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora de conclusão'
  },
  
  // Configurações
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
    defaultValue: 'normal',
    comment: 'Prioridade de envio'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  errorLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de erros'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Criado por (user ID)'
  }
}, {
  tableName: 'broadcasts',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['listId'] },
    { fields: ['createdBy'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Broadcast;

