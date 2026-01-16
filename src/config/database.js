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
    const sslEnabled = parseBool(process.env.DB_SSL, false);

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
        }
      });
    }

    // Alternativa: variáveis separadas
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
    await sequelize.authenticate();
    logger.info(`✅ Banco conectado com sucesso (dialect=${sequelize.getDialect()})`);
    return true;
  } catch (error) {
    logger.error(`❌ Erro ao conectar banco (dialect=${sequelize.getDialect()}):`, error);
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

