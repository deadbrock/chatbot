const wppconnect = require('@wppconnect-team/wppconnect');
const qrcodeTerminal = require('qrcode-terminal');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

function resolveBrowserExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = [];
  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';
    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (process.platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  }

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

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
    this.baseSessionName = process.env.WHATSAPP_SESSION_NAME || 'chatbot-session';
    this.sessionName = this.baseSessionName;
    this.loadingPercent = 0;
    this.loadingMessage = '';
    this.initStartedAt = null;
    this.hasSyncedThisSession = false;
    this.awaitingInitialSync = false;
  }

  hasPersistedBrowserProfile() {
    const sessionPath = this.getSessionPath();
    const markers = ['Default', 'Local State', 'First Run', 'Preferences'];
    return markers.some((name) => fs.existsSync(path.join(sessionPath, name)));
  }

  getSessionPath() {
    return path.join(__dirname, '../../tokens', this.sessionName);
  }

  rotateSessionName() {
    const previous = this.sessionName;
    this.sessionName = `${this.baseSessionName}-${Date.now()}`;
    const tokensRoot = path.join(__dirname, '../../tokens');
    fs.mkdirSync(path.join(tokensRoot, this.sessionName), { recursive: true });
    logger.warn(`🔄 Nova sessão criada: ${previous} → ${this.sessionName}`);
    return this.sessionName;
  }

  isSessionLocked() {
    const lockFiles = ['lockfile', 'SingletonLock', 'SingletonSocket'];
    return lockFiles.some((name) => fs.existsSync(path.join(this.getSessionPath(), name)));
  }

  async prepareForConnection({ rotateIfLocked = true, forceFresh = false } = {}) {
    this.reconnectAttempts = 0;
    this.isInitializing = false;

    if (this.client) {
      await this.disconnect();
    }

    if (forceFresh && !this.isReady) {
      logger.info('🆕 Preparando sessão limpa para novo QR Code...');
      this.rotateSessionName();
    } else if (rotateIfLocked && this.isSessionLocked()) {
      logger.warn('⚠️ Sessão anterior ainda bloqueada. Criando nova pasta de sessão...');
      this.rotateSessionName();
    } else if (!this.isReady && this.hasPersistedBrowserProfile()) {
      logger.warn('⚠️ Perfil antigo detectado sem conexão ativa. Criando nova sessão...');
      this.rotateSessionName();
    }
  }

  clearQrAfterAuth() {
    this.qrCode = null;
    try {
      const whatsappController = require('../controllers/whatsappController');
      whatsappController.clearQRCode();
    } catch (err) {
      logger.warn('⚠️ Não foi possível limpar QR no controller:', err.message);
    }
  }

  publishQrCode(base64Qr, attempt = 1, urlCode = '') {
    if (!base64Qr) return false;

    const normalized = base64Qr.startsWith('data:')
      ? base64Qr
      : `data:image/png;base64,${base64Qr}`;

    if (this.qrCode === normalized) return false;

    this.qrCode = normalized;
    this.loadingMessage = 'QR Code disponível — escaneie com o celular';
    logger.info(`📱 QR Code recebido! (Tentativa ${attempt})`);

    if (urlCode) {
      try {
        qrcodeTerminal.generate(urlCode, { small: true });
      } catch (err) {
        logger.debug('Não foi possível exibir QR no terminal:', err.message);
      }
    }

    const whatsappController = require('../controllers/whatsappController');
    whatsappController.setQRCodeFromWPPConnect(normalized).then(() => {
      logger.info('✅ QR Code enviado para controller com sucesso');
    }).catch((err) => {
      logger.error('❌ Erro ao salvar QR Code no controller:', err);
    });

    return true;
  }

  async pollQrCodeFromBrowser() {
    if (!this.client || this.isReady || this.qrCode) return false;

    try {
      const result = await this.client.getQrCode();
      if (result?.base64Image && result?.urlCode) {
        return this.publishQrCode(result.base64Image, (this.qrPollAttempt || 0) + 1, result.urlCode);
      }
    } catch (err) {
      logger.debug('Polling QR ainda sem resultado:', err.message);
    }

    return false;
  }

  markConnected() {
    if (this.isReady) return;
    this.isReady = true;
    this.isInitializing = false;
    this.reconnectAttempts = 0;
    this.awaitingInitialSync = true;
    this.clearQrAfterAuth();
    logger.info('✅ WhatsApp autenticado e pronto!');
    this.scheduleConversationSync();
  }

  scheduleConversationSync() {
    if (this.hasSyncedThisSession) return;

    setTimeout(() => {
      if (!this.isReady || !this.client) {
        this.awaitingInitialSync = false;
        return;
      }

      this.hasSyncedThisSession = true;
      const whatsappSyncService = require('../services/whatsappSyncService');

      whatsappSyncService.startSync(this).then((stats) => {
        logger.info(`📲 Conversas sincronizadas: ${stats?.messagesImported || 0} mensagens importadas`);
      }).catch((err) => {
        logger.error('❌ Falha ao sincronizar conversas:', err.message);
        this.hasSyncedThisSession = false;
      }).finally(() => {
        this.awaitingInitialSync = false;
        logger.info('✅ Sync inicial concluído — mensagens ao vivo habilitadas');
      });
    }, 3000);
  }

  async resetStuckSession() {
    const tokensRoot = path.join(__dirname, '../../tokens');
    const sessionPath = this.getSessionPath();

    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      return { rotated: false };
    }

    const backupPath = path.join(tokensRoot, `${this.sessionName}.stuck-${Date.now()}`);
    logger.warn(`⚠️ Resetando sessão travada: ${sessionPath} → ${backupPath}`);

    try {
      fs.renameSync(sessionPath, backupPath);
      fs.mkdirSync(sessionPath, { recursive: true });
      logger.info('✅ Sessão travada movida para backup');
      return { rotated: false };
    } catch (err) {
      logger.warn(`⚠️ Não foi possível mover sessão travada (${err.message}). Usando nova sessão.`);
      this.rotateSessionName();
      return { rotated: true };
    }
  }

  markDisconnected() {
    this.isReady = false;
    this.hasSyncedThisSession = false;
    this.awaitingInitialSync = false;
  }

  startQrWatchdog() {
    if (this.qrWatchdog) {
      clearInterval(this.qrWatchdog);
    }

    let attempts = 0;
    this.qrPollAttempt = 0;

    const poll = async () => {
      attempts += 1;
      this.qrPollAttempt = attempts;

      if (this.isReady || !this.client) {
        clearInterval(this.qrWatchdog);
        this.qrWatchdog = null;
        return;
      }

      if (this.qrCode) {
        clearInterval(this.qrWatchdog);
        this.qrWatchdog = null;
        return;
      }

      await this.pollQrCodeFromBrowser();

      if (attempts > 40) {
        logger.warn('⚠️ QR Code não gerado após ~2 minutos. Tente "Limpar Sessão" e reconectar.');
        clearInterval(this.qrWatchdog);
        this.qrWatchdog = null;
      }
    };

    // WAPI pode demorar para injetar; primeira tentativa após 8s
    setTimeout(poll, 8000);
    this.qrWatchdog = setInterval(poll, 3000);
  }

  /**
   * Limpar processos órfãos do Chrome antes de inicializar
   */
  async cleanupOrphanedProcesses() {
    try {
      logger.info('🧹 Verificando processos órfãos do Chrome...');
      
      const tokensPath = this.getSessionPath();
      const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];

      for (const lockName of lockFiles) {
        const lockFile = path.join(tokensPath, lockName);
        if (fs.existsSync(lockFile)) {
          logger.warn(`⚠️ Arquivo de lock encontrado (${lockName}). Limpando...`);
          try {
            fs.unlinkSync(lockFile);
            logger.info(`✅ Lock removido: ${lockName}`);
          } catch (err) {
            logger.warn(`⚠️ Não foi possível remover lock ${lockName}:`, err.message);
          }
        }
      }

      // Windows: encerrar Chrome/Edge que usa a pasta desta sessão
      if (process.platform === 'win32') {
        const tokensRoot = path.join(__dirname, '../../tokens').replace(/\\/g, '/');
        const sessionSlug = this.sessionName.replace(/'/g, "''");
        const psKill = `powershell -NoProfile -Command "$root='${tokensRoot}'; $session='${sessionSlug}'; Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe' OR Name='msedge.exe'\\" | Where-Object { $_.CommandLine -and ($_.CommandLine -like ('*' + $session + '*') -or $_.CommandLine -like ('*' + $root + '*')) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;

        try {
          await execPromise(psKill);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (err) {
          logger.debug('PowerShell não encontrou processos órfãos do navegador');
        }

        const sessionFolder = this.sessionName.replace(/\\/g, '\\\\');
        const killPatterns = [
          `wmic process where "commandline like '%${sessionFolder}%' and (name='chrome.exe' or name='msedge.exe')" get processid /format:list`,
        ];

        for (const cmd of killPatterns) {
          try {
            const { stdout } = await execPromise(cmd);
            const pids = stdout.match(/ProcessId=(\d+)/g) || [];

            if (pids.length > 0) {
              logger.warn(`⚠️ Encontrados ${pids.length} processos do navegador órfãos. Encerrando...`);
              for (const pidMatch of pids) {
                const pid = pidMatch.replace('ProcessId=', '').trim();
                if (pid && pid !== '0') {
                  try {
                    await execPromise(`taskkill /F /PID ${pid}`);
                  } catch (err) {
                    // processo pode já ter sido encerrado
                  }
                }
              }
              await new Promise((resolve) => setTimeout(resolve, 1500));
            }
          } catch (err) {
            logger.debug('Nenhum processo órfão encontrado para o padrão atual');
          }
        }

        // Tentar novamente remover locks após matar processos
        for (const lockName of lockFiles) {
          const lockFile = path.join(tokensPath, lockName);
          if (fs.existsSync(lockFile)) {
            try { fs.unlinkSync(lockFile); } catch (err) { /* ignore */ }
          }
        }
      }
    } catch (error) {
      logger.warn('⚠️ Erro ao limpar processos órfãos:', error.message);
    }
  }

  /**
   * Inicializar cliente WPPConnect
   */
  async initialize() {
    if (this.isReady) {
      logger.info('✅ Cliente já está conectado!');
      return;
    }

    if (this.isInitializing) {
      logger.warn('⚠️ Inicialização já em andamento...');
      return;
    }

    if (this.client) {
      logger.info('📱 Cliente já iniciado — aguardando autenticação via QR...');
      return;
    }

    this.isInitializing = true;
    this.initStartedAt = Date.now();
    this.loadingPercent = 0;
    this.loadingMessage = 'Iniciando navegador...';

    try {
      // Limpar processos órfãos antes de inicializar
      await this.cleanupOrphanedProcesses();

      logger.info('🚀 Iniciando WPPConnect...');

      const browserPath = resolveBrowserExecutablePath();
      if (browserPath) {
        logger.info(`🌐 Navegador detectado: ${browserPath}`);
      } else {
        logger.warn('⚠️ Chrome/Edge não encontrado. Instale o Google Chrome ou defina PUPPETEER_EXECUTABLE_PATH.');
      }

      const puppeteerOptions = {};
      if (browserPath) {
        puppeteerOptions.executablePath = browserPath;
      }

      // Criar diretório de tokens se não existir
      const tokensPath = path.join(__dirname, '../../tokens');
      if (!fs.existsSync(tokensPath)) {
        fs.mkdirSync(tokensPath, { recursive: true });
      }

      // Sempre headless — o QR é exibido no painel, sem abrir janela do Chrome
      const headless = process.env.WHATSAPP_HEADLESS !== 'false';
      const wppOptions = {
        session: this.sessionName,
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          try {
            this.publishQrCode(base64Qr, attempts, urlCode);
          } catch (err) {
            logger.error('❌ Erro no callback catchQR:', err);
          }
        },
        statusFind: (statusSession, session) => {
          try {
            logger.info(`📊 Status da sessão: ${statusSession}`);
            
            if (statusSession === 'qrReadSuccess') {
              logger.info('✅ QR Code lido com sucesso!');
            } else if (statusSession === 'isLogged' || statusSession === 'inChat') {
              this.markConnected();
            } else if (statusSession === 'chatsAvailable') {
              logger.info('✅ Chats disponíveis!');
              this.markConnected();
            } else if (statusSession === 'serverClose') {
              logger.warn('⚠️ Servidor fechou a conexão');
              this.markDisconnected();
            } else if (statusSession === 'notLogged') {
              logger.info('📲 Aguardando escaneamento do QR Code...');
              this.loadingMessage = 'Aguardando escaneamento do QR Code...';
              this.markDisconnected();
            } else if (statusSession === 'qrReadError' || statusSession === 'autocloseCalled' || statusSession === 'browserClose') {
              logger.warn(`⚠️ Sessão encerrada (${statusSession}). Será necessário reconectar.`);
              this.markDisconnected();
              this.isInitializing = false;
              this.client = null;
            }
          } catch (err) {
            logger.error('❌ Erro no callback statusFind:', err);
          }
        },
        onLoadingScreen: (percent, message) => {
          this.loadingPercent = percent || 0;
          this.loadingMessage = message || 'Carregando WhatsApp Web...';
          logger.info(`⏳ WhatsApp Web: ${percent}% — ${message}`);
        },
        folderNameToken: tokensPath,
        headless,
        devtools: process.env.WHATSAPP_DEVTOOLS === 'true',
        useChrome: true,
        puppeteerOptions,
        debug: process.env.WHATSAPP_DEBUG === 'true',
        logQR: false,
        waitForLogin: false,
        deviceName: process.env.WHATSAPP_DEVICE_NAME || 'AstroChat',
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        autoClose: 0,
        deviceSyncTimeout: 0,
        disableWelcome: true,
        updatesLog: false,
      };

      if (process.env.WHATSAPP_VERSION) {
        wppOptions.whatsappVersion = process.env.WHATSAPP_VERSION;
      } else {
        // Versão estável para geração de QR em headless
        wppOptions.whatsappVersion = '2.2412.54';
      }

      this.client = await wppconnect.create(wppOptions);

      logger.info('✅ WPPConnect browser iniciado — aguardando QR Code...');
      this.isInitializing = false;
      this.loadingMessage = 'Carregando WhatsApp Web...';

      // Configurar event listeners — o QR é gerado via catchQR (sem waitForLogin)
      this.setupEventListeners();

      // Verificar se já existe sessão autenticada
      try {
        const connectionState = await this.client.getConnectionState();
        logger.info(`📊 Estado da conexão: ${connectionState}`);
        if (connectionState === 'CONNECTED') {
          this.markConnected();
        }
      } catch (err) {
        logger.debug('Aguardando QR Code para autenticação:', err.message);
      }

      if (this.isReady) {
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
      }

      this.startQrWatchdog();

      return this.client;

    } catch (error) {
      logger.error('❌ Erro ao inicializar WPPConnect:', error);
      this.isInitializing = false;
      this.markDisconnected();
      this.client = null;

      const isBrowserMissing = /Could not find Chrome/i.test(error?.message || '');
      const isBrowserLocked = /already running/i.test(error?.message || '');

      if (isBrowserMissing) {
        logger.error('💡 Instale o Google Chrome ou defina PUPPETEER_EXECUTABLE_PATH no .env');
        logger.error('   Exemplo Windows: PUPPETEER_EXECUTABLE_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
        return null;
      }

      if (isBrowserLocked) {
        logger.warn('⚠️ Sessão do navegador travada. Liberando pasta e criando nova sessão...');
        await this.cleanupOrphanedProcesses();
        await this.resetStuckSession();
        if (this.isSessionLocked()) {
          this.rotateSessionName();
        }
      }
      
      // Tentar reconectar
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = isBrowserLocked ? 2000 : 5000 + (this.reconnectAttempts * 2000);
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
        if (message.isGroupMsg || message.fromMe) return;
        if (message.from?.includes('@broadcast') || message.from === 'status@broadcast') return;

        const whatsappSyncService = require('../services/whatsappSyncService');
        if (this.awaitingInitialSync || whatsappSyncService.syncInProgress) {
          logger.debug(`⏭️ Replay/sync em andamento — ignorando: ${message.from}`);
          return;
        }

        logger.info(`📨 Nova mensagem de ${message.from}: ${message.body?.substring(0, 50)}...`);
        await this.handleIncomingMessage(message);
      } catch (error) {
        logger.error('❌ Erro ao processar mensagem:', error);
      }
    });

    // Estado da conexão
    this.client.onStateChange((state) => {
      logger.info(`🔄 Estado alterado: ${state}`);
      
      if (state === 'CONNECTED') {
        this.markConnected();
      } else if (state === 'CONFLICT' || state === 'UNPAIRED') {
        logger.warn('⚠️ Sessão em conflito ou não pareada');
        this.markDisconnected();
      } else if (state === 'DISCONNECTED') {
        logger.warn('⚠️ WhatsApp desconectado!');
        this.markDisconnected();
        this.client = null;
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
        name: msg.notifyName || msg.sender?.pushname || msg.sender?.name || '',
        number: msg.from.split('@')[0]
      };

      // Formatar mensagem
      const message = {
        id: msg.id,
        from: msg.from,
        to: msg.to,
        body: msg.body || msg.caption || '',
        caption: msg.caption || '',
        timestamp: msg.timestamp || msg.t,
        t: msg.t,
        fromMe: msg.fromMe,
        hasMedia: msg.hasMedia || msg.isMedia,
        isMedia: msg.isMedia,
        type: this.getMessageType(msg),
        mimetype: msg.mimetype,
        filename: msg.filename || msg.fileName,
        _data: msg
      };

      const preview = message.body ? message.body.substring(0, 50) : `[${message.type}]`;
      logger.info(`📬 Processando mensagem de ${contact.name}: "${preview}..."`);

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
    if (message.type && message.type !== 'chat') {
      if (message.type === 'ptt') return 'audio';
      return message.type;
    }
    if (message.isMedia || message.hasMedia) {
      if (message.mimetype?.startsWith('image/')) return 'image';
      if (message.mimetype?.startsWith('video/')) return 'video';
      if (message.mimetype?.startsWith('audio/')) return 'audio';
      return 'document';
    }
    return 'text';
  }

  /**
   * Verifica se o cliente está realmente pronto para enviar
   */
  async ensureReadyForSend() {
    if (this.isReady && this.client) return true;

    if (!this.client) return false;

    try {
      const state = await this.client.getConnectionState();
      if (state === 'CONNECTED') {
        this.markConnected();
        return true;
      }
    } catch (err) {
      logger.debug('ensureReadyForSend:', err.message);
    }

    return false;
  }

  normalizeChatId(to) {
    if (!to || typeof to !== 'string') {
      throw new Error('Destinatário inválido');
    }

    const trimmed = to.trim();
    if (trimmed.includes('@')) {
      return trimmed;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (!digits) {
      throw new Error('Número do destinatário inválido');
    }

    return `${digits}@c.us`;
  }

  /**
   * Enviar mensagem de texto
   */
  async sendMessage(to, message) {
    try {
      const chatId = this.normalizeChatId(to);
      logger.info(`🚀 [WPPCONNECT] Enviando mensagem para: ${chatId}`);
      logger.info(`📝 [WPPCONNECT] Mensagem: ${message.substring(0, 100)}...`);

      const ready = await this.ensureReadyForSend();
      if (!ready) {
        logger.error('❌ [WPPCONNECT] WhatsApp não está conectado!');
        throw new Error('WhatsApp não está conectado. Reconecte em Administração → Conexões.');
      }

      if (!this.client) {
        logger.error('❌ [WPPCONNECT] Cliente não está disponível!');
        throw new Error('Cliente WhatsApp indisponível');
      }

      let sent = null;
      let lastError = null;
      const maxRetries = 2;
      const targets = [chatId];

      // Fallback: se falhar com @lid, tenta @c.us com os dígitos do JID
      if (chatId.includes('@lid')) {
        const digits = chatId.split('@')[0].replace(/\D/g, '');
        if (digits) targets.push(`${digits}@c.us`);
      }

      for (const target of targets) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          let timeoutId;
          try {
            logger.info(`⏳ [WPPCONNECT] Tentativa ${attempt}/${maxRetries} para ${target}...`);

            const sendPromise = this.client.sendText(target, message);
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(new Error('Timeout ao enviar mensagem (30s)'));
              }, 30000);
            });

            sent = await Promise.race([sendPromise, timeoutPromise]);
            if (timeoutId) clearTimeout(timeoutId);

            logger.info(`✅ [WPPCONNECT] Mensagem enviada com sucesso para ${target}!`);
            return sent;
          } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            lastError = error;
            logger.warn(`⚠️ [WPPCONNECT] Falha ${target} (tentativa ${attempt}): ${error.message}`);

            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
            }
          }
        }
      }

      throw lastError || new Error('Falha ao enviar mensagem após múltiplas tentativas');
    } catch (error) {
      logger.error(`❌ [WPPCONNECT] Erro ao enviar mensagem: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enviar mensagem de voz (PTT)
   */
  async sendVoiceMessage(to, filePath, filename = 'audio.ogg') {
    const chatId = this.normalizeChatId(to);
    const ready = await this.ensureReadyForSend();
    if (!ready || !this.client) {
      throw new Error('WhatsApp não está conectado');
    }

    logger.info(`🎤 [WPPCONNECT] Enviando áudio PTT para: ${chatId}`);
    return this.client.sendPtt(chatId, filePath, filename);
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
      status: this.isReady ? 'ready' : (this.client ? 'connecting' : 'disconnected'),
      platform: 'WPPConnect',
      qrCode: this.qrCode,
      sessionName: this.sessionName,
      isInitializing: this.isInitializing,
      loadingPercent: this.loadingPercent,
      loadingMessage: this.loadingMessage,
    };
  }

  /**
   * Desconectar
   */
  async disconnect() {
    try {
      if (this.qrWatchdog) {
        clearInterval(this.qrWatchdog);
        this.qrWatchdog = null;
      }
      if (this.client) {
        try {
          await this.client.close();
          logger.info('✅ WPPConnect desconectado');
        } catch (closeErr) {
          logger.warn('⚠️ Erro ao fechar cliente WPPConnect:', closeErr.message);
        }
      }
      this.markDisconnected();
      this.client = null;
      this.isInitializing = false;
      await this.cleanupOrphanedProcesses();
    } catch (error) {
      logger.error('❌ Erro ao desconectar:', error);
      this.client = null;
      this.isInitializing = false;
    }
  }

  /**
   * Limpar sessão
   */
  async clearSession() {
    logger.info('🗑️ Limpando sessão WPPConnect...');

    await this.disconnect();
    this.client = null;

    const result = await this.resetStuckSession();
    if (!result.rotated && this.isSessionLocked()) {
      this.rotateSessionName();
    }

    this.qrCode = null;
    this.isInitializing = false;
    this.reconnectAttempts = 0;

    logger.info(`✅ Sessão limpa. Sessão ativa: ${this.sessionName}`);
    return { sessionName: this.sessionName };
  }

  /**
   * Reconectar forçado
   */
  async forceReconnect() {
    logger.info('🔄 Forçando reconexão...');
    await this.prepareForConnection({ rotateIfLocked: true });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await this.initialize();
    logger.info('✅ Reconexão iniciada!');
  }
}

// Exportar instância única (Singleton)
module.exports = new WhatsAppClient();

