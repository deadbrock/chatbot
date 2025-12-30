const express = require('express');
const router = express.Router();
const satisfactionController = require('../controllers/satisfactionController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

/**
 * ================================================================================
 * FASE 6C: ROTAS - ANÁLISE DE SATISFAÇÃO
 * ================================================================================
 */

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * GET /api/satisfaction/nps
 * Calcula NPS (Net Promoter Score)
 * Query params: startDate, endDate, departmentId, agentId, queueId
 */
router.get(
  '/nps',
  requirePermission('reports:view'),
  satisfactionController.getNPS
);

/**
 * GET /api/satisfaction/wordcloud
 * Gera Word Cloud dos comentários
 * Query params: startDate, endDate, minRating, maxRating, limit
 */
router.get(
  '/wordcloud',
  requirePermission('reports:view'),
  satisfactionController.getWordCloud
);

/**
 * GET /api/satisfaction/sentiment
 * Análise de sentimento dos comentários
 * Query params: startDate, endDate
 */
router.get(
  '/sentiment',
  requirePermission('reports:view'),
  satisfactionController.getSentimentAnalysis
);

/**
 * GET /api/satisfaction/trends
 * Tendências de satisfação ao longo do tempo
 * Query params: startDate, endDate, interval
 */
router.get(
  '/trends',
  requirePermission('reports:view'),
  satisfactionController.getSatisfactionTrends
);

/**
 * GET /api/satisfaction/compare/:groupBy
 * Comparação de satisfação (department, queue, agent)
 * Query params: startDate, endDate, limit
 */
router.get(
  '/compare/:groupBy',
  requirePermission('reports:view'),
  satisfactionController.compareSatisfaction
);

module.exports = router;

