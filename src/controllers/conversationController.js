const conversationService = require('../services/conversationService');
const logger = require('../utils/logger');
const { success, fail } = require('../utils/http');
const moment = require('moment-timezone');

/**
 * ================================================================================
 * FASE 6D: CONTROLLER - ANÁLISE DE CONVERSAS
 * ================================================================================
 */

/**
 * GET /api/conversation/analyze/:ticketId
 * Analisa uma conversa específica
 */
exports.analyzeConversation = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const analysis = await conversationService.analyzeConversation(ticketId);

    res.json(success(analysis, 'Conversa analisada com sucesso'));

  } catch (error) {
    logger.error('❌ Erro ao analisar conversa:', error);
    res.status(500).json(fail('Erro ao analisar conversa'));
  }
};

/**
 * GET /api/conversation/batch
 * Analisa múltiplas conversas em lote
 */
exports.analyzeBatch = async (req, res) => {
  try {
    const { startDate, endDate, limit, status } = req.query;

    const options = {};
    if (startDate) options.startDate = moment(startDate).toDate();
    if (endDate) options.endDate = moment(endDate).toDate();
    if (limit) options.limit = parseInt(limit);
    if (status) options.status = status;

    const batch = await conversationService.analyzeBatchConversations(options);

    res.json(success(batch, 'Análise em lote concluída'));

  } catch (error) {
    logger.error('❌ Erro ao analisar lote:', error);
    res.status(500).json(fail('Erro ao analisar lote'));
  }
};

/**
 * GET /api/conversation/patterns
 * Identifica padrões em conversas
 */
exports.identifyPatterns = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const options = {};
    if (startDate) options.startDate = moment(startDate).toDate();
    if (endDate) options.endDate = moment(endDate).toDate();

    const patterns = await conversationService.identifyPatterns(options);

    res.json(success(patterns, 'Padrões identificados'));

  } catch (error) {
    logger.error('❌ Erro ao identificar padrões:', error);
    res.status(500).json(fail('Erro ao identificar padrões'));
  }
};

module.exports = exports;

