const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  listConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  connectInstance,
  disconnectInstance,
  getQRCode,
  getConnectionStats,
  getConnectionLogs,
  setDefaultConnection,
  testWebhook
} = require('../controllers/connectionsController');

/**
 * Rotas de Conexões WhatsApp
 * Todas as rotas requerem autenticação
 */

// Listar conexões
router.get('/', authenticate, listConnections);

// Buscar conexão específica
router.get('/:id', authenticate, getConnection);

// Criar nova conexão
router.post('/', authenticate, createConnection);

// Atualizar conexão
router.put('/:id', authenticate, updateConnection);

// Deletar conexão
router.delete('/:id', authenticate, deleteConnection);

// Conectar instância
router.post('/:id/connect', authenticate, connectInstance);

// Desconectar instância
router.post('/:id/disconnect', authenticate, disconnectInstance);

// Buscar QR Code
router.get('/:id/qrcode', authenticate, getQRCode);

// Buscar estatísticas
router.get('/:id/stats', authenticate, getConnectionStats);

// Buscar logs
router.get('/:id/logs', authenticate, getConnectionLogs);

// Definir como padrão
router.post('/:id/set-default', authenticate, setDefaultConnection);

// Testar webhook
router.post('/:id/test-webhook', authenticate, testWebhook);

module.exports = router;

