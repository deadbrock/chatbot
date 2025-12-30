const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Campanhas de Mensagens em Massa
 * Sistema completo de envio de mensagens para múltiplos contatos
 */
const Campaign = sequelize.define('Campaign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome da campanha'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição da campanha'
  },
  
  // Conteúdo
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Mensagem a ser enviada'
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
  
  // Segmentação
  targetType: {
    type: DataTypes.ENUM('all', 'segment', 'tags', 'custom', 'list'),
    defaultValue: 'all',
    comment: 'Tipo de segmentação'
  },
  
  targetFilters: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Filtros de segmentação (categoria, tags, etc)'
  },
  
  targetContacts: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Lista de IDs de contatos (se targetType = list)'
  },
  
  excludeContacts: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Lista de IDs de contatos a excluir'
  },
  
  // Agendamento
  scheduledFor: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora agendada para envio'
  },
  
  sendImmediately: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Enviar imediatamente'
  },
  
  // Controle de envio
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'completed', 'paused', 'cancelled', 'failed'),
    defaultValue: 'draft',
    comment: 'Status da campanha'
  },
  
  sendingSpeed: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Mensagens por minuto (controle de velocidade)'
  },
  
  respectOptOut: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Respeitar opt-out de contatos'
  },
  
  // Estatísticas
  totalContacts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de contatos na campanha'
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
  
  repliesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantidade de respostas'
  },
  
  // Datas de execução
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora de início do envio'
  },
  
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora de conclusão'
  },
  
  // Configurações avançadas
  trackOpens: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Rastrear aberturas'
  },
  
  trackClicks: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Rastrear cliques em links'
  },
  
  allowReplies: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Permitir respostas'
  },
  
  autoReply: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Resposta automática para quem responder'
  },
  
  // Tags e categorização
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Tags da campanha'
  },
  
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Categoria da campanha'
  },
  
  // Variáveis personalizadas
  variables: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Variáveis personalizadas disponíveis'
  },
  
  // Metadados e logs
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  errorLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de erros durante envio'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Criado por (user ID)'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Atualizado por (user ID)'
  },
  
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Aprovado por (user ID)'
  },
  
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de aprovação'
  }
}, {
  tableName: 'campaigns',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['scheduledFor'] },
    { fields: ['category'] },
    { fields: ['createdBy'] },
    { fields: ['createdAt'] },
    { fields: ['targetType'] }
  ]
});

module.exports = Campaign;

