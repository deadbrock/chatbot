const jwt = require('jsonwebtoken');
const User = require('../models/UserSQL');
const { ok, created, fail } = require('../utils/http');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.getByEmail(email);
    if (!user) return fail(res, 401, 'Credenciais inválidas');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return fail(res, 401, 'Credenciais inválidas');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    user.lastLogin = new Date();
    await user.save();

    return ok(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function list(req, res) {
  try {
    const users = await User.findAll({
      where: { active: true },
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
  try {
    const user = await User.create(req.body);
    return created(res, { id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return fail(res, 404, 'Usuário não encontrado');

    await user.updateStatus(status);
    return ok(res, user.toJSON());
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = { login, list, availableAgents, create, updateStatus };


