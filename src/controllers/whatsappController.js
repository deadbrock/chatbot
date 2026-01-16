const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/http');

/**
 * Controller para gerenciar conexões WhatsApp (WPPConnect)
 */

// Armazenar QR Code temporariamente
let currentQRCode = null;
let qrCodeExpiry = null;

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

    sendSuccess(res, {
      connected: status.connected,
      status: status.status,
      phoneNumber: null, // WPPConnect fornece isso após conexão
      pushname: null,
      platform: 'WPPConnect',
      qrCode: status.qrCode
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

    // Verificar se QR Code ainda é válido
    if (currentQRCode && qrCodeExpiry && Date.now() < qrCodeExpiry) {
      return sendSuccess(res, {
        qrcode: currentQRCode,
        expiresIn: Math.floor((qrCodeExpiry - Date.now()) / 1000),
        message: 'QR Code disponível'
      });
    }

    sendSuccess(res, {
      qrcode: null,
      message: 'Aguardando geração de QR Code. Reconecte em alguns segundos.'
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

    // Se já está inicializando, apenas aguardar o QR Code
    if (whatsappClient.isInitializing) {
      logger.info('🔄 Cliente já está inicializando. QR Code será gerado automaticamente.');
      return sendSuccess(res, {
        status: 'connecting',
        message: 'Cliente inicializando. QR Code disponível em breve...'
      });
    }

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
    qrCodeExpiry = Date.now() + (60 * 1000); // Expira em 60 segundos
    
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

    if (!whatsappClient) {
      return sendError(res, 'Cliente WhatsApp não inicializado', 400);
    }

    await whatsappClient.clearSession();
    currentQRCode = null;
    qrCodeExpiry = null;
    
    sendSuccess(res, {
      message: 'Sessão limpa com sucesso'
    });

  } catch (error) {
    logger.error('❌ Erro ao limpar sessão:', error);
    sendError(res, 'Erro ao limpar sessão: ' + error.message);
  }
};

module.exports = exports;
