const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * POST /api/webhook
 * Recebe webhooks de sistemas externos
 */
router.post('/', async (req, res) => {
  try {
    logger.info('📥 Webhook recebido:', req.body);

    // Processar webhook conforme necessário
    // Exemplo: integração com CRM, ERP, etc.

    res.json({
      success: true,
      message: 'Webhook recebido'
    });

  } catch (error) {
    logger.error('Erro ao processar webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/webhook/test
 * Testa webhook
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook funcionando'
  });
});

module.exports = router;

