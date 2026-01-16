const Webhook = require('../models/WebhookSQL');
const WebhookLog = require('../models/WebhookLogSQL');
const webhookService = require('../services/webhookService');
const { sendSuccess, sendError, notFound } = require('../utils/http');
const logger = require('../utils/logger');

/**
 * CONTROLLER DE WEBHOOKS
 * Gerenciamento completo de webhooks
 */

/**
 * Lista todos os webhooks
 * GET /api/webhooks
 */
exports.listWebhooks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isActive, event } = req.query;

    const where = {};

    // Filtro por status
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Filtro por evento
    if (event) {
      where.events = {
        [Webhook.sequelize.Sequelize.Op.contains]: [event]
      };
    }

    // Se não for admin, mostrar apenas webhooks do usuário
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      where.createdBy = userId;
    }

    const webhooks = await Webhook.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    // Adicionar estatísticas
    const webhooksWithStats = webhooks.map(webhook => ({
      ...webhook.toJSON(),
      stats: webhook.getStats()
    }));

    sendSuccess(res, webhooksWithStats, 'Webhooks listados com sucesso');
  } catch (err) {
    logger.error('Erro ao listar webhooks:', err);
    sendError(res, 'Erro ao listar webhooks', 500);
  }
};

/**
 * Cria novo webhook
 * POST /api/webhooks
 */
exports.createWebhook = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      url,
      method,
      headers,
      events,
      secret,
      retryAttempts,
      retryDelay,
      timeout
    } = req.body;

    // Validações
    if (!name) {
      return sendError(res, 'Nome do webhook é obrigatório', 400);
    }

    if (!url) {
      return sendError(res, 'URL do webhook é obrigatória', 400);
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return sendError(res, 'Eventos são obrigatórios', 400);
    }

    // Validar eventos
    const invalidEvents = events.filter(e => !Webhook.isValidEvent(e));
    if (invalidEvents.length > 0) {
      return sendError(res, `Eventos inválidos: ${invalidEvents.join(', ')}`, 400);
    }

    // Criar webhook
    const webhook = await Webhook.create({
      name,
      description,
      url,
      method: method || 'POST',
      headers: headers || {},
      events,
      secret,
      retryAttempts: retryAttempts || 3,
      retryDelay: retryDelay || 60,
      timeout: timeout || 30,
      createdBy: userId
    });

    // Gerar secret se não fornecido
    if (!secret) {
      webhook.generateSecret();
      await webhook.save();
    }

    logger.info(`Webhook criado: ${webhook.id} por ${userId}`);
    sendSuccess(res, webhook, 'Webhook criado com sucesso', 201);
  } catch (err) {
    logger.error('Erro ao criar webhook:', err);
    sendError(res, 'Erro ao criar webhook', 500);
  }
};

/**
 * Obtém detalhes de um webhook
 * GET /api/webhooks/:id
 */
exports.getWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      return notFound(res, 'Webhook não encontrado');
    }

    // Verificar permissão
    if (webhook.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return sendError(res, 'Acesso negado', 403);
    }

    const webhookData = {
      ...webhook.toJSON(),
      stats: webhook.getStats()
    };

    sendSuccess(res, webhookData, 'Webhook obtido com sucesso');
  } catch (err) {
    logger.error('Erro ao obter webhook:', err);
    sendError(res, 'Erro ao obter webhook', 500);
  }
};

/**
 * Atualiza um webhook
 * PATCH /api/webhooks/:id
 */
exports.updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      return notFound(res, 'Webhook não encontrado');
    }

    // Verificar permissão
    if (webhook.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return sendError(res, 'Acesso negado', 403);
    }

    // Validar eventos se fornecidos
    if (updates.events) {
      const invalidEvents = updates.events.filter(e => !Webhook.isValidEvent(e));
      if (invalidEvents.length > 0) {
        return sendError(res, `Eventos inválidos: ${invalidEvents.join(', ')}`, 400);
      }
    }

    // Campos permitidos
    const allowedFields = [
      'name', 'description', 'url', 'method', 'headers', 'events',
      'secret', 'retryAttempts', 'retryDelay', 'timeout', 'isActive'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        webhook[field] = updates[field];
      }
    });

    webhook.updatedBy = userId;
    await webhook.save();

    logger.info(`Webhook atualizado: ${webhook.id} por ${userId}`);
    sendSuccess(res, webhook, 'Webhook atualizado com sucesso');
  } catch (err) {
    logger.error('Erro ao atualizar webhook:', err);
    sendError(res, 'Erro ao atualizar webhook', 500);
  }
};

/**
 * Deleta um webhook
 * DELETE /api/webhooks/:id
 */
exports.deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      return notFound(res, 'Webhook não encontrado');
    }

    // Verificar permissão
    if (webhook.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return sendError(res, 'Acesso negado', 403);
    }

    await webhook.destroy();

    logger.info(`Webhook deletado: ${id} por ${userId}`);
    sendSuccess(res, null, 'Webhook deletado com sucesso');
  } catch (err) {
    logger.error('Erro ao deletar webhook:', err);
    sendError(res, 'Erro ao deletar webhook', 500);
  }
};

/**
 * Testa um webhook
 * POST /api/webhooks/:id/test
 */
exports.testWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      return notFound(res, 'Webhook não encontrado');
    }

    // Verificar permissão
    if (webhook.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return sendError(res, 'Acesso negado', 403);
    }

    logger.info(`Testando webhook: ${webhook.name}`);

    const result = await webhookService.testWebhook(webhook);

    sendSuccess(res, result, 'Teste de webhook executado');
  } catch (err) {
    logger.error('Erro ao testar webhook:', err);
    sendError(res, 'Erro ao testar webhook: ' + err.message, 500);
  }
};

/**
 * Obtém logs de um webhook
 * GET /api/webhooks/:id/logs
 */
exports.getWebhookLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      limit = 50,
      offset = 0,
      status,
      event,
      dateFrom,
      dateTo
    } = req.query;
    const userId = req.user.id;

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      return notFound(res, 'Webhook não encontrado');
    }

    // Verificar permissão
    if (webhook.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return sendError(res, 'Acesso negado', 403);
    }

    const logs = await WebhookLog.findByWebhook(id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      status,
      event,
      dateFrom,
      dateTo
    });

    // Contar total
    const total = await WebhookLog.count({
      where: { webhookId: id }
    });

    sendSuccess(res, {
      logs: logs.map(log => log.getSummary()),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + logs.length) < total
      }
    }, 'Logs obtidos com sucesso');
  } catch (err) {
    logger.error('Erro ao obter logs:', err);
    sendError(res, 'Erro ao obter logs', 500);
  }
};

/**
 * Reprocessa webhooks com falhas
 * POST /api/webhooks/:id/retry
 */
exports.retryWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      return notFound(res, 'Webhook não encontrado');
    }

    // Verificar permissão
    if (webhook.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return sendError(res, 'Acesso negado', 403);
    }

    logger.info(`Reprocessando webhooks com falha: ${webhook.name}`);

    const result = await webhookService.retryFailedWebhooks(id);

    sendSuccess(res, result, `${result.processed} webhook(s) reprocessado(s)`);
  } catch (err) {
    logger.error('Erro ao reprocessar webhooks:', err);
    sendError(res, 'Erro ao reprocessar webhooks', 500);
  }
};

/**
 * Obtém estatísticas globais de webhooks
 * GET /api/webhooks/stats/global
 */
exports.getGlobalStats = async (req, res) => {
  try {
    const stats = await webhookService.getGlobalStats();
    sendSuccess(res, stats, 'Estatísticas obtidas com sucesso');
  } catch (err) {
    logger.error('Erro ao obter estatísticas:', err);
    sendError(res, 'Erro ao obter estatísticas', 500);
  }
};

/**
 * Obtém estatísticas de um webhook
 * GET /api/webhooks/:id/stats
 */
exports.getWebhookStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateFrom, dateTo } = req.query;
    const userId = req.user.id;

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      return notFound(res, 'Webhook não encontrado');
    }

    // Verificar permissão
    if (webhook.createdBy !== userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return sendError(res, 'Acesso negado', 403);
    }

    const stats = await webhookService.getWebhookStats(id, { dateFrom, dateTo });

    sendSuccess(res, stats, 'Estatísticas obtidas com sucesso');
  } catch (err) {
    logger.error('Erro ao obter estatísticas:', err);
    sendError(res, 'Erro ao obter estatísticas', 500);
  }
};

/**
 * Lista eventos disponíveis
 * GET /api/webhooks/events
 */
exports.listAvailableEvents = async (req, res) => {
  try {
    const events = Webhook.getEventsByCategory();
    const allEvents = Webhook.AVAILABLE_EVENTS;

    sendSuccess(res, {
      byCategory: events,
      all: allEvents,
      total: allEvents.length
    }, 'Eventos listados com sucesso');
  } catch (err) {
    logger.error('Erro ao listar eventos:', err);
    sendError(res, 'Erro ao listar eventos', 500);
  }
};

/**
 * Obtém top eventos mais disparados
 * GET /api/webhooks/stats/top-events
 */
exports.getTopEvents = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const topEvents = await webhookService.getTopEvents(parseInt(limit));

    sendSuccess(res, topEvents, 'Top eventos obtidos com sucesso');
  } catch (err) {
    logger.error('Erro ao obter top eventos:', err);
    sendError(res, 'Erro ao obter top eventos', 500);
  }
};

/**
 * Obtém webhooks com mais falhas
 * GET /api/webhooks/stats/top-failures
 */
exports.getTopFailures = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const topFailures = await webhookService.getTopFailures(parseInt(limit));

    sendSuccess(res, topFailures, 'Top falhas obtidas com sucesso');
  } catch (err) {
    logger.error('Erro ao obter top falhas:', err);
    sendError(res, 'Erro ao obter top falhas', 500);
  }
};

/**
 * Reseta estatísticas de um webhook
 * POST /api/webhooks/:id/reset-stats
 */
exports.resetStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const webhook = await Webhook.findByPk(id);

    if (!webhook) {
      return notFound(res, 'Webhook não encontrado');
    }

    // Verificar permissão (apenas admin ou owner)
    if (webhook.createdBy !== userId && req.user.role !== 'admin') {
      return sendError(res, 'Acesso negado', 403);
    }

    await webhook.resetStats();

    logger.info(`Estatísticas resetadas: ${webhook.id} por ${userId}`);
    sendSuccess(res, webhook, 'Estatísticas resetadas com sucesso');
  } catch (err) {
    logger.error('Erro ao resetar estatísticas:', err);
    sendError(res, 'Erro ao resetar estatísticas', 500);
  }
};

module.exports = exports;

