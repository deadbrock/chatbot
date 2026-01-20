const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

/**
 * Middleware de autenticação JWT
 */
function authMiddleware(req, res, next) {
  try {
    // Obter token do header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('⚠️ [authMiddleware] Token não fornecido:', { path: req.path });
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido'
      });
    }

    // Formato: "Bearer TOKEN"
    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
      return res.status(401).json({
        success: false,
        error: 'Formato de token inválido'
      });
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      return res.status(401).json({
        success: false,
        error: 'Token mal formatado'
      });
    }

    // Verificar token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        logger.warn('⚠️ [authMiddleware] Token inválido:', {
          path: req.path,
          error: err.message,
          errorName: err.name
        });
        return res.status(401).json({
          success: false,
          error: 'Token inválido ou expirado'
        });
      }

      req.user = decoded;
        });
      }

      // Adicionar dados do usuário à requisição
      req.user = decoded;
      next();
    });

  } catch (error) {
    logger.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * Middleware de verificação de role
 */
function checkRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão'
      });
    }

    next();
  };
}

module.exports = authMiddleware;
module.exports.authenticate = authMiddleware;
module.exports.checkRole = checkRole;

