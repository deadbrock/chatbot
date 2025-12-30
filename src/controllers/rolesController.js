const Role = require('../models/RoleSQL');
const User = require('../models/UserSQL');
const { sendSuccess, sendError, badRequest, notFound, created } = require('../utils/http');

/**
 * Controller de Roles (Papéis)
 * Sistema de controle de acesso baseado em papéis (RBAC)
 */

/**
 * Lista todos os papéis
 * GET /api/roles
 */
async function listRoles(req, res) {
  try {
    const { type, isActive } = req.query;
    
    const where = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    const roles = await Role.findAll({
      where,
      order: [
        ['level', 'DESC'],
        ['name', 'ASC']
      ]
    });
    
    return sendSuccess(res, {
      roles,
      total: roles.length
    });
  } catch (error) {
    console.error('Erro ao listar papéis:', error);
    return sendError(res, 'Erro ao listar papéis');
  }
}

/**
 * Busca um papel por ID
 * GET /api/roles/:id
 */
async function getRole(req, res) {
  try {
    const { id } = req.params;
    
    const role = await Role.findByPk(id);
    
    if (!role) {
      return notFound(res, 'Papel não encontrado');
    }
    
    // Buscar permissões completas (incluindo herdadas)
    const allPermissions = await role.getAllPermissions();
    
    return sendSuccess(res, {
      role: {
        ...role.toJSON(),
        allPermissions
      }
    });
  } catch (error) {
    console.error('Erro ao buscar papel:', error);
    return sendError(res, 'Erro ao buscar papel');
  }
}

/**
 * Cria um novo papel
 * POST /api/roles
 */
async function createRole(req, res) {
  try {
    const {
      name,
      displayName,
      description,
      permissions,
      level,
      inheritsFrom,
      maxUsers,
      restrictions,
      metadata
    } = req.body;
    
    if (!name) {
      return badRequest(res, 'Nome é obrigatório');
    }
    
    if (!displayName) {
      return badRequest(res, 'Nome de exibição é obrigatório');
    }
    
    // Verificar se nome já existe
    const existing = await Role.findOne({ where: { name } });
    if (existing) {
      return badRequest(res, 'Já existe um papel com este nome');
    }
    
    const role = await Role.create({
      name,
      displayName,
      description,
      permissions: permissions || [],
      level: level || 0,
      inheritsFrom,
      type: 'custom',
      maxUsers: maxUsers || 0,
      restrictions: restrictions || {},
      metadata: metadata || {},
      createdBy: req.user?.id
    });
    
    return created(res, {
      role,
      message: 'Papel criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar papel:', error);
    return sendError(res, 'Erro ao criar papel');
  }
}

/**
 * Atualiza um papel
 * PUT /api/roles/:id
 */
async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const {
      displayName,
      description,
      permissions,
      level,
      inheritsFrom,
      isActive,
      maxUsers,
      restrictions,
      metadata
    } = req.body;
    
    const role = await Role.findByPk(id);
    
    if (!role) {
      return notFound(res, 'Papel não encontrado');
    }
    
    if (role.type === 'system') {
      return badRequest(res, 'Não é possível editar papéis do sistema');
    }
    
    await role.update({
      displayName: displayName || role.displayName,
      description: description !== undefined ? description : role.description,
      permissions: permissions || role.permissions,
      level: level !== undefined ? level : role.level,
      inheritsFrom: inheritsFrom !== undefined ? inheritsFrom : role.inheritsFrom,
      isActive: isActive !== undefined ? isActive : role.isActive,
      maxUsers: maxUsers !== undefined ? maxUsers : role.maxUsers,
      restrictions: restrictions || role.restrictions,
      metadata: metadata || role.metadata,
      updatedBy: req.user?.id
    });
    
    return sendSuccess(res, {
      role,
      message: 'Papel atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar papel:', error);
    return sendError(res, 'Erro ao atualizar papel');
  }
}

/**
 * Deleta um papel
 * DELETE /api/roles/:id
 */
async function deleteRole(req, res) {
  try {
    const { id } = req.params;
    
    const role = await Role.findByPk(id);
    
    if (!role) {
      return notFound(res, 'Papel não encontrado');
    }
    
    if (role.type === 'system') {
      return badRequest(res, 'Não é possível deletar papéis do sistema');
    }
    
    // Verificar se há usuários com este papel
    const usersCount = await User.count({ where: { role: role.name } });
    
    if (usersCount > 0) {
      return badRequest(res, `Existem ${usersCount} usuários com este papel. Reatribua-os antes de deletar.`);
    }
    
    await role.destroy();
    
    return sendSuccess(res, {
      message: 'Papel deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar papel:', error);
    return sendError(res, 'Erro ao deletar papel');
  }
}

/**
 * Adiciona permissão a um papel
 * POST /api/roles/:id/permissions
 */
async function addPermission(req, res) {
  try {
    const { id } = req.params;
    const { permission } = req.body;
    
    if (!permission) {
      return badRequest(res, 'Permissão é obrigatória');
    }
    
    const role = await Role.findByPk(id);
    
    if (!role) {
      return notFound(res, 'Papel não encontrado');
    }
    
    await role.addPermission(permission);
    
    return sendSuccess(res, {
      message: 'Permissão adicionada com sucesso',
      role
    });
  } catch (error) {
    console.error('Erro ao adicionar permissão:', error);
    return sendError(res, error.message || 'Erro ao adicionar permissão');
  }
}

/**
 * Remove permissão de um papel
 * DELETE /api/roles/:id/permissions/:permission
 */
async function removePermission(req, res) {
  try {
    const { id, permission } = req.params;
    
    const role = await Role.findByPk(id);
    
    if (!role) {
      return notFound(res, 'Papel não encontrado');
    }
    
    await role.removePermission(permission);
    
    return sendSuccess(res, {
      message: 'Permissão removida com sucesso',
      role
    });
  } catch (error) {
    console.error('Erro ao remover permissão:', error);
    return sendError(res, error.message || 'Erro ao remover permissão');
  }
}

/**
 * Lista permissões disponíveis
 * GET /api/roles/permissions/available
 */
async function listAvailablePermissions(req, res) {
  try {
    const permissions = [
      // Tickets
      { value: 'tickets.read', label: 'Visualizar Tickets', category: 'Tickets' },
      { value: 'tickets.write', label: 'Criar Tickets', category: 'Tickets' },
      { value: 'tickets.update', label: 'Atualizar Tickets', category: 'Tickets' },
      { value: 'tickets.delete', label: 'Deletar Tickets', category: 'Tickets' },
      { value: 'tickets.*', label: 'Todas - Tickets', category: 'Tickets' },
      
      // Contacts
      { value: 'contacts.read', label: 'Visualizar Contatos', category: 'Contatos' },
      { value: 'contacts.write', label: 'Criar Contatos', category: 'Contatos' },
      { value: 'contacts.update', label: 'Atualizar Contatos', category: 'Contatos' },
      { value: 'contacts.delete', label: 'Deletar Contatos', category: 'Contatos' },
      { value: 'contacts.*', label: 'Todas - Contatos', category: 'Contatos' },
      
      // Messages
      { value: 'messages.read', label: 'Visualizar Mensagens', category: 'Mensagens' },
      { value: 'messages.send', label: 'Enviar Mensagens', category: 'Mensagens' },
      { value: 'messages.*', label: 'Todas - Mensagens', category: 'Mensagens' },
      
      // Analytics
      { value: 'analytics.view', label: 'Visualizar Analytics', category: 'Analytics' },
      { value: 'analytics.*', label: 'Todas - Analytics', category: 'Analytics' },
      
      // Reports
      { value: 'reports.view', label: 'Visualizar Relatórios', category: 'Relatórios' },
      { value: 'reports.export', label: 'Exportar Relatórios', category: 'Relatórios' },
      { value: 'reports.*', label: 'Todas - Relatórios', category: 'Relatórios' },
      
      // Agents/Users
      { value: 'agents.view', label: 'Visualizar Atendentes', category: 'Usuários' },
      { value: 'agents.manage', label: 'Gerenciar Atendentes', category: 'Usuários' },
      { value: 'users.read', label: 'Visualizar Usuários', category: 'Usuários' },
      { value: 'users.write', label: 'Criar Usuários', category: 'Usuários' },
      { value: 'users.update', label: 'Atualizar Usuários', category: 'Usuários' },
      { value: 'users.delete', label: 'Deletar Usuários', category: 'Usuários' },
      { value: 'users.*', label: 'Todas - Usuários', category: 'Usuários' },
      
      // Queues
      { value: 'queues.view', label: 'Visualizar Filas', category: 'Filas' },
      { value: 'queues.manage', label: 'Gerenciar Filas', category: 'Filas' },
      { value: 'queues.*', label: 'Todas - Filas', category: 'Filas' },
      
      // Tags
      { value: 'tags.read', label: 'Visualizar Tags', category: 'Tags' },
      { value: 'tags.write', label: 'Criar Tags', category: 'Tags' },
      { value: 'tags.update', label: 'Atualizar Tags', category: 'Tags' },
      { value: 'tags.delete', label: 'Deletar Tags', category: 'Tags' },
      { value: 'tags.*', label: 'Todas - Tags', category: 'Tags' },
      
      // Quick Replies
      { value: 'quick-replies.read', label: 'Visualizar Respostas Rápidas', category: 'Respostas Rápidas' },
      { value: 'quick-replies.use', label: 'Usar Respostas Rápidas', category: 'Respostas Rápidas' },
      { value: 'quick-replies.write', label: 'Criar Respostas Rápidas', category: 'Respostas Rápidas' },
      { value: 'quick-replies.update', label: 'Atualizar Respostas Rápidas', category: 'Respostas Rápidas' },
      { value: 'quick-replies.delete', label: 'Deletar Respostas Rápidas', category: 'Respostas Rápidas' },
      { value: 'quick-replies.*', label: 'Todas - Respostas Rápidas', category: 'Respostas Rápidas' },
      
      // Campaigns
      { value: 'campaigns.view', label: 'Visualizar Campanhas', category: 'Campanhas' },
      { value: 'campaigns.create', label: 'Criar Campanhas', category: 'Campanhas' },
      { value: 'campaigns.send', label: 'Enviar Campanhas', category: 'Campanhas' },
      { value: 'campaigns.*', label: 'Todas - Campanhas', category: 'Campanhas' },
      
      // Settings
      { value: 'settings.view', label: 'Visualizar Configurações', category: 'Configurações' },
      { value: 'settings.update', label: 'Atualizar Configurações', category: 'Configurações' },
      { value: 'settings.*', label: 'Todas - Configurações', category: 'Configurações' },
      
      // API
      { value: 'api.manage', label: 'Gerenciar API Keys', category: 'API' },
      { value: 'api.*', label: 'Todas - API', category: 'API' },
      
      // Connections
      { value: 'connections.view', label: 'Visualizar Conexões', category: 'Conexões' },
      { value: 'connections.manage', label: 'Gerenciar Conexões', category: 'Conexões' },
      { value: 'connections.*', label: 'Todas - Conexões', category: 'Conexões' },
      
      // Roles
      { value: 'roles.view', label: 'Visualizar Papéis', category: 'Papéis' },
      { value: 'roles.manage', label: 'Gerenciar Papéis', category: 'Papéis' },
      { value: 'roles.*', label: 'Todas - Papéis', category: 'Papéis' },
      
      // Admin
      { value: '*', label: '⚠️ SUPER ADMIN (Todas as Permissões)', category: 'Admin' }
    ];
    
    // Agrupar por categoria
    const grouped = {};
    permissions.forEach(perm => {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    });
    
    return sendSuccess(res, {
      permissions,
      grouped,
      total: permissions.length
    });
  } catch (error) {
    console.error('Erro ao listar permissões:', error);
    return sendError(res, 'Erro ao listar permissões');
  }
}

/**
 * Verifica se um papel tem uma permissão
 * GET /api/roles/:id/check/:permission
 */
async function checkPermission(req, res) {
  try {
    const { id, permission } = req.params;
    
    const role = await Role.findByPk(id);
    
    if (!role) {
      return notFound(res, 'Papel não encontrado');
    }
    
    const hasPermission = role.hasPermission(permission);
    
    return sendSuccess(res, {
      role: role.name,
      permission,
      hasPermission
    });
  } catch (error) {
    console.error('Erro ao verificar permissão:', error);
    return sendError(res, 'Erro ao verificar permissão');
  }
}

/**
 * Lista usuários de um papel
 * GET /api/roles/:id/users
 */
async function getRoleUsers(req, res) {
  try {
    const { id } = req.params;
    
    const role = await Role.findByPk(id);
    
    if (!role) {
      return notFound(res, 'Papel não encontrado');
    }
    
    const users = await User.findAll({
      where: { role: role.name },
      attributes: ['id', 'name', 'email', 'isActive', 'createdAt']
    });
    
    return sendSuccess(res, {
      role: role.name,
      users,
      total: users.length,
      maxUsers: role.maxUsers
    });
  } catch (error) {
    console.error('Erro ao listar usuários do papel:', error);
    return sendError(res, 'Erro ao listar usuários do papel');
  }
}

module.exports = {
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
};

