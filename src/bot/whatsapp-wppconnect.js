const wppconnect = require('@wppconnect-team/wppconnect');
const qrcodeTerminal = require('qrcode-terminal');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Cliente WhatsApp usando WPPConnect
 * Mais estável que Baileys!
 */
class WhatsAppClient {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.isInitializing = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.sessionName = 'chatbot-session';
  }

  /**
   * Limpar processos órfãos do Chrome antes de inicializar
   */
  async cleanupOrphanedProcesses() {
    try {
      logger.info('🧹 Verificando processos órfãos do Chrome...');
      
      // Verificar se há arquivo de lock
      const tokensPath = path.join(__dirname, '../../tokens', this.sessionName);
      const lockFile = path.join(tokensPath, 'SingletonLock');
      
      if (fs.existsSync(lockFile)) {
        logger.warn('⚠️ Arquivo de lock encontrado. Limpando...');
        try {
          fs.unlinkSync(lockFile);
          logger.info('✅ Lock removido');
        } catch (err) {
          logger.warn('⚠️ Não foi possível remover lock:', err.message);
        }
      }

      // Windows: matar processos do Chrome que estão usando a pasta de tokens
      if (process.platform === 'win32') {
        try {
          const { stdout } = await execPromise(`wmic process where "commandline like '%${this.sessionName}%' and name='chrome.exe'" get processid /format:list`);
          const pids = stdout.match(/ProcessId=(\d+)/g);
          
          if (pids && pids.length > 0) {
            logger.warn(`⚠️ Encontrados ${pids.length} processos Chrome órfãos. Encerrando...`);
            for (const pidMatch of pids) {
              const pid = pidMatch.replace('ProcessId=', '').trim();
              if (pid && pid !== '0') {
                try {
                  await execPromise(`taskkill /F /PID ${pid}`);
                } catch (err) {
                  // Ignorar erros (processo pode já ter sido encerrado)
                }
              }
            }
            logger.info('✅ Processos órfãos encerrados');
            // Aguardar um pouco para garantir que os processos foram fechados
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (err) {
          // Se não encontrar processos, está tudo bem
          logger.debug('Nenhum processo órfão encontrado');
        }
      }
    } catch (error) {
      logger.warn('⚠️ Erro ao limpar processos órfãos:', error.message);
      // Não bloquear a inicialização por causa disso
    }
  }

  /**
   * Inicializar cliente WPPConnect
   */
  async initialize() {
    if (this.isInitializing) {
      logger.warn('⚠️ Inicialização já em andamento...');
      return;
    }

    if (this.isReady) {
      logger.info('✅ Cliente já está conectado!');
      return;
    }

    this.isInitializing = true;

    try {
      // Limpar processos órfãos antes de inicializar
      await this.cleanupOrphanedProcesses();

      logger.info('🚀 Iniciando WPPConnect...');

      // Criar diretório de tokens se não existir
      const tokensPath = path.join(__dirname, '../../tokens');
      if (!fs.existsSync(tokensPath)) {
        fs.mkdirSync(tokensPath, { recursive: true });
      }

      this.client = await wppconnect.create({
        session: this.sessionName,
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          try {
            this.qrCode = base64Qr;
            logger.info(`📱 QR Code recebido! (Tentativa ${attempts})`);
            logger.info(`📊 QR Code type: ${typeof base64Qr}, length: ${base64Qr?.length}`);
            
            // Mostrar QR Code no terminal
            qrcodeTerminal.generate(urlCode, { small: true });
            
            // Notificar controller para armazenar QR Code
            const whatsappController = require('../controllers/whatsappController');
            whatsappController.setQRCodeFromWPPConnect(base64Qr).then(() => {
              logger.info('✅ QR Code enviado para controller com sucesso');
            }).catch(err => {
              logger.error('❌ Erro ao salvar QR Code no controller:', err);
            });
          } catch (err) {
            logger.error('❌ Erro no callback catchQR:', err);
          }
        },
        statusFind: (statusSession, session) => {
          try {
            logger.info(`📊 Status da sessão: ${statusSession}`);
            
            if (statusSession === 'qrReadSuccess') {
              logger.info('✅ QR Code lido com sucesso!');
            } else if (statusSession === 'chatsAvailable') {
              logger.info('✅ Chats disponíveis!');
            } else if (statusSession === 'serverClose') {
              logger.warn('⚠️ Servidor fechou a conexão');
              this.isReady = false;
            } else if (statusSession === 'notLogged') {
              logger.warn('⚠️ Não está logado');
              this.isReady = false;
            } else if (statusSession === 'qrReadError' || statusSession === 'autocloseCalled') {
              logger.warn('⚠️ Erro ao ler QR Code ou timeout. O servidor continua funcionando.');
              this.isReady = false;
              this.isInitializing = false;
            }
          } catch (err) {
            logger.error('❌ Erro no callback statusFind:', err);
          }
        },
        folderNameToken: tokensPath,
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: false,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        autoClose: 180000, // 3 minutos (aumentado de 60s para dar mais tempo)
        disableWelcome: true,
        updatesLog: false
      });

      logger.info('✅ WPPConnect inicializado com sucesso!');
      this.isReady = true;
      this.isInitializing = false;
      this.reconnectAttempts = 0;

      // Adicionar tratamento de erro global no cliente para erros assíncronos
      if (this.client && typeof this.client.catch === 'function') {
        this.client.catch((err) => {
          logger.error('❌ Erro assíncrono no cliente WhatsApp (capturado):', err);
          this.isReady = false;
        });
      }

      // Obter informações do usuário (aguardar um pouco para garantir que está pronto)
      setTimeout(async () => {
        try {
          const hostDevice = await this.client.getHostDevice();
          if (hostDevice && hostDevice.id) {
            logger.info(`📱 Conectado como: ${hostDevice.id._serialized || hostDevice.id}`);
            logger.info(`👤 Nome: ${hostDevice.pushname || 'N/A'}`);
          }
        } catch (err) {
          logger.warn('⚠️ Não foi possível obter informações do device:', err.message);
        }
      }, 2000);

      // Limpar QR Code após conexão bem-sucedida
      this.qrCode = null;
      const whatsappController = require('../controllers/whatsappController');
      whatsappController.clearQRCode();

      // Configurar event listeners
      this.setupEventListeners();

      return this.client;

    } catch (error) {
      logger.error('❌ Erro ao inicializar WPPConnect:', error);
      this.isInitializing = false;
      this.isReady = false;
      
      // Tentar reconectar
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = 5000 + (this.reconnectAttempts * 2000);
        logger.info(`🔄 Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts}) em ${delay/1000}s...`);
        setTimeout(() => this.initialize(), delay);
      } else {
        logger.error('❌ Máximo de tentativas de reconexão atingido!');
        logger.warn('⚠️ O servidor continuará rodando, mas o WhatsApp não estará disponível.');
        logger.warn('⚠️ Para tentar novamente, reinicie o servidor ou use a API de reconexão.');
      }
      
      // NÃO fazer throw aqui para não derrubar o servidor
      // O dashboard continua funcionando mesmo sem WhatsApp
      return null;
    }
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    if (!this.client) return;

    // Mensagens recebidas
    this.client.onMessage(async (message) => {
      try {
        if (!message.isGroupMsg && !message.fromMe) {
          logger.info(`📨 Nova mensagem de ${message.from}: ${message.body?.substring(0, 50)}...`);
          await this.handleIncomingMessage(message);
        }
      } catch (error) {
        logger.error('❌ Erro ao processar mensagem:', error);
      }
    });

    // Estado da conexão
    this.client.onStateChange((state) => {
      logger.info(`🔄 Estado alterado: ${state}`);
      
      if (state === 'CONNECTED') {
        this.isReady = true;
        logger.info('✅ WhatsApp conectado!');
      } else if (state === 'CONFLICT' || state === 'UNPAIRED') {
        logger.warn('⚠️ Sessão em conflito ou não pareada');
        this.isReady = false;
      } else if (state === 'DISCONNECTED') {
        logger.warn('⚠️ WhatsApp desconectado!');
        this.isReady = false;
      }
    });

    // ACK de mensagens (confirmação de entrega)
    this.client.onAck(async (ack) => {
      logger.debug(`✓ ACK recebido: ${ack.id._serialized} - Status: ${ack.ack}`);
    });

    logger.info('✅ Event listeners configurados!');
  }

  /**
   * Processar mensagem recebida
   */
  async handleIncomingMessage(msg) {
    try {
      const flowMessageHandler = require('./flowMessageHandler');
      
      // Extrair informações do contato
      const contact = {
        id: msg.from,
        name: msg.notifyName || msg.sender.pushname || 'Usuário',
        number: msg.from.split('@')[0]
      };

      // Formatar mensagem
      const message = {
        id: msg.id,
        from: msg.from,
        to: msg.to,
        body: msg.body || '',
        timestamp: msg.timestamp,
        fromMe: msg.fromMe,
        hasMedia: msg.hasMedia,
        type: this.getMessageType(msg),
        _data: msg
      };

      logger.info(`📬 Processando mensagem de ${contact.name}: "${message.body.substring(0, 50)}..."`);

      // Processar com flowMessageHandler
      await flowMessageHandler.handleMessage(this, message, contact);

    } catch (error) {
      logger.error('❌ Erro ao processar mensagem recebida:', error);
    }
  }

  /**
   * Obter tipo de mensagem
   */
  getMessageType(message) {
    if (message.isMedia) {
      if (message.type === 'image') return 'image';
      if (message.type === 'video') return 'video';
      if (message.type === 'audio' || message.type === 'ptt') return 'audio';
      if (message.type === 'document') return 'document';
      if (message.type === 'sticker') return 'sticker';
      return 'media';
    }
    if (message.type === 'chat') return 'chat';
    if (message.type === 'vcard') return 'contact';
    if (message.type === 'location') return 'location';
    return 'unknown';
  }

  /**
   * Enviar mensagem de texto
   */
  async sendMessage(to, message) {
    try {
      logger.info(`🚀 [WPPCONNECT] Enviando mensagem para: ${to}`);
      logger.info(`📝 [WPPCONNECT] Mensagem: ${message.substring(0, 100)}...`);

      if (!this.isReady) {
        logger.error('❌ [WPPCONNECT] WhatsApp não está conectado!');
        throw new Error('WhatsApp não está conectado');
      }

      if (!this.client) {
        logger.error('❌ [WPPCONNECT] Cliente não está disponível!');
        throw new Error('Cliente não disponível');
      }

      // Garantir que o número tem @c.us
      const chatId = to.includes('@') ? to : `${to}@c.us`;

      // Tentar enviar com retry
      let sent = null;
      let lastError = null;
      const maxRetries = 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(`⏳ [WPPCONNECT] Tentativa ${attempt}/${maxRetries}...`);

          // Criar timeout de 15 segundos
          let timeoutId;
          const sendPromise = this.client.sendText(chatId, message);
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error('Timeout ao enviar mensagem'));
            }, 15000);
          });

          sent = await Promise.race([sendPromise, timeoutPromise]);

          // Limpar timeout se a mensagem foi enviada
          if (timeoutId) clearTimeout(timeoutId);

          logger.info(`✅ [WPPCONNECT] Mensagem enviada com sucesso na tentativa ${attempt}!`);
          break;

        } catch (error) {
          lastError = error;
          logger.warn(`⚠️ [WPPCONNECT] Tentativa ${attempt} falhou: ${error.message}`);

          if (attempt < maxRetries) {
            logger.info(`🔄 [WPPCONNECT] Aguardando 2s antes de tentar novamente...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (!sent) {
        logger.error(`❌ [WPPCONNECT] Todas as ${maxRetries} tentativas falharam!`);
        throw lastError || new Error('Falha ao enviar mensagem após múltiplas tentativas');
      }

      logger.info(`📤 [WPPCONNECT] Mensagem enviada para ${to}`);
      return sent;

    } catch (error) {
      logger.error(`❌ [WPPCONNECT] Erro ao enviar mensagem: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marcar mensagem como lida
   */
  async markAsRead(message) {
    try {
      if (this.client && message._data) {
        await this.client.sendSeen(message.from);
      }
    } catch (error) {
      logger.error('Erro ao marcar como lida:', error);
    }
  }

  /**
   * Enviar indicador de digitação
   */
  async sendTyping(to, duration = 2000) {
    try {
      if (this.client) {
        await this.client.startTyping(to);
        setTimeout(() => {
          this.client.stopTyping(to).catch(() => {});
        }, duration);
      }
    } catch (error) {
      logger.error('Erro ao enviar typing:', error);
    }
  }

  /**
   * Obter status da conexão
   */
  getStatus() {
    return {
      connected: this.isReady,
      status: this.isReady ? 'ready' : 'disconnected',
      platform: 'WPPConnect',
      qrCode: this.qrCode
    };
  }

  /**
   * Desconectar
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        logger.info('✅ WPPConnect desconectado');
      }
      this.isReady = false;
      this.client = null;
      
      // Limpar processos órfãos após desconectar
      await this.cleanupOrphanedProcesses();
    } catch (error) {
      logger.error('❌ Erro ao desconectar:', error);
    }
  }

  /**
   * Limpar sessão
   */
  async clearSession() {
    try {
      logger.info('🗑️ Limpando sessão WPPConnect...');
      
      await this.disconnect();
      
      // Limpar pasta de tokens
      const tokensPath = path.join(__dirname, '../../tokens');
      if (fs.existsSync(tokensPath)) {
        const files = fs.readdirSync(tokensPath);
        for (const file of files) {
          fs.unlinkSync(path.join(tokensPath, file));
        }
        logger.info('✅ Tokens limpos');
      }
      
      this.qrCode = null;
      this.reconnectAttempts = 0;
      
      logger.info('✅ Sessão limpa com sucesso!');
    } catch (error) {
      logger.error('❌ Erro ao limpar sessão:', error);
      throw error;
    }
  }

  /**
   * Reconectar forçado
   */
  async forceReconnect() {
    try {
      logger.info('🔄 Forçando reconexão...');
      await this.disconnect();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.initialize();
      logger.info('✅ Reconexão concluída!');
    } catch (error) {
      logger.error('❌ Erro ao reconectar:', error);
      throw error;
    }
  }
}

// Exportar instância única (Singleton)
module.exports = new WhatsAppClient();

