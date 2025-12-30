const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Fluxo de Campanha
 * Sistema de automação de campanhas multi-etapas com gatilhos e ações
 */
const CampaignFlow = sequelize.define('CampaignFlow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome do fluxo de campanha'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do fluxo'
  },
  
  // Configuração do Fluxo
  campaignId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID da campanha associada (opcional)'
  },
  
  // Gatilho inicial
  trigger: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Configuração do gatilho que inicia o fluxo'
  },
  // Exemplo: {
  //   type: 'campaign_sent', // campaign_sent, contact_replied, tag_added, etc
  //   conditions: { status: 'delivered' }
  // }
  
  // Etapas do fluxo
  steps: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de etapas do fluxo'
  },
  // Exemplo: [
  //   {
  //     id: 'step1',
  //     type: 'wait', // wait, send_message, add_tag, change_status, webhook, condition
  //     config: { duration: 24, unit: 'hours' },
  //     nextStep: 'step2'
  //   },
  //   {
  //     id: 'step2',
  //     type: 'send_message',
  //     config: { 
  //       message: 'Olá {{nome}}, ainda tem interesse?',
  //       templateId: 'uuid'
  //     },
  //     nextStep: 'step3'
  //   },
  //   {
  //     id: 'step3',
  //     type: 'condition',
  //     config: {
  //       field: 'replied',
  //       operator: 'equals',
  //       value: true
  //     },
  //     onTrue: 'step4',
  //     onFalse: 'step5'
  //   }
  // ]
  
  // Configurações de execução
  executionMode: {
    type: DataTypes.ENUM('sequential', 'parallel'),
    defaultValue: 'sequential',
    comment: 'Modo de execução das etapas'
  },
  
  maxExecutions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Máximo de execuções (0 = ilimitado)'
  },
  
  currentExecutions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Execuções atuais'
  },
  
  // Controle de tempo
  startDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de início do fluxo'
  },
  
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de término do fluxo'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'archived'),
    defaultValue: 'draft',
    comment: 'Status do fluxo'
  },
  
  // Segmentação
  targetFilters: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Filtros de segmentação para aplicar o fluxo'
  },
  
  // Estatísticas
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      totalEntered: 0,
      totalCompleted: 0,
      totalDropped: 0,
      avgCompletionTime: 0,
      conversionRate: 0
    },
    comment: 'Estatísticas do fluxo'
  },
  
  // Configurações avançadas
  allowReentry: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Permitir que contatos entrem novamente no fluxo'
  },
  
  exitOnReply: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Sair do fluxo se o contato responder'
  },
  
  exitConditions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Condições para sair do fluxo'
  },
  
  // A/B Testing
  abTestEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Habilitar teste A/B'
  },
  
  abTestConfig: {
    type: DataTypes.JSON,
    defaultValue: null,
    comment: 'Configuração do teste A/B'
  },
  // Exemplo: {
  //   variants: [
  //     { id: 'A', percentage: 50, steps: [...] },
  //     { id: 'B', percentage: 50, steps: [...] }
  //   ]
  // }
  
  // Notificações
  notifications: {
    type: DataTypes.JSON,
    defaultValue: {
      onStart: false,
      onComplete: false,
      onError: true,
      emails: []
    },
    comment: 'Configuração de notificações'
  },
  
  // Logs e histórico
  executionLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de execuções (últimas 100)'
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
  tableName: 'campaign_flows',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['campaignId'] },
    { fields: ['createdBy'] },
    { fields: ['startDate'] },
    { fields: ['endDate'] }
  ]
});

module.exports = CampaignFlow;

