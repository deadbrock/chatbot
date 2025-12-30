const ApiKey = require('../models/ApiKeySQL');
const { sendSuccess, sendError, badRequest, notFound, created } = require('../utils/http');

/**
 * Controller de API Keys
 * Gerenciamento de chaves de API para integração externa
 */

/**
 * Lista todas as chaves de API
 * GET /api/api-keys
 */
async function listApiKeys(req, res) {
  try {
    const { status, type } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    
    const apiKeys = await ApiKey.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['key'] } // Não expor a chave hash
    });
    
    return sendSuccess(res, {
      apiKeys,
      total: apiKeys.length
    });
  } catch (error) {
    console.error('Erro ao listar chaves de API:', error);
    return sendError(res, 'Erro ao listar chaves de API');
  }
}

/**
 * Busca uma chave de API por ID
 * GET /api/api-keys/:id
 */
async function getApiKey(req, res) {
  try {
    const { id } = req.params;
    
    const apiKey = await ApiKey.findByPk(id, {
      attributes: { exclude: ['key'] }
    });
    
    if (!apiKey) {
      return notFound(res, 'Chave de API não encontrada');
    }
    
    return sendSuccess(res, { apiKey });
  } catch (error) {
    console.error('Erro ao buscar chave de API:', error);
    return sendError(res, 'Erro ao buscar chave de API');
  }
}

/**
 * Cria uma nova chave de API
 * POST /api/api-keys
 */
async function createApiKey(req, res) {
  try {
    const {
      name,
      type,
      permissions,
      scopes,
      ipRestrictions,
      rateLimit,
      rateLimitWindow,
      expiresAt,
      webhookUrl,
      webhookSecret,
      webhookEvents,
      metadata
    } = req.body;
    
    if (!name) {
      return badRequest(res, 'Nome é obrigatório');
    }
    
    // Gerar chave
    const { fullKey, hash, prefix } = ApiKey.generateKey(type);
    
    // Criar registro
    const apiKey = await ApiKey.create({
      name,
      key: hash,
      prefix,
      type: type || 'production',
      permissions: permissions || [],
      scopes: scopes || {},
      ipRestrictions: ipRestrictions || [],
      rateLimit: rateLimit || 1000,
      rateLimitWindow: rateLimitWindow || 3600,
      expiresAt: expiresAt || null,
      webhookUrl: webhookUrl || null,
      webhookSecret: webhookSecret || null,
      webhookEvents: webhookEvents || [],
      metadata: metadata || {},
      createdBy: req.user?.id
    });
    
    // IMPORTANTE: Retornar a chave completa apenas UMA VEZ
    return created(res, {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        type: apiKey.type,
        prefix: apiKey.prefix,
        permissions: apiKey.permissions,
        status: apiKey.status,
        createdAt: apiKey.createdAt
      },
      key: fullKey, // ⚠️ ATENÇÃO: Esta é a única vez que a chave será exibida!
      warning: 'Guarde esta chave em local seguro. Ela não será exibida novamente!'
    });
  } catch (error) {
    console.error('Erro ao criar chave de API:', error);
    return sendError(res, 'Erro ao criar chave de API');
  }
}

/**
 * Atualiza uma chave de API
 * PUT /api/api-keys/:id
 */
async function updateApiKey(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      permissions,
      scopes,
      ipRestrictions,
      rateLimit,
      rateLimitWindow,
      status,
      webhookUrl,
      webhookSecret,
      webhookEvents,
      metadata
    } = req.body;
    
    const apiKey = await ApiKey.findByPk(id);
    
    if (!apiKey) {
      return notFound(res, 'Chave de API não encontrada');
    }
    
    // Não permitir alterar chaves revogadas
    if (apiKey.status === 'revoked') {
      return badRequest(res, 'Não é possível alterar uma chave revogada');
    }
    
    await apiKey.update({
      name: name || apiKey.name,
      permissions: permissions || apiKey.permissions,
      scopes: scopes || apiKey.scopes,
      ipRestrictions: ipRestrictions || apiKey.ipRestrictions,
      rateLimit: rateLimit || apiKey.rateLimit,
      rateLimitWindow: rateLimitWindow || apiKey.rateLimitWindow,
      status: status || apiKey.status,
      webhookUrl: webhookUrl !== undefined ? webhookUrl : apiKey.webhookUrl,
      webhookSecret: webhookSecret !== undefined ? webhookSecret : apiKey.webhookSecret,
      webhookEvents: webhookEvents || apiKey.webhookEvents,
      metadata: metadata || apiKey.metadata
    });
    
    return sendSuccess(res, {
      apiKey,
      message: 'Chave de API atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar chave de API:', error);
    return sendError(res, 'Erro ao atualizar chave de API');
  }
}

/**
 * Revoga uma chave de API
 * POST /api/api-keys/:id/revoke
 */
async function revokeApiKey(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const apiKey = await ApiKey.findByPk(id);
    
    if (!apiKey) {
      return notFound(res, 'Chave de API não encontrada');
    }
    
    if (apiKey.status === 'revoked') {
      return badRequest(res, 'Chave já está revogada');
    }
    
    await apiKey.revoke(req.user?.id, reason || 'Revogada pelo administrador');
    
    return sendSuccess(res, {
      message: 'Chave de API revogada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao revogar chave de API:', error);
    return sendError(res, 'Erro ao revogar chave de API');
  }
}

/**
 * Deleta uma chave de API
 * DELETE /api/api-keys/:id
 */
async function deleteApiKey(req, res) {
  try {
    const { id } = req.params;
    
    const apiKey = await ApiKey.findByPk(id);
    
    if (!apiKey) {
      return notFound(res, 'Chave de API não encontrada');
    }
    
    await apiKey.destroy();
    
    return sendSuccess(res, {
      message: 'Chave de API deletada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar chave de API:', error);
    return sendError(res, 'Erro ao deletar chave de API');
  }
}

/**
 * Busca logs de acesso de uma chave
 * GET /api/api-keys/:id/logs
 */
async function getApiKeyLogs(req, res) {
  try {
    const { id } = req.params;
    const { type = 'access' } = req.query; // access ou error
    
    const apiKey = await ApiKey.findByPk(id);
    
    if (!apiKey) {
      return notFound(res, 'Chave de API não encontrada');
    }
    
    const logs = type === 'error' ? apiKey.errorLog : apiKey.accessLog;
    
    return sendSuccess(res, {
      logs: logs || [],
      total: logs?.length || 0,
      type
    });
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    return sendError(res, 'Erro ao buscar logs');
  }
}

/**
 * Busca estatísticas de uso
 * GET /api/api-keys/:id/stats
 */
async function getApiKeyStats(req, res) {
  try {
    const { id } = req.params;
    
    const apiKey = await ApiKey.findByPk(id);
    
    if (!apiKey) {
      return notFound(res, 'Chave de API não encontrada');
    }
    
    // Calcular estatísticas dos logs
    const accessLog = apiKey.accessLog || [];
    const errorLog = apiKey.errorLog || [];
    
    const stats = {
      totalRequests: apiKey.totalRequests,
      successfulRequests: accessLog.filter(l => l.success).length,
      failedRequests: accessLog.filter(l => !l.success).length,
      errorCount: apiKey.errorCount,
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
      
      // Estatísticas por dia (últimos 7 dias)
      requestsByDay: calculateRequestsByDay(accessLog),
      
      // Endpoints mais usados
      topEndpoints: calculateTopEndpoints(accessLog),
      
      // IPs mais frequentes
      topIps: calculateTopIps(accessLog)
    };
    
    return sendSuccess(res, { stats });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return sendError(res, 'Erro ao buscar estatísticas');
  }
}

/**
 * Testa uma chave de API
 * POST /api/api-keys/verify
 */
async function verifyApiKey(req, res) {
  try {
    const { key } = req.body;
    
    if (!key) {
      return badRequest(res, 'Chave é obrigatória');
    }
    
    const apiKey = await ApiKey.verifyKey(key);
    
    if (!apiKey) {
      return sendSuccess(res, {
        valid: false,
        message: 'Chave inválida, expirada ou revogada'
      });
    }
    
    return sendSuccess(res, {
      valid: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        type: apiKey.type,
        permissions: apiKey.permissions,
        status: apiKey.status,
        expiresAt: apiKey.expiresAt
      }
    });
  } catch (error) {
    console.error('Erro ao verificar chave:', error);
    return sendError(res, 'Erro ao verificar chave');
  }
}

// Helpers

function calculateRequestsByDay(accessLog) {
  const days = {};
  const now = new Date();
  
  // Inicializar últimos 7 dias
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    days[key] = 0;
  }
  
  // Contar requisições
  accessLog.forEach(log => {
    const date = new Date(log.timestamp).toISOString().split('T')[0];
    if (days[date] !== undefined) {
      days[date]++;
    }
  });
  
  return Object.entries(days).map(([date, count]) => ({ date, count }));
}

function calculateTopEndpoints(accessLog) {
  const endpoints = {};
  
  accessLog.forEach(log => {
    const endpoint = log.endpoint || 'unknown';
    endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
  });
  
  return Object.entries(endpoints)
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function calculateTopIps(accessLog) {
  const ips = {};
  
  accessLog.forEach(log => {
    const ip = log.ip || 'unknown';
    ips[ip] = (ips[ip] || 0) + 1;
  });
  
  return Object.entries(ips)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

module.exports = {
  listApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  getApiKeyLogs,
  getApiKeyStats,
  verifyApiKey
};

