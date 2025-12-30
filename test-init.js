console.log('1. Iniciando teste...');

try {
  console.log('2. Carregando dotenv...');
  require('dotenv').config();
  
  console.log('3. Carregando logger...');
  const logger = require('./src/utils/logger');
  
  console.log('4. Carregando database...');
  const { sequelize } = require('./src/config/database');
  
  console.log('5. Carregando models...');
  const models = require('./src/models');
  
  console.log('6. ✅ TUDO OK ATÉ AQUI!');
  
  console.log('7. Carregando server...');
  require('./src/server.js');
  
} catch (error) {
  console.error('❌ ERRO:', error.message);
  console.error('STACK:', error.stack);
  process.exit(1);
}

