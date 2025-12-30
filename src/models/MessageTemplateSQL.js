const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Template de Mensagem
 * Permite criar e reutilizar mensagens/respostas
 */
const MessageTemplate = sequelize.define('MessageTemplate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome identificador do template'
  },
  
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'general',
    comment: 'Categoria (greeting, closing, error, info, etc.)'
  },
  
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Conteúdo da mensagem (suporta variáveis {{var}})'
  },
  
  variables: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Lista de variáveis disponíveis [{name, description, default}]'
  },
  
  mediaType: {
    type: DataTypes.ENUM('text', 'image', 'document', 'video', 'audio'),
    defaultValue: 'text',
    comment: 'Tipo de mídia'
  },
  
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL da mídia (se não for texto)'
  },
  
  department: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Departamento associado'
  },
  
  language: {
    type: DataTypes.STRING,
    defaultValue: 'pt-BR',
    comment: 'Idioma do template'
  },
  
  status: {
    type: DataTypes.ENUM('active', 'draft', 'archived'),
    defaultValue: 'active',
    comment: 'Status do template'
  },
  
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Tags para organização'
  },
  
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID do usuário que criou'
  },
  
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID do último usuário que editou'
  },
  
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Metadados extras (uso, performance, etc.)'
  }
}, {
  tableName: 'message_templates',
  timestamps: true,
  indexes: [
    { fields: ['category'] },
    { fields: ['department'] },
    { fields: ['status'] },
    { fields: ['name'], unique: true }
  ]
});

/**
 * Métodos estáticos
 */

// Buscar templates ativos
MessageTemplate.getActiveTemplates = async function() {
  return await MessageTemplate.findAll({
    where: { status: 'active' },
    order: [['category', 'ASC'], ['name', 'ASC']]
  });
};

// Buscar por categoria
MessageTemplate.findByCategory = async function(category) {
  return await MessageTemplate.findAll({
    where: { 
      category,
      status: 'active'
    },
    order: [['name', 'ASC']]
  });
};

// Buscar por departamento
MessageTemplate.findByDepartment = async function(department) {
  return await MessageTemplate.findAll({
    where: { 
      department,
      status: 'active'
    }
  });
};

// Buscar por nome
MessageTemplate.findByName = async function(name) {
  return await MessageTemplate.findOne({
    where: { name, status: 'active' }
  });
};

/**
 * Métodos de instância
 */

// Renderizar template com variáveis
MessageTemplate.prototype.render = function(variables = {}) {
  let rendered = this.content;
  
  // Substituir variáveis no formato {{variavel}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, value || '');
  }
  
  // Remover variáveis não substituídas
  rendered = rendered.replace(/{{[^}]+}}/g, '');
  
  return rendered;
};

// Extrair variáveis do conteúdo
MessageTemplate.prototype.extractVariables = function() {
  const regex = /{{([^}]+)}}/g;
  const matches = [...this.content.matchAll(regex)];
  return matches.map(m => m[1].trim());
};

// Validar template
MessageTemplate.prototype.validate = function() {
  // Verificar se todas as variáveis declaradas estão no conteúdo
  const declaredVars = (this.variables || []).map(v => v.name);
  const usedVars = this.extractVariables();
  
  const missing = usedVars.filter(v => !declaredVars.includes(v));
  const unused = declaredVars.filter(v => !usedVars.includes(v));
  
  return {
    valid: missing.length === 0,
    missing,
    unused
  };
};

// Duplicar template
MessageTemplate.prototype.duplicate = async function(newName) {
  const duplicate = await MessageTemplate.create({
    name: newName || `${this.name} (cópia)`,
    category: this.category,
    content: this.content,
    variables: JSON.parse(JSON.stringify(this.variables)),
    mediaType: this.mediaType,
    mediaUrl: this.mediaUrl,
    department: this.department,
    language: this.language,
    status: 'draft',
    tags: JSON.parse(JSON.stringify(this.tags)),
    createdBy: this.createdBy
  });
  
  return duplicate;
};

// Incrementar contador de uso
MessageTemplate.prototype.incrementUsage = async function() {
  if (!this.metadata.usage) {
    this.metadata.usage = 0;
  }
  this.metadata.usage++;
  
  if (!this.metadata.lastUsed) {
    this.metadata.lastUsed = new Date();
  }
  this.metadata.lastUsed = new Date();
  
  return await this.save();
};

module.exports = MessageTemplate;

