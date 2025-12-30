const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

/**
 * Modelo de Chaves de API
 * Gerenciamento de chaves para integração externa
 */
const ApiKey = sequelize.define('ApiKey', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome/descrição da chave'
  },
  
  // Chave (hash)
  key: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: 'Hash SHA256 da chave'
  },
  
  // Prefixo (para identificação visual)
  prefix: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: 'Prefixo da chave (ex: pk_live_)'
  },
  
  // Tipo
  type: {
    type: DataTypes.ENUM('production', 'sandbox', 'webhook', 'integration'),
    defaultValue: 'production',
    comment: 'Tipo da chave'
  },
  
  // Permissões
  permissions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de permissões'
  },
  // Exemplo: ['tickets.read', 'tickets.write', 'contacts.read', 'messages.send']
  
  // Escopo
  scopes: {
    type: DataTypes.JSON,
    defaultValue: {
      endpoints: [],
      ipWhitelist: [],
      rateLimit: 1000
    },
    comment: 'Configurações de escopo'
  },
  
  // Restrições de IP
  ipRestrictions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Lista de IPs permitidos (whitelist)'
  },
  
  // Rate limiting
  rateLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 1000,
    comment: 'Requisições por hora'
  },
  
  rateLimitWindow: {
    type: DataTypes.INTEGER,
    defaultValue: 3600,
    comment: 'Janela do rate limit em segundos'
  },
  
  // Uso
  totalRequests: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de requisições'
  },
  
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última utilização'
  },
  
  lastUsedIp: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Último IP usado'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'revoked', 'expired'),
    defaultValue: 'active',
    comment: 'Status da chave'
  },
  
  // Validade
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de expiração'
  },
  
  // Webhook (se aplicável)
  webhookUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL do webhook'
  },
  
  webhookSecret: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Secret do webhook para validação'
  },
  
  webhookEvents: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Eventos do webhook'
  },
  
  // Logs
  accessLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de acessos (últimos 50)'
  },
  
  errorLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Log de erros'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Criado por (user ID)'
  },
  
  revokedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Revogado por (user ID)'
  },
  
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de revogação'
  },
  
  revokedReason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Motivo da revogação'
  }
}, {
  tableName: 'api_keys',
  timestamps: true,
  indexes: [
    { fields: ['key'], unique: true },
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['createdBy'] },
    { fields: ['expiresAt'] }
  ],
  hooks: {
    // Antes de criar, gerar hash da chave
    beforeCreate: (apiKey) => {
      if (!apiKey.prefix) {
        apiKey.prefix = generatePrefix(apiKey.type);
      }
    }
  }
});

/**
 * Gera uma nova chave de API
 */
ApiKey.generateKey = function(type = 'production') {
  const prefix = generatePrefix(type);
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const fullKey = `${prefix}${randomBytes}`;
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex');
  
  return {
    fullKey, // Retornar para o usuário (só é mostrado uma vez)
    hash,    // Armazenar no banco
    prefix
  };
};

/**
 * Verifica se uma chave é válida
 */
ApiKey.verifyKey = async function(keyString) {
  const hash = crypto.createHash('sha256').update(keyString).digest('hex');
  
  const apiKey = await ApiKey.findOne({
    where: { key: hash }
  });
  
  if (!apiKey) return null;
  
  // Verificar status
  if (apiKey.status !== 'active') return null;
  
  // Verificar expiração
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    await apiKey.update({ status: 'expired' });
    return null;
  }
  
  return apiKey;
};

/**
 * Registra uso da chave
 */
ApiKey.prototype.recordUsage = async function(ip, endpoint, success = true) {
  const log = {
    timestamp: new Date(),
    ip,
    endpoint,
    success
  };
  
  const accessLog = this.accessLog || [];
  accessLog.unshift(log);
  
  await this.update({
    totalRequests: this.totalRequests + 1,
    lastUsedAt: new Date(),
    lastUsedIp: ip,
    accessLog: accessLog.slice(0, 50) // Manter últimos 50
  });
};

/**
 * Verifica se tem permissão
 */
ApiKey.prototype.hasPermission = function(permission) {
  if (!this.permissions || this.permissions.length === 0) return false;
  
  // Verificar permissão exata
  if (this.permissions.includes(permission)) return true;
  
  // Verificar wildcard (ex: tickets.* permite tickets.read, tickets.write, etc)
  const [resource, action] = permission.split('.');
  return this.permissions.includes(`${resource}.*`) || this.permissions.includes('*');
};

/**
 * Verifica rate limit
 */
ApiKey.prototype.checkRateLimit = async function() {
  // TODO: Implementar com Redis para melhor performance
  // Por enquanto, retorna true (permitido)
  return true;
};

/**
 * Revoga a chave
 */
ApiKey.prototype.revoke = async function(userId, reason) {
  await this.update({
    status: 'revoked',
    revokedBy: userId,
    revokedAt: new Date(),
    revokedReason: reason
  });
};

// Helper: Gera prefixo baseado no tipo
function generatePrefix(type) {
  const prefixes = {
    production: 'pk_live_',
    sandbox: 'pk_test_',
    webhook: 'whk_',
    integration: 'int_'
  };
  return prefixes[type] || 'pk_';
}

module.exports = ApiKey;


