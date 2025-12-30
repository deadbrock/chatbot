const express = require('express');
const router = express.Router();
const campaignFlowsController = require('../controllers/campaignFlowsController');
const { authenticate } = require('../middleware/auth');

/**
 * Rotas de Fluxos de Campanha
 * Todas as rotas requerem autenticação
 */

// Listar todos os fluxos
router.get('/', authenticate, campaignFlowsController.listFlows);

// Buscar fluxo por ID
router.get('/:id', authenticate, campaignFlowsController.getFlow);

// Criar novo fluxo
router.post('/', authenticate, campaignFlowsController.createFlow);

// Atualizar fluxo
router.put('/:id', authenticate, campaignFlowsController.updateFlow);

// Deletar fluxo
router.delete('/:id', authenticate, campaignFlowsController.deleteFlow);

// Ativar/Pausar fluxo
router.patch('/:id/status', authenticate, campaignFlowsController.toggleFlowStatus);

// Duplicar fluxo
router.post('/:id/duplicate', authenticate, campaignFlowsController.duplicateFlow);

// Buscar execuções de um fluxo
router.get('/:id/executions', authenticate, campaignFlowsController.getFlowExecutions);

// Estatísticas do fluxo
router.get('/:id/stats', authenticate, campaignFlowsController.getFlowStats);

// Testar fluxo (dry-run)
router.post('/:id/test', authenticate, campaignFlowsController.testFlow);

// Exportar fluxo
router.get('/:id/export', authenticate, campaignFlowsController.exportFlow);

// Importar fluxo
router.post('/import', authenticate, campaignFlowsController.importFlow);

module.exports = router;

