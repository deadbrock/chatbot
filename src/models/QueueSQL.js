const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Filas de Atendimento
 * Sistema de distribuição e roteamento de tickets
 */
const Queue = sequelize.define('Queue', {
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
    comment: 'Nome da fila (ex: "Suporte Técnico")'
  },
  
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Slug único (ex: "suporte-tecnico")'
  },
  
  // Aparência
  color: {
    type: DataTypes.STRING(7),
    allowNull: false,
    defaultValue: '#007bff',
    comment: 'Cor em hexadecimal'
  },
  
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Ícone Bootstrap Icons'
  },
  
  // Descrição
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição da fila'
  },
  
  // Configurações de distribuição
  distributionMode: {
    type: DataTypes.ENUM('round_robin', 'least_active', 'manual', 'random', 'priority'),
    defaultValue: 'round_robin',
    comment: 'Modo de distribuição de tickets'
  },
  
  maxTicketsPerAgent: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Máximo de tickets simultâneos por agente'
  },
  
  autoAssign: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Atribuir automaticamente ao receber ticket'
  },
  
  // Horário de funcionamento
  workingHours: {
    type: DataTypes.JSON,
    defaultValue: {
      monday: { start: '09:00', end: '18:00', enabled: true },
      tuesday: { start: '09:00', end: '18:00', enabled: true },
      wednesday: { start: '09:00', end: '18:00', enabled: true },
      thursday: { start: '09:00', end: '18:00', enabled: true },
      friday: { start: '09:00', end: '18:00', enabled: true },
      saturday: { start: '09:00', end: '13:00', enabled: false },
      sunday: { start: '09:00', end: '13:00', enabled: false }
    },
    comment: 'Horário de funcionamento'
  },
  
  // Mensagens automáticas
  greetingMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem de saudação ao entrar na fila'
  },
  
  outOfHoursMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem fora do horário'
  },
  
  queueMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem enquanto aguarda na fila'
  },
  
  // Chatbot
  chatbotEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Habilitar chatbot antes do atendimento humano'
  },
  
  chatbotFlowId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do fluxo de chatbot'
  },
  
  chatbotTimeout: {
    type: DataTypes.INTEGER,
    defaultValue: 300,
    comment: 'Timeout do chatbot em segundos (0 = sem timeout)'
  },
  
  // Prioridade
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Prioridade da fila (maior = mais prioritário)'
  },
  
  // Limites e alertas
  maxQueueSize: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tamanho máximo da fila (0 = ilimitado)'
  },
  
  alertThreshold: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Alertar quando fila atingir X tickets (0 = desabilitado)'
  },
  
  alertEmails: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Emails para receber alertas'
  },
  
  // SLA
  slaTime: {
    type: DataTypes.INTEGER,
    defaultValue: 3600,
    comment: 'Tempo de SLA em segundos'
  },
  
  // Agentes
  agents: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'IDs dos agentes desta fila'
  },
  
  // Tags automáticas
  autoTags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Tags aplicadas automaticamente aos tickets'
  },
  
  // Ordenação
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Ordem de exibição'
  },
  
  // Status
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Fila ativa'
  },
  
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Fila padrão'
  },
  
  // Estatísticas (cache)
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      waiting: 0,
      active: 0,
      resolved: 0,
      avgWaitTime: 0,
      avgResponseTime: 0
    },
    comment: 'Estatísticas em cache'
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
  tableName: 'queues',
  timestamps: true,
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['isActive'] },
    { fields: ['isDefault'] },
    { fields: ['priority'] },
    { fields: ['order'] }
  ]
});

module.exports = Queue;

