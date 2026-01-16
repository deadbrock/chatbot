const WhatsAppConnection = require('../models/WhatsAppConnectionSQL');
const { sendSuccess, sendError, badRequest, notFound, created } = require('../utils/http');

/**
 * Controller de Conexões WhatsApp
 * Gerenciamento de múltiplas instâncias WhatsApp
 */

/**
 * Lista todas as conexões
 * GET /api/connections
 */
async function listConnections(req, res) {
  try {
    const { status, isActive } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    const connections = await WhatsAppConnection.findAll({
      where,
      order: [
        ['isDefault', 'DESC'],
        ['priority', 'DESC'],
        ['name', 'ASC']
      ]
    });
    
    // Ocultar informações sensíveis
    const sanitized = connections.map(conn => ({
      ...conn.toJSON(),
      qrCode: conn.qrCode ? '***' : null
    }));
    
    // Se não há conexões no banco, adicionar a conexão WPPConnect atual
    if (connections.length === 0) {
      const whatsappClient = req.app.get('whatsappClient');
      if (whatsappClient && whatsappClient.isReady) {
        sanitized.push({
          id: 'wppconnect-default',
          name: 'WhatsApp WPPConnect (Padrão)',
          instanceId: 'wppconnect-1',
          phoneNumber: 'Conectado',
          phoneNumberFormatted: 'Conectado',
          status: whatsappClient.isReady ? 'connected' : 'disconnected',
          isActive: true,
          isDefault: true,
          priority: 100,
          deviceInfo: { platform: 'Baileys' },
          lastConnectedAt: new Date(),
          createdAt: new Date()
        });
      }
    }
    
    return sendSuccess(res, {
      connections: sanitized,
      total: sanitized.length
    });
  } catch (error) {
    console.error('Erro ao listar conexões:', error);
    return sendError(res, 'Erro ao listar conexões');
  }
}

/**
 * Busca uma conexão por ID
 * GET /api/connections/:id
 */
async function getConnection(req, res) {
  try {
    const { id } = req.params;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    return sendSuccess(res, { connection });
  } catch (error) {
    console.error('Erro ao buscar conexão:', error);
    return sendError(res, 'Erro ao buscar conexão');
  }
}

/**
 * Cria uma nova conexão
 * POST /api/connections
 */
async function createConnection(req, res) {
  try {
    const {
      name,
      instanceId,
      settings,
      defaultQueue,
      allowedQueues,
      businessHours,
      outOfHoursMessage,
      welcomeMessage,
      farewellMessage,
      webhookUrl,
      webhookEvents,
      maxConcurrentChats,
      maxMessagesPerDay,
      priority,
      metadata
    } = req.body;
    
    if (!name) {
      return badRequest(res, 'Nome é obrigatório');
    }
    
    if (!instanceId) {
      return badRequest(res, 'ID da instância é obrigatório');
    }
    
    // Verificar se instanceId já existe
    const existing = await WhatsAppConnection.findOne({
      where: { instanceId }
    });
    
    if (existing) {
      return badRequest(res, 'Já existe uma conexão com este ID de instância');
    }
    
    const connection = await WhatsAppConnection.create({
      name,
      instanceId,
      settings: settings || {},
      defaultQueue,
      allowedQueues: allowedQueues || [],
      businessHours: businessHours || {},
      outOfHoursMessage,
      welcomeMessage,
      farewellMessage,
      webhookUrl,
      webhookEvents: webhookEvents || [],
      maxConcurrentChats: maxConcurrentChats || 0,
      maxMessagesPerDay: maxMessagesPerDay || 0,
      priority: priority || 0,
      metadata: metadata || {},
      createdBy: req.user?.id
    });
    
    return created(res, {
      connection,
      message: 'Conexão criada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar conexão:', error);
    return sendError(res, 'Erro ao criar conexão');
  }
}

/**
 * Atualiza uma conexão
 * PUT /api/connections/:id
 */
async function updateConnection(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      settings,
      defaultQueue,
      allowedQueues,
      businessHours,
      outOfHoursMessage,
      welcomeMessage,
      farewellMessage,
      webhookUrl,
      webhookEvents,
      maxConcurrentChats,
      maxMessagesPerDay,
      priority,
      isActive,
      metadata
    } = req.body;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    await connection.update({
      name: name || connection.name,
      settings: settings || connection.settings,
      defaultQueue: defaultQueue !== undefined ? defaultQueue : connection.defaultQueue,
      allowedQueues: allowedQueues || connection.allowedQueues,
      businessHours: businessHours || connection.businessHours,
      outOfHoursMessage: outOfHoursMessage !== undefined ? outOfHoursMessage : connection.outOfHoursMessage,
      welcomeMessage: welcomeMessage !== undefined ? welcomeMessage : connection.welcomeMessage,
      farewellMessage: farewellMessage !== undefined ? farewellMessage : connection.farewellMessage,
      webhookUrl: webhookUrl !== undefined ? webhookUrl : connection.webhookUrl,
      webhookEvents: webhookEvents || connection.webhookEvents,
      maxConcurrentChats: maxConcurrentChats !== undefined ? maxConcurrentChats : connection.maxConcurrentChats,
      maxMessagesPerDay: maxMessagesPerDay !== undefined ? maxMessagesPerDay : connection.maxMessagesPerDay,
      priority: priority !== undefined ? priority : connection.priority,
      isActive: isActive !== undefined ? isActive : connection.isActive,
      metadata: metadata || connection.metadata
    });
    
    return sendSuccess(res, {
      connection,
      message: 'Conexão atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar conexão:', error);
    return sendError(res, 'Erro ao atualizar conexão');
  }
}

/**
 * Deleta uma conexão
 * DELETE /api/connections/:id
 */
async function deleteConnection(req, res) {
  try {
    const { id } = req.params;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    if (connection.isDefault) {
      return badRequest(res, 'Não é possível deletar a conexão padrão');
    }
    
    if (connection.status === 'connected') {
      return badRequest(res, 'Desconecte a instância antes de deletar');
    }
    
    await connection.destroy();
    
    return sendSuccess(res, {
      message: 'Conexão deletada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar conexão:', error);
    return sendError(res, 'Erro ao deletar conexão');
  }
}

/**
 * Conecta uma instância WhatsApp
 * POST /api/connections/:id/connect
 */
async function connectInstance(req, res) {
  try {
    const { id } = req.params;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    if (!connection.isActive) {
      return badRequest(res, 'Conexão está inativa');
    }
    
    if (connection.status === 'connected') {
      return badRequest(res, 'Conexão já está conectada');
    }
    
    // TODO: Integrar com o serviço WhatsApp real
    // Por enquanto, apenas simular
    await connection.updateStatus('connecting', { initiatedBy: req.user?.id });
    
    return sendSuccess(res, {
      message: 'Iniciando conexão...',
      connection
    });
  } catch (error) {
    console.error('Erro ao conectar instância:', error);
    return sendError(res, 'Erro ao conectar instância');
  }
}

/**
 * Desconecta uma instância WhatsApp
 * POST /api/connections/:id/disconnect
 */
async function disconnectInstance(req, res) {
  try {
    const { id } = req.params;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    if (connection.status === 'disconnected') {
      return badRequest(res, 'Conexão já está desconectada');
    }
    
    // TODO: Integrar com o serviço WhatsApp real
    await connection.updateStatus('disconnected', { disconnectedBy: req.user?.id });
    
    return sendSuccess(res, {
      message: 'Conexão desconectada com sucesso',
      connection
    });
  } catch (error) {
    console.error('Erro ao desconectar instância:', error);
    return sendError(res, 'Erro ao desconectar instância');
  }
}

/**
 * Busca QR Code para conexão
 * GET /api/connections/:id/qrcode
 */
async function getQRCode(req, res) {
  try {
    const { id } = req.params;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    if (!connection.qrCode) {
      return badRequest(res, 'QR Code não disponível');
    }
    
    if (connection.qrCodeExpiresAt && new Date(connection.qrCodeExpiresAt) < new Date()) {
      return badRequest(res, 'QR Code expirado');
    }
    
    return sendSuccess(res, {
      qrCode: connection.qrCode,
      expiresAt: connection.qrCodeExpiresAt
    });
  } catch (error) {
    console.error('Erro ao buscar QR Code:', error);
    return sendError(res, 'Erro ao buscar QR Code');
  }
}

/**
 * Busca estatísticas da conexão
 * GET /api/connections/:id/stats
 */
async function getConnectionStats(req, res) {
  try {
    const { id } = req.params;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    return sendSuccess(res, {
      stats: connection.stats,
      status: connection.status,
      lastConnectedAt: connection.lastConnectedAt,
      lastDisconnectedAt: connection.lastDisconnectedAt
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return sendError(res, 'Erro ao buscar estatísticas');
  }
}

/**
 * Busca logs da conexão
 * GET /api/connections/:id/logs
 */
async function getConnectionLogs(req, res) {
  try {
    const { id } = req.params;
    const { type = 'connection' } = req.query; // connection ou error
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    const logs = type === 'error' ? connection.errorLog : connection.connectionLog;
    
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
 * Define conexão como padrão
 * POST /api/connections/:id/set-default
 */
async function setDefaultConnection(req, res) {
  try {
    const { id } = req.params;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    // Remover padrão de outras conexões
    await WhatsAppConnection.update(
      { isDefault: false },
      { where: {} }
    );
    
    // Definir esta como padrão
    await connection.update({ isDefault: true });
    
    return sendSuccess(res, {
      message: 'Conexão definida como padrão',
      connection
    });
  } catch (error) {
    console.error('Erro ao definir conexão padrão:', error);
    return sendError(res, 'Erro ao definir conexão padrão');
  }
}

/**
 * Testa webhook da conexão
 * POST /api/connections/:id/test-webhook
 */
async function testWebhook(req, res) {
  try {
    const { id } = req.params;
    
    const connection = await WhatsAppConnection.findByPk(id);
    
    if (!connection) {
      return notFound(res, 'Conexão não encontrada');
    }
    
    if (!connection.webhookUrl) {
      return badRequest(res, 'URL do webhook não configurada');
    }
    
    // TODO: Enviar webhook de teste
    const testPayload = {
      event: 'test',
      timestamp: new Date(),
      connection: {
        id: connection.id,
        name: connection.name,
        instanceId: connection.instanceId
      }
    };
    
    return sendSuccess(res, {
      message: 'Webhook de teste enviado',
      payload: testPayload
    });
  } catch (error) {
    console.error('Erro ao testar webhook:', error);
    return sendError(res, 'Erro ao testar webhook');
  }
}

module.exports = {
  listConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  connectInstance,
  disconnectInstance,
  getQRCode,
  getConnectionStats,
  getConnectionLogs,
  setDefaultConnection,
  testWebhook
};

