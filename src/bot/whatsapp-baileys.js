const { 
  default: makeWASocket, 
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const logger = require('../utils/logger');
const flowMessageHandler = require('./flowMessageHandler');
const fs = require('fs');
const path = require('path');

class BaileysWhatsAppClient {
  constructor() {
    this.sock = null;
    this.isReady = false;
    this.qrCode = null;
    this.qrCodeExpiry = null;
    this.sessionPath = path.join(__dirname, '../../.wwebjs_auth');
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Inicializar cliente Baileys
   */
  async initialize(sessionName = 'chatbot-session') {
    try {
      logger.info('🚀 Inicializando Baileys WhatsApp Client...');

      // Criar diretório de sessão se não existir
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }

      const sessionFolder = path.join(this.sessionPath, sessionName);
      
      // Carregar ou criar auth state
      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

      // Obter versão mais recente do Baileys
      const { version } = await fetchLatestBaileysVersion();
      logger.info(`📱 Usando Baileys versão: ${version.join('.')}`);

      // Criar socket
      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // ou 'debug' para logs detalhados
        printQRInTerminal: false, // vamos tratar manualmente
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        msgRetryCounterCache: new Map(),
        defaultQueryTimeoutMs: undefined,
        browser: ['ChatBot Empresarial', 'Chrome', '10.0']
      });

      // Evento: Atualização de conexão
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code recebido
        if (qr) {
          this.qrCode = qr;
          this.qrCodeExpiry = Date.now() + (60 * 1000); // Expira em 60s
          
          logger.info('📱 QR Code recebido!');
          qrcodeTerminal.generate(qr, { small: true });
          
          // Notificar controller para armazenar QR Code
          const whatsappController = require('../controllers/whatsappController');
          await whatsappController.setQRCodeFromBaileys(qr);
        }

        // Conexão fechada
        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          const reason = lastDisconnect?.error?.output?.statusCode;
          
          logger.warn(`⚠️ Conexão fechada. Razão: ${reason}. Reconectar? ${shouldReconnect}`);

          // Erro 440: Sessão inválida/corrompida
          if (reason === 440) {
            logger.error('❌ Erro 440: Sessão inválida detectada!');
            
            if (this.reconnectAttempts >= 3) {
              logger.error('🗑️ Muitas tentativas falhadas. Limpando sessão...');
              this.clearSession(sessionName);
              this.reconnectAttempts = 0;
              
              logger.info('📱 Sessão limpa. Reinicie o servidor e escaneie o QR Code novamente.');
              this.isReady = false;
              return; // Não reconectar mais
            }
            
            this.reconnectAttempts++;
            const delay = 5000 * this.reconnectAttempts; // Delay progressivo (5s, 10s, 15s)
            logger.info(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/3 em ${delay/1000}s...`);
            setTimeout(() => this.initialize(sessionName), delay);
            
          } else if (reason === DisconnectReason.loggedOut) {
            logger.warn('🚪 Logout detectado. Limpando sessão...');
            this.clearSession(sessionName);
            
          } else if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = 3000 + (this.reconnectAttempts * 2000); // Delay progressivo
            logger.info(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay/1000}s...`);
            setTimeout(() => this.initialize(sessionName), delay);
          } else {
            logger.error('❌ Máximo de tentativas de reconexão atingido.');
            this.reconnectAttempts = 0;
          }

          this.isReady = false;
          
          // Limpar QR Code
          const whatsappController = require('../controllers/whatsappController');
          whatsappController.clearQRCode();
        }

        // Conexão aberta (conectado!)
        if (connection === 'open') {
          this.isReady = true;
          this.reconnectAttempts = 0;
          this.qrCode = null;
          this.qrCodeExpiry = null;
          
          logger.info('✅ WhatsApp conectado com sucesso!');
          
          // Obter informações do usuário
          const userInfo = this.sock.user;
          if (userInfo) {
            logger.info(`📱 Número: ${userInfo.id.split(':')[0]}`);
            logger.info(`👤 Nome: ${userInfo.name || 'Sem nome'}`);
          }
          
          // Limpar QR Code do controller
          const whatsappController = require('../controllers/whatsappController');
          whatsappController.clearQRCode();
        }
      });

      // Evento: Credenciais atualizadas
      this.sock.ev.on('creds.update', saveCreds);

      // Evento: Mensagens recebidas
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
          for (const msg of messages) {
            if (!msg.key.fromMe && msg.message) {
              try {
                await this.handleIncomingMessage(msg);
              } catch (error) {
                logger.error('❌ Erro ao processar mensagem:', error);
              }
            }
          }
        }
      });

      logger.info('✅ Baileys WhatsApp Client inicializado!');
      
    } catch (error) {
      logger.error('❌ Erro ao inicializar Baileys:', error);
      throw error;
    }
  }

  /**
   * Processar mensagem recebida
   */
  async handleIncomingMessage(msg) {
    try {
      // Converter mensagem Baileys para formato compatível com messageHandler
      const contact = {
        id: msg.key.remoteJid,
        name: msg.pushName || 'Usuário',
        number: msg.key.remoteJid.split('@')[0]
      };

      // Extrair texto da mensagem
      let body = '';
      if (msg.message?.conversation) {
        body = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage) {
        body = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage) {
        body = msg.message.imageMessage.caption || '';
      }

      const message = {
        id: msg.key.id,
        from: msg.key.remoteJid,
        to: this.sock.user?.id,
        body,
        timestamp: msg.messageTimestamp,
        fromMe: msg.key.fromMe,
        hasMedia: !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage),
        type: this.getMessageType(msg.message),
        _data: msg
      };

      logger.info(`📨 Mensagem recebida de ${contact.name}: ${body.substring(0, 50)}...`);

      // Processar com flowMessageHandler (novo sistema de fluxos)
      await flowMessageHandler.handleMessage(this, message, contact);
      
    } catch (error) {
      logger.error('❌ Erro ao processar mensagem recebida:', error);
    }
  }

  /**
   * Obter tipo de mensagem
   */
  getMessageType(message) {
    if (message?.conversation || message?.extendedTextMessage) return 'chat';
    if (message?.imageMessage) return 'image';
    if (message?.videoMessage) return 'video';
    if (message?.audioMessage) return 'audio';
    if (message?.documentMessage) return 'document';
    if (message?.stickerMessage) return 'sticker';
    if (message?.contactMessage) return 'contact';
    if (message?.locationMessage) return 'location';
    return 'unknown';
  }

  /**
   * Enviar mensagem de texto
   */
  async sendMessage(to, message) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp não está conectado');
      }

      // Garantir que o número tem @s.whatsapp.net
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

      const sent = await this.sock.sendMessage(jid, { text: message });
      
      logger.info(`📤 Mensagem enviada para ${to}`);
      return sent;
      
    } catch (error) {
      logger.error('❌ Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  /**
   * Enviar mídia
   */
  async sendMedia(to, mediaPath, caption = '') {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp não está conectado');
      }

      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

      // Detectar tipo de mídia
      const ext = path.extname(mediaPath).toLowerCase();
      let messageContent = {};

      if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
        messageContent = {
          image: { url: mediaPath },
          caption
        };
      } else if (['.mp4', '.mkv', '.avi'].includes(ext)) {
        messageContent = {
          video: { url: mediaPath },
          caption
        };
      } else if (['.mp3', '.ogg', '.wav'].includes(ext)) {
        messageContent = {
          audio: { url: mediaPath },
          mimetype: 'audio/mp4'
        };
      } else {
        messageContent = {
          document: { url: mediaPath },
          mimetype: 'application/octet-stream',
          fileName: path.basename(mediaPath)
        };
      }

      const sent = await this.sock.sendMessage(jid, messageContent);
      logger.info(`📤 Mídia enviada para ${to}`);
      return sent;
      
    } catch (error) {
      logger.error('❌ Erro ao enviar mídia:', error);
      throw error;
    }
  }

  /**
   * Verificar se está conectado
   */
  isConnected() {
    return this.isReady && this.sock;
  }

  /**
   * Obter número de telefone
   */
  getPhoneNumber() {
    if (this.sock?.user) {
      return this.sock.user.id.split(':')[0];
    }
    return null;
  }

  /**
   * Obter informações do usuário
   */
  getUserInfo() {
    if (this.sock?.user) {
      return {
        id: this.sock.user.id,
        name: this.sock.user.name,
        phone: this.sock.user.id.split(':')[0]
      };
    }
    return null;
  }

  /**
   * Desconectar
   */
  async destroy() {
    try {
      if (this.sock) {
        logger.info('🛑 Desconectando Baileys...');
        await this.sock.logout();
        this.sock = null;
        this.isReady = false;
        this.qrCode = null;
        this.qrCodeExpiry = null;
        logger.info('✅ Baileys desconectado');
      }
    } catch (error) {
      logger.warn('⚠️ Erro ao desconectar Baileys:', error);
    }
  }

  /**
   * Limpar sessão
   */
  clearSession(sessionName = 'chatbot-session') {
    try {
      const sessionFolder = path.join(this.sessionPath, sessionName);
      if (fs.existsSync(sessionFolder)) {
        fs.rmSync(sessionFolder, { recursive: true, force: true });
        logger.info('🗑️ Sessão limpa com sucesso');
      }
    } catch (error) {
      logger.error('❌ Erro ao limpar sessão:', error);
    }
  }
}

module.exports = new BaileysWhatsAppClient();

