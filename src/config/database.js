const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../utils/logger');

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function getDialect() {
  const dialect = (process.env.DB_DIALECT || '').toLowerCase().trim();
  return dialect || (process.env.DATABASE_URL ? 'postgres' : 'sqlite');
}

function buildSequelize() {
  const dialect = getDialect();

  // Postgres: prefer DATABASE_URL (padrão em deploys/CI)
  if (dialect === 'postgres') {
    // Em produção (Railway), sempre usar SSL
    const isProduction = process.env.NODE_ENV === 'production';
    const sslEnabled = parseBool(process.env.DB_SSL, isProduction);

    if (process.env.DATABASE_URL) {
      return new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: (msg) => logger.debug(msg),
        dialectOptions: sslEnabled
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false
              }
            }
          : undefined,
        define: {
          timestamps: true,
          underscored: false
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      });
    }

    // Alternativa: variáveis separadas (reutilizar isProduction e sslEnabled já declarados acima)
    
    return new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        dialect: 'postgres',
        logging: (msg) => logger.debug(msg),
        dialectOptions: sslEnabled
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false
              }
            }
          : undefined,
        define: {
          timestamps: true,
          underscored: false
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );
  }

  // Default: SQLite local (dev)
  return new Sequelize({
    dialect: 'sqlite',
    storage: process.env.SQLITE_PATH
      ? path.resolve(process.env.SQLITE_PATH)
      : path.join(__dirname, '../../database.sqlite'),
    logging: (msg) => logger.debug(msg),
    define: {
      timestamps: true,
      underscored: false
    }
  });
}

const sequelize = buildSequelize();

// Testar conexão
async function testConnection() {
  try {
    logger.info(`🔍 Tentando conectar ao banco (dialect=${sequelize.getDialect()})...`);
    
    if (sequelize.getDialect() === 'postgres') {
      logger.info(`   Host: ${sequelize.config.host || 'DATABASE_URL'}`);
      logger.info(`   Database: ${sequelize.config.database || 'DATABASE_URL'}`);
      logger.info(`   Port: ${sequelize.config.port || 'DATABASE_URL'}`);
      logger.info(`   SSL: ${sequelize.config.dialectOptions?.ssl ? 'habilitado' : 'desabilitado'}`);
    }
    
    const startTime = Date.now();
    await sequelize.authenticate();
    const connectionTime = Date.now() - startTime;
    
    logger.info(`✅ Banco conectado com sucesso (dialect=${sequelize.getDialect()}, ${connectionTime}ms)`);
    return true;
  } catch (error) {
    logger.error(`❌ ERRO ao conectar banco (dialect=${sequelize.getDialect()}):`);
    logger.error(`   Mensagem: ${error.message}`);
    logger.error(`   Código: ${error.code || 'N/A'}`);
    logger.error(`   Nome: ${error.name || 'N/A'}`);
    
    if (error.original) {
      logger.error(`   Erro original: ${error.original.message}`);
      logger.error(`   Código original: ${error.original.code || 'N/A'}`);
    }
    
    if (error.stack) {
      logger.error(`   Stack:`);
      logger.error(error.stack);
    }
    
    // Log detalhado para PostgreSQL
    if (sequelize.getDialect() === 'postgres') {
      logger.error(`   Configuração de conexão:`);
      logger.error(`   - DATABASE_URL: ${process.env.DATABASE_URL ? 'configurado' : 'não configurado'}`);
      logger.error(`   - DB_HOST: ${process.env.DB_HOST || 'não configurado'}`);
      logger.error(`   - DB_NAME: ${process.env.DB_NAME || 'não configurado'}`);
      logger.error(`   - DB_USER: ${process.env.DB_USER || 'não configurado'}`);
      logger.error(`   - DB_PORT: ${process.env.DB_PORT || 'não configurado'}`);
      logger.error(`   - DB_SSL: ${process.env.DB_SSL || 'não configurado'}`);
    }
    
    return false;
  }
}

// Sincronizar modelos
async function syncDatabase() {
  try {
    logger.info(`🔄 Sincronizando modelos (dialect=${sequelize.getDialect()})...`);
    const startTime = Date.now();
    
    // Importar modelos para garantir a ordem correta
    const models = require('../models');
    
    // ETAPA 1: Sincronizar modelos base PRIMEIRO (sem foreign keys problemáticas)
    logger.info('   📦 Etapa 1/2: Sincronizando modelos base...');
    const baseModels = [
      'User', 'Role', 'Queue', 'TicketStatus', 'Contact', 
      'Tag', 'Flow', 'VisualFlow', 'FlowNode', 'SystemSetting',
      'WhatsAppConnection', 'ApiKey', 'Session', 'UserSession'
    ];
    
    for (const modelName of baseModels) {
      if (models[modelName]) {
        await models[modelName].sync({ force: false });
        logger.info(`      ✅ ${modelName}`);
      }
    }
    
    // ETAPA 2: Sincronizar TODOS os modelos (incluindo os com foreign keys)
    logger.info('   📦 Etapa 2/2: Sincronizando modelos dependentes...');
    await sequelize.sync({ force: false, alter: false });
    
    const syncTime = Date.now() - startTime;
    logger.info(`✅ Banco de dados sincronizado (${syncTime}ms)`);
    return true;
  } catch (error) {
    logger.error('❌ ERRO ao sincronizar banco:');
    logger.error(`   Mensagem: ${error.message}`);
    logger.error(`   Código: ${error.code || 'N/A'}`);
    logger.error(`   Nome: ${error.name || 'N/A'}`);
    
    if (error.original) {
      logger.error(`   Erro original: ${error.original.message}`);
    }
    
    if (error.stack) {
      logger.error(`   Stack:`);
      logger.error(error.stack);
    }
    
    // Em produção, não falhar se houver erro de sync (pode ser tabela já existente)
    if (process.env.NODE_ENV === 'production' && error.name === 'SequelizeDatabaseError') {
      logger.warn('⚠️  Ignorando erro de sincronização em produção (tabelas podem já existir)');
      return true;
    }
    
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};

