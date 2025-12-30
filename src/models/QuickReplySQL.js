const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Respostas Rápidas
 * Mensagens pré-configuradas com atalhos para agilizar atendimento
 */
const QuickReply = sequelize.define('QuickReply', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shortcut: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Atalho para a resposta (ex: /oi, /obrigado)',
    validate: {
      is: /^\/[a-z0-9-_]+$/i, // Deve começar com /
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Mensagem da resposta rápida (pode conter variáveis {{nome}})',
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Categoria para organização (ex: Saudação, Despedida, Informação)',
  },
  variables: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array de variáveis usadas na mensagem (ex: ["nome", "protocolo"])',
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL de mídia anexa (imagem, PDF, etc.)',
  },
  mediaType: {
    type: DataTypes.ENUM('image', 'video', 'audio', 'document'),
    allowNull: true,
    comment: 'Tipo de mídia anexa',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Se a resposta rápida está ativa',
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Contador de uso da resposta',
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que criou',
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que atualizou',
  },
}, {
  tableName: 'quick_replies',
  timestamps: true,
  indexes: [
    { fields: ['shortcut'], unique: true },
    { fields: ['category'] },
    { fields: ['isActive'] },
    { fields: ['usageCount'] },
  ],
});

/**
 * Extrai variáveis da mensagem
 * Exemplo: "Olá {{nome}}, seu protocolo é {{protocolo}}" => ["nome", "protocolo"]
 */
QuickReply.extractVariables = (message) => {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = [];
  let match;
  
  while ((match = regex.exec(message)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
};

/**
 * Substitui variáveis na mensagem
 * @param {string} message - Mensagem com variáveis
 * @param {Object} data - Objeto com valores das variáveis
 */
QuickReply.replaceVariables = (message, data = {}) => {
  let result = message;
  
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, data[key] || '');
  });
  
  return result;
};

/**
 * Hook para extrair variáveis automaticamente antes de salvar
 */
QuickReply.beforeSave((quickReply) => {
  if (quickReply.changed('message') || quickReply.isNewRecord) {
    quickReply.variables = QuickReply.extractVariables(quickReply.message);
  }
});

/**
 * Incrementa contador de uso
 */
QuickReply.prototype.incrementUsage = async function() {
  this.usageCount += 1;
  await this.save();
};

module.exports = QuickReply;

