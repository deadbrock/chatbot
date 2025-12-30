const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { authenticate } = require('../middleware/auth');

/**
 * Rotas para gerenciar conexão WhatsApp
 */

/**
 * GET /api/whatsapp/status
 * Verifica status da conexão
 */
router.get('/status', whatsappController.getStatus);

/**
 * GET /api/whatsapp/qrcode
 * Obtém QR Code para escanear
 */
router.get('/qrcode', whatsappController.getQRCode);

/**
 * POST /api/whatsapp/connect
 * Inicia nova conexão (público para primeira conexão)
 */
router.post('/connect', whatsappController.connect);

/**
 * POST /api/whatsapp/disconnect
 * Desconecta WhatsApp
 */
router.post('/disconnect', authenticate, whatsappController.disconnect);

/**
 * POST /api/whatsapp/restart
 * Reinicia conexão
 */
router.post('/restart', authenticate, whatsappController.restart);

module.exports = router;

