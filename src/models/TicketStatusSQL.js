const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Status Personalizados de Tickets
 * Permite criar status customizados além dos padrões
 */
const TicketStatus = sequelize.define('TicketStatus', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Nome do status (ex: "Aguardando Pagamento")'
  },
  
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Slug único (ex: "aguardando-pagamento")'
  },
  
  // Aparência
  color: {
    type: DataTypes.STRING(7),
    allowNull: false,
    defaultValue: '#6c757d',
    comment: 'Cor em hexadecimal (ex: #007bff)'
  },
  
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Ícone Bootstrap Icons (ex: clock, check-circle)'
  },
  
  // Descrição
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do status'
  },
  
  // Tipo/Categoria
  category: {
    type: DataTypes.ENUM('open', 'pending', 'in_progress', 'resolved', 'closed', 'custom'),
    defaultValue: 'custom',
    comment: 'Categoria do status'
  },
  
  // Ordenação
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Ordem de exibição'
  },
  
  // Comportamento
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Status padrão para novos tickets'
  },
  
  isFinal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Status final (ticket não pode mais ser alterado)'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Status ativo'
  },
  
  // Automações
  autoCloseAfterDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Fechar automaticamente após X dias'
  },
  
  notifyUser: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Notificar usuário ao mudar para este status'
  },
  
  notifyMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem de notificação personalizada'
  },
  
  // Permissões
  allowedRoles: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Roles que podem usar este status'
  },
  
  // Transições permitidas
  allowedTransitions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'IDs dos status para os quais pode transitar'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'ticket_statuses',
  timestamps: true,
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['category'] },
    { fields: ['isActive'] },
    { fields: ['order'] },
    { fields: ['isDefault'] }
  ]
});

module.exports = TicketStatus;

