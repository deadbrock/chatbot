const redis = require('redis');
const logger = require('../utils/logger');

// Criar cliente Redis
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('❌ Redis: Conexão recusada');
      return new Error('Redis connection refused');
    }
    
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('❌ Redis: Tempo de retry excedido');
      return new Error('Redis retry time exhausted');
    }
    
    if (options.attempt > 10) {
      logger.error('❌ Redis: Máximo de tentativas excedido');
      return undefined;
    }
    
    // Reconectar após
    return Math.min(options.attempt * 100, 3000);
  }
});

// Eventos
redisClient.on('connect', () => {
  logger.info('🔄 Redis: Conectando...');
});

redisClient.on('ready', () => {
  logger.info('✅ Redis: Pronto para uso');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis: Erro -', err);
});

redisClient.on('end', () => {
  logger.warn('⚠️ Redis: Conexão encerrada');
});

redisClient.on('reconnecting', () => {
  logger.info('🔄 Redis: Reconectando...');
});

// Funções auxiliares
const redisHelper = {
  /**
   * Obtém valor do cache
   */
  async get(key) {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error('Erro ao obter do Redis:', error);
      return null;
    }
  },

  /**
   * Define valor no cache com TTL
   */
  async setEx(key, seconds, value) {
    try {
      return await redisClient.setEx(key, seconds, value);
    } catch (error) {
      logger.error('Erro ao salvar no Redis:', error);
      return null;
    }
  },

  /**
   * Define valor no cache sem TTL
   */
  async set(key, value) {
    try {
      return await redisClient.set(key, value);
    } catch (error) {
      logger.error('Erro ao salvar no Redis:', error);
      return null;
    }
  },

  /**
   * Remove chave do cache
   */
  async del(key) {
    try {
      return await redisClient.del(key);
    } catch (error) {
      logger.error('Erro ao deletar do Redis:', error);
      return null;
    }
  },

  /**
   * Verifica se chave existe
   */
  async exists(key) {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      logger.error('Erro ao verificar existência no Redis:', error);
      return false;
    }
  },

  /**
   * Define TTL para chave existente
   */
  async expire(key, seconds) {
    try {
      return await redisClient.expire(key, seconds);
    } catch (error) {
      logger.error('Erro ao definir TTL no Redis:', error);
      return false;
    }
  },

  /**
   * Incrementa valor numérico
   */
  async incr(key) {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      logger.error('Erro ao incrementar no Redis:', error);
      return null;
    }
  },

  /**
   * Decrementa valor numérico
   */
  async decr(key) {
    try {
      return await redisClient.decr(key);
    } catch (error) {
      logger.error('Erro ao decrementar no Redis:', error);
      return null;
    }
  },

  /**
   * Obtém múltiplas chaves
   */
  async mget(...keys) {
    try {
      return await redisClient.mGet(keys);
    } catch (error) {
      logger.error('Erro ao obter múltiplas chaves do Redis:', error);
      return null;
    }
  },

  /**
   * Busca chaves por padrão
   */
  async keys(pattern) {
    try {
      return await redisClient.keys(pattern);
    } catch (error) {
      logger.error('Erro ao buscar chaves no Redis:', error);
      return [];
    }
  },

  /**
   * Limpa todo o cache
   */
  async flushAll() {
    try {
      return await redisClient.flushAll();
    } catch (error) {
      logger.error('Erro ao limpar Redis:', error);
      return false;
    }
  }
};

// Adicionar métodos helper ao cliente
Object.assign(redisClient, redisHelper);

module.exports = redisClient;

