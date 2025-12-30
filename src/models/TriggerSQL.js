const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Gatilhos e Ações (Triggers)
 * Sistema de automação baseado em eventos
 */
const Trigger = sequelize.define('Trigger', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome do gatilho'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do gatilho'
  },
  
  // Tipo de evento que dispara o gatilho
  eventType: {
    type: DataTypes.ENUM(
      'message_received',
      'message_sent',
      'ticket_created',
      'ticket_status_changed',
      'ticket_assigned',
      'ticket_closed',
      'contact_created',
      'contact_updated',
      'tag_added',
      'tag_removed',
      'campaign_sent',
      'campaign_opened',
      'campaign_clicked',
      'nps_received',
      'schedule_triggered',
      'webhook_received',
      'custom'
    ),
    allowNull: false,
    comment: 'Tipo de evento'
  },
  
  // Condições para ativar o gatilho
  conditions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Condições que devem ser satisfeitas'
  },
  // Exemplo: [
  //   {
  //     field: 'message.content',
  //     operator: 'contains',
  //     value: 'orçamento'
  //   },
  //   {
  //     field: 'contact.tags',
  //     operator: 'includes',
  //     value: 'vip'
  //   }
  // ]
  
  // Operador lógico entre condições
  conditionsOperator: {
    type: DataTypes.ENUM('AND', 'OR'),
    defaultValue: 'AND',
    comment: 'Operador lógico entre condições'
  },
  
  // Ações a executar quando o gatilho é ativado
  actions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Ações a executar'
  },
  // Exemplo: [
  //   {
  //     type: 'send_message',
  //     config: {
  //       message: 'Olá! Vi que você pediu um orçamento.',
  //       templateId: 'uuid'
  //     }
  //   },
  //   {
  //     type: 'add_tag',
  //     config: { tagId: 'uuid' }
  //   },
  //   {
  //     type: 'create_ticket',
  //     config: {
  //       department: 'vendas',
  //       priority: 'high'
  //     }
  //   },
  //   {
  //     type: 'webhook',
  //     config: {
  //       url: 'https://...',
  //       method: 'POST',
  //       headers: {},
  //       body: {}
  //     }
  //   },
  //   {
  //     type: 'assign_to_agent',
  //     config: { agentId: 'uuid' }
  //   },
  //   {
  //     type: 'change_status',
  //     config: { status: 'in_progress' }
  //   },
  //   {
  //     type: 'start_flow',
  //     config: { flowId: 'uuid' }
  //   },
  //   {
  //     type: 'send_email',
  //     config: {
  //       to: 'email@example.com',
  //       subject: 'Novo lead',
  //       body: 'Detalhes...'
  //     }
  //   }
  // ]
  
  // Configuração de execução
  executionMode: {
    type: DataTypes.ENUM('immediate', 'delayed', 'scheduled'),
    defaultValue: 'immediate',
    comment: 'Modo de execução'
  },
  
  executionDelay: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Atraso em segundos (se delayed)'
  },
  
  executionSchedule: {
    type: DataTypes.JSON,
    defaultValue: null,
    comment: 'Agendamento (se scheduled)'
  },
  // Exemplo: { time: '09:00', days: [1,2,3,4,5] }
  
  // Controle de frequência
  maxExecutionsPerContact: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Máximo de execuções por contato (0 = ilimitado)'
  },
  
  cooldownPeriod: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Período de cooldown em horas'
  },
  
  // Filtros
  targetFilters: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Filtros para aplicar o gatilho'
  },
  
  excludeFilters: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Filtros para excluir'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('active', 'paused', 'archived'),
    defaultValue: 'active',
    comment: 'Status do gatilho'
  },
  
  // Prioridade
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Prioridade de execução (maior = primeiro)'
  },
  
  // Controle de erro
  onErrorAction: {
    type: DataTypes.ENUM('stop', 'continue', 'retry'),
    defaultValue: 'stop',
    comment: 'Ação em caso de erro'
  },
  
  maxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    comment: 'Máximo de tentativas em caso de erro'
  },
  
  // Estatísticas
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      totalTriggered: 0,
      totalExecuted: 0,
      totalFailed: 0,
      successRate: 0,
      avgExecutionTime: 0
    },
    comment: 'Estatísticas do gatilho'
  },
  
  // Notificações
  notifyOnExecution: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Notificar ao executar'
  },
  
  notifyOnError: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Notificar em caso de erro'
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
    comment: 'Log de execuções (últimas 100)'
  },
  
  errorLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de erros'
  },
  
  // Teste e debug
  testMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Modo de teste (não executa ações reais)'
  },
  
  debugEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Habilitar logs detalhados'
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
  
  lastTriggeredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última vez que foi disparado'
  },
  
  lastExecutedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última execução'
  }
}, {
  tableName: 'triggers',
  timestamps: true,
  indexes: [
    { fields: ['eventType'] },
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['createdBy'] }
  ]
});

module.exports = Trigger;

