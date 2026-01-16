const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessionsController');

/**
 * GET /api/sessions
 * Lista todas as sessões ativas
 */
router.get('/', async (req, res) => {
  return sessionsController.list(req, res);
});

/**
 * GET /api/sessions/stats/summary
 * Estatísticas de sessões
 */
router.get('/stats/summary', async (req, res) => {
  return sessionsController.statsSummary(req, res);
});

/**
 * GET /api/sessions/:userId
 * Obtém sessão específica
 */
router.get('/:userId', async (req, res) => {
  return sessionsController.get(req, res);
});

/**
 * DELETE /api/sessions/:userId
 * Expira sessão
 */
router.delete('/:userId', async (req, res) => {
  return sessionsController.remove(req, res);
});

/**
 * PATCH /api/sessions/:userId/flow
 * Força fluxo atual da conversa (user_sessions)
 * body: { currentFlow, currentStep?, resetContext? }
 */
router.patch('/:userId/flow', async (req, res) => {
  return sessionsController.updateFlow(req, res);
});

module.exports = router;

