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

/**
 * POST /api/whatsapp/force-reconnect
 * Força reconexão (quando isReady=false)
 * TEMPORARIAMENTE SEM AUTENTICAÇÃO PARA DEBUG
 */
router.post('/force-reconnect', whatsappController.forceReconnect);

/**
 * POST /api/whatsapp/clear-session
 * Limpa sessão e força novo QR Code
 */
router.post('/clear-session', whatsappController.clearSession);

/**
 * POST /api/whatsapp/sync
 * Sincroniza conversas do WhatsApp conectado
 */
router.post('/sync', authenticate, whatsappController.syncConversations);

/**
 * POST /api/whatsapp/sync-on-login
 * Sincronização automática ao entrar no painel
 */
router.post('/sync-on-login', authenticate, whatsappController.syncOnLogin);

/**
 * GET /api/whatsapp/sync/status
 * Progresso da sincronização em tempo real
 */
router.get('/sync/status', authenticate, whatsappController.getSyncStatus);

module.exports = router;

