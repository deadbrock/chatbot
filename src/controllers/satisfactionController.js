const satisfactionService = require('../services/satisfactionService');
const logger = require('../utils/logger');
const { success, fail } = require('../utils/http');
const moment = require('moment-timezone');

/**
 * ================================================================================
 * FASE 6C: CONTROLLER - ANÁLISE DE SATISFAÇÃO
 * ================================================================================
 */

/**
 * GET /api/satisfaction/nps
 * Calcula NPS (Net Promoter Score)
 */
exports.getNPS = async (req, res) => {
  try {
    const { startDate, endDate, departmentId, agentId, queueId } = req.query;

    const options = {};
    if (startDate) options.startDate = moment(startDate).toDate();
    if (endDate) options.endDate = moment(endDate).toDate();
    if (departmentId) options.departmentId = departmentId;
    if (agentId) options.agentId = agentId;
    if (queueId) options.queueId = queueId;

    const nps = await satisfactionService.calculateNPS(options);

    res.json(success(nps, 'NPS calculado com sucesso'));

  } catch (error) {
    logger.error('❌ Erro ao calcular NPS:', error);
    res.status(500).json(fail('Erro ao calcular NPS'));
  }
};

/**
 * GET /api/satisfaction/wordcloud
 * Gera Word Cloud dos comentários
 */
exports.getWordCloud = async (req, res) => {
  try {
    const { startDate, endDate, minRating, maxRating, limit } = req.query;

    const options = {};
    if (startDate) options.startDate = moment(startDate).toDate();
    if (endDate) options.endDate = moment(endDate).toDate();
    if (minRating) options.minRating = parseInt(minRating);
    if (maxRating) options.maxRating = parseInt(maxRating);
    if (limit) options.limit = parseInt(limit);

    const wordCloud = await satisfactionService.generateWordCloud(options);

    res.json(success(wordCloud, 'Word cloud gerado com sucesso'));

  } catch (error) {
    logger.error('❌ Erro ao gerar word cloud:', error);
    res.status(500).json(fail('Erro ao gerar word cloud'));
  }
};

/**
 * GET /api/satisfaction/sentiment
 * Análise de sentimento dos comentários
 */
exports.getSentimentAnalysis = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const options = {};
    if (startDate) options.startDate = moment(startDate).toDate();
    if (endDate) options.endDate = moment(endDate).toDate();

    const sentiment = await satisfactionService.analyzeSentiment(options);

    res.json(success(sentiment, 'Análise de sentimento concluída'));

  } catch (error) {
    logger.error('❌ Erro ao analisar sentimento:', error);
    res.status(500).json(fail('Erro ao analisar sentimento'));
  }
};

/**
 * GET /api/satisfaction/trends
 * Tendências de satisfação ao longo do tempo
 */
exports.getSatisfactionTrends = async (req, res) => {
  try {
    const { startDate, endDate, interval = 'day' } = req.query;

    const options = { interval };
    if (startDate) options.startDate = moment(startDate).toDate();
    if (endDate) options.endDate = moment(endDate).toDate();

    const trends = await satisfactionService.getSatisfactionTrends(options);

    res.json(success(trends, 'Tendências carregadas'));

  } catch (error) {
    logger.error('❌ Erro ao buscar tendências:', error);
    res.status(500).json(fail('Erro ao buscar tendências'));
  }
};

/**
 * GET /api/satisfaction/compare/:groupBy
 * Comparação de satisfação entre departamentos/filas/agentes
 */
exports.compareSatisfaction = async (req, res) => {
  try {
    const { groupBy } = req.params;
    const { startDate, endDate, limit } = req.query;

    const options = {};
    if (startDate) options.startDate = moment(startDate).toDate();
    if (endDate) options.endDate = moment(endDate).toDate();
    if (limit) options.limit = parseInt(limit);

    const comparison = await satisfactionService.compareSatisfaction(groupBy, options);

    res.json(success(comparison, `Comparação por ${groupBy} concluída`));

  } catch (error) {
    logger.error('❌ Erro ao comparar satisfação:', error);
    res.status(500).json(fail(error.message || 'Erro ao comparar satisfação'));
  }
};

module.exports = exports;

