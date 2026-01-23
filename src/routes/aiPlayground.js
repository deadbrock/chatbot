const express = require('express');
const router = express.Router();
const aiPlaygroundController = require('../controllers/aiPlaygroundController');
const { authenticate, checkRole } = require('../middleware/auth');

/**
 * Rotas para AI Playground (Treinamento e Testes)
 * Todas as rotas requerem autenticação e permissão de administrador
 */

// Testar mensagem com a IA
router.post('/test', authenticate, checkRole('admin', 'manager'), aiPlaygroundController.testMessage);

// Salvar exemplo de treinamento
router.post('/examples', authenticate, checkRole('admin', 'manager'), aiPlaygroundController.saveTrainingExample);

// Listar exemplos de treinamento
router.get('/examples', authenticate, checkRole('admin', 'manager'), aiPlaygroundController.getTrainingExamples);

// Deletar exemplo de treinamento
router.delete('/examples/:id', authenticate, checkRole('admin', 'manager'), aiPlaygroundController.deleteTrainingExample);

// Obter estatísticas de intenções
router.get('/stats', authenticate, checkRole('admin', 'manager'), aiPlaygroundController.getIntentStats);

// Configurações da IA
router.get('/config', authenticate, checkRole('admin', 'manager'), aiPlaygroundController.getConfig);
router.post('/config', authenticate, checkRole('admin', 'manager'), aiPlaygroundController.saveConfig);
router.post('/config/reset', authenticate, checkRole('admin', 'manager'), aiPlaygroundController.resetConfig);

module.exports = router;

