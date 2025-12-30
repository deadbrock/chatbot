const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const messageHandler = require('./messageHandler');
const SessionManager = require('../services/sessionManager');

class WhatsAppClient {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.sessionManager = new SessionManager();
  }

  /**
   * Inicializa o cliente WhatsApp
   */
  async initialize() {
    try {
      logger.info('🚀 Inicializando cliente WhatsApp...');

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: process.env.WHATSAPP_SESSION_NAME || 'chatbot-session'
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        }
      });

      // Evento: QR Code
      this.client.on('qr', async (qr) => {
        logger.info('📱 QR Code recebido! Escaneie com seu WhatsApp:');
        qrcode.generate(qr, { small: true });
        
        // Armazenar QR Code para API
        const whatsappController = require('../controllers/whatsappController');
        await whatsappController.setQRCode(qr);
      });

      // Evento: Autenticado
      this.client.on('authenticated', () => {
        logger.info('✅ WhatsApp autenticado com sucesso!');
      });

      // Evento: Pronto
      this.client.on('ready', () => {
        this.isReady = true;
        logger.info('✅ WhatsApp conectado e pronto para uso!');
        logger.info(`📱 Número: ${this.client.info.wid.user}`);
        
        // Limpar QR Code armazenado
        const whatsappController = require('../controllers/whatsappController');
        whatsappController.clearQRCode();
      });

      // Evento: Mensagem recebida
      this.client.on('message', async (message) => {
        try {
          await this.handleIncomingMessage(message);
        } catch (error) {
          logger.error('Erro ao processar mensagem:', error);
        }
      });

      // Evento: Mensagem criada (enviada pelo bot)
      this.client.on('message_create', async (message) => {
        // Registrar mensagens enviadas pelo bot
        if (message.fromMe) {
          logger.debug(`📤 Mensagem enviada para ${message.to}`);
        }
      });

      // Evento: Desconectado
      this.client.on('disconnected', (reason) => {
        this.isReady = false;
        logger.warn('⚠️ WhatsApp desconectado:', reason);
        
        // Tentar reconectar após 5 segundos
        setTimeout(() => {
          logger.info('🔄 Tentando reconectar...');
          this.initialize();
        }, 5000);
      });

      // Evento: Erro
      this.client.on('auth_failure', (error) => {
        logger.error('❌ Falha na autenticação:', error);
      });

      // Inicializar cliente
      await this.client.initialize();

    } catch (error) {
      logger.error('❌ Erro ao inicializar WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Processa mensagem recebida
   */
  async handleIncomingMessage(message) {
    try {
      // Ignorar mensagens de status e grupos (opcional)
      if (message.isStatus) return;
      
      // Opcional: descomentar para ignorar grupos
      // const chat = await message.getChat();
      // if (chat.isGroup) return;

      const from = message.from;
      const contact = await message.getContact();
      const name = contact.pushname || contact.name || 'Cliente';

      logger.info(`📨 Mensagem de ${name} (${from}): ${message.body}`);

      // Criar ou recuperar sessão do usuário
      let session = await this.sessionManager.getSession(from);
      if (!session) {
        session = await this.sessionManager.createSession(from, {
          name,
          phone: from,
          startedAt: new Date()
        });
      }

      // Processar mensagem através do handler
      await messageHandler.handle(message, session, this);

    } catch (error) {
      logger.error('Erro ao processar mensagem:', error);
      await this.sendMessage(
        message.from,
        '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.'
      );
    }
  }

  /**
   * Envia mensagem de texto
   */
  async sendMessage(to, text) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp não está conectado');
      }

      await this.client.sendMessage(to, text);
      logger.debug(`📤 Mensagem enviada para ${to}`);
      return true;
    } catch (error) {
      logger.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  /**
   * Envia mensagem com mídia
   */
  async sendMedia(to, media, caption = '') {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp não está conectado');
      }

      const messageMedia = await MessageMedia.fromFilePath(media);
      await this.client.sendMessage(to, messageMedia, { caption });
      logger.debug(`📤 Mídia enviada para ${to}`);
      return true;
    } catch (error) {
      logger.error('Erro ao enviar mídia:', error);
      throw error;
    }
  }

  /**
   * Envia mensagem com botões (lista)
   */
  async sendButtons(to, text, buttons) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp não está conectado');
      }

      // WhatsApp Web.js não suporta botões nativos ainda
      // Então enviamos como texto formatado
      let message = text + '\n\n';
      buttons.forEach((btn, index) => {
        message += `*${index + 1}.* ${btn.text}\n`;
      });

      await this.sendMessage(to, message);
      return true;
    } catch (error) {
      logger.error('Erro ao enviar botões:', error);
      throw error;
    }
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(message) {
    try {
      const chat = await message.getChat();
      await chat.sendSeen();
    } catch (error) {
      logger.error('Erro ao marcar como lida:', error);
    }
  }

  /**
   * Mostra "digitando..."
   */
  async sendTyping(chatId, duration = 3000) {
    try {
      const chat = await this.client.getChatById(chatId);
      await chat.sendStateTyping();
      
      // Para de digitar após a duração
      setTimeout(async () => {
        await chat.clearState();
      }, duration);
    } catch (error) {
      logger.error('Erro ao enviar typing:', error);
    }
  }

  /**
   * Obtém informações do contato
   */
  async getContact(phoneNumber) {
    try {
      const contact = await this.client.getContactById(phoneNumber);
      return {
        name: contact.pushname || contact.name,
        phone: contact.number,
        isBlocked: contact.isBlocked,
        isBusiness: contact.isBusiness
      };
    } catch (error) {
      logger.error('Erro ao obter contato:', error);
      return null;
    }
  }

  /**
   * Bloqueia contato
   */
  async blockContact(phoneNumber) {
    try {
      const contact = await this.client.getContactById(phoneNumber);
      await contact.block();
      logger.info(`🚫 Contato bloqueado: ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error('Erro ao bloquear contato:', error);
      return false;
    }
  }

  /**
   * Desbloqueia contato
   */
  async unblockContact(phoneNumber) {
    try {
      const contact = await this.client.getContactById(phoneNumber);
      await contact.unblock();
      logger.info(`✅ Contato desbloqueado: ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error('Erro ao desbloquear contato:', error);
      return false;
    }
  }

  /**
   * Verifica se está conectado
   */
  isConnected() {
    return this.isReady;
  }

  /**
   * Obtém informações do cliente
   */
  getInfo() {
    if (!this.isReady || !this.client.info) {
      return null;
    }

    return {
      phone: this.client.info.wid.user,
      platform: this.client.info.platform,
      pushname: this.client.info.pushname
    };
  }

  /**
   * Destrói o cliente
   */
  async destroy() {
    try {
      if (this.client) {
        await this.client.destroy();
        this.isReady = false;
        logger.info('🛑 Cliente WhatsApp encerrado');
      }
    } catch (error) {
      logger.error('Erro ao destruir cliente:', error);
    }
  }
}

// Exportar instância única (singleton)
const whatsappClient = new WhatsAppClient();
module.exports = whatsappClient;

