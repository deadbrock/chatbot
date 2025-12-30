const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

/**
 * ================================================================================
 * FASE 6D: ROTAS - ANÁLISE DE CONVERSAS
 * ================================================================================
 */

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * GET /api/conversation/analyze/:ticketId
 * Analisa uma conversa específica
 */
router.get(
  '/analyze/:ticketId',
  requirePermission('reports:view'),
  conversationController.analyzeConversation
);

/**
 * GET /api/conversation/batch
 * Analisa múltiplas conversas em lote
 */
router.get(
  '/batch',
  requirePermission('reports:view'),
  conversationController.analyzeBatch
);

/**
 * GET /api/conversation/patterns
 * Identifica padrões em conversas
 */
router.get(
  '/patterns',
  requirePermission('reports:view'),
  conversationController.identifyPatterns
);

module.exports = router;

