const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Logs de Webhooks
 * Registra histórico completo de chamadas de webhooks
 */
const WebhookLog = sequelize.define('WebhookLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Referência ao Webhook
  webhookId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID do webhook'
  },
  
  // Informações do Evento
  event: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nome do evento que disparou'
  },
  
  // Payload Enviado
  payload: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Payload enviado'
  },
  
  // Requisição
  requestUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'URL da requisição'
  },
  
  requestMethod: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: 'Método HTTP'
  },
  
  requestHeaders: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Headers da requisição'
  },
  
  // Resposta
  responseStatus: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Status HTTP da resposta'
  },
  
  responseBody: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Corpo da resposta'
  },
  
  responseHeaders: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Headers da resposta'
  },
  
  responseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tempo de resposta em milissegundos'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('success', 'failure', 'timeout', 'retry'),
    allowNull: false,
    comment: 'Status da chamada'
  },
  
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensagem de erro (se houver)'
  },
  
  // Retry
  attemptNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Número da tentativa'
  },
  
  willRetry: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Se haverá retry'
  },
  
  nextRetryAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data do próximo retry'
  },
  
  // Metadata
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Metadados adicionais'
  }
}, {
  tableName: 'webhook_logs',
  timestamps: true,
  updatedAt: false, // Logs não devem ser atualizados
  indexes: [
    { fields: ['webhookId'] },
    { fields: ['event'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

/**
 * Métodos de Instância
 */

// Verificar se foi bem-sucedido
WebhookLog.prototype.isSuccess = function() {
  return this.status === 'success' && this.responseStatus >= 200 && this.responseStatus < 300;
};

// Verificar se é erro do servidor
WebhookLog.prototype.isServerError = function() {
  return this.responseStatus >= 500 && this.responseStatus < 600;
};

// Verificar se é erro do cliente
WebhookLog.prototype.isClientError = function() {
  return this.responseStatus >= 400 && this.responseStatus < 500;
};

// Obter resumo
WebhookLog.prototype.getSummary = function() {
  return {
    id: this.id,
    webhookId: this.webhookId,
    event: this.event,
    status: this.status,
    responseStatus: this.responseStatus,
    responseTime: this.responseTime,
    attemptNumber: this.attemptNumber,
    error: this.error,
    createdAt: this.createdAt
  };
};

/**
 * Métodos Estáticos
 */

// Buscar logs de um webhook
WebhookLog.findByWebhook = async function(webhookId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    status,
    event,
    dateFrom,
    dateTo
  } = options;
  
  const where = { webhookId };
  
  if (status) {
    where.status = status;
  }
  
  if (event) {
    where.event = event;
  }
  
  if (dateFrom) {
    where.createdAt = { [sequelize.Sequelize.Op.gte]: new Date(dateFrom) };
  }
  
  if (dateTo) {
    where.createdAt = { ...where.createdAt, [sequelize.Sequelize.Op.lte]: new Date(dateTo) };
  }
  
  return await WebhookLog.findAll({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
};

// Buscar logs com retry pendente
WebhookLog.findPendingRetries = async function() {
  const now = new Date();
  
  return await WebhookLog.findAll({
    where: {
      status: 'retry',
      willRetry: true,
      nextRetryAt: {
        [sequelize.Sequelize.Op.lte]: now
      }
    },
    order: [['nextRetryAt', 'ASC']]
  });
};

// Estatísticas de um webhook
WebhookLog.getWebhookStats = async function(webhookId, options = {}) {
  const { dateFrom, dateTo } = options;
  
  const where = { webhookId };
  
  if (dateFrom) {
    where.createdAt = { [sequelize.Sequelize.Op.gte]: new Date(dateFrom) };
  }
  
  if (dateTo) {
    where.createdAt = { ...where.createdAt, [sequelize.Sequelize.Op.lte]: new Date(dateTo) };
  }
  
  const [total, success, failure, timeout, avgResponseTime] = await Promise.all([
    WebhookLog.count({ where }),
    WebhookLog.count({ where: { ...where, status: 'success' } }),
    WebhookLog.count({ where: { ...where, status: 'failure' } }),
    WebhookLog.count({ where: { ...where, status: 'timeout' } }),
    WebhookLog.findOne({
      where,
      attributes: [
        [sequelize.fn('AVG', sequelize.col('responseTime')), 'avg']
      ]
    })
  ]);
  
  return {
    total,
    success,
    failure,
    timeout,
    successRate: total > 0 ? ((success / total) * 100).toFixed(2) + '%' : '0%',
    avgResponseTime: Math.round(avgResponseTime?.dataValues?.avg || 0) + 'ms'
  };
};

// Limpar logs antigos
WebhookLog.cleanup = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const deleted = await WebhookLog.destroy({
    where: {
      createdAt: {
        [sequelize.Sequelize.Op.lt]: cutoffDate
      }
    }
  });
  
  return deleted;
};

// Estatísticas globais
WebhookLog.getGlobalStats = async function(options = {}) {
  const { dateFrom, dateTo } = options;
  
  const where = {};
  
  if (dateFrom) {
    where.createdAt = { [sequelize.Sequelize.Op.gte]: new Date(dateFrom) };
  }
  
  if (dateTo) {
    where.createdAt = { ...where.createdAt, [sequelize.Sequelize.Op.lte]: new Date(dateTo) };
  }
  
  const [total, success, failure, timeout] = await Promise.all([
    WebhookLog.count({ where }),
    WebhookLog.count({ where: { ...where, status: 'success' } }),
    WebhookLog.count({ where: { ...where, status: 'failure' } }),
    WebhookLog.count({ where: { ...where, status: 'timeout' } })
  ]);
  
  return {
    total,
    success,
    failure,
    timeout,
    successRate: total > 0 ? ((success / total) * 100).toFixed(2) + '%' : '0%'
  };
};

// Top eventos mais chamados
WebhookLog.getTopEvents = async function(limit = 10) {
  return await WebhookLog.findAll({
    attributes: [
      'event',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['event'],
    order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
    limit
  });
};

// Webhooks com mais falhas
WebhookLog.getTopFailures = async function(limit = 10) {
  return await WebhookLog.findAll({
    where: { status: 'failure' },
    attributes: [
      'webhookId',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['webhookId'],
    order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
    limit
  });
};

module.exports = WebhookLog;

