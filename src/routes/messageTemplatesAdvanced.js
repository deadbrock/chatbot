const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const templatesController = require('../controllers/messageTemplatesAdvancedController');

// Aplicar autenticação a todas as rotas
router.use(authenticate);

/**
 * Rotas de Templates de Mensagem Avançados
 * Sistema completo de templates com variáveis e condições
 */

// CRUD básico
router.get('/', templatesController.getAllTemplates);
router.get('/stats', templatesController.getTemplatesStats);
router.get('/:id', templatesController.getTemplateById);
router.get('/slug/:slug', templatesController.getTemplateBySlug);
router.post('/', templatesController.createTemplate);
router.put('/:id', templatesController.updateTemplate);
router.delete('/:id', templatesController.deleteTemplate);

// Ações especiais
router.post('/:id/render', templatesController.renderTemplate);
router.post('/:id/approve', templatesController.approveTemplate);
router.post('/:id/duplicate', templatesController.duplicateTemplate);

module.exports = router;

