const express = require('express');
const router = express.Router();
const automationsController = require('../controllers/automationsController');
const { authenticate } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authenticate);

// Regras de automação
router.get('/rules', automationsController.listRules);
router.post('/rules', automationsController.createRule);
router.put('/rules/:id', automationsController.updateRule);
router.delete('/rules/:id', automationsController.deleteRule);
router.patch('/rules/:id/toggle', automationsController.toggleRule);

// Execuções
router.get('/executions', automationsController.listExecutions);
router.post('/executions/continue', automationsController.continueExecution);
router.delete('/executions/:contactId', automationsController.cancelExecution);

// Testes
router.post('/test', automationsController.testMessage);

// Estatísticas
router.get('/stats', automationsController.getStats);

// Templates
router.get('/templates', automationsController.getTemplates);
router.post('/templates/:templateId/create', automationsController.createFromTemplate);

module.exports = router;
