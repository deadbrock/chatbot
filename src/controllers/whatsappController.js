const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/http');
const chatDataPurgeService = require('../services/chatDataPurgeService');
const whatsappSyncService = require('../services/whatsappSyncService');

/**
 * Controller para gerenciar conexões WhatsApp (WPPConnect)
 */

// Armazenar QR Code temporariamente
let currentQRCode = null;
let qrCodeExpiry = null;
const QR_TTL_MS = 90 * 1000;

function getStoredQRCode(whatsappClient) {
  if (currentQRCode && qrCodeExpiry && Date.now() < qrCodeExpiry) {
    return {
      qrcode: currentQRCode,
      expiresIn: Math.floor((qrCodeExpiry - Date.now()) / 1000),
    };
  }

  if (whatsappClient?.qrCode) {
    const qrcode = whatsappClient.qrCode.startsWith('data:')
      ? whatsappClient.qrCode
      : `data:image/png;base64,${whatsappClient.qrCode}`;
    return { qrcode, expiresIn: QR_TTL_MS / 1000 };
  }

  return null;
}

/**
 * GET /api/whatsapp/status
 * Verifica status da conexão WhatsApp
 */
exports.getStatus = async (req, res) => {
  try {
    const whatsappClient = req.app.get('whatsappClient');
    
    if (!whatsappClient) {
      return sendSuccess(res, {
        connected: false,
        status: 'not_initialized',
        message: 'Cliente WhatsApp não inicializado'
      });
    }

    const status = whatsappClient.getStatus();
    const syncStatus = whatsappSyncService.getStatus();

    sendSuccess(res, {
      connected: status.connected,
      status: status.status,
      phoneNumber: null,
      pushname: null,
      platform: 'WPPConnect',
      qrCode: status.qrCode,
      sessionName: status.sessionName,
      isInitializing: status.isInitializing,
      loadingPercent: status.loadingPercent,
      loadingMessage: status.loadingMessage,
      sync: syncStatus
    });

  } catch (error) {
    logger.error('❌ Erro ao verificar status:', error);
    sendError(res, 'Erro ao verificar status do WhatsApp');
  }
};

/**
 * GET /api/whatsapp/qrcode
 * Obtém QR Code para conexão
 */
exports.getQRCode = async (req, res) => {
  try {
    const whatsappClient = req.app.get('whatsappClient');

    if (!whatsappClient) {
      return sendError(res, 'Cliente WhatsApp não inicializado', 400);
    }

    if (whatsappClient.isReady) {
      return sendSuccess(res, {
        connected: true,
        message: 'WhatsApp já está conectado'
      });
    }

    const stored = getStoredQRCode(whatsappClient);
    if (stored) {
      return sendSuccess(res, {
        qrcode: stored.qrcode,
        expiresIn: stored.expiresIn,
        message: 'QR Code disponível'
      });
    }

    sendSuccess(res, {
      qrcode: null,
      message: whatsappClient.isInitializing
        ? 'Gerando QR Code. Aguarde alguns segundos...'
        : 'Aguardando geração de QR Code. Clique em Conectar para iniciar.'
    });

  } catch (error) {
    logger.error('❌ Erro ao obter QR Code:', error);
    sendError(res, 'Erro ao obter QR Code');
  }
};

/**
 * POST /api/whatsapp/connect
 * Inicia conexão WhatsApp
 */
exports.connect = async (req, res) => {
  try {
    logger.info('📱 Tentando conectar WhatsApp via API...');
    
    const whatsappClient = req.app.get('whatsappClient');

    if (!whatsappClient) {
      logger.error('❌ Cliente WhatsApp não encontrado no app');
      return sendError(res, 'Cliente WhatsApp não inicializado', 400);
    }

    logger.info(`📊 Status atual - isReady: ${whatsappClient.isReady}, isInitializing: ${whatsappClient.isInitializing}`);

    if (whatsappClient.isReady) {
      logger.info('✅ WhatsApp já está conectado');
      return sendSuccess(res, {
        connected: true,
        message: 'WhatsApp já está conectado'
      });
    }

    // Se já está inicializando ou cliente aguardando QR, apenas informar status
    if (whatsappClient.isInitializing || whatsappClient.client) {
      const stored = getStoredQRCode(whatsappClient);
      logger.info('🔄 Cliente já está inicializando ou aguardando QR.');
      return sendSuccess(res, {
        status: 'connecting',
        message: whatsappClient.loadingMessage || 'Cliente inicializando. QR Code disponível em breve...',
        qrcode: stored?.qrcode || null,
        expiresIn: stored?.expiresIn || QR_TTL_MS / 1000,
        loadingPercent: whatsappClient.loadingPercent,
      });
    }

    whatsappClient.reconnectAttempts = 0;
    await whatsappClient.prepareForConnection({ rotateIfLocked: true, forceFresh: true });

    // Iniciar nova conexão
    logger.info('🚀 Iniciando nova conexão WhatsApp...');
    whatsappClient.initialize().catch(err => {
      logger.error('❌ Erro ao inicializar WhatsApp:', err);
    });

    sendSuccess(res, {
      status: 'connecting',
      message: 'Conexão iniciada. Aguarde o QR Code ser gerado...'
    });

  } catch (error) {
    logger.error('❌ Erro ao conectar:', error);
    sendError(res, 'Erro ao iniciar conexão: ' + error.message);
  }
};

/**
 * POST /api/whatsapp/disconnect
 * Desconecta WhatsApp
 */
exports.disconnect = async (req, res) => {
  try {
    const whatsappClient = req.app.get('whatsappClient');

    if (!whatsappClient || !whatsappClient.isReady) {
      return sendError(res, 'Cliente WhatsApp não está conectado', 400);
    }

    await whatsappClient.disconnect();
    currentQRCode = null;
    qrCodeExpiry = null;

    sendSuccess(res, {
      message: 'WhatsApp desconectado com sucesso'
    });

  } catch (error) {
    logger.error('❌ Erro ao desconectar:', error);
    sendError(res, 'Erro ao desconectar WhatsApp');
  }
};

/**
 * POST /api/whatsapp/restart
 * Reinicia conexão WhatsApp
 */
exports.restart = async (req, res) => {
  try {
    const whatsappClient = req.app.get('whatsappClient');

    if (!whatsappClient) {
      return sendError(res, 'Cliente WhatsApp não inicializado', 400);
    }

    // Desconectar se estiver conectado
    if (whatsappClient.isReady) {
      await whatsappClient.disconnect();
      currentQRCode = null;
      qrCodeExpiry = null;
    }

    // Aguardar 2 segundos antes de reconectar
    setTimeout(() => {
      whatsappClient.initialize().catch(err => {
        logger.error('Erro ao reiniciar WhatsApp:', err);
      });
    }, 2000);

    sendSuccess(res, {
      message: 'Reiniciando conexão WhatsApp...'
    });

  } catch (error) {
    logger.error('❌ Erro ao reiniciar:', error);
    sendError(res, 'Erro ao reiniciar conexão');
  }
};

/**
 * Função para armazenar QR Code do WPPConnect
 */
exports.setQRCodeFromWPPConnect = async (base64Qr) => {
  try {
    if (!base64Qr) {
      logger.error('❌ QR Code vazio recebido!');
      return;
    }
    
    // WPPConnect já retorna em base64, apenas adicionar prefixo se necessário
    currentQRCode = base64Qr.startsWith('data:') ? base64Qr : `data:image/png;base64,${base64Qr}`;
    qrCodeExpiry = Date.now() + QR_TTL_MS;
    
    logger.info('✅ QR Code do WPPConnect armazenado');
    logger.info(`📊 QR Code length: ${currentQRCode.length}, expires: ${new Date(qrCodeExpiry).toLocaleTimeString()}`);
  } catch (error) {
    logger.error('❌ Erro ao armazenar QR Code do WPPConnect:', error);
  }
};

/**
 * Função auxiliar para limpar QR Code
 */
exports.clearQRCode = () => {
  currentQRCode = null;
  qrCodeExpiry = null;
};

exports.getStoredQRCode = getStoredQRCode;

/**
 * POST /api/whatsapp/force-reconnect
 * Força reconexão do WhatsApp
 */
exports.forceReconnect = async (req, res) => {
  try {
    logger.warn('🔄 Solicitação de reconexão forçada via API');
    
    const whatsappClient = req.app.get('whatsappClient');

    if (!whatsappClient) {
      return sendError(res, 'Cliente WhatsApp não inicializado', 400);
    }

    await whatsappClient.forceReconnect();
    
    sendSuccess(res, {
      message: 'Reconexão iniciada',
      status: 'reconnecting'
    });

  } catch (error) {
    logger.error('❌ Erro ao forçar reconexão:', error);
    sendError(res, 'Erro ao forçar reconexão: ' + error.message);
  }
};

/**
 * POST /api/whatsapp/clear-session
 * Limpa sessão do WhatsApp
 */
exports.clearSession = async (req, res) => {
  try {
    logger.warn('🗑️ Solicitação de limpeza de sessão via API');

    const whatsappClient = req.app.get('whatsappClient');
    const purgeConversations = req.body?.purgeConversations !== false;

    if (!whatsappClient) {
      return sendError(res, 'Cliente WhatsApp não inicializado', 400);
    }

    let purgeStats = null;
    if (purgeConversations) {
      purgeStats = await chatDataPurgeService.purgeAll();
      whatsappSyncService.lastSyncAt = null;
      whatsappSyncService.lastStats = null;
    }

    await whatsappClient.clearSession();
    currentQRCode = null;
    qrCodeExpiry = null;

    setTimeout(() => {
      whatsappClient.initialize().catch((err) => {
        logger.error('Erro ao reinicializar após limpar sessão:', err);
      });
    }, 1500);

    sendSuccess(res, {
      message: purgeConversations
        ? 'Sessão limpa e todas as conversas foram apagadas. Novo QR Code será gerado em instantes.'
        : 'Sessão limpa com sucesso. Novo QR Code será gerado em instantes.',
      sessionName: whatsappClient.sessionName,
      purgeStats
    });
  } catch (error) {
    logger.error('❌ Erro ao limpar sessão:', error);
    sendError(res, 'Erro ao limpar sessão: ' + error.message);
  }
};

/**
 * GET /api/whatsapp/sync/status
 * Status detalhado da sincronização em andamento
 */
exports.getSyncStatus = async (req, res) => {
  try {
    return sendSuccess(res, whatsappSyncService.getStatus());
  } catch (error) {
    logger.error('❌ Erro ao obter status de sync:', error);
    return sendError(res, 'Erro ao obter status de sincronização');
  }
};

/**
 * POST /api/whatsapp/sync
 * Sincroniza conversas do WhatsApp conectado
 */
exports.syncConversations = async (req, res) => {
  try {
    const whatsappClient = req.app.get('whatsappClient');

    if (!whatsappClient) {
      return sendError(res, 'Cliente WhatsApp não inicializado', 400);
    }

    if (!(await whatsappClient.ensureReadyForSend())) {
      return sendError(res, 'WhatsApp não está conectado', 503);
    }

    const force = req.body?.force === true;

    whatsappSyncService.startSync(whatsappClient, { force }).then((stats) => {
      logger.info('✅ Sync manual concluído:', stats);
    }).catch((err) => {
      logger.error('❌ Sync manual falhou:', err.message);
    });

    return sendSuccess(res, {
      message: 'Sincronização iniciada em segundo plano',
      sync: whatsappSyncService.getStatus()
    });
  } catch (error) {
    logger.error('❌ Erro ao iniciar sync:', error);
    return sendError(res, 'Erro ao sincronizar conversas: ' + error.message);
  }
};

module.exports = exports;
