const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performanceController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

/**
 * ================================================================================
 * FASE 6B: ROTAS - ANÁLISE DE DESEMPENHO
 * ================================================================================
 * 
 * Rotas para análise de desempenho de agentes e filas
 */

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * GET /api/performance/agents
 * Lista desempenho de agentes
 * Query params: startDate, endDate, agentIds, departmentId, limit
 */
router.get(
  '/agents',
  requirePermission('reports:view'),
  performanceController.getAgentPerformance
);

/**
 * GET /api/performance/agents/:id
 * Detalhes de desempenho de um agente específico
 */
router.get(
  '/agents/:id',
  requirePermission('reports:view'),
  performanceController.getAgentPerformanceDetails
);

/**
 * GET /api/performance/agents/:id/compare
 * Compara desempenho do agente com períodos anteriores
 */
router.get(
  '/agents/:id/compare',
  requirePermission('reports:view'),
  performanceController.compareAgentPerformance
);

/**
 * GET /api/performance/queues
 * Lista desempenho de filas
 * Query params: startDate, endDate, queueIds, limit
 */
router.get(
  '/queues',
  requirePermission('reports:view'),
  performanceController.getQueuePerformance
);

/**
 * GET /api/performance/queues/:id
 * Detalhes de desempenho de uma fila específica
 */
router.get(
  '/queues/:id',
  requirePermission('reports:view'),
  performanceController.getQueuePerformanceDetails
);

/**
 * GET /api/performance/ranking
 * Ranking de agentes por métrica
 * Query params: metric, startDate, endDate, limit
 */
router.get(
  '/ranking',
  requirePermission('reports:view'),
  performanceController.getAgentRanking
);

/**
 * GET /api/performance/stats
 * Estatísticas consolidadas de desempenho
 * Query params: startDate, endDate
 */
router.get(
  '/stats',
  requirePermission('reports:view'),
  performanceController.getPerformanceStats
);

/**
 * GET /api/performance/export
 * Exporta relatório de desempenho
 * Query params: format, type, startDate, endDate
 */
router.get(
  '/export',
  requirePermission('reports:export'),
  performanceController.exportPerformanceReport
);

module.exports = router;

