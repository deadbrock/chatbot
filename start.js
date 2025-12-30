// Script de inicialização robusto
const fs = require('fs');
const path = require('path');

// Criar arquivo de log
const logFile = path.join(__dirname, 'startup.log');
const log = (msg) => {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, logMsg);
  console.log(msg);
};

log('========================================');
log('🚀 Iniciando Chatbot WhatsApp');
log('========================================');

try {
  log('1. Carregando dotenv...');
  require('dotenv').config();
  log('✅ Dotenv carregado');
  
  log('2. Carregando módulos principais...');
  const express = require('express');
  const http = require('http');
  const socketIO = require('socket.io');
  log('✅ Módulos principais carregados');
  
  log('3. Carregando logger...');
  const logger = require('./src/utils/logger');
  log('✅ Logger carregado');
  
  log('4. Carregando database...');
  const { testConnection, syncDatabase } = require('./src/config/database');
  log('✅ Database carregado');
  
  log('5. Carregando modelos...');
  require('./src/models');
  log('✅ Modelos carregados');
  
  log('6. Carregando rotas...');
  const routes = require('./src/routes');
  log('✅ Rotas carregadas');
  
  log('7. Carregando WhatsApp client...');
  const whatsappClient = require('./src/bot/whatsapp');
  log('✅ WhatsApp client carregado');
  
  log('8. Carregando scheduler...');
  const { initializeScheduledJobs } = require('./src/services/scheduler');
  log('✅ Scheduler carregado');
  
  log('✅ Todos os módulos carregados com sucesso!');
  log('🚀 Iniciando servidor principal...');
  
  // Agora carregar o servidor principal
  require('./src/server.js');
  
} catch (error) {
  log('❌ ERRO FATAL: ' + error.message);
  log('Stack: ' + error.stack);
  fs.appendFileSync(logFile, '\n\nERRO COMPLETO:\n' + JSON.stringify(error, null, 2) + '\n');
  process.exit(1);
}

