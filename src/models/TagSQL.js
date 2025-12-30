const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Tags
 * Etiquetas para categorizar tickets
 */
const Tag = sequelize.define('Tag', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Nome da tag',
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Slug da tag (URL-friendly)',
  },
  color: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '#6c757d',
    comment: 'Cor da tag em hexadecimal',
    validate: {
      is: /^#[0-9A-F]{6}$/i
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição da tag',
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Ícone da tag (Bootstrap Icons)',
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Categoria da tag (ex: Status, Prioridade, Tipo)',
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Contador de uso da tag',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Se a tag está ativa',
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
  tableName: 'tags',
  timestamps: true,
  indexes: [
    { fields: ['name'], unique: true },
    { fields: ['slug'], unique: true },
    { fields: ['category'] },
    { fields: ['isActive'] },
    { fields: ['usageCount'] },
  ],
});

/**
 * Gera slug a partir do nome
 */
Tag.generateSlug = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-') // Substitui espaços por hífen
    .replace(/-+/g, '-'); // Remove hífens duplicados
};

/**
 * Hook para gerar slug automaticamente antes de criar
 */
Tag.beforeCreate((tag) => {
  if (!tag.slug) {
    tag.slug = Tag.generateSlug(tag.name);
  }
});

/**
 * Hook para atualizar slug se o nome mudar
 */
Tag.beforeUpdate((tag) => {
  if (tag.changed('name')) {
    tag.slug = Tag.generateSlug(tag.name);
  }
});

/**
 * Incrementa contador de uso
 */
Tag.prototype.incrementUsage = async function() {
  this.usageCount += 1;
  await this.save();
};

/**
 * Decrementa contador de uso
 */
Tag.prototype.decrementUsage = async function() {
  if (this.usageCount > 0) {
    this.usageCount -= 1;
    await this.save();
  }
};

module.exports = Tag;

