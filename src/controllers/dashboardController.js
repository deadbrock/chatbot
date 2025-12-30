const analyticsService = require('../services/analyticsService');
const AnalyticsSnapshot = require('../models/AnalyticsSnapshotSQL');
const { success, error: fail, notFound } = require('../utils/http');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

/**
 * DASHBOARD CONTROLLER
 * Gerenciamento de dashboards e análises
 */

/**
 * GET /api/dashboard/executive
 * Dashboard executivo completo
 */
exports.getExecutiveDashboard = async (req, res) => {
  try {
    const {
      startDate = moment().subtract(30, 'days').format('YYYY-MM-DD'),
      endDate = moment().format('YYYY-MM-DD'),
      period = 'daily',
    } = req.query;

    logger.info(`Buscando dashboard executivo: ${startDate} a ${endDate}`);

    const data = await analyticsService.getDashboardData(
      new Date(startDate),
      new Date(endDate),
      { period }
    );

    success(res, data, 'Dashboard executivo obtido com sucesso');
  } catch (err) {
    logger.error('Erro ao obter dashboard executivo:', err);
    fail(res, 'Erro ao obter dashboard executivo', 500);
  }
};

/**
 * GET /api/dashboard/kpis
 * KPIs principais
 */
exports.getKPIs = async (req, res) => {
  try {
    const {
      startDate = moment().subtract(30, 'days').format('YYYY-MM-DD'),
      endDate = moment().format('YYYY-MM-DD'),
    } = req.query;

    logger.info(`Buscando KPIs: ${startDate} a ${endDate}`);

    const kpis = await analyticsService.getMainKPIs(
      new Date(startDate),
      new Date(endDate)
    );

    // Buscar comparação com período anterior
    const duration = moment(endDate).diff(moment(startDate), 'days');
    const previousStart = moment(startDate).subtract(duration, 'days').format('YYYY-MM-DD');
    const previousEnd = moment(startDate).subtract(1, 'day').format('YYYY-MM-DD');

    const previousKPIs = await analyticsService.getMainKPIs(
      new Date(previousStart),
      new Date(previousEnd)
    );

    // Calcular variações
    const variations = {};
    for (const key in kpis) {
      if (previousKPIs[key] !== undefined) {
        const current = kpis[key];
        const previous = previousKPIs[key];
        variations[key] = previous > 0 
          ? parseFloat((((current - previous) / previous) * 100).toFixed(2))
          : current > 0 ? 100 : 0;
      }
    }

    success(res, {
      current: kpis,
      previous: previousKPIs,
      variations,
    }, 'KPIs obtidos com sucesso');
  } catch (err) {
    logger.error('Erro ao obter KPIs:', err);
    fail(res, 'Erro ao obter KPIs', 500);
  }
};

/**
 * GET /api/dashboard/breakdown/:dimension
 * Breakdown por dimensão
 */
exports.getBreakdown = async (req, res) => {
  try {
    const { dimension } = req.params;
    const {
      startDate = moment().subtract(30, 'days').format('YYYY-MM-DD'),
      endDate = moment().format('YYYY-MM-DD'),
    } = req.query;

    // Validar dimensão
    const validDimensions = ['queue', 'agent', 'status', 'hour', 'weekday'];
    if (!validDimensions.includes(dimension)) {
      return fail(res, `Dimensão inválida. Use: ${validDimensions.join(', ')}`, 400);
    }

    logger.info(`Buscando breakdown por ${dimension}: ${startDate} a ${endDate}`);

    let breakdown;
    switch (dimension) {
      case 'queue':
        breakdown = await analyticsService.breakdownByQueue(new Date(startDate), new Date(endDate));
        break;
      case 'agent':
        breakdown = await analyticsService.breakdownByAgent(new Date(startDate), new Date(endDate));
        break;
      case 'status':
        breakdown = await analyticsService.breakdownByStatus(new Date(startDate), new Date(endDate));
        break;
      case 'hour':
        breakdown = await analyticsService.breakdownByHour(new Date(startDate), new Date(endDate));
        break;
      case 'weekday':
        breakdown = await analyticsService.breakdownByWeekday(new Date(startDate), new Date(endDate));
        break;
    }

    success(res, breakdown, `Breakdown por ${dimension} obtido com sucesso`);
  } catch (err) {
    logger.error('Erro ao obter breakdown:', err);
    fail(res, 'Erro ao obter breakdown', 500);
  }
};

/**
 * GET /api/dashboard/trends
 * Tendências de uma métrica
 */
exports.getTrends = async (req, res) => {
  try {
    const {
      metric = 'tickets',
      startDate = moment().subtract(90, 'days').format('YYYY-MM-DD'),
      endDate = moment().format('YYYY-MM-DD'),
      period = 'daily',
    } = req.query;

    logger.info(`Buscando tendência de ${metric}: ${startDate} a ${endDate}`);

    const snapshots = await AnalyticsSnapshot.findInRange(
      new Date(startDate),
      new Date(endDate),
      period
    );

    // Mapear métrica
    const metricMap = {
      tickets: 'totalTickets',
      messages: 'totalMessages',
      nps: 'npsScore',
      contacts: 'newContacts',
      resolution_time: 'avgResolutionTime',
      response_time: 'avgResponseTime',
    };

    const field = metricMap[metric] || 'totalTickets';

    const data = snapshots.map(snap => ({
      date: snap.date,
      value: snap[field],
    }));

    // Calcular tendência (crescimento/decrescimento)
    let trend = 'stable';
    if (data.length >= 2) {
      const first = data[0].value;
      const last = data[data.length - 1].value;
      const change = ((last - first) / (first || 1)) * 100;
      
      if (change > 10) trend = 'growing';
      else if (change < -10) trend = 'declining';
    }

    success(res, {
      metric,
      data,
      trend,
      total: data.reduce((sum, d) => sum + d.value, 0),
      average: data.reduce((sum, d) => sum + d.value, 0) / (data.length || 1),
    }, 'Tendências obtidas com sucesso');
  } catch (err) {
    logger.error('Erro ao obter tendências:', err);
    fail(res, 'Erro ao obter tendências', 500);
  }
};

/**
 * GET /api/dashboard/comparison
 * Comparação entre dois períodos
 */
exports.getComparison = async (req, res) => {
  try {
    const {
      period1Start,
      period1End,
      period2Start,
      period2End,
    } = req.query;

    if (!period1Start || !period1End || !period2Start || !period2End) {
      return fail(res, 'Parâmetros period1Start, period1End, period2Start e period2End são obrigatórios', 400);
    }

    logger.info('Comparando períodos:', {
      period1: `${period1Start} a ${period1End}`,
      period2: `${period2Start} a ${period2End}`,
    });

    const period1Data = await analyticsService.getDashboardData(
      new Date(period1Start),
      new Date(period1End)
    );

    const period2Data = await analyticsService.getDashboardData(
      new Date(period2Start),
      new Date(period2End)
    );

    // Calcular diferenças
    const compare = (val1, val2) => {
      if (val2 === 0) return val1 > 0 ? 100 : 0;
      return parseFloat((((val1 - val2) / val2) * 100).toFixed(2));
    };

    const comparison = {
      period1: {
        start: period1Start,
        end: period1End,
        summary: period1Data.summary,
      },
      period2: {
        start: period2Start,
        end: period2End,
        summary: period2Data.summary,
      },
      differences: {
        tickets: compare(period1Data.summary?.totalTickets || 0, period2Data.summary?.totalTickets || 0),
        messages: compare(period1Data.summary?.totalMessages || 0, period2Data.summary?.totalMessages || 0),
        nps: compare(period1Data.summary?.avgNPS || 0, period2Data.summary?.avgNPS || 0),
      },
    };

    success(res, comparison, 'Comparação realizada com sucesso');
  } catch (err) {
    logger.error('Erro ao comparar períodos:', err);
    fail(res, 'Erro ao comparar períodos', 500);
  }
};

/**
 * GET /api/dashboard/snapshots
 * Lista snapshots
 */
exports.listSnapshots = async (req, res) => {
  try {
    const {
      startDate = moment().subtract(30, 'days').format('YYYY-MM-DD'),
      endDate = moment().format('YYYY-MM-DD'),
      period = 'daily',
      limit = 100,
    } = req.query;

    const snapshots = await AnalyticsSnapshot.findInRange(
      new Date(startDate),
      new Date(endDate),
      period
    );

    const limitedSnapshots = snapshots.slice(0, parseInt(limit));

    success(res, {
      snapshots: limitedSnapshots.map(s => s.getSummary()),
      total: snapshots.length,
      period,
    }, 'Snapshots listados com sucesso');
  } catch (err) {
    logger.error('Erro ao listar snapshots:', err);
    fail(res, 'Erro ao listar snapshots', 500);
  }
};

/**
 * POST /api/dashboard/snapshots/generate
 * Gera snapshot manualmente
 */
exports.generateSnapshot = async (req, res) => {
  try {
    const { date = moment().format('YYYY-MM-DD') } = req.body;

    logger.info(`Gerando snapshot para ${date}...`);

    const snapshot = await analyticsService.generateDailySnapshot(new Date(date));

    success(res, snapshot, 'Snapshot gerado com sucesso', 201);
  } catch (err) {
    logger.error('Erro ao gerar snapshot:', err);
    fail(res, 'Erro ao gerar snapshot', 500);
  }
};

/**
 * GET /api/dashboard/stats
 * Estatísticas globais
 */
exports.getGlobalStats = async (req, res) => {
  try {
    const stats = await AnalyticsSnapshot.getGlobalStats();

    success(res, stats, 'Estatísticas globais obtidas com sucesso');
  } catch (err) {
    logger.error('Erro ao obter estatísticas globais:', err);
    fail(res, 'Erro ao obter estatísticas globais', 500);
  }
};

/**
 * GET /api/dashboard/heatmap
 * Heatmap de atividade
 */
exports.getHeatmap = async (req, res) => {
  try {
    const {
      startDate = moment().subtract(30, 'days').format('YYYY-MM-DD'),
      endDate = moment().format('YYYY-MM-DD'),
    } = req.query;

    logger.info(`Gerando heatmap: ${startDate} a ${endDate}`);

    const byHour = await analyticsService.breakdownByHour(
      new Date(startDate),
      new Date(endDate)
    );

    const byWeekday = await analyticsService.breakdownByWeekday(
      new Date(startDate),
      new Date(endDate)
    );

    // Identificar horários de pico
    const hourValues = Object.values(byHour);
    const maxHour = Math.max(...hourValues);
    const peakHours = Object.entries(byHour)
      .filter(([_, value]) => value >= maxHour * 0.8)
      .map(([hour]) => parseInt(hour));

    // Identificar dias de pico
    const weekdayValues = Object.values(byWeekday);
    const maxWeekday = Math.max(...weekdayValues);
    const peakDays = Object.entries(byWeekday)
      .filter(([_, value]) => value >= maxWeekday * 0.8)
      .map(([day]) => parseInt(day));

    const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    success(res, {
      byHour,
      byWeekday,
      peakHours,
      peakDays: peakDays.map(d => weekdayNames[d]),
      insights: {
        busiestHour: Object.keys(byHour).reduce((a, b) => byHour[a] > byHour[b] ? a : b),
        busiestDay: weekdayNames[Object.keys(byWeekday).reduce((a, b) => byWeekday[a] > byWeekday[b] ? a : b)],
      },
    }, 'Heatmap gerado com sucesso');
  } catch (err) {
    logger.error('Erro ao gerar heatmap:', err);
    fail(res, 'Erro ao gerar heatmap', 500);
  }
};

/**
 * GET /api/dashboard/performance
 * Performance de agentes e filas
 */
exports.getPerformance = async (req, res) => {
  try {
    const {
      startDate = moment().subtract(30, 'days').format('YYYY-MM-DD'),
      endDate = moment().format('YYYY-MM-DD'),
      type = 'both', // 'agents', 'queues', 'both'
    } = req.query;

    logger.info(`Buscando performance (${type}): ${startDate} a ${endDate}`);

    const data = {};

    if (type === 'agents' || type === 'both') {
      data.agents = await analyticsService.breakdownByAgent(
        new Date(startDate),
        new Date(endDate)
      );
    }

    if (type === 'queues' || type === 'both') {
      data.queues = await analyticsService.breakdownByQueue(
        new Date(startDate),
        new Date(endDate)
      );
    }

    success(res, data, 'Performance obtida com sucesso');
  } catch (err) {
    logger.error('Erro ao obter performance:', err);
    fail(res, 'Erro ao obter performance', 500);
  }
};

/**
 * DELETE /api/dashboard/snapshots/cleanup
 * Limpa snapshots antigos
 */
exports.cleanupSnapshots = async (req, res) => {
  try {
    const { daysToKeep = 365 } = req.body;

    logger.info(`Limpando snapshots mais antigos que ${daysToKeep} dias...`);

    const deleted = await AnalyticsSnapshot.cleanup(parseInt(daysToKeep));

    success(res, { deleted }, `${deleted} snapshot(s) deletado(s) com sucesso`);
  } catch (err) {
    logger.error('Erro ao limpar snapshots:', err);
    fail(res, 'Erro ao limpar snapshots', 500);
  }
};

module.exports = exports;

