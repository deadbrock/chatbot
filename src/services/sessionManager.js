const Session = require('../models/SessionSQL');
const UserSession = require('../models/UserSessionSQL');
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
      // Buscar de user_sessions (usado pelo bot)
      const sessions = await UserSession.findAll({
        where: { isActive: true },
        order: [['lastInteraction', 'DESC']]
      });

      // Formatar para o formato esperado pelo frontend
      return sessions.map(s => ({
        userId: s.phone,
        userName: s.name,
        // compatibilidade: alguns lugares do dashboard usam "currentDepartment"
        currentDepartment: s.currentFlow,
        // novos campos: para exibir/configurar manualmente
        currentFlow: s.currentFlow,
        currentStep: s.currentStep,
        interactionCount: 0, // Pode ser calculado se necessário
        lastInteraction: s.lastInteraction,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt
      }));
    } catch (error) {
      logger.error('Erro ao obter sessões ativas:', error);
      return [];
    }
  }

  /**
   * Força fluxo/step atual de uma conversa (user_sessions)
   * @param {string} userId - telefone (ex: 558199999999)
   * @param {Object} payload
   * @param {string} payload.currentFlow
   * @param {string} [payload.currentStep]
   * @param {boolean} [payload.resetContext=true]
   */
  async setConversationFlow(userId, { currentFlow, currentStep, resetContext = true }) {
    const botFlows = require('../bot/flows/flowDefinitions');

    if (!userId) throw new Error('userId é obrigatório');
    if (!currentFlow) throw new Error('currentFlow é obrigatório');

    const targetFlow = botFlows[currentFlow];
    if (!targetFlow) throw new Error(`Fluxo do bot inválido: ${currentFlow}`);

    const normalizedStep = (currentStep && String(currentStep).trim()) ? String(currentStep).trim() : 'start';

    // validar step quando o fluxo tem steps
    if (targetFlow.steps) {
      if (!targetFlow.steps[normalizedStep]) {
        throw new Error(`Step inválido para o fluxo "${currentFlow}": ${normalizedStep}`);
      }
    } else {
      // fluxo simples não usa steps; manter start para consistência
      // (o processSimpleFlow ignora currentStep)
    }

    const session = await UserSession.findOne({ where: { phone: userId } });
    if (!session) throw new Error('Sessão não encontrada em user_sessions');

    session.currentFlow = currentFlow;
    session.currentStep = normalizedStep;

    if (resetContext) {
      session.collectionIndex = 0;
      session.formData = {};
      session.menuPath = [];
    }

    await session.save();
    return session;
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
