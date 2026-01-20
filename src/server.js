require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

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

// Importações internas
const whatsappClient = require('./bot/whatsapp');
const logger = require('./utils/logger');
const { testConnection, syncDatabase } = require('./config/database');
const routes = require('./routes');
const { initializeScheduledJobs } = require('./services/scheduler');
// const automationService = require('./services/automationService'); // Removido - módulo de automações excluído
const reportScheduler = require('./services/reportScheduler');
const { initializeSnapshotScheduler } = require('./services/snapshotScheduler');
const { initializeAdminDefaults } = require('./setup/initializeAdmin');
const ChatSocketService = require('./services/chatSocketService');

// Importar todos os modelos (necessário para o Sequelize sync)
require('./models');

// Configuração do Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

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
      // Adicione seu domínio Vercel aqui após o deploy
      // 'https://seu-projeto.vercel.app',
      // Ou use variável de ambiente
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ];
    
    // Em desenvolvimento, permitir qualquer origem
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Em produção, verificar se a origem está permitida
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dashboard/public')));

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
    whatsapp: whatsappClient.isReady,
    database: dbConnected
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  logger.error('Erro na aplicação:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
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
  try {
    logger.info('🚀 Iniciando servidor...');

    // Conectar ao banco de dados
    logger.info('📊 Conectando ao banco de dados...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Falha ao conectar ao banco de dados');
    }

    // Sincronizar modelos
    logger.info('🔄 Sincronizando modelos...');
    await syncDatabase();
    
    // Inicializar papéis e configurações padrão
    logger.info('⚙️ Inicializando configurações de administração...');
    await initializeAdminDefaults();

    // Socket.IO para dashboard em tempo real
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

    // Iniciar servidor (com fallback se a porta padrão estiver ocupada)
    const port = await listenWithFallback(DEFAULT_PORT);
    if (port !== DEFAULT_PORT) {
      logger.warn(`ℹ️ Porta solicitada ${DEFAULT_PORT} indisponível. Servidor subiu na porta ${port}.`);
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
    logger.info('⏰ Inicializando jobs agendados...');
    initializeScheduledJobs();
    logger.info('✅ Jobs agendados inicializados');
    
    // Inicializar agendador de relatórios
    logger.info('📊 Inicializando agendador de relatórios...');
    reportScheduler.start();
    
    // Inicializar agendador de snapshots
    logger.info('📸 Inicializando agendador de snapshots...');
    initializeSnapshotScheduler();
    
    // Serviço de automação removido (módulo excluído)
    // logger.info('🤖 Inicializando Serviço de Automação...');
    // automationService.initialize();
    // logger.info('✅ Serviço de Automação inicializado');

    // Registrar whatsappClient no app para acesso nos controllers
    app.set('whatsappClient', whatsappClient);
    
    // Inicializar WhatsApp (não bloquear o start do servidor)
    logger.info('📱 Inicializando WhatsApp (pode levar alguns segundos)...');
    whatsappClient.initialize()
      .then(() => logger.info('✅ WhatsApp inicializado'))
      .catch((err) => logger.error('⚠️ Falha ao inicializar WhatsApp (o painel continua online):', err));

  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Tratamento de sinais de encerramento
process.on('SIGINT', async () => {
  logger.info('🛑 Encerrando servidor...');
  await whatsappClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Encerrando servidor...');
  await whatsappClient.disconnect();
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('❌ Erro não capturado:', error);
  console.error('❌ Erro não capturado:', error);
  // Não derrubar o servidor por EPIPE (broken pipe) causado por logging no console
  if (error && error.code === 'EPIPE') {
    logger.warn('⚠️ Ignorando EPIPE (broken pipe) para manter o servidor online.');
    return;
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promise rejeitada não tratada:', reason);
  console.error('❌ Promise rejeitada não tratada:', reason);
  // Evitar quedas por rejeições não críticas em produção/dev.
  // (Ainda fica logado em logs/rejections.log via winston)
  if (reason && reason.code === 'EPIPE') {
    logger.warn('⚠️ Ignorando EPIPE (broken pipe) em unhandledRejection.');
    return;
  }
  // Manter processo vivo (o ideal é corrigir a origem; aqui priorizamos disponibilidade)
  // process.exit(1);
});

// Iniciar
startServer().catch(error => {
  logger.error('❌ Erro fatal ao iniciar servidor:', error);
  console.error('❌ Erro fatal ao iniciar servidor:', error);
  process.exit(1);
});

module.exports = { app, io };

