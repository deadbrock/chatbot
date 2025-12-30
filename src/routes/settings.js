const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  listSettings,
  listCategories,
  getByCategory,
  getSetting,
  getSettingValue,
  updateSetting,
  bulkUpdateSettings,
  resetSetting,
  getSettingHistory,
  exportSettings,
  importSettings
} = require('../controllers/settingsController');

/**
 * Rotas de Configurações do Sistema
 * Todas as rotas requerem autenticação
 */

// Listar configurações
router.get('/', authenticate, listSettings);

// Listar categorias
router.get('/categories', authenticate, listCategories);

// Exportar configurações
router.get('/export', authenticate, exportSettings);

// Atualizar múltiplas configurações
router.put('/bulk', authenticate, bulkUpdateSettings);

// Importar configurações
router.post('/import', authenticate, importSettings);

// Buscar configurações por categoria
router.get('/category/:category', authenticate, getByCategory);

// Buscar configuração específica
router.get('/:key', authenticate, getSetting);

// Buscar valor de configuração
router.get('/:key/value', authenticate, getSettingValue);

// Atualizar configuração
router.put('/:key', authenticate, updateSetting);

// Restaurar configuração para padrão
router.post('/:key/reset', authenticate, resetSetting);

// Buscar histórico de alterações
router.get('/:key/history', authenticate, getSettingHistory);

module.exports = router;

