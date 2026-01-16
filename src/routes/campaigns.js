const express = require('express');
const router = express.Router();
const campaignsController = require('../controllers/campaignsController');

/**
 * Rotas de Campanhas
 * Sistema completo de mensagens em massa
 * 
 * Nota: A autenticação já é aplicada em src/routes/index.js
 */

// CRUD básico
router.get('/', campaignsController.getAllCampaigns);
router.get('/:id', campaignsController.getCampaignById);
router.post('/', campaignsController.createCampaign);
router.put('/:id', campaignsController.updateCampaign);
router.delete('/:id', campaignsController.deleteCampaign);

// Controle de envio
router.post('/:id/start', campaignsController.startCampaign);
router.post('/:id/pause', campaignsController.pauseCampaign);
router.post('/:id/cancel', campaignsController.cancelCampaign);

// Estatísticas e relatórios
router.get('/:id/stats', campaignsController.getCampaignStats);
router.get('/:id/contacts', campaignsController.getCampaignContacts);

// Ações especiais
router.post('/:id/duplicate', campaignsController.duplicateCampaign);
router.post('/:id/test', campaignsController.testCampaign);

module.exports = router;

