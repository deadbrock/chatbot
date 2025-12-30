const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/http');
const QRCode = require('qrcode');

/**
 * Controller para gerenciar conexões WhatsApp
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

    const info = whatsappClient.isReady ? whatsappClient.client.info : null;

    sendSuccess(res, {
      connected: whatsappClient.isReady,
      status: whatsappClient.isReady ? 'ready' : 'connecting',
      phoneNumber: info ? info.wid.user : null,
      pushname: info ? info.pushname : null,
      platform: info ? info.platform : null
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

    logger.info(`📊 Status atual - isReady: ${whatsappClient.isReady}, hasClient: ${!!whatsappClient.client}`);

    if (whatsappClient.isReady) {
      logger.info('✅ WhatsApp já está conectado');
      return sendSuccess(res, {
        connected: true,
        message: 'WhatsApp já está conectado'
      });
    }

    // Se já tem um cliente inicializando, apenas aguardar o QR Code
    if (whatsappClient.client) {
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

    if (!whatsappClient || !whatsappClient.client) {
      return sendError(res, 'Cliente WhatsApp não inicializado', 400);
    }

    await whatsappClient.client.logout();
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
    if (whatsappClient.client) {
      await whatsappClient.client.destroy();
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
 * Função auxiliar para armazenar QR Code
 * Chamada pelo whatsapp.js quando QR é gerado
 */
exports.setQRCode = async (qr) => {
  try {
    // Gerar QR Code como Data URL
    currentQRCode = await QRCode.toDataURL(qr);
    qrCodeExpiry = Date.now() + (60 * 1000); // Expira em 60 segundos
    
    logger.info('✅ QR Code gerado e armazenado');
  } catch (error) {
    logger.error('❌ Erro ao gerar QR Code:', error);
  }
};

/**
 * Função para armazenar QR Code do Baileys (recebe string diretamente)
 */
exports.setQRCodeFromBaileys = async (qrString) => {
  try {
    // Baileys já retorna o QR como string, converter para Data URL
    currentQRCode = await QRCode.toDataURL(qrString);
    qrCodeExpiry = Date.now() + (60 * 1000); // Expira em 60 segundos
    
    logger.info('✅ QR Code do Baileys gerado e armazenado');
  } catch (error) {
    logger.error('❌ Erro ao gerar QR Code do Baileys:', error);
  }
};

/**
 * Função auxiliar para limpar QR Code
 */
exports.clearQRCode = () => {
  currentQRCode = null;
  qrCodeExpiry = null;
};

module.exports = exports;

