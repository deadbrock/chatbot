const express = require('express');
const router = express.Router();
const followUpsController = require('../controllers/followUpsController');
const { authenticate } = require('../middleware/auth');

/**
 * Rotas de Follow-ups Automáticos
 * Todas as rotas requerem autenticação
 */

// Listar todos os follow-ups
router.get('/', authenticate, followUpsController.listFollowUps);

// Buscar follow-up por ID
router.get('/:id', authenticate, followUpsController.getFollowUp);

// Criar novo follow-up
router.post('/', authenticate, followUpsController.createFollowUp);

// Atualizar follow-up
router.put('/:id', authenticate, followUpsController.updateFollowUp);

// Deletar follow-up
router.delete('/:id', authenticate, followUpsController.deleteFollowUp);

// Ativar/Pausar follow-up
router.patch('/:id/status', authenticate, followUpsController.toggleFollowUpStatus);

// Duplicar follow-up
router.post('/:id/duplicate', authenticate, followUpsController.duplicateFollowUp);

// Estatísticas do follow-up
router.get('/:id/stats', authenticate, followUpsController.getFollowUpStats);

// Testar follow-up
router.post('/:id/test', authenticate, followUpsController.testFollowUp);

// Listar contatos elegíveis
router.get('/:id/eligible-contacts', authenticate, followUpsController.getEligibleContacts);

// Enviar follow-up manualmente
router.post('/:id/send', authenticate, followUpsController.sendFollowUpManually);

module.exports = router;

