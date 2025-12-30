const express = require('express');
const router = express.Router();
const {
  listStatuses,
  getStatus,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
  getStatusStats,
  initDefaults
} = require('../controllers/ticketStatusesController');
const { authenticate } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authenticate);

// Rotas especiais
router.post('/init-defaults', initDefaults);
router.post('/reorder', reorderStatuses);
router.get('/stats', getStatusStats);

// CRUD
router.get('/', listStatuses);
router.get('/:id', getStatus);
router.post('/', createStatus);
router.put('/:id', updateStatus);
router.delete('/:id', deleteStatus);

module.exports = router;

