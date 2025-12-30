const Role = require('../models/RoleSQL');
const User = require('../models/UserSQL');

/**
 * Middleware RBAC (Role-Based Access Control)
 * Controle de acesso baseado em papéis e permissões
 */

/**
 * Verifica se o usuário tem uma permissão específica
 * @param {string} permission - Permissão necessária (ex: 'tickets.write')
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      // Verificar se usuário está autenticado
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado'
        });
      }
      
      // Buscar usuário completo
      const user = await User.findByPk(req.user.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuário inativo ou não encontrado'
        });
      }
      
      // Buscar papel do usuário
      const role = await Role.findOne({
        where: { name: user.role }
      });
      
      if (!role || !role.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Papel não encontrado ou inativo'
        });
      }
      
      // Verificar permissão
      const hasPermission = role.hasPermission(permission);
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Você não tem permissão para: ${permission}`,
          required: permission
        });
      }
      
      // Anexar papel ao request para uso posterior
      req.role = role;
      
      next();
    } catch (error) {
      console.error('Erro no middleware RBAC:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões'
      });
    }
  };
}

/**
 * Verifica se o usuário tem TODAS as permissões especificadas
 * @param {string[]} permissions - Array de permissões necessárias
 */
function requireAllPermissions(permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado'
        });
      }
      
      const user = await User.findByPk(req.user.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuário inativo ou não encontrado'
        });
      }
      
      const role = await Role.findOne({
        where: { name: user.role }
      });
      
      if (!role || !role.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Papel não encontrado ou inativo'
        });
      }
      
      // Verificar todas as permissões
      const missingPermissions = permissions.filter(perm => !role.hasPermission(perm));
      
      if (missingPermissions.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem todas as permissões necessárias',
          missing: missingPermissions
        });
      }
      
      req.role = role;
      next();
    } catch (error) {
      console.error('Erro no middleware RBAC:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões'
      });
    }
  };
}

/**
 * Verifica se o usuário tem QUALQUER UMA das permissões especificadas
 * @param {string[]} permissions - Array de permissões (basta ter uma)
 */
function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado'
        });
      }
      
      const user = await User.findByPk(req.user.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuário inativo ou não encontrado'
        });
      }
      
      const role = await Role.findOne({
        where: { name: user.role }
      });
      
      if (!role || !role.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Papel não encontrado ou inativo'
        });
      }
      
      // Verificar se tem alguma das permissões
      const hasAnyPermission = permissions.some(perm => role.hasPermission(perm));
      
      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem nenhuma das permissões necessárias',
          required: permissions
        });
      }
      
      req.role = role;
      next();
    } catch (error) {
      console.error('Erro no middleware RBAC:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões'
      });
    }
  };
}

/**
 * Verifica se o usuário tem um papel específico
 * @param {string|string[]} roles - Papel(is) necessário(s)
 */
function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado'
        });
      }
      
      const user = await User.findByPk(req.user.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuário inativo ou não encontrado'
        });
      }
      
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem o papel necessário para acessar este recurso',
          required: allowedRoles
        });
      }
      
      const role = await Role.findOne({
        where: { name: user.role }
      });
      
      req.role = role;
      next();
    } catch (error) {
      console.error('Erro no middleware RBAC:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar papel'
      });
    }
  };
}

/**
 * Verifica se o usuário é admin
 */
function requireAdmin() {
  return requireRole('admin');
}

/**
 * Verifica nível hierárquico mínimo
 * @param {number} minLevel - Nível mínimo necessário
 */
function requireLevel(minLevel) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado'
        });
      }
      
      const user = await User.findByPk(req.user.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuário inativo ou não encontrado'
        });
      }
      
      const role = await Role.findOne({
        where: { name: user.role }
      });
      
      if (!role || !role.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Papel não encontrado ou inativo'
        });
      }
      
      if (role.level < minLevel) {
        return res.status(403).json({
          success: false,
          message: 'Seu nível de acesso é insuficiente',
          yourLevel: role.level,
          required: minLevel
        });
      }
      
      req.role = role;
      next();
    } catch (error) {
      console.error('Erro no middleware RBAC:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar nível'
      });
    }
  };
}

/**
 * Middleware para verificar se usuário pode acessar recursos próprios ou de outros
 * Útil para rotas como /users/:id onde um usuário pode ver a si mesmo, mas admin pode ver todos
 */
function canAccessResource(resourceIdParam = 'id') {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado'
        });
      }
      
      const user = await User.findByPk(req.user.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuário inativo ou não encontrado'
        });
      }
      
      const role = await Role.findOne({
        where: { name: user.role }
      });
      
      if (!role || !role.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Papel não encontrado ou inativo'
        });
      }
      
      const resourceId = req.params[resourceIdParam];
      
      // Se é admin ou tem permissão *.*, pode acessar qualquer recurso
      if (role.hasPermission('*') || role.hasPermission('users.*')) {
        req.role = role;
        req.canAccessAny = true;
        return next();
      }
      
      // Se não é admin, só pode acessar recursos próprios
      if (resourceId !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'Você só pode acessar seus próprios recursos'
        });
      }
      
      req.role = role;
      req.canAccessAny = false;
      next();
    } catch (error) {
      console.error('Erro no middleware RBAC:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar acesso ao recurso'
      });
    }
  };
}

module.exports = {
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireRole,
  requireAdmin,
  requireLevel,
  canAccessResource,
  // Alias para compatibilidade
  checkPermission: requirePermission,
  authorize: requireRole
};

