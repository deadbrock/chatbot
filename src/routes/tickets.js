const express = require('express');
const router = express.Router();
const ticketsController = require('../controllers/ticketsController');

/**
 * GET /api/tickets
 * Lista todos os tickets
 */
router.get('/', async (req, res) => {
  return ticketsController.list(req, res);
});

/**
 * GET /api/tickets/stats/summary
 * Estatísticas de tickets
 */
router.get('/stats/summary', async (req, res) => {
  return ticketsController.statsSummary(req, res);
});

/**
 * POST /api/tickets/:id/assign
 * Atribui ticket a atendente
 */
router.post('/:id/assign', async (req, res) => {
  return ticketsController.assign(req, res);
});

/**
 * POST /api/tickets/:id/close
 * Fecha ticket
 */
router.post('/:id/close', async (req, res) => {
  return ticketsController.close(req, res);
});

/**
 * POST /api/tickets/:id/transfer
 * Transfere ticket para outro atendente (apenas admin/manager)
 */
router.post('/:id/transfer', async (req, res) => {
  console.log('🔥 ROTA TRANSFER CHAMADA:', req.params, req.body);
  return ticketsController.transfer(req, res);
});

/**
 * POST /api/tickets/:id/accept
 * Atendente aceita um ticket
 */
router.post('/:id/accept', async (req, res) => {
  return ticketsController.acceptTicket(req, res);
});

/**
 * POST /api/tickets/:id/reject
 * Atendente rejeita um ticket (IA assume)
 */
router.post('/:id/reject', async (req, res) => {
  return ticketsController.rejectTicket(req, res);
});

/**
 * POST /api/tickets/:id/finish
 * Atendente finaliza o atendimento
 */
router.post('/:id/finish', async (req, res) => {
  return ticketsController.finishTicket(req, res);
});

/**
 * GET /api/tickets/:id
 * Obtém ticket específico (id numérico ou protocolo)
 */
router.get('/:id', async (req, res) => {
  return ticketsController.get(req, res);
});

/**
 * POST /api/tickets
 * Cria novo ticket
 */
router.post('/', async (req, res) => {
  return ticketsController.create(req, res);
});

/**
 * PATCH /api/tickets/:id
 * Atualiza ticket
 */
router.patch('/:id', async (req, res) => {
  return ticketsController.patch(req, res);
});

module.exports = router;

