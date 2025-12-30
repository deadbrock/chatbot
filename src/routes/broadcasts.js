const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const broadcastsController = require('../controllers/broadcastsController');

// Aplicar autenticação a todas as rotas
router.use(authenticate);

/**
 * Rotas de Transmissões (Broadcasts)
 * Sistema de envio rápido em massa
 */

// ========== BROADCASTS ==========

// CRUD de transmissões
router.get('/', broadcastsController.getAllBroadcasts);
router.get('/:id', broadcastsController.getBroadcastById);
router.post('/', broadcastsController.createBroadcast);
router.delete('/:id', broadcastsController.deleteBroadcast);

// Ações de transmissão
router.post('/:id/send', broadcastsController.sendBroadcast);
router.get('/:id/stats', broadcastsController.getBroadcastStats);

// ========== LISTAS DE TRANSMISSÃO ==========

// CRUD de listas
router.get('/lists/all', broadcastsController.getAllLists);
router.get('/lists/:id', broadcastsController.getListById);
router.post('/lists', broadcastsController.createList);
router.put('/lists/:id', broadcastsController.updateList);
router.delete('/lists/:id', broadcastsController.deleteList);

// Gerenciamento de contatos nas listas
router.post('/lists/:id/contacts/add', broadcastsController.addContactsToList);
router.post('/lists/:id/contacts/remove', broadcastsController.removeContactsFromList);

module.exports = router;

