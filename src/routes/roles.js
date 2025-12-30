const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  addPermission,
  removePermission,
  listAvailablePermissions,
  checkPermission,
  getRoleUsers
} = require('../controllers/rolesController');

/**
 * Rotas de Roles (Papéis)
 * Todas as rotas requerem autenticação
 */

// Listar papéis
router.get('/', authenticate, listRoles);

// Listar permissões disponíveis
router.get('/permissions/available', authenticate, listAvailablePermissions);

// Buscar papel específico
router.get('/:id', authenticate, getRole);

// Criar novo papel
router.post('/', authenticate, createRole);

// Atualizar papel
router.put('/:id', authenticate, updateRole);

// Deletar papel
router.delete('/:id', authenticate, deleteRole);

// Adicionar permissão
router.post('/:id/permissions', authenticate, addPermission);

// Remover permissão
router.delete('/:id/permissions/:permission', authenticate, removePermission);

// Verificar permissão
router.get('/:id/check/:permission', authenticate, checkPermission);

// Listar usuários do papel
router.get('/:id/users', authenticate, getRoleUsers);

module.exports = router;

