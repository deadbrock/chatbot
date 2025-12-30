const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  listApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  getApiKeyLogs,
  getApiKeyStats,
  verifyApiKey
} = require('../controllers/apiKeysController');

/**
 * Rotas de API Keys
 * Todas as rotas requerem autenticação
 */

// Listar chaves
router.get('/', authenticate, listApiKeys);

// Buscar chave específica
router.get('/:id', authenticate, getApiKey);

// Criar nova chave
router.post('/', authenticate, createApiKey);

// Atualizar chave
router.put('/:id', authenticate, updateApiKey);

// Revogar chave
router.post('/:id/revoke', authenticate, revokeApiKey);

// Deletar chave
router.delete('/:id', authenticate, deleteApiKey);

// Buscar logs
router.get('/:id/logs', authenticate, getApiKeyLogs);

// Buscar estatísticas
router.get('/:id/stats', authenticate, getApiKeyStats);

// Verificar chave (não requer autenticação - usado para validação)
router.post('/verify', verifyApiKey);

module.exports = router;

