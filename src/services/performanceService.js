const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

/**
 * ================================================================================
 * FASE 6B: SERVICE - ANÁLISE DE DESEMPENHO
 * ================================================================================
 * 
 * Serviço responsável por calcular métricas de desempenho de:
 * - Agentes (tempo médio, tickets resolvidos, satisfação)
 * - Filas (volume, tempo de espera, abandono)
 * - Comparações e rankings
 */

class PerformanceService {
  
  /**
   * Calcula desempenho de agentes em um período
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>}
   */
  async getAgentPerformance(options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        agentIds = null,
        departmentId = null,
        limit = 20
      } = options;

      const whereClause = {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      };

      if (agentIds && agentIds.length > 0) {
        whereClause.userId = { [Op.in]: agentIds };
      }

      if (departmentId) {
        whereClause.departmentId = departmentId;
      }

      // Query complexa para calcular métricas de agentes
      const [results] = await sequelize.query(`
        SELECT 
          u.id as agentId,
          u.name as agentName,
          u.email as agentEmail,
          u.avatar as agentAvatar,
          u.department as department,
          COUNT(DISTINCT t.id) as totalTickets,
          COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END) as ticketsResolved,
          COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END) as ticketsActive,
          AVG(CASE 
            WHEN t.status = 'closed' AND t.closedAt IS NOT NULL 
            THEN (julianday(t.closedAt) - julianday(t.createdAt)) * 24 * 60 
          END) as avgResolutionTimeMinutes,
          AVG(CASE 
            WHEN t.firstResponseAt IS NOT NULL 
            THEN (julianday(t.firstResponseAt) - julianday(t.createdAt)) * 24 * 60 
          END) as avgFirstResponseMinutes,
          COUNT(DISTINCT CASE WHEN r.rating >= 4 THEN r.id END) as positiveRatings,
          COUNT(DISTINCT CASE WHEN r.rating <= 2 THEN r.id END) as negativeRatings,
          COUNT(DISTINCT r.id) as totalRatings,
          AVG(r.rating) as avgRating,
          COUNT(DISTINCT m.id) as totalMessages,
          MAX(t.updatedAt) as lastActivity
        FROM users u
        LEFT JOIN tickets t ON t.userId = u.id 
          AND t.createdAt BETWEEN :startDate AND :endDate
          ${departmentId ? 'AND t.departmentId = :departmentId' : ''}
        LEFT JOIN ratings r ON r.ticketId = t.id
        LEFT JOIN messages m ON m.ticketId = t.id AND m.fromMe = 1
        WHERE u.role IN ('agent', 'supervisor', 'admin')
          ${agentIds && agentIds.length > 0 ? 'AND u.id IN (:agentIds)' : ''}
        GROUP BY u.id, u.name, u.email, u.avatar, u.department
        HAVING totalTickets > 0
        ORDER BY ticketsResolved DESC, avgRating DESC
        LIMIT :limit
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          agentIds: agentIds || [],
          departmentId: departmentId || null,
          limit
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Calcular métricas adicionais
      return results.map(agent => ({
        ...agent,
        resolutionRate: agent.totalTickets > 0 
          ? ((agent.ticketsResolved / agent.totalTickets) * 100).toFixed(2) 
          : 0,
        satisfactionRate: agent.totalRatings > 0 
          ? ((agent.positiveRatings / agent.totalRatings) * 100).toFixed(2) 
          : 0,
        avgMessagesPerTicket: agent.totalTickets > 0 
          ? (agent.totalMessages / agent.totalTickets).toFixed(2) 
          : 0,
        performance: this.calculatePerformanceScore({
          resolutionRate: agent.ticketsResolved / (agent.totalTickets || 1),
          avgRating: agent.avgRating || 0,
          avgResolutionTime: agent.avgResolutionTimeMinutes || 0,
          avgFirstResponse: agent.avgFirstResponseMinutes || 0
        })
      }));

    } catch (error) {
      logger.error('❌ Erro ao calcular desempenho de agentes:', error);
      throw error;
    }
  }

  /**
   * Calcula desempenho de filas em um período
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>}
   */
  async getQueuePerformance(options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        queueIds = null,
        limit = 20
      } = options;

      const [results] = await sequelize.query(`
        SELECT 
          q.id as queueId,
          q.name as queueName,
          q.slug as queueSlug,
          q.color as queueColor,
          q.icon as queueIcon,
          COUNT(DISTINCT t.id) as totalTickets,
          COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END) as ticketsClosed,
          COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END) as ticketsActive,
          COUNT(DISTINCT CASE WHEN t.status = 'waiting' THEN t.id END) as ticketsWaiting,
          AVG(CASE 
            WHEN t.status = 'closed' AND t.closedAt IS NOT NULL 
            THEN (julianday(t.closedAt) - julianday(t.createdAt)) * 24 * 60 
          END) as avgHandlingTimeMinutes,
          AVG(CASE 
            WHEN t.firstResponseAt IS NOT NULL 
            THEN (julianday(t.firstResponseAt) - julianday(t.createdAt)) * 24 * 60 
          END) as avgWaitTimeMinutes,
          MAX(CASE 
            WHEN t.firstResponseAt IS NOT NULL 
            THEN (julianday(t.firstResponseAt) - julianday(t.createdAt)) * 24 * 60 
          END) as maxWaitTimeMinutes,
          COUNT(DISTINCT t.contactId) as uniqueContacts,
          AVG(r.rating) as avgRating,
          COUNT(DISTINCT r.id) as totalRatings,
          COUNT(DISTINCT u.id) as activeAgents
        FROM queues q
        LEFT JOIN tickets t ON t.queueId = q.id 
          AND t.createdAt BETWEEN :startDate AND :endDate
        LEFT JOIN ratings r ON r.ticketId = t.id
        LEFT JOIN users u ON u.id = t.userId AND u.role IN ('agent', 'supervisor')
        WHERE q.isActive = 1
          ${queueIds && queueIds.length > 0 ? 'AND q.id IN (:queueIds)' : ''}
        GROUP BY q.id, q.name, q.slug, q.color, q.icon
        HAVING totalTickets > 0
        ORDER BY totalTickets DESC
        LIMIT :limit
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          queueIds: queueIds || [],
          limit
        },
        type: sequelize.QueryTypes.SELECT
      });

      return results.map(queue => ({
        ...queue,
        resolutionRate: queue.totalTickets > 0 
          ? ((queue.ticketsClosed / queue.totalTickets) * 100).toFixed(2) 
          : 0,
        avgTicketsPerAgent: queue.activeAgents > 0 
          ? (queue.totalTickets / queue.activeAgents).toFixed(2) 
          : 0,
        utilizationRate: queue.activeAgents > 0 
          ? ((queue.ticketsActive / queue.activeAgents) * 100).toFixed(2) 
          : 0,
        abandonmentRate: queue.totalTickets > 0
          ? ((queue.ticketsWaiting / queue.totalTickets) * 100).toFixed(2)
          : 0
      }));

    } catch (error) {
      logger.error('❌ Erro ao calcular desempenho de filas:', error);
      throw error;
    }
  }

  /**
   * Compara desempenho de agente com períodos anteriores
   * @param {String} agentId - ID do agente
   * @param {Object} options - Opções
   * @returns {Promise<Object>}
   */
  async compareAgentPerformance(agentId, options = {}) {
    try {
      const {
        currentPeriodDays = 30,
        comparisonPeriodDays = 30
      } = options;

      const currentEnd = moment();
      const currentStart = moment().subtract(currentPeriodDays, 'days');
      const comparisonEnd = currentStart.clone();
      const comparisonStart = comparisonEnd.clone().subtract(comparisonPeriodDays, 'days');

      const [currentPeriod] = await this.getAgentPerformance({
        startDate: currentStart.toDate(),
        endDate: currentEnd.toDate(),
        agentIds: [agentId],
        limit: 1
      });

      const [previousPeriod] = await this.getAgentPerformance({
        startDate: comparisonStart.toDate(),
        endDate: comparisonEnd.toDate(),
        agentIds: [agentId],
        limit: 1
      });

      if (!currentPeriod) {
        throw new Error('Agente não encontrado ou sem dados no período atual');
      }

      const comparison = {
        current: currentPeriod,
        previous: previousPeriod || {},
        changes: {}
      };

      if (previousPeriod) {
        const metrics = [
          'totalTickets',
          'ticketsResolved',
          'avgRating',
          'avgResolutionTimeMinutes',
          'avgFirstResponseMinutes',
          'resolutionRate',
          'satisfactionRate'
        ];

        metrics.forEach(metric => {
          const current = parseFloat(currentPeriod[metric]) || 0;
          const previous = parseFloat(previousPeriod[metric]) || 0;
          const change = previous > 0 ? ((current - previous) / previous * 100).toFixed(2) : 0;
          
          comparison.changes[metric] = {
            value: change,
            direction: change > 0 ? 'up' : (change < 0 ? 'down' : 'stable'),
            improved: this.isImprovement(metric, change)
          };
        });
      }

      return comparison;

    } catch (error) {
      logger.error('❌ Erro ao comparar desempenho:', error);
      throw error;
    }
  }

  /**
   * Ranking de agentes por métrica específica
   * @param {String} metric - Métrica para ranking
   * @param {Object} options - Opções
   * @returns {Promise<Array>}
   */
  async getAgentRanking(metric = 'ticketsResolved', options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate(),
        limit = 10
      } = options;

      const validMetrics = [
        'ticketsResolved',
        'avgRating',
        'avgResolutionTimeMinutes',
        'avgFirstResponseMinutes',
        'resolutionRate',
        'satisfactionRate',
        'totalMessages'
      ];

      if (!validMetrics.includes(metric)) {
        throw new Error(`Métrica inválida. Use: ${validMetrics.join(', ')}`);
      }

      const agents = await this.getAgentPerformance({
        startDate,
        endDate,
        limit: 100 // Buscar todos para fazer ranking correto
      });

      // Ordenar por métrica específica
      const isTimeMetric = metric.includes('Time') || metric.includes('Minutes');
      agents.sort((a, b) => {
        const aValue = parseFloat(a[metric]) || 0;
        const bValue = parseFloat(b[metric]) || 0;
        // Para métricas de tempo, menor é melhor
        return isTimeMetric ? aValue - bValue : bValue - aValue;
      });

      // Adicionar posição no ranking
      return agents.slice(0, limit).map((agent, index) => ({
        ...agent,
        rank: index + 1,
        rankMetric: metric,
        rankValue: agent[metric]
      }));

    } catch (error) {
      logger.error('❌ Erro ao gerar ranking:', error);
      throw error;
    }
  }

  /**
   * Estatísticas de desempenho consolidadas
   * @param {Object} options - Opções
   * @returns {Promise<Object>}
   */
  async getPerformanceStats(options = {}) {
    try {
      const {
        startDate = moment().subtract(30, 'days').toDate(),
        endDate = moment().toDate()
      } = options;

      const [agents, queues] = await Promise.all([
        this.getAgentPerformance({ startDate, endDate, limit: 100 }),
        this.getQueuePerformance({ startDate, endDate, limit: 100 })
      ]);

      // Calcular estatísticas gerais
      const totalTickets = agents.reduce((sum, a) => sum + (parseInt(a.totalTickets) || 0), 0);
      const totalResolved = agents.reduce((sum, a) => sum + (parseInt(a.ticketsResolved) || 0), 0);
      const avgResolutionTime = agents.reduce((sum, a) => sum + (parseFloat(a.avgResolutionTimeMinutes) || 0), 0) / (agents.length || 1);
      const avgRating = agents.reduce((sum, a) => sum + (parseFloat(a.avgRating) || 0), 0) / (agents.length || 1);

      return {
        period: {
          startDate,
          endDate,
          days: moment(endDate).diff(moment(startDate), 'days')
        },
        overview: {
          totalAgents: agents.length,
          totalQueues: queues.length,
          totalTickets,
          totalResolved,
          resolutionRate: totalTickets > 0 ? ((totalResolved / totalTickets) * 100).toFixed(2) : 0,
          avgResolutionTime: avgResolutionTime.toFixed(2),
          avgRating: avgRating.toFixed(2)
        },
        topAgents: agents.slice(0, 5),
        topQueues: queues.slice(0, 5),
        performance: {
          excellent: agents.filter(a => parseFloat(a.avgRating) >= 4.5).length,
          good: agents.filter(a => parseFloat(a.avgRating) >= 3.5 && parseFloat(a.avgRating) < 4.5).length,
          average: agents.filter(a => parseFloat(a.avgRating) >= 2.5 && parseFloat(a.avgRating) < 3.5).length,
          poor: agents.filter(a => parseFloat(a.avgRating) < 2.5).length
        }
      };

    } catch (error) {
      logger.error('❌ Erro ao calcular estatísticas:', error);
      throw error;
    }
  }

  /**
   * Calcula score de desempenho (0-100)
   * @param {Object} metrics - Métricas do agente
   * @returns {Number}
   */
  calculatePerformanceScore(metrics) {
    const {
      resolutionRate = 0,
      avgRating = 0,
      avgResolutionTime = 0,
      avgFirstResponse = 0
    } = metrics;

    // Pesos para cada métrica
    const weights = {
      resolutionRate: 0.30,  // 30%
      avgRating: 0.35,        // 35%
      resolutionTime: 0.20,   // 20%
      firstResponse: 0.15     // 15%
    };

    // Normalizar métricas (0-1)
    const normalizedResolution = Math.min(resolutionRate, 1);
    const normalizedRating = avgRating / 5;
    const normalizedResolutionTime = Math.max(0, 1 - (avgResolutionTime / 120)); // 120min = 0 pontos
    const normalizedFirstResponse = Math.max(0, 1 - (avgFirstResponse / 15)); // 15min = 0 pontos

    // Calcular score ponderado
    const score = (
      (normalizedResolution * weights.resolutionRate) +
      (normalizedRating * weights.avgRating) +
      (normalizedResolutionTime * weights.resolutionTime) +
      (normalizedFirstResponse * weights.firstResponse)
    ) * 100;

    return Math.round(score);
  }

  /**
   * Verifica se mudança em métrica é melhoria
   * @param {String} metric - Nome da métrica
   * @param {Number} change - Percentual de mudança
   * @returns {Boolean}
   */
  isImprovement(metric, change) {
    // Métricas onde menor é melhor
    const lowerIsBetter = [
      'avgResolutionTimeMinutes',
      'avgFirstResponseMinutes',
      'avgWaitTimeMinutes',
      'abandonmentRate'
    ];

    if (lowerIsBetter.includes(metric)) {
      return change < 0; // Diminuiu = melhorou
    }

    return change > 0; // Aumentou = melhorou
  }
}

module.exports = new PerformanceService();

