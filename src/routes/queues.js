const express = require('express');
const router = express.Router();
const {
  listQueues,
  getQueue,
  createQueue,
  updateQueue,
  deleteQueue,
  reorderQueues,
  getQueueStats,
  distributeTicket,
  addAgent,
  removeAgent,
  initDefaults
} = require('../controllers/queuesController');
const { authenticate } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authenticate);

// Rotas especiais
router.post('/init-defaults', initDefaults);
router.post('/reorder', reorderQueues);

// CRUD
router.get('/', listQueues);
router.get('/:id', getQueue);
router.post('/', createQueue);
router.put('/:id', updateQueue);
router.delete('/:id', deleteQueue);

// Estatísticas e ações
router.get('/:id/stats', getQueueStats);
router.post('/:id/distribute', distributeTicket);
router.post('/:id/agents', addAgent);
router.delete('/:id/agents/:agentId', removeAgent);

module.exports = router;

