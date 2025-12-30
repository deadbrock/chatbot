const express = require('express');
const router = express.Router();
const webhooksController = require('../controllers/webhooksController');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

/**
 * ROTAS DE WEBHOOKS
 * Todas as rotas requerem autenticação
 */

// ============================================
// EVENTOS DISPONÍVEIS
// ============================================

/**
 * @route   GET /api/webhooks/events
 * @desc    Lista eventos disponíveis
 * @access  Private
 */
router.get('/events', authenticate, webhooksController.listAvailableEvents);

// ============================================
// ESTATÍSTICAS GLOBAIS
// ============================================

/**
 * @route   GET /api/webhooks/stats/global
 * @desc    Estatísticas globais de webhooks
 * @access  Private (Admin/Manager)
 */
router.get('/stats/global', authenticate, checkPermission('webhooks', 'read'), webhooksController.getGlobalStats);

/**
 * @route   GET /api/webhooks/stats/top-events
 * @desc    Top eventos mais disparados
 * @access  Private (Admin/Manager)
 */
router.get('/stats/top-events', authenticate, checkPermission('webhooks', 'read'), webhooksController.getTopEvents);

/**
 * @route   GET /api/webhooks/stats/top-failures
 * @desc    Webhooks com mais falhas
 * @access  Private (Admin/Manager)
 */
router.get('/stats/top-failures', authenticate, checkPermission('webhooks', 'read'), webhooksController.getTopFailures);

// ============================================
// CRUD DE WEBHOOKS
// ============================================

/**
 * @route   GET /api/webhooks
 * @desc    Lista todos os webhooks
 * @access  Private
 * @query   isActive - Filtrar por status
 * @query   event - Filtrar por evento
 */
router.get('/', authenticate, webhooksController.listWebhooks);

/**
 * @route   POST /api/webhooks
 * @desc    Cria novo webhook
 * @access  Private
 * @body    { name, description, url, method, headers, events, secret, retryAttempts, retryDelay, timeout }
 */
router.post('/', authenticate, webhooksController.createWebhook);

/**
 * @route   GET /api/webhooks/:id
 * @desc    Obtém detalhes de um webhook
 * @access  Private (Owner/Admin)
 */
router.get('/:id', authenticate, webhooksController.getWebhook);

/**
 * @route   PATCH /api/webhooks/:id
 * @desc    Atualiza um webhook
 * @access  Private (Owner/Admin)
 * @body    { name, description, url, method, headers, events, secret, retryAttempts, retryDelay, timeout, isActive }
 */
router.patch('/:id', authenticate, webhooksController.updateWebhook);

/**
 * @route   DELETE /api/webhooks/:id
 * @desc    Deleta um webhook
 * @access  Private (Owner/Admin)
 */
router.delete('/:id', authenticate, webhooksController.deleteWebhook);

// ============================================
// AÇÕES DE WEBHOOK
// ============================================

/**
 * @route   POST /api/webhooks/:id/test
 * @desc    Testa um webhook
 * @access  Private (Owner/Admin)
 */
router.post('/:id/test', authenticate, webhooksController.testWebhook);

/**
 * @route   GET /api/webhooks/:id/logs
 * @desc    Obtém logs de um webhook
 * @access  Private (Owner/Admin)
 * @query   limit - Limite de resultados (default: 50)
 * @query   offset - Offset para paginação (default: 0)
 * @query   status - Filtrar por status (success, failure, timeout)
 * @query   event - Filtrar por evento
 * @query   dateFrom - Data inicial
 * @query   dateTo - Data final
 */
router.get('/:id/logs', authenticate, webhooksController.getWebhookLogs);

/**
 * @route   POST /api/webhooks/:id/retry
 * @desc    Reprocessa webhooks com falhas
 * @access  Private (Owner/Admin)
 */
router.post('/:id/retry', authenticate, webhooksController.retryWebhook);

/**
 * @route   GET /api/webhooks/:id/stats
 * @desc    Obtém estatísticas de um webhook
 * @access  Private (Owner/Admin)
 * @query   dateFrom - Data inicial
 * @query   dateTo - Data final
 */
router.get('/:id/stats', authenticate, webhooksController.getWebhookStats);

/**
 * @route   POST /api/webhooks/:id/reset-stats
 * @desc    Reseta estatísticas de um webhook
 * @access  Private (Owner/Admin)
 */
router.post('/:id/reset-stats', authenticate, webhooksController.resetStats);

module.exports = router;

