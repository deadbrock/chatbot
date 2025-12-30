const SessionManager = require('../services/sessionManager');
const { ok, fail } = require('../utils/http');

const sessionManager = new SessionManager();

async function list(req, res) {
  try {
    const sessions = await sessionManager.getActiveSessions();
    return ok(res, sessions);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function statsSummary(req, res) {
  try {
    const stats = await sessionManager.getStats();
    return ok(res, stats);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function get(req, res) {
  try {
    const session = await sessionManager.getSession(req.params.userId);
    if (!session) return fail(res, 404, 'Sessão não encontrada');
    return ok(res, session);
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

async function remove(req, res) {
  try {
    await sessionManager.expireSession(req.params.userId);
    return ok(res, { message: 'Sessão expirada com sucesso' });
  } catch (error) {
    return fail(res, 500, error.message);
  }
}

module.exports = { list, statsSummary, get, remove };


