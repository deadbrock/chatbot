const Session = require('../models/SessionSQL');
const logger = require('../utils/logger');
const NodeCache = require('node-cache');

// Cache em memória (substitui Redis)
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hora

class SessionManager {
  constructor() {
    this.cachePrefix = 'session:';
  }

  /**
   * Cria nova sessão
   */
  async createSession(userId, data = {}) {
    try {
      const session = await Session.create({
        userId,
        userName: data.name || data.userName,
        userPhone: data.phone || data.userPhone,
        welcomed: false,
        lastInteraction: new Date(),
        interactionCount: 0,
        active: true
      });

      // Salvar no cache
      this.cacheSession(userId, session);
      
      logger.debug(`✅ Sessão criada para ${userId}`);
      return session;

    } catch (error) {
      logger.error('Erro ao criar sessão:', error);
      throw error;
    }
  }

  /**
   * Obtém sessão existente
   */
  async getSession(userId) {
    try {
      // Tentar obter do cache primeiro
      const cached = this.getCachedSession(userId);
      if (cached) {
        return cached;
      }

      // Buscar no banco
      const session = await Session.getActiveSession(userId);
      
      if (session) {
        // Atualizar interação
        await session.updateInteraction();
        
        // Salvar no cache
        this.cacheSession(userId, session);
      }

      return session;

    } catch (error) {
      logger.error('Erro ao obter sessão:', error);
      return null;
    }
  }

  /**
   * Atualiza sessão
   */
  async updateSession(userId, updates) {
    try {
      const session = await Session.findOne({ where: { userId, active: true } });
      
      if (session) {
        // Atualizar campos
        Object.keys(updates).forEach(key => {
          const value = updates[key];
          if (key.includes('.')) {
            // Suporta notação de ponto (ex: 'data.welcomed')
            const parts = key.split('.');
            if (parts[0] === 'data') {
              session[parts[1]] = value;
            }
          } else {
            session[key] = value;
          }
        });

        await session.save();
        await session.updateInteraction();
        this.cacheSession(userId, session);
      }

      return session;

    } catch (error) {
      logger.error('Erro ao atualizar sessão:', error);
      throw error;
    }
  }

  /**
   * Expira sessão
   */
  async expireSession(userId) {
    try {
      const session = await Session.getActiveSession(userId);
      
      if (session) {
        session.active = false;
        await session.save();
        this.clearCache(userId);
        logger.debug(`🗑️ Sessão expirada para ${userId}`);
      }

      return true;

    } catch (error) {
      logger.error('Erro ao expirar sessão:', error);
      return false;
    }
  }

  /**
   * Obtém todas as sessões ativas
   */
  async getActiveSessions() {
    try {
      return await Session.getActiveSessions();
    } catch (error) {
      logger.error('Erro ao obter sessões ativas:', error);
      return [];
    }
  }

  /**
   * Limpa sessões expiradas
   */
  async cleanExpiredSessions() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const result = await Session.update(
        { active: false },
        {
          where: {
            lastInteraction: { [require('sequelize').Op.lt]: oneDayAgo },
            active: true
          }
        }
      );

      const count = result[0];
      logger.info(`🗑️ ${count} sessões expiradas removidas`);
      return count;
    } catch (error) {
      logger.error('Erro ao limpar sessões:', error);
      return 0;
    }
  }

  /**
   * Cache - Salvar sessão
   */
  cacheSession(userId, session) {
    try {
      const key = this.cachePrefix + userId;
      cache.set(key, session.toJSON());
    } catch (error) {
      logger.error('Erro ao cachear sessão:', error);
    }
  }

  /**
   * Cache - Obter sessão
   */
  getCachedSession(userId) {
    try {
      const key = this.cachePrefix + userId;
      return cache.get(key);
    } catch (error) {
      logger.error('Erro ao obter sessão do cache:', error);
      return null;
    }
  }

  /**
   * Cache - Limpar
   */
  clearCache(userId) {
    try {
      const key = this.cachePrefix + userId;
      cache.del(key);
    } catch (error) {
      logger.error('Erro ao limpar cache:', error);
    }
  }

  /**
   * Estatísticas de sessões
   */
  async getStats() {
    try {
      const { Op } = require('sequelize');
      
      const activeSessions = await Session.count({ where: { active: true } });
      const totalSessions = await Session.count();
      
      const avgResult = await Session.findOne({
        attributes: [
          [require('sequelize').fn('AVG', require('sequelize').col('interactionCount')), 'avg']
        ],
        where: { active: true }
      });

      return {
        active: activeSessions,
        total: totalSessions,
        averageInteractions: avgResult ? parseFloat(avgResult.get('avg')) || 0 : 0
      };

    } catch (error) {
      logger.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

module.exports = SessionManager;
