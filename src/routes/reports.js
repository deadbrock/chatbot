const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

/**
 * ROTAS DE RELATÓRIOS
 * Todas as rotas requerem autenticação
 */

// ============================================
// CRUD DE RELATÓRIOS
// ============================================

/**
 * @route   GET /api/reports
 * @desc    Lista todos os relatórios do usuário
 * @access  Private
 * @query   type - Filtrar por tipo
 * @query   status - Filtrar por status
 * @query   includePublic - Incluir relatórios públicos (default: true)
 */
router.get('/', authenticate, reportsController.listReports);

/**
 * @route   POST /api/reports
 * @desc    Cria novo relatório
 * @access  Private
 * @body    { name, description, type, filters, schedule, format, recipients, isPublic, allowedUsers }
 */
router.post('/', authenticate, reportsController.createReport);

/**
 * @route   GET /api/reports/stats
 * @desc    Estatísticas de relatórios
 * @access  Private (Admin/Manager)
 */
router.get('/stats', authenticate, checkPermission('reports', 'read'), reportsController.getStats);

/**
 * @route   GET /api/reports/history
 * @desc    Histórico de relatórios gerados
 * @access  Private
 * @query   limit - Limite de resultados (default: 50)
 * @query   offset - Offset para paginação (default: 0)
 */
router.get('/history', authenticate, reportsController.getReportsHistory);

/**
 * @route   POST /api/reports/custom-query
 * @desc    Gera relatório customizado ad-hoc (não salvo)
 * @access  Private
 * @body    { type, filters, format }
 */
router.post('/custom-query', authenticate, reportsController.customQuery);

/**
 * @route   GET /api/reports/download-temp
 * @desc    Download de arquivo temporário
 * @access  Private
 * @query   file - Nome do arquivo
 */
router.get('/download-temp', authenticate, reportsController.downloadTemp);

/**
 * @route   GET /api/reports/:id
 * @desc    Obtém detalhes de um relatório
 * @access  Private
 */
router.get('/:id', authenticate, reportsController.getReport);

/**
 * @route   PATCH /api/reports/:id
 * @desc    Atualiza um relatório
 * @access  Private (Owner/Admin)
 * @body    { name, description, filters, schedule, format, recipients, status, isPublic, allowedUsers }
 */
router.patch('/:id', authenticate, reportsController.updateReport);

/**
 * @route   DELETE /api/reports/:id
 * @desc    Deleta um relatório
 * @access  Private (Owner/Admin)
 */
router.delete('/:id', authenticate, reportsController.deleteReport);

/**
 * @route   POST /api/reports/:id/generate
 * @desc    Gera um relatório manualmente
 * @access  Private
 * @body    { format } - Opcional: pdf|excel|csv|json
 */
router.post('/:id/generate', authenticate, reportsController.generateReport);

/**
 * @route   GET /api/reports/:id/download
 * @desc    Download de relatório gerado
 * @access  Private
 * @query   file - Nome do arquivo
 */
router.get('/:id/download', authenticate, reportsController.downloadReport);

// ============================================
// EXPORTAÇÕES DIRETAS
// ============================================

/**
 * @route   POST /api/reports/export/tickets
 * @desc    Exporta tickets em formato específico
 * @access  Private
 * @body    { format, filters }
 */
router.post('/export/tickets', authenticate, reportsController.exportTickets);

/**
 * @route   POST /api/reports/export/contacts
 * @desc    Exporta contatos em formato específico
 * @access  Private
 * @body    { format, includeStats }
 */
router.post('/export/contacts', authenticate, reportsController.exportContacts);

module.exports = router;

