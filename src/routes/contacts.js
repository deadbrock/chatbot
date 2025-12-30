const express = require('express');
const router = express.Router();
const {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  toggleBlock,
  getStats,
  importContacts,
  exportContacts,
  addTags,
  removeTag
} = require('../controllers/contactsController');
const { authenticate } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authenticate);

// Rotas de estatísticas e ações em massa
router.get('/stats', getStats);
router.post('/import', importContacts);
router.get('/export', exportContacts);

// CRUD de contatos
router.get('/', listContacts);
router.get('/:id', getContact);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

// Ações específicas
router.post('/:id/toggle-block', toggleBlock);
router.post('/:id/tags', addTags);
router.delete('/:id/tags/:tag', removeTag);

module.exports = router;

