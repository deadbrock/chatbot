const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Listas de Transmissão
 * Listas salvas de contatos para reutilização em transmissões
 */
const BroadcastList = sequelize.define('BroadcastList', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome da lista'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição da lista'
  },
  
  // Membros
  contacts: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de IDs de contatos'
  },
  
  totalContacts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de contatos na lista'
  },
  
  // Categorização
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Categoria da lista'
  },
  
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Tags da lista'
  },
  
  // Configurações
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Lista ativa'
  },
  
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Lista pública (visível para outros usuários)'
  },
  
  // Estatísticas de uso
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantas vezes foi usada'
  },
  
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última vez que foi usada'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Criado por (user ID)'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Atualizado por (user ID)'
  }
}, {
  tableName: 'broadcast_lists',
  timestamps: true,
  indexes: [
    { fields: ['name'] },
    { fields: ['category'] },
    { fields: ['isActive'] },
    { fields: ['createdBy'] }
  ]
});

module.exports = BroadcastList;

