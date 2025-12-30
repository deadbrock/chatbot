const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

/**
 * ROTAS DE DASHBOARD E ANALYTICS
 * Todas as rotas requerem autenticação
 */

// ============================================
// DASHBOARD EXECUTIVO
// ============================================

/**
 * @route   GET /api/dashboard/executive
 * @desc    Dashboard executivo completo
 * @access  Private
 * @query   startDate, endDate, period
 */
router.get('/executive', authenticate, dashboardController.getExecutiveDashboard);

/**
 * @route   GET /api/dashboard/kpis
 * @desc    KPIs principais com comparação
 * @access  Private
 * @query   startDate, endDate
 */
router.get('/kpis', authenticate, dashboardController.getKPIs);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Estatísticas globais
 * @access  Private
 */
router.get('/stats', authenticate, dashboardController.getGlobalStats);

// ============================================
// BREAKDOWNS E ANÁLISES
// ============================================

/**
 * @route   GET /api/dashboard/breakdown/:dimension
 * @desc    Breakdown por dimensão
 * @access  Private
 * @param   dimension - queue, agent, status, hour, weekday
 * @query   startDate, endDate
 */
router.get('/breakdown/:dimension', authenticate, dashboardController.getBreakdown);

/**
 * @route   GET /api/dashboard/trends
 * @desc    Tendências de métricas
 * @access  Private
 * @query   metric, startDate, endDate, period
 */
router.get('/trends', authenticate, dashboardController.getTrends);

/**
 * @route   GET /api/dashboard/comparison
 * @desc    Comparação entre períodos
 * @access  Private
 * @query   period1Start, period1End, period2Start, period2End
 */
router.get('/comparison', authenticate, dashboardController.getComparison);

/**
 * @route   GET /api/dashboard/heatmap
 * @desc    Heatmap de atividade (hora/dia)
 * @access  Private
 * @query   startDate, endDate
 */
router.get('/heatmap', authenticate, dashboardController.getHeatmap);

/**
 * @route   GET /api/dashboard/performance
 * @desc    Performance de agentes e filas
 * @access  Private
 * @query   startDate, endDate, type (agents, queues, both)
 */
router.get('/performance', authenticate, dashboardController.getPerformance);

// ============================================
// SNAPSHOTS
// ============================================

/**
 * @route   GET /api/dashboard/snapshots
 * @desc    Lista snapshots
 * @access  Private
 * @query   startDate, endDate, period, limit
 */
router.get('/snapshots', authenticate, dashboardController.listSnapshots);

/**
 * @route   POST /api/dashboard/snapshots/generate
 * @desc    Gera snapshot manualmente
 * @access  Private (Admin/Manager)
 * @body    { date }
 */
router.post(
  '/snapshots/generate',
  authenticate,
  checkPermission('analytics', 'create'),
  dashboardController.generateSnapshot
);

/**
 * @route   DELETE /api/dashboard/snapshots/cleanup
 * @desc    Limpa snapshots antigos
 * @access  Private (Admin)
 * @body    { daysToKeep }
 */
router.delete(
  '/snapshots/cleanup',
  authenticate,
  checkPermission('analytics', 'delete'),
  dashboardController.cleanupSnapshots
);

module.exports = router;

