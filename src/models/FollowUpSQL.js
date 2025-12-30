const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Follow-up Automático
 * Sistema de lembretes e reengajamento automático de leads
 */
const FollowUp = sequelize.define('FollowUp', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome da regra de follow-up'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição da regra'
  },
  
  // Tipo de follow-up
  type: {
    type: DataTypes.ENUM('ticket_status', 'inactivity', 'campaign', 'custom', 'birthday', 'abandoned_cart'),
    allowNull: false,
    comment: 'Tipo de follow-up'
  },
  
  // Gatilho
  trigger: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Condições que ativam o follow-up'
  },
  // Exemplo para ticket_status:
  // {
  //   ticketStatus: 'waiting_human',
  //   waitTime: 24,
  //   waitUnit: 'hours'
  // }
  // Exemplo para inactivity:
  // {
  //   inactiveDays: 7,
  //   lastInteractionType: 'any'
  // }
  
  // Mensagem
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Mensagem do follow-up'
  },
  
  messageTemplateId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do template de mensagem (opcional)'
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
  
  // Configuração de timing
  delay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Tempo de espera antes do envio'
  },
  
  delayUnit: {
    type: DataTypes.ENUM('minutes', 'hours', 'days', 'weeks'),
    defaultValue: 'hours',
    comment: 'Unidade do tempo de espera'
  },
  
  // Horário de envio
  sendOnlyDuringBusinessHours: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Enviar apenas em horário comercial'
  },
  
  businessHours: {
    type: DataTypes.JSON,
    defaultValue: {
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5] // Segunda a Sexta
    },
    comment: 'Horário comercial'
  },
  
  // Sequência de follow-ups
  sequence: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Sequência de follow-ups (se houver)'
  },
  // Exemplo: [
  //   { delay: 1, unit: 'days', message: 'Primeira tentativa' },
  //   { delay: 3, unit: 'days', message: 'Segunda tentativa' },
  //   { delay: 7, unit: 'days', message: 'Última tentativa' }
  // ]
  
  currentSequenceStep: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Etapa atual da sequência'
  },
  
  // Segmentação
  targetFilters: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Filtros para aplicar o follow-up'
  },
  
  excludeFilters: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Filtros para excluir do follow-up'
  },
  
  // Controle de execução
  maxAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    comment: 'Máximo de tentativas'
  },
  
  stopOnReply: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Parar se o contato responder'
  },
  
  stopOnConversion: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Parar se houver conversão'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('active', 'paused', 'archived'),
    defaultValue: 'active',
    comment: 'Status da regra'
  },
  
  // Prioridade
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Prioridade (maior = mais importante)'
  },
  
  // Estatísticas
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      totalSent: 0,
      totalReplies: 0,
      totalConversions: 0,
      replyRate: 0,
      conversionRate: 0
    },
    comment: 'Estatísticas do follow-up'
  },
  
  // Ações após envio
  actionsAfterSend: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Ações a executar após envio'
  },
  // Exemplo: [
  //   { type: 'add_tag', value: 'follow-up-sent' },
  //   { type: 'change_status', value: 'waiting_reply' }
  // ]
  
  // Notificações
  notifyTeam: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Notificar equipe ao enviar'
  },
  
  notifyEmails: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Emails para notificar'
  },
  
  // Logs
  executionLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de execuções (últimas 50)'
  },
  
  errorLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de erros'
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
    allowNull: true,
    comment: 'Criado por (user ID)'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Atualizado por (user ID)'
  },
  
  lastExecutedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última execução'
  }
}, {
  tableName: 'follow_ups',
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['createdBy'] }
  ]
});

module.exports = FollowUp;

