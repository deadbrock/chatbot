const performanceService = require('../services/performanceService');
const logger = require('../utils/logger');
const { success, fail } = require('../utils/http');
const moment = require('moment-timezone');

/**
 * ================================================================================
 * FASE 6B: CONTROLLER - ANÁLISE DE DESEMPENHO
 * ================================================================================
 * 
 * Endpoints para análise de desempenho de agentes e filas
 */

/**
 * GET /api/performance/agents
 * Busca desempenho de agentes
 */
exports.getAgentPerformance = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      agentIds,
      departmentId,
      limit = 20
    } = req.query;

    const options = {
      limit: parseInt(limit)
    };

    if (startDate) {
      options.startDate = moment(startDate).toDate();
    }
    if (endDate) {
      options.endDate = moment(endDate).toDate();
    }
    if (agentIds) {
      options.agentIds = Array.isArray(agentIds) ? agentIds : [agentIds];
    }
    if (departmentId) {
      options.departmentId = departmentId;
    }

    const agents = await performanceService.getAgentPerformance(options);

    res.json(success(agents, 'Desempenho de agentes carregado'));

  } catch (error) {
    logger.error('❌ Erro ao buscar desempenho de agentes:', error);
    res.status(500).json(fail('Erro ao buscar desempenho de agentes'));
  }
};

/**
 * GET /api/performance/agents/:id
 * Busca desempenho detalhado de um agente específico
 */
exports.getAgentPerformanceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const options = {
      agentIds: [id],
      limit: 1
    };

    if (startDate) {
      options.startDate = moment(startDate).toDate();
    }
    if (endDate) {
      options.endDate = moment(endDate).toDate();
    }

    const [agent] = await performanceService.getAgentPerformance(options);

    if (!agent) {
      return res.status(404).json(fail('Agente não encontrado ou sem dados'));
    }

    res.json(success(agent, 'Desempenho do agente carregado'));

  } catch (error) {
    logger.error('❌ Erro ao buscar desempenho do agente:', error);
    res.status(500).json(fail('Erro ao buscar desempenho do agente'));
  }
};

/**
 * GET /api/performance/agents/:id/compare
 * Compara desempenho do agente com períodos anteriores
 */
exports.compareAgentPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      currentPeriodDays = 30,
      comparisonPeriodDays = 30
    } = req.query;

    const comparison = await performanceService.compareAgentPerformance(id, {
      currentPeriodDays: parseInt(currentPeriodDays),
      comparisonPeriodDays: parseInt(comparisonPeriodDays)
    });

    res.json(success(comparison, 'Comparação de desempenho gerada'));

  } catch (error) {
    logger.error('❌ Erro ao comparar desempenho:', error);
    res.status(500).json(fail(error.message || 'Erro ao comparar desempenho'));
  }
};

/**
 * GET /api/performance/queues
 * Busca desempenho de filas
 */
exports.getQueuePerformance = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      queueIds,
      limit = 20
    } = req.query;

    const options = {
      limit: parseInt(limit)
    };

    if (startDate) {
      options.startDate = moment(startDate).toDate();
    }
    if (endDate) {
      options.endDate = moment(endDate).toDate();
    }
    if (queueIds) {
      options.queueIds = Array.isArray(queueIds) ? queueIds : [queueIds];
    }

    const queues = await performanceService.getQueuePerformance(options);

    res.json(success(queues, 'Desempenho de filas carregado'));

  } catch (error) {
    logger.error('❌ Erro ao buscar desempenho de filas:', error);
    res.status(500).json(fail('Erro ao buscar desempenho de filas'));
  }
};

/**
 * GET /api/performance/queues/:id
 * Busca desempenho detalhado de uma fila específica
 */
exports.getQueuePerformanceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const options = {
      queueIds: [id],
      limit: 1
    };

    if (startDate) {
      options.startDate = moment(startDate).toDate();
    }
    if (endDate) {
      options.endDate = moment(endDate).toDate();
    }

    const [queue] = await performanceService.getQueuePerformance(options);

    if (!queue) {
      return res.status(404).json(fail('Fila não encontrada ou sem dados'));
    }

    res.json(success(queue, 'Desempenho da fila carregado'));

  } catch (error) {
    logger.error('❌ Erro ao buscar desempenho da fila:', error);
    res.status(500).json(fail('Erro ao buscar desempenho da fila'));
  }
};

/**
 * GET /api/performance/ranking
 * Ranking de agentes por métrica específica
 */
exports.getAgentRanking = async (req, res) => {
  try {
    const {
      metric = 'ticketsResolved',
      startDate,
      endDate,
      limit = 10
    } = req.query;

    const options = {
      limit: parseInt(limit)
    };

    if (startDate) {
      options.startDate = moment(startDate).toDate();
    }
    if (endDate) {
      options.endDate = moment(endDate).toDate();
    }

    const ranking = await performanceService.getAgentRanking(metric, options);

    res.json(success({
      metric,
      ranking
    }, 'Ranking gerado com sucesso'));

  } catch (error) {
    logger.error('❌ Erro ao gerar ranking:', error);
    res.status(500).json(fail(error.message || 'Erro ao gerar ranking'));
  }
};

/**
 * GET /api/performance/stats
 * Estatísticas consolidadas de desempenho
 */
exports.getPerformanceStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const options = {};

    if (startDate) {
      options.startDate = moment(startDate).toDate();
    }
    if (endDate) {
      options.endDate = moment(endDate).toDate();
    }

    const stats = await performanceService.getPerformanceStats(options);

    res.json(success(stats, 'Estatísticas carregadas'));

  } catch (error) {
    logger.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json(fail('Erro ao buscar estatísticas'));
  }
};

/**
 * GET /api/performance/export
 * Exporta relatório de desempenho em PDF/Excel
 */
exports.exportPerformanceReport = async (req, res) => {
  try {
    const {
      format = 'pdf',
      type = 'agents',
      startDate,
      endDate
    } = req.query;

    // TODO: Implementar exportação usando reportService
    // Por enquanto, retorna dados JSON

    const options = {};
    if (startDate) options.startDate = moment(startDate).toDate();
    if (endDate) options.endDate = moment(endDate).toDate();

    let data;
    if (type === 'agents') {
      data = await performanceService.getAgentPerformance(options);
    } else if (type === 'queues') {
      data = await performanceService.getQueuePerformance(options);
    } else {
      data = await performanceService.getPerformanceStats(options);
    }

    res.json(success({
      format,
      type,
      data,
      message: 'Exportação será implementada em breve'
    }, 'Dados preparados para exportação'));

  } catch (error) {
    logger.error('❌ Erro ao exportar relatório:', error);
    res.status(500).json(fail('Erro ao exportar relatório'));
  }
};

module.exports = exports;

