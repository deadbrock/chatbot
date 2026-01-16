/**
 * Modelo para Logs de Classificação por IA
 * Armazena todas as classificações feitas pela IA para analytics
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AIClassificationLog = sequelize.define('AIClassificationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Dados do usuário
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  
  userName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Mensagem original
  userMessage: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  
  // Contexto da sessão
  sessionContext: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  
  // Resultado da classificação
  intent: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  
  targetFlow: {
    type: DataTypes.STRING,
    allowNull: false
  },
  
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  
  method: {
    type: DataTypes.ENUM('keywords', 'openai', 'claude', 'local'),
    allowNull: false,
    defaultValue: 'keywords'
  },
  
  // Dados adicionais
  matchedKeywords: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  reasoning: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Feedback (opcional - para melhorar a IA)
  wasCorrect: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: 'Se o usuário confirmou que a classificação estava correta'
  },
  
  userFeedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Métricas
  processingTimeMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tempo de processamento em milissegundos'
  },
  
  // Status
  used: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Se a classificação foi usada ou descartada por baixa confiança'
  }
  
}, {
  tableName: 'ai_classification_logs',
  timestamps: true,
  indexes: [
    { fields: ['phone'] },
    { fields: ['intent'] },
    { fields: ['method'] },
    { fields: ['createdAt'] },
    { fields: ['used'] }
  ]
});

// Métodos auxiliares
AIClassificationLog.getStatsByIntent = async function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { Op } = require('sequelize');
  
  const stats = await this.findAll({
    attributes: [
      'intent',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('confidence')), 'avgConfidence'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN used = 1 THEN 1 END')), 'usedCount']
    ],
    where: {
      createdAt: {
        [Op.gte]: startDate
      }
    },
    group: ['intent'],
    raw: true
  });
  
  return stats;
};

AIClassificationLog.getStatsByMethod = async function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { Op } = require('sequelize');
  
  const stats = await this.findAll({
    attributes: [
      'method',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('confidence')), 'avgConfidence'],
      [sequelize.fn('AVG', sequelize.col('processingTimeMs')), 'avgProcessingTime']
    ],
    where: {
      createdAt: {
        [Op.gte]: startDate
      }
    },
    group: ['method'],
    raw: true
  });
  
  return stats;
};

module.exports = AIClassificationLog;

