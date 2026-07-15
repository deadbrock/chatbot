// ============================================
// LOGS INICIAIS - ANTES DE QUALQUER COISA
// ============================================
console.log('═══════════════════════════════════════════════════════');
console.log('🚀 ASTROCHAT - INICIANDO SERVIDOR');
console.log('═══════════════════════════════════════════════════════');
console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
console.log(`💻 Node.js: ${process.version}`);
console.log(`🖥️  Plataforma: ${process.platform} ${process.arch}`);
console.log(`🆔 PID: ${process.pid}`);
console.log(`📁 Diretório: ${process.cwd()}`);
console.log(`💾 Memória inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
console.log('═══════════════════════════════════════════════════════');

// Carregar variáveis de ambiente PRIMEIRO
console.log('📋 Carregando variáveis de ambiente...');
require('dotenv').config();
console.log('✅ Variáveis de ambiente carregadas');

// Evitar "quedas" do servidor por EPIPE ao escrever no stdout/stderr
// (pode acontecer quando o processo roda em background/pipe).
function ignoreEpipe(stream) {
  if (!stream || typeof stream.on !== 'function') return;
  stream.on('error', (err) => {
    if (err && err.code === 'EPIPE') {
      // Silenciosamente ignorar para não derrubar o processo
      return;
    }
    // Outros erros de stream devem ser visíveis
    console.error('Erro em stream de saída:', err);
  });
}
ignoreEpipe(process.stdout);
ignoreEpipe(process.stderr);

console.log('📦 Carregando módulos...');

// Importações internas
let whatsappClient;
let logger;

try {
  console.log('   - Carregando logger...');
  logger = require('./utils/logger');
  console.log('   ✅ Logger carregado');
} catch (loggerError) {
  console.error('   ❌ ERRO ao carregar logger:', loggerError);
  // Criar logger básico de fallback
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    debug: (...args) => console.log('[DEBUG]', ...args)
  };
}

try {
  console.log('   - Carregando WhatsApp client...');
  whatsappClient = require('./bot/whatsapp');
  console.log('   ✅ WhatsApp client carregado');
} catch (whatsappError) {
  console.error('   ⚠️ AVISO: Erro ao carregar WhatsApp client (não crítico):', whatsappError.message);
  // Continuar sem WhatsApp
}

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

console.log('✅ Módulos básicos carregados');

// Carregar módulos críticos com tratamento de erro
let testConnection, syncDatabase;
try {
  console.log('   - Carregando configuração de banco de dados...');
  const dbConfig = require('./config/database');
  testConnection = dbConfig.testConnection;
  syncDatabase = dbConfig.syncDatabase;
  console.log('   ✅ Configuração de banco carregada');
} catch (dbConfigError) {
  console.error('   ❌ ERRO CRÍTICO ao carregar configuração de banco:', dbConfigError);
  throw dbConfigError; // Este é crítico, não pode continuar
}

let routes;
try {
  console.log('   - Carregando rotas...');
  routes = require('./routes');
  console.log('   ✅ Rotas carregadas');
} catch (routesError) {
  console.error('   ❌ ERRO CRÍTICO ao carregar rotas:', routesError);
  throw routesError; // Este é crítico
}

let initializeScheduledJobs;
try {
  console.log('   - Carregando scheduler...');
  const scheduler = require('./services/scheduler');
  initializeScheduledJobs = scheduler.initializeScheduledJobs;
  console.log('   ✅ Scheduler carregado');
} catch (schedulerError) {
  console.error('   ⚠️ AVISO: Erro ao carregar scheduler (não crítico):', schedulerError.message);
  initializeScheduledJobs = () => {}; // Função vazia como fallback
}

let reportScheduler;
try {
  console.log('   - Carregando report scheduler...');
  reportScheduler = require('./services/reportScheduler');
  console.log('   ✅ Report scheduler carregado');
} catch (reportError) {
  console.error('   ⚠️ AVISO: Erro ao carregar report scheduler (não crítico):', reportError.message);
  reportScheduler = { start: () => {} }; // Objeto vazio como fallback
}

let initializeSnapshotScheduler;
try {
  console.log('   - Carregando snapshot scheduler...');
  const snapshotScheduler = require('./services/snapshotScheduler');
  initializeSnapshotScheduler = snapshotScheduler.initializeSnapshotScheduler;
  console.log('   ✅ Snapshot scheduler carregado');
} catch (snapshotError) {
  console.error('   ⚠️ AVISO: Erro ao carregar snapshot scheduler (não crítico):', snapshotError.message);
  initializeSnapshotScheduler = () => {}; // Função vazia como fallback
}

let initializeAdminDefaults;
try {
  console.log('   - Carregando inicialização de admin...');
  const adminInit = require('./setup/initializeAdmin');
  initializeAdminDefaults = adminInit.initializeAdminDefaults;
  console.log('   ✅ Inicialização de admin carregada');
} catch (adminError) {
  console.error('   ⚠️ AVISO: Erro ao carregar inicialização de admin (não crítico):', adminError.message);
  initializeAdminDefaults = async () => {}; // Função vazia como fallback
}

let ChatSocketService;
try {
  console.log('   - Carregando Chat Socket Service...');
  ChatSocketService = require('./services/chatSocketService');
  console.log('   ✅ Chat Socket Service carregado');
} catch (chatSocketError) {
  console.error('   ⚠️ AVISO: Erro ao carregar Chat Socket Service (não crítico):', chatSocketError.message);
  // Criar classe vazia como fallback
  ChatSocketService = class {
    constructor() {}
    initialize() {}
  };
}

// Importar todos os modelos (necessário para o Sequelize sync)
try {
  console.log('   - Carregando modelos...');
  require('./models');
  console.log('   ✅ Modelos carregados');
} catch (modelsError) {
  console.error('   ❌ ERRO CRÍTICO ao carregar modelos:', modelsError);
  throw modelsError; // Este é crítico
}

console.log('✅ Todos os módulos carregados com sucesso');

// Configuração do Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
global.io = io;

// Middlewares
// Configurar CORS para permitir requisições do frontend (Vercel)
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      // Adicionar origens do Vercel via variável de ambiente
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [])
    ];
    
    // Em desenvolvimento, permitir qualquer origem
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Em produção, verificar se a origem está permitida
    // Se ALLOWED_ORIGINS não estiver configurado, permitir qualquer origem (temporário para debug)
    const hasCustomOrigins = process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim() !== '';
    
    if (!hasCustomOrigins) {
      // Se não houver ALLOWED_ORIGINS configurado, permitir todas as origens (temporário)
      logger.warn(`⚠️ ALLOWED_ORIGINS não configurado. Permitindo todas as origens (não recomendado para produção)`);
      callback(null, true);
    } else if (allowedOrigins.includes(origin)) {
      // Origem está na lista permitida
      callback(null, true);
    } else {
      // Log para debug
      logger.warn(`⚠️ CORS bloqueado para origem: ${origin}`);
      logger.info(`💡 Origens permitidas: ${allowedOrigins.join(', ')}`);
      logger.info(`💡 Configure ALLOWED_ORIGINS no Railway para permitir esta origem`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Tratar requisições OPTIONS (preflight) antes do CORS
app.options('*', cors(corsOptions));

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dashboard/public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Se chegar JSON inválido, responder 400 (sem derrubar / sem virar 500 genérico)
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no body' });
  }
  return next(err);
});

// Disponibilizar io globalmente
app.set('io', io);

// Rotas
app.use('/api', routes);

// Rota principal do dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard/public/index.html'));
});

// Health check
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({ 
    status: 'ok', 
    whatsapp: whatsappClient?.isReady ?? false,
    database: dbConnected
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  logger.error('❌ Erro na aplicação:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    headers: req.headers
  });
  
  // Sempre retornar JSON, mesmo em caso de erro
  res.status(err.status || 500).json({ 
    success: false,
    error: err.message || 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.stack : 'Erro interno do servidor'
  });
});

// Inicialização do servidor
const DEFAULT_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function listenOnce(port) {
  return new Promise((resolve, reject) => {
    const onListening = () => {
      cleanup();
      resolve(port);
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      server.removeListener('listening', onListening);
      server.removeListener('error', onError);
    };

    server.once('listening', onListening);
    server.once('error', onError);
    server.listen(port);
  });
}

async function listenWithFallback(startPort) {
  try {
    return await listenOnce(startPort);
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      logger.warn(`⚠️ Porta ${startPort} em uso. Tentando porta ${startPort + 1}...`);
      return await listenOnce(startPort + 1);
    }
    throw err;
  }
}

async function startServer() {
  const startTime = Date.now();
  
  try {
    logger.info('🚀 Iniciando servidor...');
    logger.info(`📋 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔌 Porta: ${DEFAULT_PORT}`);
    logger.info(`💾 Node.js: ${process.version}`);
    logger.info(`📦 Plataforma: ${process.platform}`);
    
    // Log de variáveis de ambiente (sem expor senhas)
    logger.info('🔐 Variáveis de ambiente configuradas:');
    logger.info(`   - NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
    logger.info(`   - PORT: ${process.env.PORT || 'não definido'}`);
    logger.info(`   - DB_DIALECT: ${process.env.DB_DIALECT || 'não definido'}`);
    logger.info(`   - DATABASE_URL: ${process.env.DATABASE_URL ? '✅ configurado' : '❌ não configurado'}`);
    logger.info(`   - JWT_SECRET: ${process.env.JWT_SECRET ? '✅ configurado' : '❌ não configurado'}`);
    logger.info(`   - DB_SSL: ${process.env.DB_SSL || 'não definido'}`);

    // Conectar ao banco de dados
    logger.info('📊 Conectando ao banco de dados...');
    try {
      const dbConnected = await testConnection();
      if (!dbConnected) {
        logger.error('❌ Falha ao conectar ao banco de dados');
        throw new Error('Falha ao conectar ao banco de dados');
      }
      logger.info('✅ Banco de dados conectado com sucesso');
    } catch (dbError) {
      logger.error('❌ Erro ao conectar banco de dados:', {
        message: dbError.message,
        stack: dbError.stack,
        code: dbError.code,
        name: dbError.name
      });
      throw dbError;
    }

    // Sincronizar modelos
    logger.info('🔄 Sincronizando modelos...');
    try {
      await syncDatabase();
      logger.info('✅ Modelos sincronizados com sucesso');
    } catch (syncError) {
      logger.error('❌ Erro ao sincronizar modelos:', {
        message: syncError.message,
        stack: syncError.stack
      });
      throw syncError;
    }
    
    // Inicializar papéis e configurações padrão
    logger.info('⚙️ Inicializando configurações de administração...');
    try {
      await initializeAdminDefaults();
      logger.info('✅ Configurações de administração inicializadas');
    } catch (adminError) {
      logger.error('❌ Erro ao inicializar configurações de administração:', {
        message: adminError.message,
        stack: adminError.stack
      });
      // Não bloquear o servidor por erro em admin defaults
      logger.warn('⚠️ Continuando sem configurações de administração...');
    }

    // Socket.IO para dashboard em tempo real
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('💬 ETAPA 4: Configurando Socket.IO...');
    logger.info('═══════════════════════════════════════════════════════');
    try {
      io.on('connection', (socket) => {
        logger.info(`📱 Cliente conectado ao dashboard: ${socket.id}`);
        
        socket.on('disconnect', () => {
          logger.info(`📱 Cliente desconectado: ${socket.id}`);
        });
      });
      
      // Inicializar Chat Socket Service
      logger.info('💬 Inicializando Chat Socket Service...');
      const chatSocketService = new ChatSocketService(io);
      chatSocketService.initialize();
      app.set('chatSocketService', chatSocketService);
      logger.info('✅ Chat Socket Service inicializado');
    } catch (socketError) {
      logger.error('⚠️ AVISO: Erro ao configurar Socket.IO (não crítico):');
      logger.error(`   Mensagem: ${socketError.message}`);
      if (socketError.stack) {
        logger.error(`   Stack: ${socketError.stack}`);
      }
      logger.warn('⚠️ Continuando sem Socket.IO...');
    }

    // Iniciar servidor (com fallback se a porta padrão estiver ocupada)
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🌐 ETAPA 5: Iniciando servidor HTTP...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`🔌 Tentando iniciar na porta ${DEFAULT_PORT}...`);
    
    let port;
    try {
      port = await listenWithFallback(DEFAULT_PORT);
      if (port !== DEFAULT_PORT) {
        logger.warn(`ℹ️ Porta solicitada ${DEFAULT_PORT} indisponível. Servidor subiu na porta ${port}.`);
      }
      logger.info(`✅ Servidor HTTP iniciado com sucesso na porta ${port}`);
    } catch (listenError) {
      logger.error('❌ ERRO CRÍTICO ao iniciar servidor HTTP:');
      logger.error(`   Mensagem: ${listenError.message}`);
      logger.error(`   Código: ${listenError.code || 'N/A'}`);
      if (listenError.stack) {
        logger.error(`   Stack: ${listenError.stack}`);
      }
      throw listenError;
    }
    
    // Obter IP local para acesso na rede
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'localhost';
    
    // Procurar primeiro IPv4 não interno
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
      if (localIP !== 'localhost') break;
    }
    
    logger.info(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     ⭐ ASTROCHAT - AESTRON                           ║
║                                                       ║
║     ✅ Servidor rodando na porta ${port}                 ║
║                                                       ║
║     📱 ACESSO LOCAL:                                  ║
║     ✅ Dashboard: http://localhost:${port}/admin         ║
║     ✅ Login:     http://localhost:${port}/login.html    ║
║                                                       ║
║     🌐 ACESSO NA REDE:                                ║
║     ✅ Dashboard: http://${localIP}:${port}/admin         ║
║     ✅ Login:     http://${localIP}:${port}/login.html    ║
║                                                       ║
║     🔌 API: http://${localIP}:${port}/api                 ║
║                                                       ║
║     Status: ONLINE 🟢                                 ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);

    // Inicializar jobs agendados (não bloqueia o start do servidor)
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('⏰ ETAPA 6: Inicializando jobs agendados...');
    logger.info('═══════════════════════════════════════════════════════');
    try {
      initializeScheduledJobs();
      logger.info('✅ Jobs agendados inicializados');
    } catch (jobError) {
      logger.error('⚠️ AVISO: Erro ao inicializar jobs agendados (não crítico):');
      logger.error(`   Mensagem: ${jobError.message}`);
      logger.warn('⚠️ Continuando sem jobs agendados...');
    }
    
    try {
      logger.info('📊 Inicializando agendador de relatórios...');
      reportScheduler.start();
      logger.info('✅ Agendador de relatórios inicializado');
    } catch (reportError) {
      logger.error('⚠️ AVISO: Erro ao inicializar agendador de relatórios (não crítico):');
      logger.error(`   Mensagem: ${reportError.message}`);
    }
    
    try {
      logger.info('📸 Inicializando agendador de snapshots...');
      initializeSnapshotScheduler();
      logger.info('✅ Agendador de snapshots inicializado');
    } catch (snapshotError) {
      logger.error('⚠️ AVISO: Erro ao inicializar agendador de snapshots (não crítico):');
      logger.error(`   Mensagem: ${snapshotError.message}`);
    }

    // Registrar whatsappClient no app para acesso nos controllers
    if (whatsappClient) {
      app.set('whatsappClient', whatsappClient);
      
      // Inicializar WhatsApp apenas se WHATSAPP_AUTO_START=true (evita travar no boot)
      if (process.env.WHATSAPP_AUTO_START === 'true') {
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('📱 ETAPA 7: Inicializando WhatsApp (não bloqueia servidor)...');
        logger.info('═══════════════════════════════════════════════════════');
        whatsappClient.prepareForConnection({ rotateIfLocked: true })
          .then(() => whatsappClient.initialize())
          .then(() => {
            logger.info('✅ WhatsApp inicializado com sucesso');
          })
          .catch((err) => {
            logger.error('⚠️ AVISO: Falha ao inicializar WhatsApp (servidor continua online):');
            logger.error(`   Mensagem: ${err.message}`);
          });
      } else {
        logger.info('📱 WhatsApp: aguardando conexão manual (Administração → Nova Conexão)');
      }
    } else {
      logger.warn('⚠️ WhatsApp client não disponível (servidor continua sem WhatsApp)');
    }
    
    const totalTime = Date.now() - startTime;
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`✅ SERVIDOR INICIADO COM SUCESSO (${totalTime}ms)`);
    logger.info('═══════════════════════════════════════════════════════');

  } catch (error) {
    logger.error('═══════════════════════════════════════════════════════');
    logger.error('❌ ERRO FATAL AO INICIAR SERVIDOR');
    logger.error('═══════════════════════════════════════════════════════');
    logger.error(`   Mensagem: ${error.message}`);
    logger.error(`   Código: ${error.code || 'N/A'}`);
    logger.error(`   Nome: ${error.name || 'N/A'}`);
    if (error.stack) {
      logger.error(`   Stack completo:`);
      logger.error(error.stack);
    }
    
    // Log adicional para Railway
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ ERRO FATAL - SERVIDOR NÃO PODE INICIAR');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════');
    
    process.exit(1);
  }
}

// Tratamento de sinais de encerramento
process.on('SIGINT', async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🛑 SIGINT recebido - Encerrando servidor...');
  console.log('═══════════════════════════════════════════════════════');
  logger.info('🛑 SIGINT recebido - Encerrando servidor...');
  try {
    if (whatsappClient && typeof whatsappClient.disconnect === 'function') {
      await whatsappClient.disconnect();
    }
  } catch (disconnectError) {
    logger.error('⚠️ Erro ao desconectar WhatsApp:', disconnectError.message);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🛑 SIGTERM recebido - Encerrando servidor...');
  console.log('═══════════════════════════════════════════════════════');
  logger.info('🛑 SIGTERM recebido - Encerrando servidor...');
  try {
    if (whatsappClient && typeof whatsappClient.disconnect === 'function') {
      await whatsappClient.disconnect();
    }
  } catch (disconnectError) {
    logger.error('⚠️ Erro ao desconectar WhatsApp:', disconnectError.message);
  }
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('═══════════════════════════════════════════════════════');
  logger.error('❌ UNCAUGHT EXCEPTION - ERRO NÃO CAPTURADO');
  logger.error('═══════════════════════════════════════════════════════');
  logger.error(`   Mensagem: ${error.message}`);
  logger.error(`   Código: ${error.code || 'N/A'}`);
  logger.error(`   Nome: ${error.name || 'N/A'}`);
  if (error.stack) {
    logger.error(`   Stack completo:`);
    logger.error(error.stack);
  }
  
  console.error('═══════════════════════════════════════════════════════');
  console.error('❌ UNCAUGHT EXCEPTION');
  console.error('═══════════════════════════════════════════════════════');
  console.error('Mensagem:', error.message);
  console.error('Código:', error.code);
  console.error('Stack:', error.stack);
  console.error('═══════════════════════════════════════════════════════');
  
  // Não derrubar o servidor por EPIPE (broken pipe) causado por logging no console
  if (error && error.code === 'EPIPE') {
    logger.warn('⚠️ Ignorando EPIPE (broken pipe) para manter o servidor online.');
    return;
  }
  
  // Em produção, tentar manter o servidor vivo para logs
  if (process.env.NODE_ENV === 'production') {
    logger.error('⚠️ Tentando manter servidor vivo após uncaughtException...');
    // Não fazer exit imediato para permitir logs serem escritos
    setTimeout(() => {
      logger.error('❌ Encerrando servidor após uncaughtException...');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('═══════════════════════════════════════════════════════');
  logger.error('❌ UNHANDLED REJECTION - PROMISE REJEITADA NÃO TRATADA');
  logger.error('═══════════════════════════════════════════════════════');
  logger.error(`   Razão: ${reason}`);
  if (reason && typeof reason === 'object') {
    logger.error(`   Mensagem: ${reason.message || 'N/A'}`);
    logger.error(`   Código: ${reason.code || 'N/A'}`);
    logger.error(`   Nome: ${reason.name || 'N/A'}`);
    if (reason.stack) {
      logger.error(`   Stack completo:`);
      logger.error(reason.stack);
    }
  }
  
  console.error('═══════════════════════════════════════════════════════');
  console.error('❌ UNHANDLED REJECTION');
  console.error('═══════════════════════════════════════════════════════');
  console.error('Razão:', reason);
  if (reason && typeof reason === 'object' && reason.stack) {
    console.error('Stack:', reason.stack);
  }
  console.error('═══════════════════════════════════════════════════════');
  
  // Evitar quedas por rejeições não críticas em produção/dev.
  // (Ainda fica logado em logs/rejections.log via winston)
  if (reason && reason.code === 'EPIPE') {
    logger.warn('⚠️ Ignorando EPIPE (broken pipe) em unhandledRejection.');
    return;
  }
  
  // Em produção, não fazer exit para manter disponibilidade
  // Mas logar tudo para debug
  logger.warn('⚠️ Continuando após unhandledRejection (servidor permanece online)');
});

// Iniciar
startServer().catch(error => {
  logger.error('═══════════════════════════════════════════════════════');
  logger.error('❌ ERRO FATAL - FALHA AO INICIAR SERVIDOR');
  logger.error('═══════════════════════════════════════════════════════');
  logger.error(`   Mensagem: ${error.message}`);
  logger.error(`   Código: ${error.code || 'N/A'}`);
  logger.error(`   Nome: ${error.name || 'N/A'}`);
  if (error.stack) {
    logger.error(`   Stack completo:`);
    logger.error(error.stack);
  }
  
  console.error('═══════════════════════════════════════════════════════');
  console.error('❌ ERRO FATAL - SERVIDOR NÃO PODE INICIAR');
  console.error('═══════════════════════════════════════════════════════');
  console.error('Mensagem:', error.message);
  console.error('Código:', error.code);
  console.error('Stack:', error.stack);
  console.error('═══════════════════════════════════════════════════════');
  
  // Aguardar um pouco para garantir que logs sejam escritos
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});

module.exports = { app, io };

