// Script de teste para identificar onde o servidor está falhando
console.log('🔍 Testando inicialização do servidor...\n');

try {
  console.log('1️⃣ Carregando dotenv...');
  require('dotenv').config();
  console.log('✅ dotenv OK\n');

  console.log('2️⃣ Testando imports básicos...');
  const express = require('express');
  const http = require('http');
  const socketIO = require('socket.io');
  console.log('✅ Express, HTTP, Socket.IO OK\n');

  console.log('3️⃣ Testando logger...');
  const logger = require('./src/utils/logger');
  console.log('✅ Logger OK\n');

  console.log('4️⃣ Testando database...');
  const { testConnection, syncDatabase } = require('./src/config/database');
  console.log('✅ Database config OK\n');

  console.log('5️⃣ Testando modelos...');
  require('./src/models');
  console.log('✅ Modelos OK\n');

  console.log('6️⃣ Testando whatsapp client...');
  const whatsappClient = require('./src/bot/whatsapp');
  console.log('✅ WhatsApp client OK\n');

  console.log('7️⃣ Testando routes...');
  const routes = require('./src/routes');
  console.log('✅ Routes OK\n');

  console.log('8️⃣ Testando services...');
  const { initializeScheduledJobs } = require('./src/services/scheduler');
  const automationService = require('./src/services/automationService');
  const reportScheduler = require('./src/services/reportScheduler');
  const { initializeSnapshotScheduler } = require('./src/services/snapshotScheduler');
  const { initializeAdminDefaults } = require('./src/setup/initializeAdmin');
  const ChatSocketService = require('./src/services/chatSocketService');
  console.log('✅ Services OK\n');

  console.log('9️⃣ Criando servidor Express...');
  const app = express();
  const server = http.createServer(app);
  const io = socketIO(server);
  console.log('✅ Servidor criado OK\n');

  console.log('🎉 TODOS OS IMPORTS FUNCIONARAM!\n');
  console.log('O problema pode estar em:');
  console.log('- Sincronização do banco');
  console.log('- Inicialização do WhatsApp');
  console.log('- Porta já em uso');
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ ERRO ENCONTRADO:\n');
  console.error(error);
  console.error('\n📍 Stack trace:');
  console.error(error.stack);
  process.exit(1);
}
