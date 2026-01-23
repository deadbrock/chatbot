const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Model de Configurações da IA
 * Armazena configurações globais da IA (contexto, temperatura, etc)
 */
const AIConfig = sequelize.define('AIConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Chave única da configuração (ex: system_prompt, temperature)'
  },
  
  value: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Valor da configuração'
  },
  
  type: {
    type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
    defaultValue: 'string',
    comment: 'Tipo de dado do valor'
  },
  
  category: {
    type: DataTypes.STRING,
    defaultValue: 'general',
    comment: 'Categoria da configuração (general, playground, bot, etc)'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição da configuração'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Se a configuração está ativa'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que atualizou por último'
  }
}, {
  tableName: 'ai_configs',
  timestamps: true,
  indexes: [
    { fields: ['key'], unique: true },
    { fields: ['category'] },
    { fields: ['isActive'] }
  ]
});

/**
 * Buscar configuração por chave
 */
AIConfig.getByKey = async function(key, defaultValue = null) {
  try {
    const config = await this.findOne({
      where: { key, isActive: true }
    });
    
    if (!config) {
      return defaultValue;
    }
    
    // Converter valor de acordo com o tipo
    switch (config.type) {
      case 'number':
        return parseFloat(config.value);
      case 'boolean':
        return config.value === 'true' || config.value === '1';
      case 'json':
        return JSON.parse(config.value);
      default:
        return config.value;
    }
  } catch (error) {
    console.error(`Erro ao buscar config ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Definir configuração
 */
AIConfig.setConfig = async function(key, value, options = {}) {
  try {
    const {
      type = 'string',
      category = 'general',
      description = null,
      updatedBy = null
    } = options;
    
    // Converter valor para string
    let stringValue = value;
    if (type === 'json') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }
    
    // Upsert (criar ou atualizar)
    const [config, created] = await this.findOrCreate({
      where: { key },
      defaults: {
        value: stringValue,
        type,
        category,
        description,
        updatedBy,
        isActive: true
      }
    });
    
    if (!created) {
      // Atualizar existente
      await config.update({
        value: stringValue,
        type,
        category,
        description,
        updatedBy
      });
    }
    
    return config;
  } catch (error) {
    console.error(`Erro ao salvar config ${key}:`, error);
    throw error;
  }
};

/**
 * Buscar todas as configurações de uma categoria
 */
AIConfig.getByCategory = async function(category) {
  try {
    const configs = await this.findAll({
      where: { category, isActive: true },
      order: [['key', 'ASC']]
    });
    
    const result = {};
    for (const config of configs) {
      const key = config.key;
      
      // Converter valor de acordo com o tipo
      switch (config.type) {
        case 'number':
          result[key] = parseFloat(config.value);
          break;
        case 'boolean':
          result[key] = config.value === 'true' || config.value === '1';
          break;
        case 'json':
          result[key] = JSON.parse(config.value);
          break;
        default:
          result[key] = config.value;
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Erro ao buscar configs da categoria ${category}:`, error);
    return {};
  }
};

module.exports = AIConfig;
