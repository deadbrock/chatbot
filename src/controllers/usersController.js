const jwt = require('jsonwebtoken');
const User = require('../models/UserSQL');
const { AGENT_DEPARTMENTS } = require('../constants/agentDepartments');
const { ok, created, fail } = require('../utils/http');
const {
  serializeUser,
  ensureUserProfileSchema,
  deleteAvatarFile,
  ensureAvatarDir
} = require('../services/userProfileService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

async function getProfile(req, res) {
  try {
    await ensureUserProfileSchema();
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user || !user.active) {
      return fail(res, 404, 'Usuário não encontrado');
    }

    return ok(res, serializeUser(user));
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function updateProfile(req, res) {
  const logger = require('../utils/logger');

  try {
    await ensureUserProfileSchema();
    const user = await User.findByPk(req.user.id);
    if (!user || !user.active) {
      return fail(res, 404, 'Usuário não encontrado');
    }

    const { name, email, phone, currentPassword, newPassword } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return fail(res, 400, 'Nome é obrigatório');
      }
      updates.name = trimmedName;
    }

    if (email !== undefined) {
      const trimmedEmail = String(email).trim().toLowerCase();
      if (!trimmedEmail) {
        return fail(res, 400, 'E-mail é obrigatório');
      }
      updates.email = trimmedEmail;
    }

    if (phone !== undefined) {
      updates.phone = String(phone).trim() || null;
    }

    if (newPassword !== undefined && String(newPassword).trim()) {
      if (!currentPassword) {
        return fail(res, 400, 'Informe a senha atual para alterá-la');
      }
      const matches = await user.comparePassword(currentPassword);
      if (!matches) {
        return fail(res, 400, 'Senha atual incorreta');
      }
      if (String(newPassword).trim().length < 6) {
        return fail(res, 400, 'A nova senha deve ter pelo menos 6 caracteres');
      }
      updates.password = String(newPassword).trim();
    }

    await user.update(updates);
    logger.info(`✅ Perfil atualizado: ${user.email}`);

    return ok(res, serializeUser(user));
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return fail(res, 400, 'Este e-mail já está cadastrado no sistema');
    }
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map((e) => e.message).join(', ');
      return fail(res, 400, `Erro de validação: ${messages}`);
    }
    return fail(res, 500, error.message);
  }
}

async function uploadAvatar(req, res) {
  const logger = require('../utils/logger');

  try {
    await ensureUserProfileSchema();
    const user = await User.findByPk(req.user.id);
    if (!user || !user.active) {
      return fail(res, 404, 'Usuário não encontrado');
    }

    if (!req.file) {
      return fail(res, 400, 'Nenhuma imagem enviada');
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    if (user.avatar && user.avatar !== avatarUrl) {
      await deleteAvatarFile(user.avatar);
    }

    await user.update({ avatar: avatarUrl });
    logger.info(`✅ Avatar atualizado: ${user.email}`);

    return ok(res, serializeUser(user));
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function removeAvatar(req, res) {
  const logger = require('../utils/logger');

  try {
    await ensureUserProfileSchema();
    const user = await User.findByPk(req.user.id);
    if (!user || !user.active) {
      return fail(res, 404, 'Usuário não encontrado');
    }

    if (user.avatar) {
      await deleteAvatarFile(user.avatar);
      await user.update({ avatar: null });
      logger.info(`✅ Avatar removido: ${user.email}`);
    }

    return ok(res, serializeUser(user));
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function login(req, res) {
  const logger = require('../utils/logger');
  
  try {
    logger.info('📝 Tentativa de login:', { 
      body: req.body, 
      ip: req.ip, 
      origin: req.headers.origin 
    });
    
    const { email, password } = req.body;

    if (!email || !password) {
      logger.warn('⚠️ Login rejeitado: email ou senha vazios');
      return fail(res, 400, 'Email e senha são obrigatórios');
    }

    const user = await User.getByEmail(email);
    if (!user) {
      logger.warn(`⚠️ Login rejeitado: usuário não encontrado - ${email}`);
      return fail(res, 401, 'Credenciais inválidas');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn(`⚠️ Login rejeitado: senha incorreta - ${email}`);
      return fail(res, 401, 'Credenciais inválidas');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    user.lastLogin = new Date();
    await user.save();

    logger.info(`✅ Login bem-sucedido: ${user.email} (${user.role})`);

    return ok(res, {
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    logger.error('❌ Erro ao processar login:', {
      message: error.message,
      stack: error.stack
    });
    return fail(res, 500, error.message);
  }
}

async function list(req, res) {
  try {
    const { role } = req.query;
    
    const where = { active: true };
    
    // Filtrar por role se especificado (ex: ?role=agent,manager)
    if (role) {
      const roles = role.split(',').map(r => r.trim());
      where.role = roles.length > 1 ? { [require('sequelize').Op.in]: roles } : roles[0];
    }
    
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['name', 'ASC']]
    });
    return ok(res, users);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function availableAgents(req, res) {
  try {
    const { department } = req.query;
    const agents = await User.getAvailableAgents(department);
    return ok(res, agents.map(a => {
      const { password, ...rest } = a.toJSON ? a.toJSON() : a;
      return rest;
    }));
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function create(req, res) {
  const logger = require('../utils/logger');

  try {
    if (req.user?.role === 'manager' && req.body?.role === 'admin') {
      return fail(res, 403, 'Gestores não podem criar usuários admin');
    }

    const user = await User.create(req.body);
    logger.info(`✅ Usuário criado: ${user.email} (${user.role})`);
    return created(res, { id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    // Tratar erro de email duplicado
    if (error.name === 'SequelizeUniqueConstraintError') {
      logger.warn(`⚠️ Tentativa de criar usuário com email duplicado: ${req.body.email}`);
      return fail(res, 400, 'Este email já está cadastrado no sistema');
    }
    
    // Tratar erro de validação
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(e => e.message).join(', ');
      logger.warn(`⚠️ Erro de validação ao criar usuário: ${messages}`);
      return fail(res, 400, `Erro de validação: ${messages}`);
    }
    
    // Outros erros
    logger.error('❌ Erro ao criar usuário:', error);
    return fail(res, 500, error.message);
  }
}

async function getById(req, res) {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user || !user.active) {
      return fail(res, 404, 'Usuário não encontrado');
    }

    return ok(res, user);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function listDepartments(req, res) {
  return ok(res, AGENT_DEPARTMENTS);
}

async function update(req, res) {
  const logger = require('../utils/logger');

  try {
    const user = await User.findByPk(req.params.id);
    if (!user || !user.active) {
      return fail(res, 404, 'Usuário não encontrado');
    }

    if (req.user?.role === 'manager' && user.role === 'admin') {
      return fail(res, 403, 'Gestores não podem editar usuários admin');
    }

    const { name, email, role, status, department, password } = req.body;
    if (req.user?.role === 'manager' && role === 'admin') {
      return fail(res, 403, 'Gestores não podem promover usuários para admin');
    }

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (status !== undefined) updates.status = status;
    if (department !== undefined) updates.department = department || null;
    if (password && String(password).trim()) updates.password = password;

    await user.update(updates);
    logger.info(`✅ Usuário atualizado: ${user.email} (${user.role})`);

    const { password: _pw, ...safeUser } = user.toJSON();
    return ok(res, safeUser);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return fail(res, 400, 'Este email já está cadastrado no sistema');
    }

    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map((e) => e.message).join(', ');
      return fail(res, 400, `Erro de validação: ${messages}`);
    }

    return fail(res, 500, error.message);
  }
}

async function remove(req, res) {
  const logger = require('../utils/logger');

  try {
    const user = await User.findByPk(req.params.id);
    if (!user || !user.active) {
      return fail(res, 404, 'Usuário não encontrado');
    }

    if (req.user?.role === 'manager' && user.role === 'admin') {
      return fail(res, 403, 'Gestores não podem excluir usuários admin');
    }

    if (String(req.user?.id) === String(user.id)) {
      return fail(res, 400, 'Não é possível excluir sua própria conta');
    }

    await user.update({ active: false, status: 'offline' });
    logger.info(`🗑️ Usuário desativado: ${user.email}`);

    return ok(res, { message: 'Atendente excluído com sucesso' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;

    if (['online', 'offline'].includes(status)) {
      return fail(res, 403, 'Status online/offline é definido automaticamente pelo login no painel');
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return fail(res, 404, 'Usuário não encontrado');

    await user.updateStatus(status);
    return ok(res, user.toJSON());
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = {
  login,
  getProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
  list,
  getById,
  listDepartments,
  availableAgents,
  create,
  update,
  remove,
  updateStatus
};


