const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Avaliações (NPS)
 * Armazena avaliações de clientes (0-10) para cálculo de NPS
 */
const Rating = sequelize.define('Rating', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticketId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID do ticket avaliado',
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID do usuário que avaliou (WhatsApp ID)',
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 10,
    },
    comment: 'Nota de 0 a 10',
  },
  category: {
    type: DataTypes.ENUM('detractor', 'neutral', 'promoter'),
    allowNull: false,
    comment: 'Categoria NPS: detrator (0-6), neutro (7-8), promotor (9-10)',
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Comentário opcional do cliente',
  },
  attendedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do atendente que foi avaliado',
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Departamento do atendimento',
  },
  responseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tempo de resposta em minutos',
  },
}, {
  tableName: 'ratings',
  timestamps: true,
  indexes: [
    { fields: ['ticketId'] },
    { fields: ['userId'] },
    { fields: ['attendedBy'] },
    { fields: ['category'] },
    { fields: ['createdAt'] },
  ],
});

/**
 * Categoriza a nota em detrator, neutro ou promotor
 */
Rating.categorizeScore = (score) => {
  if (score >= 0 && score <= 6) return 'detractor';
  if (score >= 7 && score <= 8) return 'neutral';
  if (score >= 9 && score <= 10) return 'promoter';
  throw new Error('Score must be between 0 and 10');
};

/**
 * Hook para definir a categoria automaticamente antes de criar
 */
Rating.beforeCreate((rating) => {
  rating.category = Rating.categorizeScore(rating.score);
});

/**
 * Hook para atualizar a categoria se o score mudar
 */
Rating.beforeUpdate((rating) => {
  if (rating.changed('score')) {
    rating.category = Rating.categorizeScore(rating.score);
  }
});

module.exports = Rating;

