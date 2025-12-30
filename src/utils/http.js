/**
 * Utilitários para respostas HTTP padronizadas
 */

/**
 * Envia resposta de sucesso
 * @param {Object} res - Response object do Express
 * @param {*} data - Dados a serem enviados
 * @param {string} message - Mensagem opcional
 * @param {number} statusCode - Código HTTP (padrão: 200)
 */
function sendSuccess(res, data, message = null, statusCode = 200) {
  const response = {
    success: true,
    data
  };
  
  if (message) {
    response.message = message;
  }
  
  res.status(statusCode).json(response);
}

/**
 * Envia resposta de erro
 * @param {Object} res - Response object do Express
 * @param {Error|string} error - Erro ou mensagem de erro
 * @param {number} statusCode - Código HTTP (padrão: 500)
 */
function sendError(res, error, statusCode = 500) {
  console.error('Erro na requisição:', error);
  
  const response = {
    success: false,
    message: typeof error === 'string' ? error : error.message || 'Erro interno do servidor'
  };
  
  if (error.stack && process.env.NODE_ENV === 'development') {
    response.error = error.stack;
  }
  
  res.status(statusCode).json(response);
}

/**
 * Envia resposta de bad request (400)
 * @param {Object} res - Response object do Express
 * @param {string} message - Mensagem de erro
 */
function badRequest(res, message) {
  res.status(400).json({
    success: false,
    message
  });
}

/**
 * Envia resposta de não encontrado (404)
 * @param {Object} res - Response object do Express
 * @param {string} message - Mensagem de erro
 */
function notFound(res, message = 'Recurso não encontrado') {
  res.status(404).json({
    success: false,
    message
  });
}

/**
 * Envia resposta de não autorizado (401)
 * @param {Object} res - Response object do Express
 * @param {string} message - Mensagem de erro
 */
function unauthorized(res, message = 'Não autorizado') {
  res.status(401).json({
    success: false,
    message
  });
}

/**
 * Envia resposta de proibido (403)
 * @param {Object} res - Response object do Express
 * @param {string} message - Mensagem de erro
 */
function forbidden(res, message = 'Acesso negado') {
  res.status(403).json({
    success: false,
    message
  });
}

/**
 * Envia resposta de criado (201)
 * @param {Object} res - Response object do Express
 * @param {*} data - Dados criados
 * @param {string} message - Mensagem opcional
 */
function created(res, data, message = 'Recurso criado com sucesso') {
  res.status(201).json({
    success: true,
    message,
    data
  });
}

/**
 * Alias para sendSuccess (compatibilidade)
 * @param {Object} res - Response object do Express
 * @param {*} data - Dados a serem enviados
 * @param {string} message - Mensagem opcional
 */
function ok(res, data, message = null) {
  return sendSuccess(res, data, message, 200);
}

/**
 * Alias para sendError (compatibilidade)
 * @param {Object} res - Response object do Express
 * @param {number} statusCode - Código HTTP
 * @param {string} message - Mensagem de erro
 */
function fail(res, statusCode, message) {
  return sendError(res, message, statusCode);
}

/**
 * Objeto httpResponse para compatibilidade
 */
const httpResponse = {
  ok: (res, data, message = null) => sendSuccess(res, data, message, 200),
  created: (res, data, message = null) => sendSuccess(res, data, message, 201),
  error: (res, message, statusCode = 500) => sendError(res, message, statusCode),
  badRequest: (res, message) => badRequest(res, message),
  notFound: (res, message) => notFound(res, message),
  unauthorized: (res, message) => unauthorized(res, message),
  forbidden: (res, message) => forbidden(res, message)
};

module.exports = {
  sendSuccess,
  sendError,
  badRequest,
  notFound,
  unauthorized,
  forbidden,
  created,
  ok,
  fail,
  httpResponse
};
