const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  validateFlow,
  publishFlow,
  pauseFlow,
  cloneFlow,
  createVersion,
  exportFlow,
  importFlow,
  getNodesLibrary,
  getTemplates,
  testFlow
} = require('../controllers/visualFlowsController');

/**
 * Rotas de Fluxos Visuais
 * Editor visual drag & drop
 */

// ==================== FLUXOS ====================

// Listar fluxos
router.get('/', authenticate, listFlows);

// Buscar biblioteca de nodes
router.get('/nodes/library', authenticate, getNodesLibrary);

// Buscar templates públicos
router.get('/templates', authenticate, getTemplates);

// Importar fluxo
router.post('/import', authenticate, requirePermission('flows.write'), importFlow);

// Buscar fluxo específico
router.get('/:id', authenticate, getFlow);

// Criar novo fluxo
router.post('/', authenticate, requirePermission('flows.write'), createFlow);

// Atualizar fluxo
router.put('/:id', authenticate, requirePermission('flows.write'), updateFlow);

// Deletar fluxo
router.delete('/:id', authenticate, requirePermission('flows.delete'), deleteFlow);

// ==================== AÇÕES ====================

// Validar fluxo
router.post('/:id/validate', authenticate, validateFlow);

// Publicar fluxo (ativar)
router.post('/:id/publish', authenticate, requirePermission('flows.publish'), publishFlow);

// Pausar fluxo
router.post('/:id/pause', authenticate, requirePermission('flows.publish'), pauseFlow);

// Clonar fluxo
router.post('/:id/clone', authenticate, requirePermission('flows.write'), cloneFlow);

// Criar nova versão
router.post('/:id/version', authenticate, requirePermission('flows.write'), createVersion);

// Exportar fluxo
router.get('/:id/export', authenticate, exportFlow);

// Testar fluxo
router.post('/:id/test', authenticate, testFlow);

module.exports = router;

