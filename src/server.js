require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Importações internas
const whatsappClient = require('./bot/whatsapp');
const logger = require('./utils/logger');
const { testConnection, syncDatabase } = require('./config/database');
const routes = require('./routes');
const { initializeScheduledJobs } = require('./services/scheduler');
const automationService = require('./services/automationService');
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
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dashboard/public')));

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
    whatsapp: whatsappClient.isConnected(),
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

    // Conectar ao banco de dados SQLite
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
    logger.info(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     🤖 CHATBOT WHATSAPP EMPRESARIAL                  ║
║                                                       ║
║     ✅ Servidor rodando na porta ${port}                 ║
║     ✅ Dashboard: http://localhost:${port}/admin         ║
║     ✅ Login:     http://localhost:${port}/login.html    ║
║     ✅ API: http://localhost:${port}/api                 ║
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
    
    // Inicializar serviço de automação
    logger.info('🤖 Inicializando Serviço de Automação...');
    automationService.initialize();
    logger.info('✅ Serviço de Automação inicializado');

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
  await whatsappClient.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Encerrando servidor...');
  await whatsappClient.destroy();
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('❌ Erro não capturado:', error);
  console.error('❌ Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promise rejeitada não tratada:', reason);
  console.error('❌ Promise rejeitada não tratada:', reason);
  process.exit(1);
});

// Iniciar
startServer().catch(error => {
  logger.error('❌ Erro fatal ao iniciar servidor:', error);
  console.error('❌ Erro fatal ao iniciar servidor:', error);
  process.exit(1);
});

module.exports = { app, io };

