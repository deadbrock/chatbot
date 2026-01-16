/**
 * Rotas para gerenciamento de IA e classificação de intenções
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Configurações
router.get('/config', aiController.getConfig.bind(aiController));
router.put('/config', aiController.updateConfig.bind(aiController));

// Intenções
router.get('/intents', aiController.getIntents.bind(aiController));

// Teste de classificação
router.post('/test', aiController.testClassification.bind(aiController));

// Exemplos de treinamento
router.get('/training-examples', aiController.getTrainingExamples.bind(aiController));
router.post('/training-examples', aiController.saveTrainingExamples.bind(aiController));

// Analytics
router.get('/analytics', aiController.getAnalytics.bind(aiController));
router.get('/logs', aiController.getLogs.bind(aiController));

module.exports = router;

