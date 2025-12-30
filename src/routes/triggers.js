const express = require('express');
const router = express.Router();
const triggersController = require('../controllers/triggersController');
const { authenticate } = require('../middleware/auth');

/**
 * Rotas de Gatilhos e Ações (Triggers)
 * Todas as rotas requerem autenticação
 */

// Listar todos os gatilhos
router.get('/', authenticate, triggersController.listTriggers);

// Buscar gatilhos por tipo de evento
router.get('/event/:eventType', authenticate, triggersController.getTriggersByEvent);

// Buscar gatilho por ID
router.get('/:id', authenticate, triggersController.getTrigger);

// Criar novo gatilho
router.post('/', authenticate, triggersController.createTrigger);

// Atualizar gatilho
router.put('/:id', authenticate, triggersController.updateTrigger);

// Deletar gatilho
router.delete('/:id', authenticate, triggersController.deleteTrigger);

// Ativar/Pausar gatilho
router.patch('/:id/status', authenticate, triggersController.toggleTriggerStatus);

// Duplicar gatilho
router.post('/:id/duplicate', authenticate, triggersController.duplicateTrigger);

// Estatísticas do gatilho
router.get('/:id/stats', authenticate, triggersController.getTriggerStats);

// Testar gatilho
router.post('/:id/test', authenticate, triggersController.testTrigger);

// Limpar logs do gatilho
router.delete('/:id/logs', authenticate, triggersController.clearTriggerLogs);

// Executar gatilho manualmente
router.post('/:id/execute', authenticate, triggersController.executeTriggerManually);

module.exports = router;

