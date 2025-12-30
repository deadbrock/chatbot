const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

/**
 * Modelo de Webhooks
 * Gerencia webhooks personalizados para eventos do sistema
 */
const Webhook = sequelize.define('Webhook', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Informações Básicas
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nome do webhook'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do webhook'
  },
  
  // Configuração da Requisição
  url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      isUrl: true
    },
    comment: 'URL de destino'
  },
  
  method: {
    type: DataTypes.ENUM('POST', 'GET', 'PUT', 'PATCH', 'DELETE'),
    allowNull: false,
    defaultValue: 'POST',
    comment: 'Método HTTP'
  },
  
  headers: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Headers HTTP customizados'
  },
  
  // Eventos
  events: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: 'Lista de eventos que disparam o webhook'
  },
  
  // Segurança
  secret: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Chave secreta para assinatura HMAC'
  },
  
  // Configurações de Retry
  retryAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    comment: 'Número de tentativas em caso de falha'
  },
  
  retryDelay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
    comment: 'Delay entre tentativas em segundos'
  },
  
  timeout: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
    comment: 'Timeout da requisição em segundos'
  },
  
  // Estado
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Se o webhook está ativo'
  },
  
  // Estatísticas
  lastTriggered: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data da última chamada'
  },
  
  lastStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Status da última chamada (success, failure, timeout)'
  },
  
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Última mensagem de erro'
  },
  
  successCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total de chamadas bem-sucedidas'
  },
  
  failureCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total de chamadas falhadas'
  },
  
  // Controle de Acesso
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que criou'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que atualizou'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Metadados adicionais'
  }
}, {
  tableName: 'webhooks',
  timestamps: true,
  indexes: [
    { fields: ['isActive'] },
    { fields: ['createdBy'] },
    { fields: ['events'], type: 'GIN' } // PostgreSQL only, remove for SQLite
  ]
});

/**
 * Métodos de Instância
 */

// Gerar secret automático
Webhook.prototype.generateSecret = function() {
  this.secret = crypto.randomBytes(32).toString('hex');
  return this.secret;
};

// Assinar payload
Webhook.prototype.signPayload = function(payload) {
  if (!this.secret) return null;
  
  const hmac = crypto.createHmac('sha256', this.secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
};

// Verificar se webhook escuta um evento
Webhook.prototype.listensToEvent = function(eventName) {
  return Array.isArray(this.events) && this.events.includes(eventName);
};

// Registrar sucesso
Webhook.prototype.recordSuccess = async function() {
  this.lastTriggered = new Date();
  this.lastStatus = 'success';
  this.lastError = null;
  this.successCount += 1;
  await this.save();
};

// Registrar falha
Webhook.prototype.recordFailure = async function(error) {
  this.lastTriggered = new Date();
  this.lastStatus = 'failure';
  this.lastError = error.message || String(error);
  this.failureCount += 1;
  await this.save();
};

// Registrar timeout
Webhook.prototype.recordTimeout = async function() {
  this.lastTriggered = new Date();
  this.lastStatus = 'timeout';
  this.lastError = 'Request timeout';
  this.failureCount += 1;
  await this.save();
};

// Verificar se deve fazer retry
Webhook.prototype.shouldRetry = function(attemptNumber) {
  return attemptNumber < this.retryAttempts;
};

// Calcular delay para retry (exponential backoff)
Webhook.prototype.calculateRetryDelay = function(attemptNumber) {
  return this.retryDelay * Math.pow(2, attemptNumber);
};

// Obter estatísticas
Webhook.prototype.getStats = function() {
  const total = this.successCount + this.failureCount;
  const successRate = total > 0 ? (this.successCount / total * 100).toFixed(2) : 0;
  
  return {
    total,
    successCount: this.successCount,
    failureCount: this.failureCount,
    successRate: `${successRate}%`,
    lastTriggered: this.lastTriggered,
    lastStatus: this.lastStatus,
    isHealthy: this.lastStatus === 'success' && this.failureCount < 10
  };
};

// Resetar estatísticas
Webhook.prototype.resetStats = async function() {
  this.successCount = 0;
  this.failureCount = 0;
  this.lastError = null;
  await this.save();
};

/**
 * Métodos Estáticos
 */

// Eventos disponíveis no sistema
Webhook.AVAILABLE_EVENTS = [
  // Ticket events
  'ticket.created',
  'ticket.updated',
  'ticket.assigned',
  'ticket.status_changed',
  'ticket.closed',
  'ticket.reopened',
  
  // Message events
  'message.received',
  'message.sent',
  'message.read',
  'message.delivered',
  
  // Contact events
  'contact.created',
  'contact.updated',
  'contact.blocked',
  'contact.unblocked',
  
  // User events
  'user.login',
  'user.logout',
  'user.created',
  'user.updated',
  
  // Campaign events
  'campaign.started',
  'campaign.completed',
  'campaign.failed',
  
  // Flow events
  'flow.started',
  'flow.completed',
  'flow.failed',
  
  // NPS events
  'nps.rated',
  
  // System events
  'system.error',
  'system.warning'
];

// Buscar webhooks por evento
Webhook.findByEvent = async function(eventName) {
  return await Webhook.findAll({
    where: {
      isActive: true,
      events: {
        [sequelize.Sequelize.Op.contains]: [eventName]
      }
    },
    order: [['createdAt', 'ASC']]
  });
};

// Buscar webhooks com falhas recentes
Webhook.findWithFailures = async function(threshold = 5) {
  return await Webhook.findAll({
    where: {
      failureCount: {
        [sequelize.Sequelize.Op.gte]: threshold
      }
    },
    order: [['failureCount', 'DESC']]
  });
};

// Buscar webhooks inativos por muito tempo
Webhook.findInactive = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return await Webhook.findAll({
    where: {
      [sequelize.Sequelize.Op.or]: [
        { lastTriggered: null },
        {
          lastTriggered: {
            [sequelize.Sequelize.Op.lt]: cutoffDate
          }
        }
      ]
    }
  });
};

// Estatísticas globais
Webhook.getGlobalStats = async function() {
  const [total, active, inactive] = await Promise.all([
    Webhook.count(),
    Webhook.count({ where: { isActive: true } }),
    Webhook.count({ where: { isActive: false } })
  ]);
  
  const webhooks = await Webhook.findAll();
  
  const totalCalls = webhooks.reduce((sum, w) => sum + w.successCount + w.failureCount, 0);
  const totalSuccess = webhooks.reduce((sum, w) => sum + w.successCount, 0);
  const totalFailures = webhooks.reduce((sum, w) => sum + w.failureCount, 0);
  
  return {
    total,
    active,
    inactive,
    totalCalls,
    totalSuccess,
    totalFailures,
    successRate: totalCalls > 0 ? ((totalSuccess / totalCalls) * 100).toFixed(2) + '%' : '0%'
  };
};

// Validar evento
Webhook.isValidEvent = function(eventName) {
  return Webhook.AVAILABLE_EVENTS.includes(eventName);
};

// Obter eventos por categoria
Webhook.getEventsByCategory = function() {
  return {
    ticket: Webhook.AVAILABLE_EVENTS.filter(e => e.startsWith('ticket.')),
    message: Webhook.AVAILABLE_EVENTS.filter(e => e.startsWith('message.')),
    contact: Webhook.AVAILABLE_EVENTS.filter(e => e.startsWith('contact.')),
    user: Webhook.AVAILABLE_EVENTS.filter(e => e.startsWith('user.')),
    campaign: Webhook.AVAILABLE_EVENTS.filter(e => e.startsWith('campaign.')),
    flow: Webhook.AVAILABLE_EVENTS.filter(e => e.startsWith('flow.')),
    nps: Webhook.AVAILABLE_EVENTS.filter(e => e.startsWith('nps.')),
    system: Webhook.AVAILABLE_EVENTS.filter(e => e.startsWith('system.'))
  };
};

module.exports = Webhook;

