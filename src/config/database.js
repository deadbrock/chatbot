const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../utils/logger');

// Configurar SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database.sqlite'),
  logging: (msg) => logger.debug(msg),
  define: {
    timestamps: true,
    underscored: false
  }
});

// Testar conexão
async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('✅ SQLite conectado com sucesso');
    return true;
  } catch (error) {
    logger.error('❌ Erro ao conectar SQLite:', error);
    return false;
  }
}

// Sincronizar modelos
async function syncDatabase() {
  try {
    // Usar force: false para não recriar tabelas existentes
    await sequelize.sync({ force: false });
    logger.info('✅ Banco de dados sincronizado');
    return true;
  } catch (error) {
    logger.error('❌ Erro ao sincronizar banco:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};

